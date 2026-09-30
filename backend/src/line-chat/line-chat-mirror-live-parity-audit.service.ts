import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { configuredLineChatMirrorStoreCodes } from "./line-chat-mirror.service";

type LiveParityAggregateRow = {
  section: "LEGACY" | "LIVE" | "COVERAGE";
  direction: string | null;
  reconcileStatus: string;
  count: bigint | number;
  canonicalPresent: boolean;
  canonicalImported: boolean;
  canonicalDuplicate: boolean;
  storeChatsVisible: boolean;
  matchingWebhook: boolean;
  exactIdentity: boolean;
  replyStatus: string | null;
  followUpStatus: string | null;
  configuredStores: bigint | number | null;
  attachedStores: bigint | number | null;
  completedAfterWatermark: bigint | number | null;
};

type DirectionAudit = {
  total: number;
  resolved: number;
  unresolved: number;
  exactIdentityEvidence: number;
  matchingCanonicalWebhook: number;
  duplicates: number;
  failed: number;
  mappingGap: number;
  webhookGap: number;
  mirrorObserved: number;
  canonicalImported: number;
  canonicalDuplicate: number;
  storeChatsVisible: number;
  pending: number;
  waitingCanonical: number;
  unresolvedIdentity: number;
};

function emptyDirectionAudit(): DirectionAudit {
  return {
    total: 0,
    resolved: 0,
    unresolved: 0,
    exactIdentityEvidence: 0,
    matchingCanonicalWebhook: 0,
    duplicates: 0,
    failed: 0,
    mappingGap: 0,
    webhookGap: 0,
    mirrorObserved: 0,
    canonicalImported: 0,
    canonicalDuplicate: 0,
    storeChatsVisible: 0,
    pending: 0,
    waitingCanonical: 0,
    unresolvedIdentity: 0,
  };
}

function countOf(row: LiveParityAggregateRow): number {
  return typeof row.count === "bigint" ? Number(row.count) : row.count;
}

@Injectable()
export class LineChatMirrorLiveParityAuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  public async getReport(watermark: Date): Promise<{
    generatedAt: string;
    watermark: string;
    watermarkBasis: "Manager event sentAt; inclusive lower bound";
    legacyEvidenceDebt: { unmapped: number; waitingCanonical: number };
    postWatermarkLive: {
      storeCoverage: {
        configuredStores: number;
        attachedStores: number;
        completedAfterWatermark: number;
        pendingAfterWatermark: number;
      };
      inbound: DirectionAudit;
      outbound: DirectionAudit;
      unknownDirection: number;
      replyStates: Array<{ bmReplyStatus: string; followUpStatus: string; outboundEvents: number }>;
    };
  }> {
    if (!Number.isFinite(watermark.getTime()) || watermark.getTime() > Date.now()) {
      throw new Error("INVALID_LIVE_PARITY_WATERMARK");
    }
    const storeCodes = configuredLineChatMirrorStoreCodes();
    if (storeCodes.length === 0) throw new Error("LIVE_PARITY_AUDIT_FLEET_SCOPE_EMPTY");
    const storeCodeList = Prisma.join(storeCodes);

    const rows = await this.prisma.$queryRaw<LiveParityAggregateRow[]>(Prisma.sql`
      WITH active_fleet_oa AS (
        SELECT DISTINCT ON (state."storeCode")
          state."storeCode",
          state."lineOfficialAccountId"
        FROM "LineChatMirrorStoreState" AS state
        WHERE state."storeCode" IN (${storeCodeList})
          AND state."enabled" = true
        ORDER BY state."storeCode", state."lastStartedAt" DESC NULLS LAST
      ), latest_store_state AS (
        SELECT DISTINCT ON (state."storeCode")
          state."storeCode",
          state."lastSuccessfulSyncAt"
        FROM "LineChatMirrorStoreState" AS state
        WHERE state."storeCode" IN (${storeCodeList})
          AND state."enabled" = true
        ORDER BY state."storeCode", state."lastStartedAt" DESC NULLS LAST
      ), store_coverage AS (
        SELECT
          ${storeCodes.length}::bigint AS "configuredStores",
          COUNT(DISTINCT latest_store_state."storeCode")::bigint AS "attachedStores",
          COUNT(DISTINCT latest_store_state."storeCode") FILTER (
            WHERE latest_store_state."lastSuccessfulSyncAt" >= ${watermark}
          )::bigint AS "completedAfterWatermark"
        FROM latest_store_state
      ), live_classified AS (
        SELECT
          mirror."direction"::text AS direction,
          mirror."reconcileStatus"::text AS "reconcileStatus",
          (
            (linked_message."id" IS NOT NULL AND linked_conversation."id" IS NOT NULL)
            OR (exact_message."id" IS NOT NULL AND exact_conversation."id" IS NOT NULL)
          ) AS "canonicalPresent",
          (
            mirror."direction"::text = 'OUTBOUND'
            AND mirror."reconcileStatus"::text = 'IMPORTED'
            AND (
              (linked_message."id" IS NOT NULL AND linked_conversation."id" IS NOT NULL)
              OR (exact_message."id" IS NOT NULL AND exact_conversation."id" IS NOT NULL)
            )
          ) AS "canonicalImported",
          (
            mirror."reconcileStatus"::text = 'DUPLICATE'
            AND (
              (linked_message."id" IS NOT NULL AND linked_conversation."id" IS NOT NULL)
              OR (exact_message."id" IS NOT NULL AND exact_conversation."id" IS NOT NULL)
            )
          ) AS "canonicalDuplicate",
          (
            mirror."direction"::text = 'OUTBOUND'
            AND (
              (linked_message."id" IS NOT NULL AND linked_conversation."storeId" IS NOT NULL)
              OR (exact_message."id" IS NOT NULL AND exact_conversation."storeId" IS NOT NULL)
            )
          ) AS "storeChatsVisible",
          (
            mirror."direction"::text = 'INBOUND'
            AND exact_message."id" IS NOT NULL
            AND exact_conversation."id" IS NOT NULL
          ) AS "matchingWebhook",
          COALESCE(
            COALESCE(
              linked_conversation."lineChatUserId",
              exact_conversation."lineChatUserId",
              mapped_conversation."lineChatUserId"
            ) = mirror."lineChatUserId",
            false
          ) AS "exactIdentity",
          COALESCE(
            linked_conversation."bmReplyStatus"::text,
            exact_conversation."bmReplyStatus"::text,
            mapped_conversation."bmReplyStatus"::text
          ) AS "replyStatus",
          COALESCE(
            linked_conversation."followUpStatus"::text,
            exact_conversation."followUpStatus"::text,
            mapped_conversation."followUpStatus"::text
        ) AS "followUpStatus"
        FROM "LineChatMirrorMessage" AS mirror
        JOIN active_fleet_oa AS fleet
          ON fleet."lineOfficialAccountId" = mirror."lineOfficialAccountId"
        LEFT JOIN "Message" AS linked_message
          ON linked_message."id" = mirror."canonicalMessageId"
          AND linked_message."direction"::text = mirror."direction"::text
        LEFT JOIN "Conversation" AS linked_conversation
          ON linked_conversation."id" = linked_message."conversationId"
          AND linked_conversation."lineOfficialAccountId" = mirror."lineOfficialAccountId"
        LEFT JOIN "Message" AS exact_message
          ON (
            (
              mirror."direction"::text = 'OUTBOUND'
              AND exact_message."externalMessageId" IN (
                mirror."managerMessageId",
                'line-chat-manager:' || mirror."managerMessageId"
              )
            )
            OR (
              mirror."direction"::text <> 'OUTBOUND'
              AND exact_message."externalMessageId" = mirror."managerMessageId"
            )
          )
          AND exact_message."direction"::text = mirror."direction"::text
        LEFT JOIN "Conversation" AS exact_conversation
          ON exact_conversation."id" = exact_message."conversationId"
          AND exact_conversation."lineOfficialAccountId" = mirror."lineOfficialAccountId"
        LEFT JOIN "Conversation" AS mapped_conversation
          ON mapped_conversation."id" = mirror."canonicalConversationId"
          AND mapped_conversation."lineOfficialAccountId" = mirror."lineOfficialAccountId"
        WHERE mirror."sentAt" >= ${watermark}
          AND mirror."direction"::text IN ('INBOUND', 'OUTBOUND', 'UNKNOWN')
      ), live_groups AS (
        SELECT
          direction,
          "reconcileStatus",
          "canonicalPresent",
          "canonicalImported",
          "canonicalDuplicate",
          "storeChatsVisible",
          "matchingWebhook",
          "exactIdentity",
          "replyStatus",
          "followUpStatus",
          COUNT(*)::bigint AS count
        FROM live_classified
        GROUP BY
          direction,
          "reconcileStatus",
          "canonicalPresent",
          "canonicalImported",
          "canonicalDuplicate",
          "storeChatsVisible",
          "matchingWebhook",
          "exactIdentity",
          "replyStatus",
          "followUpStatus"
      ), legacy_groups AS (
        SELECT "reconcileStatus"::text AS "reconcileStatus", COUNT(*)::bigint AS count
        FROM "LineChatMirrorMessage" AS mirror
        JOIN active_fleet_oa AS fleet
          ON fleet."lineOfficialAccountId" = mirror."lineOfficialAccountId"
        WHERE "sentAt" < ${watermark}
          AND "reconcileStatus"::text IN ('UNMAPPED', 'WAITING_CANONICAL')
        GROUP BY "reconcileStatus"
      )
      SELECT
        'LEGACY'::text AS section,
        NULL::text AS direction,
        "reconcileStatus",
        count,
        false AS "canonicalPresent",
        false AS "canonicalImported",
        false AS "canonicalDuplicate",
        false AS "storeChatsVisible",
        false AS "matchingWebhook",
        false AS "exactIdentity",
        NULL::text AS "replyStatus",
        NULL::text AS "followUpStatus",
        NULL::bigint AS "configuredStores",
        NULL::bigint AS "attachedStores",
        NULL::bigint AS "completedAfterWatermark"
      FROM legacy_groups
      UNION ALL
      SELECT
        'LIVE'::text AS section,
        direction,
        "reconcileStatus",
        count,
        "canonicalPresent",
        "canonicalImported",
        "canonicalDuplicate",
        "storeChatsVisible",
        "matchingWebhook",
        "exactIdentity",
        "replyStatus",
        "followUpStatus",
        NULL::bigint AS "configuredStores",
        NULL::bigint AS "attachedStores",
        NULL::bigint AS "completedAfterWatermark"
      FROM live_groups
      UNION ALL
      SELECT
        'COVERAGE'::text AS section,
        NULL::text AS direction,
        'COVERAGE'::text AS "reconcileStatus",
        0::bigint AS count,
        false AS "canonicalPresent",
        false AS "canonicalImported",
        false AS "canonicalDuplicate",
        false AS "storeChatsVisible",
        false AS "matchingWebhook",
        false AS "exactIdentity",
        NULL::text AS "replyStatus",
        NULL::text AS "followUpStatus",
        "configuredStores",
        "attachedStores",
        "completedAfterWatermark"
      FROM store_coverage
    `);

    const legacyEvidenceDebt = { unmapped: 0, waitingCanonical: 0 };
    const storeCoverageCounts = { configuredStores: storeCodes.length, attachedStores: 0, completedAfterWatermark: 0 };
    const inbound = emptyDirectionAudit();
    const outbound = emptyDirectionAudit();
    let unknownDirection = 0;
    const replyStateCounts = new Map<string, { bmReplyStatus: string; followUpStatus: string; count: number }>();

    for (const row of rows) {
      const count = countOf(row);
      if (row.section === "COVERAGE") {
        storeCoverageCounts.configuredStores = Number(row.configuredStores ?? storeCodes.length);
        storeCoverageCounts.attachedStores = Number(row.attachedStores ?? 0);
        storeCoverageCounts.completedAfterWatermark = Number(row.completedAfterWatermark ?? 0);
        continue;
      }
      if (row.section === "LEGACY") {
        if (row.reconcileStatus === "UNMAPPED") legacyEvidenceDebt.unmapped += count;
        if (row.reconcileStatus === "WAITING_CANONICAL") legacyEvidenceDebt.waitingCanonical += count;
        continue;
      }

      if (row.direction === "UNKNOWN") {
        unknownDirection += count;
        continue;
      }
      const directionAudit = row.direction === "INBOUND" ? inbound : outbound;
      directionAudit.total += count;
      directionAudit.mirrorObserved += count;
      directionAudit.duplicates += row.reconcileStatus === "DUPLICATE" ? count : 0;
      directionAudit.failed += row.reconcileStatus === "FAILED" ? count : 0;
      directionAudit.mappingGap += row.exactIdentity ? 0 : count;
      directionAudit.exactIdentityEvidence += row.exactIdentity ? count : 0;

      if (row.direction === "INBOUND") {
        directionAudit.matchingCanonicalWebhook += row.matchingWebhook ? count : 0;
        directionAudit.resolved += row.matchingWebhook && row.exactIdentity ? count : 0;
        directionAudit.webhookGap += row.matchingWebhook ? 0 : count;
        directionAudit.waitingCanonical += row.reconcileStatus === "WAITING_CANONICAL" && !row.matchingWebhook
          ? count
          : 0;
        directionAudit.unresolvedIdentity += row.exactIdentity ? 0 : count;
      } else {
        directionAudit.canonicalImported += row.canonicalImported ? count : 0;
        directionAudit.canonicalDuplicate += row.canonicalDuplicate ? count : 0;
        directionAudit.storeChatsVisible += row.storeChatsVisible ? count : 0;
        directionAudit.pending += row.reconcileStatus === "PENDING" ? count : 0;
        directionAudit.resolved += (row.canonicalImported || row.canonicalDuplicate) && row.exactIdentity
          ? count
          : 0;
        if (row.canonicalPresent && row.replyStatus && row.followUpStatus) {
          const key = `${row.replyStatus}\u0000${row.followUpStatus}`;
          const prior = replyStateCounts.get(key);
          if (prior) prior.count += count;
          else replyStateCounts.set(key, {
            bmReplyStatus: row.replyStatus,
            followUpStatus: row.followUpStatus,
            count,
          });
        }
      }
      directionAudit.unresolved += row.direction === "INBOUND"
        ? (row.matchingWebhook && row.exactIdentity ? 0 : count)
        : ((row.canonicalImported || row.canonicalDuplicate) && row.exactIdentity ? 0 : count);
    }

    return {
      generatedAt: new Date().toISOString(),
      watermark: watermark.toISOString(),
      watermarkBasis: "Manager event sentAt; inclusive lower bound",
      legacyEvidenceDebt,
      postWatermarkLive: {
        storeCoverage: {
          configuredStores: storeCoverageCounts.configuredStores,
          attachedStores: storeCoverageCounts.attachedStores,
          completedAfterWatermark: storeCoverageCounts.completedAfterWatermark,
          pendingAfterWatermark: Math.max(
            0,
            storeCoverageCounts.configuredStores - storeCoverageCounts.completedAfterWatermark,
          ),
        },
        inbound,
        outbound,
        unknownDirection,
        replyStates: [...replyStateCounts.values()]
          .sort((left, right) => left.bmReplyStatus.localeCompare(right.bmReplyStatus)
            || left.followUpStatus.localeCompare(right.followUpStatus))
          .map((state) => ({
            bmReplyStatus: state.bmReplyStatus,
            followUpStatus: state.followUpStatus,
            outboundEvents: state.count,
          })),
      },
    };
  }
}
