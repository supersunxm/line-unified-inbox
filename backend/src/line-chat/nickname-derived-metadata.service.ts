import { Prisma, PrismaClient } from "@prisma/client";
import {
  buildNicknameV3ProductResolver,
  type NicknameParserV3Model,
} from "./nickname-parser-v3-products";
import {
  NICKNAME_PARSER_V3_RULE_VERSION,
  parseNicknameV3,
} from "./nickname-parser-v3.contract";
import {
  createManifest,
  equalValues,
  parserValuesToMetadata,
  sha256,
  type NicknameDerivedManifest,
  type NicknameDerivedManifestRow,
  type NicknameDerivedStateSnapshot,
  type NicknameDerivedValues,
} from "./nickname-derived-metadata.contract";

type RawAuditRow = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  nickname: string | null;
  observedAt: Date;
  latestAnyId: string;
  latestAnyReadStatus: string;
  profileKey: string | null;
  conversationCount: number;
  conversationId: string | null;
  conversationStoreId: string | null;
  conversationOaId: string | null;
  conversationChatId: string | null;
  storeIsActive: boolean | null;
  storeArchivedAt: Date | null;
  oaStoreId: string | null;
  oaIsActive: boolean | null;
  currentObservationId: string | null;
  currentParserVersion: string | null;
  currentObservedAt: Date | null;
  currentSource: string | null;
  currentCustomerType: string | null;
  currentProductModelId: string | null;
  currentProductName: string | null;
  currentPaymentMethod: string | null;
  currentFinanceProvider: string | null;
  currentService: string | null;
  currentPeriodYear: number | null;
  currentPeriodMonth: number | null;
  currentEventDate: Date | null;
  customerSalesStatus: string | null;
  filmBrand: string | null;
  onlineSource: string | null;
  operationalPaymentMethod: string | null;
  isInstallment: boolean;
  sourceChannels: string[];
  purchaseIntent: string | null;
  ownerUserId: string | null;
  bmReplyStatus: string;
  followUpStatus: string;
};

type ExactConversation = {
  id: string;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  customerSalesStatus: string | null;
  filmBrand: string | null;
  onlineSource: string | null;
  paymentMethod: string | null;
  isInstallment: boolean;
  sourceChannels: string[];
  purchaseIntent: string | null;
  ownerUserId: string | null;
  bmReplyStatus: string;
  followUpStatus: string;
  store: { isActive: boolean; archivedAt: Date | null } | null;
  lineOfficialAccount: { storeId: string; isActive: boolean };
};

type Resolver = ReturnType<typeof buildNicknameV3ProductResolver>["resolveProduct"];

export type NicknameDerivedReadiness = {
  totalIdentities: number;
  latestReadableIdentityRows: number;
  latestReadableIdentities: number;
  latestMissingOrUnreadableIdentities: number;
  deterministic: number;
  noTagSignal: number;
  ambiguousOrReview: number;
  identityConflict: number;
  stateConflict: number;
  staleObservation: number;
  unknown: number;
  unexplained: number;
  writeReadyRows: number;
  alreadyCorrect: number;
  held: number;
  stores: number;
  oas: number;
  profileA: number;
  profileB: number;
};

export type NicknameDerivedReadinessResult = {
  manifest: NicknameDerivedManifest;
  report: NicknameDerivedReadiness;
};

export type RowCheck = "WOULD_APPLY" | "ALREADY_CORRECT" | "STALE_OBSERVATION";
export type ReadbackReport = {
  checked: number;
  wrongConversation: number;
  wrongProduct: number;
  wrongCustomerType: number;
  wrongPayment: number;
  wrongFinance: number;
  wrongSource: number;
  wrongService: number;
  wrongPeriodDate: number;
  salesFieldChanges: number;
};

function toValues(row: {
  currentSource: string | null;
  currentCustomerType: string | null;
  currentProductModelId: string | null;
  currentProductName: string | null;
  currentPaymentMethod: string | null;
  currentFinanceProvider: string | null;
  currentService: string | null;
  currentPeriodYear: number | null;
  currentPeriodMonth: number | null;
  currentEventDate: Date | null;
}): NicknameDerivedValues {
  return {
    source: row.currentSource,
    customerType: row.currentCustomerType,
    productModelId: row.currentProductModelId,
    productName: row.currentProductName,
    paymentMethod: row.currentPaymentMethod,
    financeProvider: row.currentFinanceProvider,
    service: row.currentService,
    periodYear: row.currentPeriodYear,
    periodMonth: row.currentPeriodMonth,
    eventDate: row.currentEventDate?.toISOString().slice(0, 10) ?? null,
  };
}

function salesFieldsHash(conversation: ExactConversation): string {
  return sha256(JSON.stringify({
    customerSalesStatus: conversation.customerSalesStatus,
    filmBrand: conversation.filmBrand,
    onlineSource: conversation.onlineSource,
    paymentMethod: conversation.paymentMethod,
    isInstallment: conversation.isInstallment,
    sourceChannels: conversation.sourceChannels,
    purchaseIntent: conversation.purchaseIntent,
    ownerUserId: conversation.ownerUserId,
    bmReplyStatus: conversation.bmReplyStatus,
    followUpStatus: conversation.followUpStatus,
  }));
}

function rawSalesFieldsHash(row: RawAuditRow): string {
  return sha256(JSON.stringify({
    customerSalesStatus: row.customerSalesStatus,
    filmBrand: row.filmBrand,
    onlineSource: row.onlineSource,
    paymentMethod: row.operationalPaymentMethod,
    isInstallment: row.isInstallment,
    sourceChannels: row.sourceChannels,
    purchaseIntent: row.purchaseIntent,
    ownerUserId: row.ownerUserId,
    bmReplyStatus: row.bmReplyStatus,
    followUpStatus: row.followUpStatus,
  }));
}

function stateSnapshotFromRaw(row: RawAuditRow): NicknameDerivedStateSnapshot | null {
  if (!row.currentObservationId || !row.currentParserVersion || !row.currentObservedAt) return null;
  return {
    sourceObservationId: row.currentObservationId,
    parserVersion: row.currentParserVersion,
    observedAt: row.currentObservedAt.toISOString(),
    values: toValues(row),
  };
}

function snapshotValues(snapshot: NicknameDerivedStateSnapshot | null): string {
  return snapshot === null ? "null" : JSON.stringify(snapshot);
}

function validateDestination(row: {
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  conversationCount: number;
  conversationId: string | null;
  conversationStoreId: string | null;
  conversationOaId: string | null;
  conversationChatId: string | null;
  storeIsActive: boolean | null;
  storeArchivedAt: Date | null;
  oaStoreId: string | null;
  oaIsActive: boolean | null;
}): boolean {
  return row.conversationCount === 1 && row.conversationId !== null &&
    row.conversationStoreId === row.storeId && row.conversationOaId === row.lineOfficialAccountId &&
    row.conversationChatId === row.lineChatUserId && row.oaStoreId === row.storeId &&
    row.storeIsActive === true && row.storeArchivedAt === null && row.oaIsActive === true;
}

async function loadResolver(tx: Prisma.TransactionClient): Promise<{ resolveProduct: Resolver; models: Map<string, NicknameParserV3Model> }> {
  const [models, aliases] = await Promise.all([
    tx.productModel.findMany({ where: { isActive: true }, select: { id: true, name: true, classificationLevel: true } }),
    tx.productAlias.findMany({ where: { isActive: true }, select: { alias: true, source: true, productModel: { select: { id: true, name: true, isActive: true } } } }),
  ]);
  const resolver = buildNicknameV3ProductResolver(models, aliases);
  return { resolveProduct: resolver.resolveProduct, models: new Map(models.map((model) => [model.id, model])) };
}

async function latestIdentityCounts(tx: Prisma.TransactionClient): Promise<{ total: number; readable: number }> {
  const [counts] = await tx.$queryRaw<Array<{ total: bigint; readable: bigint }>>`
    SELECT
      (SELECT COUNT(*) FROM (SELECT DISTINCT "lineOfficialAccountId", "lineChatUserId" FROM "NicknameSourceObservation") identities)::bigint AS "total",
      (SELECT COUNT(*) FROM (
        SELECT DISTINCT "lineOfficialAccountId", "lineChatUserId"
        FROM "NicknameSourceObservation" WHERE "nicknameReadStatus" = 'READ'
      ) readable)::bigint AS "readable"
  `;
  return { total: Number(counts.total), readable: Number(counts.readable) };
}

async function latestReadableRows(tx: Prisma.TransactionClient): Promise<RawAuditRow[]> {
  return tx.$queryRaw<RawAuditRow[]>`
    WITH latest_any AS (
      SELECT DISTINCT ON ("lineOfficialAccountId", "lineChatUserId") *
      FROM "NicknameSourceObservation"
      ORDER BY "lineOfficialAccountId", "lineChatUserId", "observedAt" DESC, "id" DESC
    ), latest_read AS (
      SELECT DISTINCT ON ("lineOfficialAccountId", "lineChatUserId") *
      FROM "NicknameSourceObservation"
      WHERE "nicknameReadStatus" = 'READ'
      ORDER BY "lineOfficialAccountId", "lineChatUserId", "observedAt" DESC, "id" DESC
    )
    SELECT
      r."id", r."storeId", r."lineOfficialAccountId", r."lineChatUserId", r."nickname", r."observedAt",
      a."id" AS "latestAnyId", a."nicknameReadStatus" AS "latestAnyReadStatus",
      capture."profileKey",
      COUNT(c."id") OVER (PARTITION BY r."id")::int AS "conversationCount",
      c."id" AS "conversationId", c."storeId" AS "conversationStoreId",
      c."lineOfficialAccountId" AS "conversationOaId", c."lineChatUserId" AS "conversationChatId",
      s."isActive" AS "storeIsActive", s."archivedAt" AS "storeArchivedAt",
      oa."storeId" AS "oaStoreId", oa."isActive" AS "oaIsActive",
      state."sourceObservationId" AS "currentObservationId", state."parserVersion" AS "currentParserVersion",
      state."observedAt" AS "currentObservedAt", state."source" AS "currentSource",
      state."customerType" AS "currentCustomerType", state."productModelId" AS "currentProductModelId",
      product."name" AS "currentProductName", state."paymentMethod" AS "currentPaymentMethod",
      state."financeProvider" AS "currentFinanceProvider", state."service" AS "currentService",
      state."periodYear" AS "currentPeriodYear", state."periodMonth" AS "currentPeriodMonth",
      state."eventDate" AS "currentEventDate",
      c."customerSalesStatus"::text AS "customerSalesStatus", c."filmBrand", c."onlineSource",
      c."paymentMethod"::text AS "operationalPaymentMethod", c."isInstallment", c."sourceChannels"::text[] AS "sourceChannels",
      c."purchaseIntent"::text AS "purchaseIntent", c."ownerUserId",
      c."bmReplyStatus"::text AS "bmReplyStatus", c."followUpStatus"::text AS "followUpStatus"
    FROM latest_read r
    JOIN latest_any a ON a."lineOfficialAccountId" = r."lineOfficialAccountId" AND a."lineChatUserId" = r."lineChatUserId"
    LEFT JOIN "NicknameSourceCapture" capture ON capture."id" = r."batchId"
    LEFT JOIN "Conversation" c ON c."lineOfficialAccountId" = r."lineOfficialAccountId" AND c."lineChatUserId" = r."lineChatUserId"
    LEFT JOIN "Store" s ON s."id" = c."storeId"
    LEFT JOIN "LineOfficialAccount" oa ON oa."id" = c."lineOfficialAccountId"
    LEFT JOIN "NicknameDerivedMetadataState" state ON state."conversationId" = c."id"
    LEFT JOIN "ProductModel" product ON product."id" = state."productModelId"
    ORDER BY r."lineOfficialAccountId", r."lineChatUserId"
  `;
}

export class NicknameDerivedMetadataService {
  constructor(private readonly prisma: PrismaClient) {}

  async buildManifest(): Promise<NicknameDerivedReadinessResult> {
    const snapshot = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const [identityCounts, observations, resolver] = await Promise.all([
        latestIdentityCounts(tx),
        latestReadableRows(tx),
        loadResolver(tx),
      ]);
      return { identityCounts, observations, resolver };
    }, { timeout: 120_000, maxWait: 15_000 });

    const stats: NicknameDerivedReadiness = {
      totalIdentities: snapshot.identityCounts.total,
      latestReadableIdentityRows: 0,
      latestReadableIdentities: 0,
      latestMissingOrUnreadableIdentities: 0,
      deterministic: 0,
      noTagSignal: 0,
      ambiguousOrReview: 0,
      identityConflict: 0,
      stateConflict: 0,
      staleObservation: 0,
      unknown: 0,
      unexplained: 0,
      writeReadyRows: 0,
      alreadyCorrect: 0,
      held: 0,
      stores: 0,
      oas: 0,
      profileA: 0,
      profileB: 0,
    };
    const seenObservationIds = new Set<string>();
    const seenIdentities = new Set<string>();
    const stores = new Set<string>();
    const oas = new Set<string>();
    const rows: NicknameDerivedManifestRow[] = [];

    for (const observation of snapshot.observations) {
      if (seenObservationIds.has(observation.id)) continue;
      seenObservationIds.add(observation.id);
      stats.latestReadableIdentityRows++;
      const identity = `${observation.lineOfficialAccountId}:${observation.lineChatUserId}`;
      seenIdentities.add(identity);
      if (validateDestination(observation)) {
        stores.add(observation.storeId);
        oas.add(observation.lineOfficialAccountId);
      }
      if (observation.latestAnyId !== observation.id || observation.latestAnyReadStatus !== "READ") {
        stats.staleObservation++;
        continue;
      }
      stats.latestReadableIdentities++;
      if (observation.profileKey === "A") stats.profileA++;
      if (observation.profileKey === "B") stats.profileB++;
      if (!validateDestination(observation)) {
        stats.identityConflict++;
        continue;
      }
      const parsed = parseNicknameV3(observation.nickname, true, snapshot.resolver.resolveProduct);
      if (parsed.decision === "UNKNOWN") { stats.unknown++; continue; }
      if (parsed.decision === "NO_SIGNAL") { stats.noTagSignal++; continue; }
      if (parsed.decision === "REVIEW") { stats.ambiguousOrReview++; continue; }
      stats.deterministic++;
      const values = parserValuesToMetadata(parsed);
      if (values.productModelId && !snapshot.resolver.models.has(values.productModelId)) {
        stats.ambiguousOrReview++;
        stats.deterministic--;
        continue;
      }
      const expectedCurrentState = stateSnapshotFromRaw(observation);
      if (expectedCurrentState &&
          expectedCurrentState.sourceObservationId === observation.id &&
          expectedCurrentState.parserVersion === parsed.ruleVersion &&
          expectedCurrentState.observedAt === observation.observedAt.toISOString() &&
          equalValues(expectedCurrentState.values, values)) {
        stats.alreadyCorrect++;
        continue;
      }
      if (expectedCurrentState?.sourceObservationId === observation.id && !equalValues(expectedCurrentState.values, values)) {
        stats.stateConflict++;
        stats.deterministic--;
        continue;
      }
      rows.push({
        conversationId: observation.conversationId!,
        storeId: observation.storeId,
        lineOfficialAccountId: observation.lineOfficialAccountId,
        lineChatUserId: observation.lineChatUserId,
        sourceObservationId: observation.id,
        observedAt: observation.observedAt.toISOString(),
        nicknameSha256: sha256(observation.nickname ?? ""),
        parserVersion: parsed.ruleVersion,
        profileKey: observation.profileKey,
        values,
        expectedCurrentState,
        salesFieldsSha256: rawSalesFieldsHash(observation),
      });
    }

    stats.latestReadableIdentityRows = seenObservationIds.size;
    stats.latestMissingOrUnreadableIdentities = Math.max(0, stats.totalIdentities - stats.latestReadableIdentities);
    stats.writeReadyRows = rows.length;
    stats.held = stats.identityConflict + stats.stateConflict + stats.staleObservation + stats.unknown + stats.ambiguousOrReview;
    stats.unexplained = stats.latestReadableIdentityRows - (stats.deterministic + stats.noTagSignal +
      stats.ambiguousOrReview + stats.identityConflict + stats.stateConflict + stats.staleObservation + stats.unknown);
    // Any selected readable row must have exactly one explicit parser/identity disposition.
    if (stats.unexplained !== 0) throw new Error("NICKNAME_DERIVED_AUDIT_UNEXPLAINED_ROWS");
    stats.stores = stores.size;
    stats.oas = oas.size;
    const manifest = createManifest(rows, NICKNAME_PARSER_V3_RULE_VERSION);
    return { manifest, report: stats };
  }

  async dryRunRows(rows: readonly NicknameDerivedManifestRow[], manifestSha256: string): Promise<Record<RowCheck, number>> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const { resolveProduct } = await loadResolver(tx);
      const counts: Record<RowCheck, number> = { WOULD_APPLY: 0, ALREADY_CORRECT: 0, STALE_OBSERVATION: 0 };
      for (const row of rows) {
        const check = await this.checkRow(tx, row, resolveProduct, manifestSha256);
        counts[check]++;
      }
      return counts;
    }, { timeout: 120_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async applyBatch(rows: readonly NicknameDerivedManifestRow[], manifestSha256: string): Promise<{
    counts: Record<"APPLIED" | "ALREADY_CORRECT" | "STALE_OBSERVATION", number>;
    staleConversationIds: string[];
    appliedConversationIds: string[];
  }> {
    return this.prisma.$transaction(async (tx) => {
      const { resolveProduct, models } = await loadResolver(tx);
      const counts = { APPLIED: 0, ALREADY_CORRECT: 0, STALE_OBSERVATION: 0 };
      const staleConversationIds: string[] = [];
      const appliedConversationIds: string[] = [];
      for (const row of rows) {
        const check = await this.checkRow(tx, row, resolveProduct, manifestSha256);
        if (check === "STALE_OBSERVATION") { counts.STALE_OBSERVATION++; staleConversationIds.push(row.conversationId); continue; }
        if (check === "ALREADY_CORRECT") { counts.ALREADY_CORRECT++; continue; }
        if (row.values.productModelId && !models.has(row.values.productModelId)) {
          throw new Error("PRODUCT_MASTER_CHANGED_BEFORE_WRITE");
        }
        const previous = row.expectedCurrentState;
        await tx.nicknameDerivedMetadataState.upsert({
          where: { conversationId: row.conversationId },
          create: {
            conversationId: row.conversationId,
            sourceObservationId: row.sourceObservationId,
            parserVersion: row.parserVersion,
            observedAt: new Date(row.observedAt),
            provenance: "MANAGER_NICKNAME",
            ...this.databaseValues(row.values),
          },
          update: {
            sourceObservationId: row.sourceObservationId,
            parserVersion: row.parserVersion,
            observedAt: new Date(row.observedAt),
            appliedAt: new Date(),
            provenance: "MANAGER_NICKNAME",
            ...this.databaseValues(row.values),
          },
        });
        await tx.nicknameDerivedMetadataApplication.create({
          data: {
            conversationId: row.conversationId,
            sourceObservationId: row.sourceObservationId,
            parserVersion: row.parserVersion,
            manifestSha256,
            outcome: "APPLIED",
            previousValues: JSON.parse(JSON.stringify(previous)) as Prisma.InputJsonValue,
            resultingValues: JSON.parse(JSON.stringify({ sourceObservationId: row.sourceObservationId, parserVersion: row.parserVersion, observedAt: row.observedAt, values: row.values })) as Prisma.InputJsonValue,
          },
        });
        counts.APPLIED++;
        appliedConversationIds.push(row.conversationId);
      }
      return { counts, staleConversationIds, appliedConversationIds };
    }, { timeout: 120_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async verifyManifestReceipts(manifestSha256: string, expectedConversationIds: readonly string[]): Promise<{ receipts: number; outsideManifest: number }> {
    const receipts = await this.prisma.nicknameDerivedMetadataApplication.findMany({
      where: { manifestSha256 },
      select: { conversationId: true },
    });
    const expected = new Set(expectedConversationIds);
    return {
      receipts: receipts.length,
      outsideManifest: receipts.filter((receipt) => !expected.has(receipt.conversationId)).length,
    };
  }

  async verifyReadback(rows: readonly NicknameDerivedManifestRow[]): Promise<ReadbackReport> {
    const report: ReadbackReport = {
      checked: rows.length,
      wrongConversation: 0,
      wrongProduct: 0,
      wrongCustomerType: 0,
      wrongPayment: 0,
      wrongFinance: 0,
      wrongSource: 0,
      wrongService: 0,
      wrongPeriodDate: 0,
      salesFieldChanges: 0,
    };
    for (const row of rows) {
      const [state, conversation] = await Promise.all([
        this.prisma.nicknameDerivedMetadataState.findUnique({ where: { conversationId: row.conversationId }, include: { productModel: { select: { id: true, name: true } } } }),
        this.prisma.conversation.findUnique({ where: { id: row.conversationId }, include: { store: { select: { isActive: true, archivedAt: true } }, lineOfficialAccount: { select: { storeId: true, isActive: true } } } }),
      ]);
      const readback = state ? this.toSnapshot(state) : null;
      const values = readback?.values;
      if (!readback || readback.sourceObservationId !== row.sourceObservationId || readback.parserVersion !== row.parserVersion ||
          readback.observedAt !== row.observedAt) report.wrongConversation++;
      if (!values || values.productModelId !== row.values.productModelId || values.productName !== row.values.productName) report.wrongProduct++;
      if (!values || values.customerType !== row.values.customerType) report.wrongCustomerType++;
      if (!values || values.paymentMethod !== row.values.paymentMethod) report.wrongPayment++;
      if (!values || values.financeProvider !== row.values.financeProvider) report.wrongFinance++;
      if (!values || values.source !== row.values.source) report.wrongSource++;
      if (!values || values.service !== row.values.service) report.wrongService++;
      if (!values || values.periodYear !== row.values.periodYear || values.periodMonth !== row.values.periodMonth || values.eventDate !== row.values.eventDate) report.wrongPeriodDate++;
      if (!conversation || conversation.storeId !== row.storeId || conversation.lineOfficialAccountId !== row.lineOfficialAccountId ||
          conversation.lineChatUserId !== row.lineChatUserId || !conversation.store || !conversation.lineOfficialAccount ||
          conversation.store.isActive !== true || conversation.store.archivedAt !== null ||
          conversation.lineOfficialAccount.storeId !== row.storeId || conversation.lineOfficialAccount.isActive !== true ||
          salesFieldsHash(conversation as ExactConversation) !== row.salesFieldsSha256) {
        report.salesFieldChanges++;
      }
    }
    return report;
  }

  private async checkRow(
    tx: Prisma.TransactionClient,
    row: NicknameDerivedManifestRow,
    resolveProduct: Resolver,
    manifestSha256: string,
  ): Promise<RowCheck> {
    const [observation, latest, destinations] = await Promise.all([
      tx.nicknameSourceObservation.findUnique({ where: { id: row.sourceObservationId } }),
      tx.nicknameSourceObservation.findFirst({
        where: { lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId },
        orderBy: [{ observedAt: "desc" }, { id: "desc" }],
      }),
      tx.conversation.findMany({
        where: { lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId },
        include: { store: { select: { isActive: true, archivedAt: true } }, lineOfficialAccount: { select: { storeId: true, isActive: true } } },
      }),
    ]);
    if (!observation || !latest || latest.id !== row.sourceObservationId || observation.nicknameReadStatus !== "READ" ||
        observation.storeId !== row.storeId || observation.lineOfficialAccountId !== row.lineOfficialAccountId ||
        observation.lineChatUserId !== row.lineChatUserId || observation.observedAt.toISOString() !== row.observedAt ||
        sha256(observation.nickname ?? "") !== row.nicknameSha256) {
      return "STALE_OBSERVATION";
    }
    if (destinations.length !== 1) throw new Error("EXACT_CONVERSATION_IDENTITY_CONFLICT");
    const conversation = destinations[0] as ExactConversation;
    if (conversation.id !== row.conversationId || conversation.storeId !== row.storeId ||
        conversation.lineOfficialAccountId !== row.lineOfficialAccountId || conversation.lineChatUserId !== row.lineChatUserId ||
        conversation.lineOfficialAccount.storeId !== row.storeId || !conversation.lineOfficialAccount.isActive ||
        !conversation.store || !conversation.store.isActive || conversation.store.archivedAt !== null ||
        salesFieldsHash(conversation) !== row.salesFieldsSha256) {
      throw new Error("DESTINATION_OR_SALES_STATE_CHANGED");
    }
    const parsed = parseNicknameV3(observation.nickname, true, resolveProduct);
    if (parsed.decision !== "DETERMINISTIC" || parsed.ruleVersion !== row.parserVersion ||
        !equalValues(parserValuesToMetadata(parsed), row.values)) {
      throw new Error("PARSER_RESULT_CHANGED_SINCE_MANIFEST");
    }
    if (row.values.productModelId) {
      const product = await tx.productModel.findUnique({ where: { id: row.values.productModelId }, select: { id: true, name: true, isActive: true } });
      if (!product?.isActive || product.name !== row.values.productName) throw new Error("PRODUCT_MASTER_CHANGED_BEFORE_WRITE");
    }
    const current = await tx.nicknameDerivedMetadataState.findUnique({ where: { conversationId: row.conversationId }, include: { productModel: { select: { id: true, name: true } } } });
    if (current) {
      const currentSnapshot = this.toSnapshot(current);
      if (currentSnapshot.sourceObservationId === row.sourceObservationId &&
          currentSnapshot.parserVersion === row.parserVersion && currentSnapshot.observedAt === row.observedAt &&
          equalValues(currentSnapshot.values, row.values) && currentSnapshot.values.productName === row.values.productName) {
        return "ALREADY_CORRECT";
      }
    }
    const expected = row.expectedCurrentState;
    const currentSnapshot = current ? this.toSnapshot(current) : null;
    if (snapshotValues(currentSnapshot) !== snapshotValues(expected)) {
      const receipt = await tx.nicknameDerivedMetadataApplication.findUnique({
        where: { sourceObservationId_parserVersion: { sourceObservationId: row.sourceObservationId, parserVersion: row.parserVersion } },
      });
      if (receipt && currentSnapshot?.sourceObservationId === row.sourceObservationId && equalValues(currentSnapshot.values, row.values)) {
        return "ALREADY_CORRECT";
      }
      throw new Error("UNEXPECTED_CURRENT_STATE_CONFLICT");
    }
    // The manifest digest is consumed by the receipt; validating it here prevents accidental unbound writes.
    if (!/^[a-f0-9]{64}$/.test(manifestSha256)) throw new Error("INVALID_MANIFEST_SHA256");
    return "WOULD_APPLY";
  }

  private databaseValues(values: NicknameDerivedValues) {
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

  private toSnapshot(state: {
    sourceObservationId: string;
    parserVersion: string;
    observedAt: Date;
    source: string | null;
    customerType: string | null;
    productModelId: string | null;
    productModel?: { id: string; name: string } | null;
    paymentMethod: string | null;
    financeProvider: string | null;
    service: string | null;
    periodYear: number | null;
    periodMonth: number | null;
    eventDate: Date | null;
  }): NicknameDerivedStateSnapshot {
    return {
      sourceObservationId: state.sourceObservationId,
      parserVersion: state.parserVersion,
      observedAt: state.observedAt.toISOString(),
      values: {
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
      },
    };
  }
}
