import { Prisma } from "@prisma/client";
import {
  buildNicknameV3ProductResolver,
  type NicknameParserV3Model,
} from "./nickname-parser-v3-products";
import {
  NICKNAME_PARSER_V3_RULE_VERSION,
  parseNicknameV3,
} from "./nickname-parser-v3.contract";
import {
  parserValuesToMetadata,
  sha256,
  type NicknameDerivedStateSnapshot,
  type NicknameDerivedValues,
} from "./nickname-derived-metadata.contract";

type CapturedNicknameObservation = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  nickname: string | null;
  nicknameReadStatus: string;
  observedAt: Date;
};

type LatestNicknameIdentity = {
  id: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
};

export type NicknameDerivedSyncCounts = {
  observations: number;
  deterministicUpdates: number;
  noSignalClears: number;
  heldUnreadable: number;
  heldReview: number;
  identityConflicts: number;
  stale: number;
  duplicateReplays: number;
  unchangedSkips: number;
};

type ProductResolver = ReturnType<typeof buildNicknameV3ProductResolver>["resolveProduct"];
type DerivedState = Prisma.NicknameDerivedMetadataStateGetPayload<{
  include: { productModel: { select: { id: true; name: true } }; sourceObservation: { select: { id: true; storeId: true; lineOfficialAccountId: true; lineChatUserId: true; nickname: true; nicknameReadStatus: true } } };
}>;

function valuesFromState(state: DerivedState | null): NicknameDerivedValues | null {
  if (!state) return null;
  return {
    source: state.source,
    customerType: state.customerType,
    productModelId: state.productModelId,
    productName: state.productModel?.name ?? null,
    paymentMethod: state.paymentMethod,
    financeProvider: state.financeProvider,
    service: state.service,
    periodYear: state.periodYear,
    periodMonth: state.periodMonth,
    eventDate: state.eventDate?.toISOString().slice(0, 10) ?? null,
  };
}

function snapshotFromState(state: DerivedState | null): NicknameDerivedStateSnapshot | null {
  const values = valuesFromState(state);
  if (!state || !values) return null;
  return {
    sourceObservationId: state.sourceObservationId,
    parserVersion: state.parserVersion,
    observedAt: state.observedAt.toISOString(),
    values,
  };
}

function databaseValues(values: NicknameDerivedValues) {
  return {
    source: values.source,
    customerType: values.customerType,
    productModelId: values.productModelId,
    paymentMethod: values.paymentMethod,
    financeProvider: values.financeProvider,
    service: values.service,
    periodYear: values.periodYear,
    periodMonth: values.periodMonth,
    eventDate: values.eventDate ? new Date(`${values.eventDate}T00:00:00.000Z`) : null,
  };
}

function emptyValues(): NicknameDerivedValues {
  return {
    source: null,
    customerType: null,
    productModelId: null,
    productName: null,
    paymentMethod: null,
    financeProvider: null,
    service: null,
    periodYear: null,
    periodMonth: null,
    eventDate: null,
  };
}

async function loadProductResolver(tx: Prisma.TransactionClient): Promise<{
  resolveProduct: ProductResolver;
  models: Map<string, NicknameParserV3Model>;
}> {
  const [models, aliases] = await Promise.all([
    tx.productModel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, classificationLevel: true },
    }),
    tx.productAlias.findMany({
      where: { isActive: true },
      select: {
        alias: true,
        source: true,
        productModel: { select: { id: true, name: true, isActive: true } },
      },
    }),
  ]);
  return {
    resolveProduct: buildNicknameV3ProductResolver(models, aliases).resolveProduct,
    models: new Map(models.map((model) => [model.id, model])),
  };
}

function receiptHash(input: {
  observationId: string;
  parserVersion: string;
  outcome: "APPLIED";
  previous: NicknameDerivedStateSnapshot | null;
  resulting: NicknameDerivedStateSnapshot | null;
}): string {
  return sha256(JSON.stringify({ contract: "nickname-derived-continuous-v1", ...input }));
}

function identityKey(lineOfficialAccountId: string, lineChatUserId: string): string {
  return `${lineOfficialAccountId}\u0000${lineChatUserId}`;
}

/**
 * Applies the just-captured passive observations in the same transaction as
 * their immutable source rows. It performs database work only: no Manager,
 * browser, profile lease, conversation CRM field, or customer-name access.
 */
export async function synchronizeNicknameDerivedObservations(
  tx: Prisma.TransactionClient,
  observations: readonly CapturedNicknameObservation[],
): Promise<NicknameDerivedSyncCounts> {
  const counts: NicknameDerivedSyncCounts = {
    observations: observations.length,
    deterministicUpdates: 0,
    noSignalClears: 0,
    heldUnreadable: 0,
    heldReview: 0,
    identityConflicts: 0,
    stale: 0,
    duplicateReplays: 0,
    unchangedSkips: 0,
  };
  if (observations.length === 0) return counts;

  const readableCandidates = observations.filter((observation) =>
    observation.nicknameReadStatus === "READ" && observation.nickname?.trim(),
  );
  const { resolveProduct, models } = readableCandidates.length > 0
    ? await loadProductResolver(tx)
    : { resolveProduct: () => ({ kind: "NO_MATCH" as const }), models: new Map<string, NicknameParserV3Model>() };

  const identities = [...new Map(observations.map((observation) => [
    identityKey(observation.lineOfficialAccountId, observation.lineChatUserId), observation,
  ])).values()];
  const identityTuples = identities.map((observation) => Prisma.sql`(
    ${observation.lineOfficialAccountId}, ${observation.lineChatUserId}
  )`);
  const latestRows = await tx.$queryRaw<LatestNicknameIdentity[]>(Prisma.sql`
    SELECT DISTINCT ON ("lineOfficialAccountId", "lineChatUserId")
      "id", "lineOfficialAccountId", "lineChatUserId"
    FROM "NicknameSourceObservation"
    WHERE ("lineOfficialAccountId", "lineChatUserId") IN (${Prisma.join(identityTuples)})
    ORDER BY "lineOfficialAccountId", "lineChatUserId", "observedAt" DESC, "id" DESC
  `);
  const latestByIdentity = new Map(latestRows.map((row) => [
    identityKey(row.lineOfficialAccountId, row.lineChatUserId), row.id,
  ]));

  const destinationRows = await tx.conversation.findMany({
    where: { OR: identities.map((observation) => ({
      lineOfficialAccountId: observation.lineOfficialAccountId,
      lineChatUserId: observation.lineChatUserId,
    })) },
    include: {
      store: { select: { id: true, isActive: true, archivedAt: true } },
      lineOfficialAccount: { select: { id: true, storeId: true, isActive: true, archivedAt: true } },
    },
  });
  const destinationsByIdentity = new Map<string, typeof destinationRows>();
  for (const destination of destinationRows) {
    if (!destination.lineChatUserId) continue;
    const key = identityKey(destination.lineOfficialAccountId, destination.lineChatUserId);
    destinationsByIdentity.set(key, [...(destinationsByIdentity.get(key) ?? []), destination]);
  }
  const destinationIds = [...new Set(destinationRows.map((destination) => destination.id))];
  const observationIds = observations.map((observation) => observation.id);

  const [states, currentReceipts] = await Promise.all([
    destinationIds.length > 0
      ? tx.nicknameDerivedMetadataState.findMany({
          where: { conversationId: { in: destinationIds } },
          include: {
            productModel: { select: { id: true, name: true } },
            sourceObservation: { select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true, nickname: true, nicknameReadStatus: true } },
          },
        })
      : Promise.resolve([]),
    tx.nicknameDerivedMetadataApplication.findMany({
      where: {
        sourceObservationId: { in: observationIds },
        parserVersion: NICKNAME_PARSER_V3_RULE_VERSION,
      },
      select: { id: true, sourceObservationId: true },
    }),
  ]);
  const statesByConversationId = new Map(states.map((state) => [state.conversationId, state]));
  const receiptObservationIds = new Set(currentReceipts.map((receipt) => receipt.sourceObservationId));
  const noStateDestinationIds = destinationRows
    .filter((destination) => !statesByConversationId.has(destination.id))
    .map((destination) => destination.id);
  const previousReceipts = noStateDestinationIds.length > 0
    ? await tx.nicknameDerivedMetadataApplication.findMany({
        where: {
          conversationId: { in: noStateDestinationIds },
          sourceObservationId: { notIn: observationIds },
          parserVersion: NICKNAME_PARSER_V3_RULE_VERSION,
        },
        include: {
          sourceObservation: { select: {
            lineOfficialAccountId: true, lineChatUserId: true, nickname: true, nicknameReadStatus: true,
          } },
        },
        orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
      })
    : [];
  const previousReceiptByConversationId = new Map<string, (typeof previousReceipts)[number]>();
  for (const receipt of previousReceipts) {
    if (!previousReceiptByConversationId.has(receipt.conversationId)) {
      previousReceiptByConversationId.set(receipt.conversationId, receipt);
    }
  }
  const applicationWrites: Prisma.NicknameDerivedMetadataApplicationCreateManyInput[] = [];

  for (const observation of observations) {
    if (latestByIdentity.get(identityKey(observation.lineOfficialAccountId, observation.lineChatUserId)) !== observation.id) {
      counts.stale++;
      continue;
    }
    if (observation.nicknameReadStatus !== "READ" || !observation.nickname?.trim()) {
      counts.heldUnreadable++;
      continue;
    }

    const destinations = destinationsByIdentity.get(identityKey(observation.lineOfficialAccountId, observation.lineChatUserId)) ?? [];
    if (destinations.length !== 1) {
      counts.identityConflicts++;
      continue;
    }
    const destination = destinations[0];
    if (
      destination.storeId !== observation.storeId ||
      destination.lineOfficialAccountId !== observation.lineOfficialAccountId ||
      destination.lineChatUserId !== observation.lineChatUserId ||
      destination.lineOfficialAccount.id !== observation.lineOfficialAccountId ||
      destination.lineOfficialAccount.storeId !== observation.storeId ||
      !destination.lineOfficialAccount.isActive ||
      destination.lineOfficialAccount.archivedAt !== null ||
      destination.store?.id !== observation.storeId ||
      !destination.store.isActive ||
      destination.store.archivedAt !== null
    ) {
      counts.identityConflicts++;
      continue;
    }

    const state = statesByConversationId.get(destination.id) ?? null;
    if (state && (
      state.sourceObservation.storeId !== observation.storeId ||
      state.sourceObservation.lineOfficialAccountId !== observation.lineOfficialAccountId ||
      state.sourceObservation.lineChatUserId !== observation.lineChatUserId
    )) {
      counts.identityConflicts++;
      continue;
    }
    if (receiptObservationIds.has(observation.id)) {
      counts.duplicateReplays++;
      continue;
    }
    if (
      state?.parserVersion === NICKNAME_PARSER_V3_RULE_VERSION &&
      state.sourceObservation.nicknameReadStatus === "READ" &&
      state.sourceObservation.nickname === observation.nickname
    ) {
      counts.unchangedSkips++;
      continue;
    }
    if (!state) {
      const previousReceipt = previousReceiptByConversationId.get(destination.id);
      if (
        previousReceipt?.sourceObservation.nicknameReadStatus === "READ" &&
        previousReceipt.sourceObservation.lineOfficialAccountId === observation.lineOfficialAccountId &&
        previousReceipt.sourceObservation.lineChatUserId === observation.lineChatUserId &&
        previousReceipt.sourceObservation.nickname === observation.nickname &&
        previousReceipt.resultingValues === null
      ) {
        counts.unchangedSkips++;
        continue;
      }
    }

    let parsed;
    try {
      parsed = parseNicknameV3(observation.nickname, true, resolveProduct);
    } catch {
      counts.heldReview++;
      continue;
    }
    if (parsed.ruleVersion !== NICKNAME_PARSER_V3_RULE_VERSION || parsed.decision === "REVIEW") {
      counts.heldReview++;
      continue;
    }
    if (parsed.decision === "UNKNOWN") {
      counts.heldUnreadable++;
      continue;
    }

    const previous = snapshotFromState(state);
    const nextValues = parsed.decision === "NO_SIGNAL" ? emptyValues() : parserValuesToMetadata(parsed);
    if (nextValues.productModelId && !models.has(nextValues.productModelId)) {
      counts.heldReview++;
      continue;
    }
    const resulting: NicknameDerivedStateSnapshot | null = parsed.decision === "NO_SIGNAL"
      ? null
      : {
          sourceObservationId: observation.id,
          parserVersion: parsed.ruleVersion,
          observedAt: observation.observedAt.toISOString(),
          values: nextValues,
        };

    if (parsed.decision === "NO_SIGNAL") {
      await tx.nicknameDerivedMetadataState.deleteMany({ where: { conversationId: destination.id } });
      counts.noSignalClears++;
    } else {
      await tx.nicknameDerivedMetadataState.upsert({
        where: { conversationId: destination.id },
        create: {
          conversationId: destination.id,
          sourceObservationId: observation.id,
          parserVersion: parsed.ruleVersion,
          observedAt: observation.observedAt,
          provenance: "MANAGER_NICKNAME",
          ...databaseValues(nextValues),
        },
        update: {
          sourceObservationId: observation.id,
          parserVersion: parsed.ruleVersion,
          observedAt: observation.observedAt,
          appliedAt: new Date(),
          provenance: "MANAGER_NICKNAME",
          ...databaseValues(nextValues),
        },
      });
      counts.deterministicUpdates++;
    }

    applicationWrites.push({
      conversationId: destination.id,
      sourceObservationId: observation.id,
      parserVersion: parsed.ruleVersion,
      manifestSha256: receiptHash({
        observationId: observation.id,
        parserVersion: parsed.ruleVersion,
        outcome: "APPLIED",
        previous,
        resulting,
      }),
      outcome: "APPLIED",
      previousValues: previous === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(previous)) as Prisma.InputJsonValue,
      resultingValues: resulting === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(resulting)) as Prisma.InputJsonValue,
    });
  }
  if (applicationWrites.length > 0) {
    await tx.nicknameDerivedMetadataApplication.createMany({ data: applicationWrites });
  }
  return counts;
}
