import { PrismaClient } from "@prisma/client";
import {
  auditNicknameDateTokens,
  NICKNAME_PARSER_V3_RULE_VERSION,
  parseNicknameV3,
  type ParserV3Decision,
} from "./nickname-parser-v3.contract";
import {
  buildNicknameV3ProductResolver,
} from "./nickname-parser-v3-products";

type IdentityCounts = {
  totalIdentities: bigint;
  readableIdentities: bigint;
  totalObservations: bigint;
};

type LatestReadableObservation = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  nickname: string | null;
  nicknameReadStatus: string;
  observedAt: Date;
  parsedTag: string | null;
  ruleVersion: string;
  classification: string;
  profileKey: string | null;
};

const DECISIONS: readonly ParserV3Decision[] = ["DETERMINISTIC", "NO_SIGNAL", "REVIEW", "UNKNOWN"];

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) increment(counts, key(item));
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const report = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const [identityCounts] = await tx.$queryRaw<IdentityCounts[]>`
        SELECT
          (SELECT COUNT(*) FROM (
            SELECT DISTINCT "lineOfficialAccountId", "lineChatUserId"
            FROM "NicknameSourceObservation"
          ) identities)::bigint AS "totalIdentities",
          (SELECT COUNT(*) FROM (
            SELECT DISTINCT "lineOfficialAccountId", "lineChatUserId"
            FROM "NicknameSourceObservation"
            WHERE "nicknameReadStatus" = 'READ'
          ) readable)::bigint AS "readableIdentities",
          (SELECT COUNT(*) FROM "NicknameSourceObservation")::bigint AS "totalObservations"
      `;
      const observations = await tx.$queryRaw<LatestReadableObservation[]>`
        SELECT DISTINCT ON (observation."lineOfficialAccountId", observation."lineChatUserId")
          observation."id",
          observation."storeId",
          observation."lineOfficialAccountId",
          observation."lineChatUserId",
          observation."nickname",
          observation."nicknameReadStatus",
          observation."observedAt",
          observation."parsedTag",
          observation."ruleVersion",
          observation."classification",
          capture."profileKey"
        FROM "NicknameSourceObservation" observation
        JOIN "NicknameSourceCapture" capture ON capture."id" = observation."batchId"
        WHERE observation."nicknameReadStatus" = 'READ'
        ORDER BY observation."lineOfficialAccountId", observation."lineChatUserId",
          observation."observedAt" DESC, observation."id" DESC
      `;
      const models = await tx.productModel.findMany({
        where: { isActive: true },
        select: { id: true, name: true, classificationLevel: true },
      });
      const aliases = await tx.productAlias.findMany({
        where: { isActive: true },
        select: {
          alias: true,
          source: true,
          productModel: { select: { id: true, name: true, isActive: true } },
        },
      });

      if (Number(identityCounts.readableIdentities) !== observations.length) {
        throw new Error("LATEST_READABLE_IDENTITY_COUNT_MISMATCH");
      }

      return { identityCounts: { ...identityCounts, totalObservations: identityCounts.totalObservations }, observations, models, aliases };
    }, { timeout: 120_000, maxWait: 15_000 });

    const { aliasAudit, activeModelsById, resolveProduct } = buildNicknameV3ProductResolver(report.models, report.aliases);
    const decisions = new Map<ParserV3Decision, number>(DECISIONS.map((decision) => [decision, 0]));
    const fieldCounts = {
      source: new Map<string, number>(),
      customerType: new Map<string, number>(),
      financeProvider: new Map<string, number>(),
      paymentMethod: new Map<string, number>(),
      service: new Map<string, number>(),
    };
    const reviewReasons = new Map<string, number>();
    const dateShapes = new Map<string, { count: number; dispositions: Map<string, number>; yearConventions: Map<string, number> }>();
    const productMatches = new Map<string, number>();
    let emptyReadableNicknames = 0;
    let v2PersistedParsedTagMatches = 0;
    let v2PersistedParsedTagMismatches = 0;
    const v2RuleVersions = new Map<string, number>();

    for (const observation of report.observations) {
      const nickname = observation.nickname ?? "";
      if (nickname.trim() === "") emptyReadableNicknames++;
      const parsed = parseNicknameV3(observation.nickname, true, resolveProduct);
      decisions.set(parsed.decision, (decisions.get(parsed.decision) ?? 0) + 1);
      if (parsed.values.source) increment(fieldCounts.source, parsed.values.source);
      if (parsed.values.customerType) increment(fieldCounts.customerType, parsed.values.customerType);
      if (parsed.values.financeProvider) increment(fieldCounts.financeProvider, parsed.values.financeProvider);
      if (parsed.values.paymentMethod) increment(fieldCounts.paymentMethod, parsed.values.paymentMethod);
      if (parsed.values.service) increment(fieldCounts.service, parsed.values.service);
      if (parsed.values.product) increment(productMatches, parsed.values.product.name);
      for (const reason of parsed.holdReasons) increment(reviewReasons, reason);
      for (const date of auditNicknameDateTokens(nickname)) {
        const group = dateShapes.get(date.shape) ?? { count: 0, dispositions: new Map<string, number>(), yearConventions: new Map<string, number>() };
        group.count++;
        increment(group.dispositions, date.disposition);
        increment(group.yearConventions, date.yearConvention);
        dateShapes.set(date.shape, group);
      }
      increment(v2RuleVersions, observation.ruleVersion);
      if (observation.ruleVersion === "manager-source-v2") {
        const recomputedTag = parsed.legacySource.kind === "SIGNAL" ? parsed.legacySource.tag : null;
        if (recomputedTag === observation.parsedTag) v2PersistedParsedTagMatches++;
        else v2PersistedParsedTagMismatches++;
      }
    }

    const unknown = decisions.get("UNKNOWN") ?? 0;
    const classified = [...decisions.values()].reduce((sum, count) => sum + count, 0);
    const unexplained = report.observations.length - classified;
    const profileCounts = new Map<string, number>();
    for (const observation of report.observations) {
      const profile = observation.profileKey === "A" ? "PROFILE_A"
        : observation.profileKey === "B" ? "PROFILE_B" : "PROFILE_UNKNOWN";
      increment(profileCounts, profile);
    }
    const oas = new Set(report.observations.map(({ lineOfficialAccountId }) => lineOfficialAccountId));
    const stores = new Set(report.observations.map(({ storeId }) => storeId));
    const latestObservedAt = report.observations.reduce<Date | null>(
      (latest, observation) => latest === null || observation.observedAt > latest ? observation.observedAt : latest,
      null,
    );
    const topProducts = [...productMatches.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([product, count]) => ({ product, count }));
    const activeAliasesOnActiveModels = report.aliases.filter((alias) => alias.productModel.isActive).length;

    // Guard the report shape against any unclassified records before emitting aggregates.
    if (unknown < 0 || unexplained !== 0) throw new Error("PARSER_CLASSIFICATION_INCOMPLETE");

    console.log(JSON.stringify({
      mode: "READ_ONLY_PRODUCTION_SIMULATION",
      ruleVersion: NICKNAME_PARSER_V3_RULE_VERSION,
      corpus: {
        totalIdentities: Number(report.identityCounts.totalIdentities),
        latestReadableNicknameIdentities: report.observations.length,
        latestMissingNicknameIdentities: Number(report.identityCounts.totalIdentities - report.identityCounts.readableIdentities),
        readableRowsWithEmptyNickname: emptyReadableNicknames,
        totalPersistedObservations: Number(report.identityCounts.totalObservations),
        latestReadableObservationAt: latestObservedAt?.toISOString() ?? null,
        observedOAs: oas.size,
        observedStores: stores.size,
        profileCoverage: Object.fromEntries([...profileCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
        internalDestinationIdentityMatches: "NOT_EVALUATED_BY_PARSER_DRY_RUN",
      },
      simulation: {
        deterministic: decisions.get("DETERMINISTIC"),
        noSignal: decisions.get("NO_SIGNAL"),
        review: decisions.get("REVIEW"),
        unknown: decisions.get("UNKNOWN"),
        unexplained,
        fieldCandidates: Object.fromEntries(Object.entries(fieldCounts).map(([key, counts]) => [key, Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))])),
        reviewReasons: Object.fromEntries([...reviewReasons.entries()].sort(([a], [b]) => a.localeCompare(b))),
      },
      productMaster: {
        activeModels: report.models.length,
        modelsByClassificationLevel: countBy(report.models, ({ classificationLevel }) => classificationLevel),
        aliasAudit: {
          ...aliasAudit,
          activeAliasesOnActiveModels,
          totalAliasesOnInactiveModels: aliasAudit.aliasesOnInactiveModelsExcluded,
          uniqueProductIdsInResolver: activeModelsById.size,
        },
        nicknameProductMatchesByModel: topProducts,
        unresolvedProductOrFreeTextAmongSignaledNicknames: reviewReasons.get("UNRESOLVED_PRODUCT_OR_FREE_TEXT") ?? 0,
        ambiguousProductAliasNicknames: reviewReasons.get("PRODUCT_ALIAS_COLLISION") ?? 0,
      },
      dateNormalization: {
        totalNumericDateLikeTokens: [...dateShapes.values()].reduce((sum, entry) => sum + entry.count, 0),
        shapes: Object.fromEntries([...dateShapes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([shape, entry]) => [shape, {
          count: entry.count,
          dispositions: Object.fromEntries([...entry.dispositions.entries()].sort(([a], [b]) => a.localeCompare(b))),
          yearConventions: Object.fromEntries([...entry.yearConventions.entries()].sort(([a], [b]) => a.localeCompare(b))),
        }])),
      },
      managerSourceV2: {
        latestReadableObservationRuleVersions: Object.fromEntries([...v2RuleVersions.entries()].sort(([a], [b]) => a.localeCompare(b))),
        recomputedSourceFieldCounts: Object.fromEntries([...fieldCounts.source.entries()].sort(([a], [b]) => a.localeCompare(b))),
        persistedParsedTagMatchesOnV2Rows: v2PersistedParsedTagMatches,
        persistedParsedTagMismatchesOnV2Rows: v2PersistedParsedTagMismatches,
        v2ImplementationChanged: false,
      },
      emittedRawNicknames: false,
      emittedCustomerOrChatIds: false,
      emittedMessageContents: false,
      productionWrites: 0,
      managerRequests: 0,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UNKNOWN_ERROR";
  console.error(JSON.stringify({ mode: "READ_ONLY_PRODUCTION_SIMULATION", completed: false, error: errorName }));
  process.exitCode = 1;
});
