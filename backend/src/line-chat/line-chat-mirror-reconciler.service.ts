import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  ActivityActionType,
  BmReplyStatus,
  FollowUpStatus,
  LineAccountType,
  LineChatMirrorDirection,
  LineChatMirrorReconcileStatus,
  MembershipStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageType,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  AUTO_REPLY_BOT_DISPLAY_NAME,
  isAutomatedOutboundMessage,
} from "../conversation-reply-state";
import { isLineChatUserId } from "./line-chat-chat-discovery";
import { configuredLineChatMirrorStoreCodes } from "./line-chat-mirror.service";
import { selectLineChatStoreOa } from "./line-chat-store-oa-selector";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 1_000;
const FULL_FLEET_BATCH_THRESHOLD = 32;
const FULL_FLEET_MAX_BATCH_PER_STORE = 100;
const START_DELAY_MS = 15_000;
const IDENTITY_EVIDENCE_LIMIT = 100;
const MIN_IDENTITY_MATCHES = 3;
const INBOUND_MAPPING_EVIDENCE_LIMIT = 25;
const CONTENT_TIME_TOLERANCE_MS = 2_000;
const RETRY_ACTIVE_WINDOW_MS = 24 * 60 * 60_000;
const RETRY_MIN_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 6 * 60 * 60_000;

type MirrorRow = {
  id: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  managerMessageId: string;
  eventType: string;
  direction: LineChatMirrorDirection;
  messageType: string | null;
  text: string | null;
  fileName: string | null;
  bizId: string | null;
  ownerName: string | null;
  sentAt: Date;
};

type MappingResult =
  | {
      status: "MAPPED";
      conversationId: string;
      source: "DIRECT_LINE_CHAT_USER_ID" | "EXACT_INBOUND_MESSAGE_ID" | "VERIFIED_WEBHOOK_USER_ID";
    }
  | { status: "UNMAPPED"; reason: string }
  | { status: "AMBIGUOUS"; reason: string };

type IdentityEvidence = {
  verified: boolean;
  matches: number;
  mismatches: number;
  validPairs: number;
  invalidPairs: number;
};

export interface LineChatMirrorReconcileCycleResult {
  storeCode: string;
  apply: boolean;
  scanned: number;
  directMapped: number;
  messageIdMapped: number;
  identityMapped: number;
  identityEquivalenceVerified: boolean;
  identityEvidenceMatches: number;
  identityEvidenceMismatches: number;
  identityEvidenceValidPairs: number;
  identityEvidenceInvalidPairs: number;
  unmapped: number;
  unmappedReasons: Record<string, number>;
  ambiguous: number;
  ambiguousReasons: Record<string, number>;
  exactDuplicates: number;
  contentTimeDuplicates: number;
  waitingInboundCanonical: number;
  wouldImportOutbound: number;
  importedOutbound: number;
  autoResponses: number;
  staffAttributed: number;
  staffUnresolved: number;
  conversationsRecomputed: number;
  failed: number;
  durationMs: number;
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

export function isLineChatMirrorReconcileEnabled(): boolean {
  return process.env.LINE_CHAT_MIRROR_RECONCILE_ENABLED?.trim().toLowerCase() === "true";
}

export function isLineChatMirrorReconcileApplyEnabled(): boolean {
  return process.env.LINE_CHAT_MIRROR_RECONCILE_APPLY?.trim().toLowerCase() === "true";
}

function parseStoreCodeList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(
    raw
      .split(/[\s,;]+/u)
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

export function configuredLineChatMirrorReconcileStoreCodes(): string[] {
  // Canonical parity is part of Live Mirror, not a separate pilot scope.
  // Never allow the reconciler apply scope to be narrower than the active
  // Live Mirror fleet. Explicit reconcile codes remain additive for
  // operator recovery, but every configured Mirror store is always included.
  return [...new Set([
    ...configuredLineChatMirrorStoreCodes(),
    ...parseStoreCodeList(process.env.LINE_CHAT_MIRROR_RECONCILE_STORE_CODES),
  ])];
}

// Observation-only stores exclude the entire effective canonical apply scope.
export function configuredLineChatMirrorReconcileDryRunStoreCodes(): string[] {
  const primary = new Set(configuredLineChatMirrorReconcileStoreCodes());
  return parseStoreCodeList(process.env.LINE_CHAT_MIRROR_RECONCILE_DRY_RUN_STORE_CODES)
    .filter((storeCode) => !primary.has(storeCode));
}

export function lineChatMirrorReconcileSince(): Date | null {
  const raw = process.env.LINE_CHAT_MIRROR_RECONCILE_SINCE?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function lineChatMirrorReconcileBatchSize(): number {
  const raw = Number(process.env.LINE_CHAT_MIRROR_RECONCILE_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(raw)) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(raw)));
}

export function lineChatMirrorReconcileEffectiveBatchSize(storeCount: number): number {
  const configured = lineChatMirrorReconcileBatchSize();
  return storeCount > FULL_FLEET_BATCH_THRESHOLD
    ? Math.min(configured, FULL_FLEET_MAX_BATCH_PER_STORE)
    : configured;
}

export function lineChatMirrorReconcileIntervalMs(): number {
  const raw = Number(process.env.LINE_CHAT_MIRROR_RECONCILE_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(raw)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(raw));
}

export function mirrorCanonicalExternalId(managerMessageId: string): string {
  return `line-chat-manager:${managerMessageId}`;
}

export function managerResponderDisplayName(
  ownerName: string | null | undefined,
): string {
  return ownerName?.trim() || "LINE OA Manager Staff";
}

export function selectUniqueExactInboundConversationId(
  conversationIds: readonly string[],
):
  | { status: "NONE" }
  | { status: "UNIQUE"; conversationId: string }
  | { status: "AMBIGUOUS" } {
  const unique = [...new Set(conversationIds.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return { status: "NONE" };
  if (unique.length > 1) return { status: "AMBIGUOUS" };
  return { status: "UNIQUE", conversationId: unique[0] };
}

export function canonicalMessageTypeFromMirror(raw: string | null | undefined): MessageType {
  switch (raw?.trim().toLowerCase()) {
    case "text": return MessageType.TEXT;
    case "image": return MessageType.IMAGE;
    case "video": return MessageType.VIDEO;
    case "audio": return MessageType.AUDIO;
    case "file": return MessageType.FILE;
    case "location": return MessageType.LOCATION;
    case "sticker": return MessageType.STICKER;
    default: return MessageType.UNSUPPORTED;
  }
}

export function mirrorCanonicalText(input: {
  messageType: string | null;
  text: string | null;
  fileName: string | null;
}): string {
  if (typeof input.text === "string") return input.text;
  if (input.fileName) return input.fileName;
  switch (canonicalMessageTypeFromMirror(input.messageType)) {
    case MessageType.IMAGE: return "[Image]";
    case MessageType.VIDEO: return "[Video]";
    case MessageType.AUDIO: return "[Audio]";
    case MessageType.FILE: return "[File]";
    case MessageType.LOCATION: return "[Location]";
    case MessageType.STICKER: return "[Sticker]";
    default: return "";
  }
}

@Injectable()
export class LineChatMirrorReconcilerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatMirrorReconcilerService.name);
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === "test"
      || !isLineChatMirrorReconcileEnabled()
      || configuredLineChatMirrorReconcileStoreCodes().length === 0
    ) {
      return;
    }
    const since = lineChatMirrorReconcileSince();
    if (!since) {
      this.logger.error(JSON.stringify({
        event: "line_chat_mirror_reconciler_not_started",
        reason: "LINE_CHAT_MIRROR_RECONCILE_SINCE_REQUIRED",
      }));
      return;
    }

    const intervalMs = lineChatMirrorReconcileIntervalMs();
    const primaryStoreCodes = configuredLineChatMirrorReconcileStoreCodes();
    const dryRunStoreCodes = configuredLineChatMirrorReconcileDryRunStoreCodes();
    const effectiveBatchSize = lineChatMirrorReconcileEffectiveBatchSize(primaryStoreCodes.length);
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_reconciler_started",
      storeCount: primaryStoreCodes.length,
      apply: isLineChatMirrorReconcileApplyEnabled(),
      dryRunStoreCount: dryRunStoreCodes.length,
      since: since.toISOString(),
      configuredBatchSize: lineChatMirrorReconcileBatchSize(),
      effectiveBatchSize,
      batchSize: effectiveBatchSize,
      intervalMs,
      inboundPolicy: "WAIT_FOR_CANONICAL_WEBHOOK",
      outboundPolicy: "IMPORT_FROM_MANAGER_MIRROR",
      scopePolicy: "LIVE_MIRROR_FLEET_PLUS_EXPLICIT",
    }));
    this.startupTimer = setTimeout(() => void this.runCycle(), START_DELAY_MS);
    this.startupTimer.unref?.();
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.timer = null;
    this.startupTimer = null;
  }

  public async runCycle(): Promise<LineChatMirrorReconcileCycleResult[]> {
    if (this.running) return [];
    const since = lineChatMirrorReconcileSince();
    if (!since) return [];

    this.running = true;
    try {
      const results: LineChatMirrorReconcileCycleResult[] = [];
      const primaryStoreCodes = configuredLineChatMirrorReconcileStoreCodes();
      const effectiveBatchSize = lineChatMirrorReconcileEffectiveBatchSize(primaryStoreCodes.length);
      const scopes = [
        ...primaryStoreCodes.map((storeCode) => ({
          storeCode,
          apply: isLineChatMirrorReconcileApplyEnabled(),
        })),
        ...configuredLineChatMirrorReconcileDryRunStoreCodes().map((storeCode) => ({
          storeCode,
          apply: false,
        })),
      ];
      for (const scope of scopes) {
        try {
          results.push(await this.reconcileStore(
            scope.storeCode,
            since,
            scope.apply,
            effectiveBatchSize,
          ));
        } catch (error) {
          this.logger.error(JSON.stringify({
            event: "line_chat_mirror_reconcile_store_failed",
            storeCode: scope.storeCode,
            apply: scope.apply,
            error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          }));
        }
      }
      return results;
    } finally {
      this.running = false;
    }
  }

  private async reconcileStore(
    storeCode: string,
    since: Date,
    apply: boolean,
    batchSize: number = lineChatMirrorReconcileBatchSize(),
  ): Promise<LineChatMirrorReconcileCycleResult> {
    const startedAt = Date.now();
    const store = await this.prisma.store.findFirst({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { code: storeCode },
          { storeMaster: { externalStoreId: storeCode } },
        ],
      },
      select: {
        id: true,
        code: true,
        storeMaster: {
          select: {
            externalStoreId: true,
            accountName: true,
            normalizedAccountName: true,
            lineId: true,
          },
        },
        lineOfficialAccounts: {
          where: {
            accountType: LineAccountType.STORE,
            isActive: true,
            archivedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, basicId: true },
        },
      },
    });
    if (!store) throw new Error("RECONCILE_STORE_NOT_FOUND");

    const oaSelection = selectLineChatStoreOa(
      store.storeMaster,
      store.lineOfficialAccounts.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        basicId: candidate.basicId,
      })),
    );
    if (!oaSelection.ok) {
      throw new Error(`RECONCILE_OA_IDENTITY_${oaSelection.reason}`);
    }
    const oa = store.lineOfficialAccounts.find((candidate) => candidate.id === oaSelection.oaId);
    if (!oa) throw new Error("RECONCILE_SELECTED_OA_NOT_FOUND");

    const effectiveStoreCode = store.code?.trim()
      || store.storeMaster?.externalStoreId?.trim()
      || storeCode;
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_reconcile_oa_selected",
      storeCode: effectiveStoreCode,
      storeMasterAccountName: store.storeMaster?.accountName ?? null,
      storeMasterLineId: store.storeMaster?.lineId ?? null,
      lineOfficialAccountId: oa.id,
      lineOfficialAccountName: oa.name,
      selectionSource: oaSelection.source,
    }));
    const rowSelect = {
      id: true,
      lineOfficialAccountId: true,
      lineChatUserId: true,
      managerMessageId: true,
      eventType: true,
      direction: true,
      messageType: true,
      text: true,
      fileName: true,
      bizId: true,
      ownerName: true,
      sentAt: true,
    } as const;

    // Drain new Manager replies first. This prevents inbound rows waiting for
    // webhook canonicalization from repeatedly occupying the whole batch and
    // starving outbound replies that Store Chats must surface.
    const pendingOutbound = await this.prisma.lineChatMirrorMessage.findMany({
      where: {
        lineOfficialAccountId: oa.id,
        sentAt: { gte: since },
        reconcileStatus: LineChatMirrorReconcileStatus.PENDING,
        direction: LineChatMirrorDirection.OUTBOUND,
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: batchSize,
      select: rowSelect,
    }) as MirrorRow[];

    const remainingAfterOutbound = Math.max(0, batchSize - pendingOutbound.length);
    const pendingOther = remainingAfterOutbound > 0
      ? await this.prisma.lineChatMirrorMessage.findMany({
          where: {
            lineOfficialAccountId: oa.id,
            sentAt: { gte: since },
            reconcileStatus: LineChatMirrorReconcileStatus.PENDING,
            direction: { not: LineChatMirrorDirection.OUTBOUND },
          },
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
          take: remainingAfterOutbound,
          select: rowSelect,
        }) as MirrorRow[]
      : [];

    const remainingAfterPending = Math.max(
      0,
      batchSize - pendingOutbound.length - pendingOther.length,
    );
    const retryNow = Date.now();
    const retryRows = remainingAfterPending > 0
      ? await this.prisma.lineChatMirrorMessage.findMany({
          where: {
            lineOfficialAccountId: oa.id,
            sentAt: { gte: since },
            OR: [
              { sentAt: { gte: new Date(retryNow - RETRY_ACTIVE_WINDOW_MS) } },
              { reconcileAttempts: { lt: RETRY_MIN_ATTEMPTS } },
              { updatedAt: { lte: new Date(retryNow - RETRY_BACKOFF_MS) } },
            ],
            reconcileStatus: {
              in: [
                LineChatMirrorReconcileStatus.WAITING_CANONICAL,
                LineChatMirrorReconcileStatus.UNMAPPED,
                LineChatMirrorReconcileStatus.AMBIGUOUS,
                LineChatMirrorReconcileStatus.FAILED,
              ],
            },
          },
          orderBy: [{ updatedAt: "asc" }, { sentAt: "desc" }, { id: "desc" }],
          take: remainingAfterPending,
          select: rowSelect,
        }) as MirrorRow[]
      : [];

    const rows = [...pendingOutbound, ...pendingOther, ...retryRows];

    const result: LineChatMirrorReconcileCycleResult = {
      storeCode: effectiveStoreCode,
      apply,
      scanned: rows.length,
      directMapped: 0,
      messageIdMapped: 0,
      identityMapped: 0,
      identityEquivalenceVerified: false,
      identityEvidenceMatches: 0,
      identityEvidenceMismatches: 0,
      identityEvidenceValidPairs: 0,
      identityEvidenceInvalidPairs: 0,
      unmapped: 0,
      unmappedReasons: {},
      ambiguous: 0,
      ambiguousReasons: {},
      exactDuplicates: 0,
      contentTimeDuplicates: 0,
      waitingInboundCanonical: 0,
      wouldImportOutbound: 0,
      importedOutbound: 0,
      autoResponses: 0,
      staffAttributed: 0,
      staffUnresolved: 0,
      conversationsRecomputed: 0,
      failed: 0,
      durationMs: 0,
    };

    if (rows.length === 0) {
      result.durationMs = Date.now() - startedAt;
      this.logStoreResult(result, since);
      return result;
    }

    const identityEvidence = await this.identityEvidence(oa.id);
    result.identityEquivalenceVerified = identityEvidence.verified;
    result.identityEvidenceMatches = identityEvidence.matches;
    result.identityEvidenceMismatches = identityEvidence.mismatches;
    result.identityEvidenceValidPairs = identityEvidence.validPairs;
    result.identityEvidenceInvalidPairs = identityEvidence.invalidPairs;
    const mappingCache = new Map<string, MappingResult>();
    const ownerCache = new Map<string, { id: string; displayName: string } | null>();
    const touchedConversationIds = new Set<string>();
    const importedOutboundEvidence: Array<{
      conversationId: string;
      conversationKey: string;
      managerMessageAt: string;
      canonicalImportAt: string;
    }> = [];

    for (const row of rows) {
      try {
        let mapping = mappingCache.get(row.lineChatUserId);
        if (!mapping) {
          mapping = await this.resolveConversation({
            lineOfficialAccountId: oa.id,
            storeId: store.id,
            lineChatUserId: row.lineChatUserId,
            identityEquivalent: identityEvidence.verified,
            apply,
          });
          mappingCache.set(row.lineChatUserId, mapping);
        }

        if (mapping.status === "UNMAPPED") {
          result.unmapped += 1;
          result.unmappedReasons[mapping.reason] = (result.unmappedReasons[mapping.reason] ?? 0) + 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.UNMAPPED,
            error: mapping.reason,
          }, apply);
          continue;
        }
        if (mapping.status === "AMBIGUOUS") {
          result.ambiguous += 1;
          result.ambiguousReasons[mapping.reason] = (result.ambiguousReasons[mapping.reason] ?? 0) + 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.AMBIGUOUS,
            error: mapping.reason,
          }, apply);
          continue;
        }

        if (mapping.source === "DIRECT_LINE_CHAT_USER_ID") result.directMapped += 1;
        else if (mapping.source === "EXACT_INBOUND_MESSAGE_ID") result.messageIdMapped += 1;
        else result.identityMapped += 1;

        if (row.direction === LineChatMirrorDirection.UNKNOWN) {
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.SKIPPED,
            conversationId: mapping.conversationId,
            source: "UNKNOWN_DIRECTION",
            error: "Mirror direction is unknown; canonical write skipped.",
          }, apply);
          continue;
        }

        const exact = await this.findExactCanonical(row.managerMessageId);
        if (exact) {
          if (exact.conversationId !== mapping.conversationId) {
            result.failed += 1;
            await this.markMirror(row.id, {
              status: LineChatMirrorReconcileStatus.FAILED,
              conversationId: mapping.conversationId,
              messageId: exact.id,
              source: "EXACT_EXTERNAL_ID_CONFLICT",
              error: "Manager message ID already belongs to a different canonical conversation.",
            }, apply);
            continue;
          }
          result.exactDuplicates += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.DUPLICATE,
            conversationId: mapping.conversationId,
            messageId: exact.id,
            source: "EXACT_EXTERNAL_ID",
          }, apply);
          if (row.direction === LineChatMirrorDirection.OUTBOUND) {
            touchedConversationIds.add(mapping.conversationId);
          }
          continue;
        }

        const contentTime = await this.findContentTimeDuplicate(mapping.conversationId, row);
        if (contentTime.length === 1) {
          result.contentTimeDuplicates += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.DUPLICATE,
            conversationId: mapping.conversationId,
            messageId: contentTime[0].id,
            source: "CONTENT_TIME_MATCH",
          }, apply);
          if (row.direction === LineChatMirrorDirection.OUTBOUND) {
            touchedConversationIds.add(mapping.conversationId);
          }
          continue;
        }
        if (contentTime.length > 1) {
          result.ambiguous += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.AMBIGUOUS,
            conversationId: mapping.conversationId,
            source: "CONTENT_TIME_AMBIGUOUS",
            error: `${contentTime.length} canonical messages match content/time window.`,
          }, apply);
          continue;
        }

        if (row.direction === LineChatMirrorDirection.INBOUND) {
          result.waitingInboundCanonical += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.WAITING_CANONICAL,
            conversationId: mapping.conversationId,
            source: "WAIT_FOR_WEBHOOK",
            error: "Inbound Manager message has no canonical webhook message yet.",
          }, apply);
          continue;
        }

        result.wouldImportOutbound += 1;
        const automated = row.bizId === "__AUTO_RESPONSE";
        if (automated) result.autoResponses += 1;

        let attributedUser: { id: string; displayName: string } | null = null;
        if (!automated && row.ownerName?.trim()) {
          const ownerKey = row.ownerName.trim();
          if (ownerCache.has(ownerKey)) {
            attributedUser = ownerCache.get(ownerKey) ?? null;
          } else {
            attributedUser = await this.resolveStoreUser(store.id, ownerKey);
            ownerCache.set(ownerKey, attributedUser);
          }
          if (attributedUser) result.staffAttributed += 1;
          else result.staffUnresolved += 1;
        } else if (!automated) {
          result.staffUnresolved += 1;
        }

        if (!apply) continue;

        const imported = await this.importOutbound({
          conversationId: mapping.conversationId,
          row,
          attributedUser,
          automated,
        });
        result.importedOutbound += imported.created ? 1 : 0;
        if (!imported.created) result.exactDuplicates += 1;
        touchedConversationIds.add(mapping.conversationId);
        if (imported.created) {
          importedOutboundEvidence.push({
            conversationId: mapping.conversationId,
            conversationKey: createHash("sha256")
              .update(`${oa.id}:${row.lineChatUserId}`)
              .digest("hex"),
            managerMessageAt: row.sentAt.toISOString(),
            canonicalImportAt: new Date().toISOString(),
          });
        }
        await this.markMirror(row.id, {
          status: imported.created
            ? LineChatMirrorReconcileStatus.IMPORTED
            : LineChatMirrorReconcileStatus.DUPLICATE,
          conversationId: mapping.conversationId,
          messageId: imported.messageId,
          source: imported.created ? "IMPORTED_OUTBOUND" : "IMPORT_RACE_DUPLICATE",
        }, true);
      } catch (error) {
        result.failed += 1;
        await this.markMirror(row.id, {
          status: LineChatMirrorReconcileStatus.FAILED,
          error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        }, apply).catch(() => {});
      }
    }

    if (apply) {
      for (const conversationId of touchedConversationIds) {
        if (await this.recomputeConversationState(conversationId)) {
          result.conversationsRecomputed += 1;
        }
      }
    }

    for (const evidence of importedOutboundEvidence) {
      const state = await this.prisma.conversation.findUnique({
        where: { id: evidence.conversationId },
        select: { bmReplyStatus: true, followUpStatus: true },
      });
      this.logger.log(JSON.stringify({
        event: "line_chat_mirror_manager_outbound_canonicalized",
        storeCode: effectiveStoreCode,
        conversationKey: evidence.conversationKey,
        managerMessageAt: evidence.managerMessageAt,
        canonicalImportAt: evidence.canonicalImportAt,
        resultingReplyState: state?.bmReplyStatus ?? null,
        resultingFollowUpState: state?.followUpStatus ?? null,
      }));
    }

    result.durationMs = Date.now() - startedAt;
    this.logStoreResult(result, since);
    return result;
  }

  private async identityEvidence(lineOfficialAccountId: string): Promise<IdentityEvidence> {
    const evidence = await this.prisma.conversation.findMany({
      where: {
        lineOfficialAccountId,
        lineChatUserId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: IDENTITY_EVIDENCE_LIMIT,
      select: {
        lineChatUserId: true,
        customer: { select: { lineUserId: true } },
      },
    });

    let matches = 0;
    let mismatches = 0;
    let validPairs = 0;
    let invalidPairs = 0;
    for (const row of evidence) {
      const managerId = row.lineChatUserId?.trim() || "";
      const webhookId = row.customer.lineUserId?.trim() || "";
      if (!isLineChatUserId(managerId) || !isLineChatUserId(webhookId)) {
        invalidPairs += 1;
        continue;
      }
      validPairs += 1;
      if (managerId === webhookId) matches += 1;
      else mismatches += 1;
    }
    return {
      verified: matches >= MIN_IDENTITY_MATCHES && mismatches === 0,
      matches,
      mismatches,
      validPairs,
      invalidPairs,
    };
  }

  private async resolveConversation(input: {
    lineOfficialAccountId: string;
    storeId: string;
    lineChatUserId: string;
    identityEquivalent: boolean;
    apply: boolean;
  }): Promise<MappingResult> {
    const direct = await this.prisma.conversation.findMany({
      where: {
        lineOfficialAccountId: input.lineOfficialAccountId,
        lineChatUserId: input.lineChatUserId,
      },
      orderBy: [{ latestMessageAt: "desc" }, { id: "asc" }],
      take: 3,
      select: { id: true },
    });
    if (direct.length === 1) {
      return {
        status: "MAPPED",
        conversationId: direct[0].id,
        source: "DIRECT_LINE_CHAT_USER_ID",
      };
    }
    if (direct.length > 1) {
      return { status: "AMBIGUOUS", reason: "MULTIPLE_DIRECT_LINE_CHAT_USER_ID_CONVERSATIONS" };
    }

    const exactInboundMapping = await this.resolveByExactInboundMessageEvidence(input);
    if (exactInboundMapping) return exactInboundMapping;

    if (!input.identityEquivalent) {
      return { status: "UNMAPPED", reason: "WEBHOOK_MANAGER_USER_ID_EQUIVALENCE_NOT_VERIFIED" };
    }

    const candidates = await this.prisma.conversation.findMany({
      where: {
        lineOfficialAccountId: input.lineOfficialAccountId,
        storeId: input.storeId,
        customer: { lineUserId: input.lineChatUserId },
      },
      orderBy: [{ latestMessageAt: "desc" }, { id: "asc" }],
      take: 3,
      select: { id: true, lineChatUserId: true },
    });
    if (candidates.length === 0) {
      return { status: "UNMAPPED", reason: "NO_CANONICAL_CONVERSATION_FOR_VERIFIED_USER_ID" };
    }
    if (candidates.length > 1) {
      return { status: "AMBIGUOUS", reason: "MULTIPLE_CANONICAL_CONVERSATIONS_FOR_VERIFIED_USER_ID" };
    }

    const candidate = candidates[0];
    if (candidate.lineChatUserId && candidate.lineChatUserId !== input.lineChatUserId) {
      return { status: "AMBIGUOUS", reason: "CANONICAL_CONVERSATION_HAS_DIFFERENT_MANAGER_USER_ID" };
    }

    if (input.apply && !candidate.lineChatUserId) {
      const conflict = await this.prisma.conversation.findFirst({
        where: {
          lineOfficialAccountId: input.lineOfficialAccountId,
          lineChatUserId: input.lineChatUserId,
          NOT: { id: candidate.id },
        },
        select: { id: true },
      });
      if (conflict) {
        return { status: "AMBIGUOUS", reason: "MANAGER_USER_ID_ALREADY_MAPPED_TO_OTHER_CONVERSATION" };
      }

      const written = await this.prisma.conversation.updateMany({
        where: {
          id: candidate.id,
          lineOfficialAccountId: input.lineOfficialAccountId,
          lineChatUserId: null,
        },
        data: {
          lineChatUserId: input.lineChatUserId,
          lineChatMappingSource: "PROJECT_B_VERIFIED_USER_ID",
          lineChatMappedAt: new Date(),
        },
      });
      if (written.count !== 1) {
        return { status: "AMBIGUOUS", reason: "CANONICAL_MAPPING_CHANGED_DURING_RECONCILIATION" };
      }
    }

    return {
      status: "MAPPED",
      conversationId: candidate.id,
      source: "VERIFIED_WEBHOOK_USER_ID",
    };
  }

  private async resolveByExactInboundMessageEvidence(input: {
    lineOfficialAccountId: string;
    storeId: string;
    lineChatUserId: string;
    apply: boolean;
  }): Promise<MappingResult | null> {
    const mirrorInbound = await this.prisma.lineChatMirrorMessage.findMany({
      where: {
        lineOfficialAccountId: input.lineOfficialAccountId,
        lineChatUserId: input.lineChatUserId,
        direction: LineChatMirrorDirection.INBOUND,
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: INBOUND_MAPPING_EVIDENCE_LIMIT,
      select: { managerMessageId: true },
    });
    const managerMessageIds = [...new Set(
      mirrorInbound
        .map((row) => row.managerMessageId?.trim())
        .filter((value): value is string => Boolean(value)),
    )];
    if (managerMessageIds.length === 0) return null;

    const canonicalEvidence = await this.prisma.message.findMany({
      where: {
        externalMessageId: { in: managerMessageIds },
        direction: MessageDirection.INBOUND,
        conversation: {
          lineOfficialAccountId: input.lineOfficialAccountId,
          storeId: input.storeId,
        },
      },
      select: {
        conversationId: true,
        externalMessageId: true,
      },
    });
    const selection = selectUniqueExactInboundConversationId(
      canonicalEvidence.map((row) => row.conversationId),
    );
    if (selection.status === "NONE") return null;
    if (selection.status === "AMBIGUOUS") {
      return {
        status: "AMBIGUOUS",
        reason: "EXACT_INBOUND_MESSAGE_IDS_POINT_TO_MULTIPLE_CONVERSATIONS",
      };
    }

    const conversationId = selection.conversationId;
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, lineOfficialAccountId: true, storeId: true, lineChatUserId: true },
    });
    if (
      !conversation
      || conversation.lineOfficialAccountId !== input.lineOfficialAccountId
      || conversation.storeId !== input.storeId
    ) {
      return {
        status: "AMBIGUOUS",
        reason: "EXACT_INBOUND_MESSAGE_CONVERSATION_SCOPE_CHANGED",
      };
    }
    if (
      conversation.lineChatUserId
      && conversation.lineChatUserId.trim() !== input.lineChatUserId
    ) {
      return {
        status: "AMBIGUOUS",
        reason: "EXACT_INBOUND_MESSAGE_CONFLICTS_WITH_EXISTING_MANAGER_MAPPING",
      };
    }

    if (input.apply && !conversation.lineChatUserId) {
      const conflict = await this.prisma.conversation.findFirst({
        where: {
          lineOfficialAccountId: input.lineOfficialAccountId,
          lineChatUserId: input.lineChatUserId,
          NOT: { id: conversation.id },
        },
        select: { id: true },
      });
      if (conflict) {
        return {
          status: "AMBIGUOUS",
          reason: "MANAGER_USER_ID_ALREADY_MAPPED_TO_OTHER_CONVERSATION",
        };
      }

      const written = await this.prisma.conversation.updateMany({
        where: {
          id: conversation.id,
          lineOfficialAccountId: input.lineOfficialAccountId,
          storeId: input.storeId,
          lineChatUserId: null,
        },
        data: {
          lineChatUserId: input.lineChatUserId,
          lineChatMappingSource: "PROJECT_B_EXACT_INBOUND_MESSAGE_ID",
          lineChatMappedAt: new Date(),
        },
      });
      if (written.count !== 1) {
        const current = await this.prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { lineChatUserId: true },
        });
        if (current?.lineChatUserId?.trim() !== input.lineChatUserId) {
          return {
            status: "AMBIGUOUS",
            reason: "CANONICAL_MAPPING_CHANGED_DURING_EXACT_MESSAGE_RECONCILIATION",
          };
        }
      }
    }

    return {
      status: "MAPPED",
      conversationId,
      source: "EXACT_INBOUND_MESSAGE_ID",
    };
  }

  private async resolveStoreUser(
    storeId: string,
    displayName: string,
  ): Promise<{ id: string; displayName: string } | null> {
    const users = await this.prisma.user.findMany({
      where: {
        displayName,
        isActive: true,
        status: UserStatus.ACTIVE,
        memberships: {
          some: {
            storeId,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
      take: 2,
      select: { id: true, displayName: true },
    });
    return users.length === 1 ? users[0] : null;
  }

  private async findExactCanonical(
    managerMessageId: string,
  ): Promise<{ id: string; conversationId: string } | null> {
    return this.prisma.message.findFirst({
      where: {
        externalMessageId: {
          in: [managerMessageId, mirrorCanonicalExternalId(managerMessageId)],
        },
      },
      select: { id: true, conversationId: true },
    });
  }

  private async findContentTimeDuplicate(
    conversationId: string,
    row: MirrorRow,
  ): Promise<Array<{ id: string }>> {
    const direction = row.direction === LineChatMirrorDirection.INBOUND
      ? MessageDirection.INBOUND
      : MessageDirection.OUTBOUND;
    const messageType = canonicalMessageTypeFromMirror(row.messageType);
    const where: Prisma.MessageWhereInput = {
      conversationId,
      direction,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      messageType,
      sentAt: {
        gte: new Date(row.sentAt.getTime() - CONTENT_TIME_TOLERANCE_MS),
        lte: new Date(row.sentAt.getTime() + CONTENT_TIME_TOLERANCE_MS),
      },
    };

    if (messageType === MessageType.TEXT && row.text !== null) {
      where.originalText = row.text;
    } else if (messageType === MessageType.FILE && row.fileName) {
      where.fileName = row.fileName;
    } else {
      return [];
    }

    return this.prisma.message.findMany({
      where,
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: 3,
      select: { id: true },
    });
  }

  private async importOutbound(input: {
    conversationId: string;
    row: MirrorRow;
    attributedUser: { id: string; displayName: string } | null;
    automated: boolean;
  }): Promise<{ created: boolean; messageId: string }> {
    const externalMessageId = mirrorCanonicalExternalId(input.row.managerMessageId);
    const now = new Date();
    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId: input.conversationId,
          externalMessageId,
          direction: MessageDirection.OUTBOUND,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          messageType: canonicalMessageTypeFromMirror(input.row.messageType),
          originalText: mirrorCanonicalText(input.row),
          fileName: input.row.fileName,
          senderUserId: input.automated ? null : input.attributedUser?.id ?? null,
          // For Project B, LINE OA Manager is the source of truth for
          // responder identity shown in statistics. Keep any internal user link
          // only as metadata/ownership; never replace the Manager-visible name
          // with the legacy app user display name.
          senderDisplayName: input.automated
            ? AUTO_REPLY_BOT_DISPLAY_NAME
            : managerResponderDisplayName(input.row.ownerName),
          sentAt: input.row.sentAt,
          rawPayload: {
            provider: "LINE_MANAGER",
            source: input.automated ? "AUTO_RESPONSE" : "LINE_MANAGER_MIRROR",
            project: "PROJECT_B",
            managerMessageId: input.row.managerMessageId,
            managerBizId: input.row.bizId,
            managerOwnerName: input.row.ownerName,
            responderIdentitySource: input.automated ? "AUTO_RESPONSE" : "LINE_MANAGER_OWNER_NAME",
            internalUserLinkId: input.automated ? null : input.attributedUser?.id ?? null,
            mirroredAt: now.toISOString(),
          },
        },
        select: { id: true },
      });
      return { created: true, messageId: message.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.message.findUnique({
          where: { externalMessageId },
          select: { id: true, conversationId: true },
        });
        if (existing?.conversationId === input.conversationId) {
          return { created: false, messageId: existing.id };
        }
      }
      throw error;
    }
  }

  private async markMirror(
    mirrorMessageId: string,
    input: {
      status: LineChatMirrorReconcileStatus;
      conversationId?: string;
      messageId?: string;
      source?: string;
      error?: string;
    },
    apply: boolean,
  ): Promise<void> {
    if (!apply) return;
    await this.prisma.lineChatMirrorMessage.update({
      where: { id: mirrorMessageId },
      data: {
        reconcileStatus: input.status,
        canonicalConversationId: input.conversationId,
        canonicalMessageId: input.messageId,
        reconcileSource: input.source,
        reconcileAttempts: { increment: 1 },
        reconciledAt: input.status === LineChatMirrorReconcileStatus.DUPLICATE
          || input.status === LineChatMirrorReconcileStatus.IMPORTED
          || input.status === LineChatMirrorReconcileStatus.SKIPPED
          ? new Date()
          : null,
        reconcileError: input.error ?? null,
      },
    });
  }

  private async recomputeConversationState(conversationId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        latestMessageAt: true,
        bmReplyStatus: true,
        followUpStatus: true,
        ownerUserId: true,
      },
    });
    if (!conversation) return false;

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: 250,
      select: {
        id: true,
        direction: true,
        deliveryStatus: true,
        sentAt: true,
        senderUserId: true,
        senderDisplayName: true,
        rawPayload: true,
      },
    });
    if (messages.length === 0) return false;

    const latestMessage = messages[0];
    const latestInbound = messages.find(
      (message) => message.direction === MessageDirection.INBOUND,
    );
    if (!latestInbound) {
      if (latestMessage.sentAt <= conversation.latestMessageAt) return false;
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { latestMessageAt: latestMessage.sentAt },
      });
      return true;
    }

    const humanReply = messages.find((message) => {
      if (
        message.direction !== MessageDirection.OUTBOUND
        || message.deliveryStatus !== MessageDeliveryStatus.DELIVERED
        || message.sentAt < latestInbound.sentAt
        || isAutomatedOutboundMessage(message)
      ) {
        return false;
      }
      const raw = jsonObject(message.rawPayload);
      return Boolean(message.senderUserId)
        || raw.source === "LINE_MANAGER_MIRROR"
        || raw.provider === "LINE_MANAGER";
    });

    const targetReply = humanReply ? BmReplyStatus.REPLIED : BmReplyStatus.NOT_REPLIED;
    const targetFollowUp = humanReply
      ? FollowUpStatus.COMPLETED
      : conversation.followUpStatus;
    const ownerToAssign = humanReply?.senderUserId && !conversation.ownerUserId
      ? humanReply.senderUserId
      : null;
    const latestMessageAt = latestMessage.sentAt > conversation.latestMessageAt
      ? latestMessage.sentAt
      : conversation.latestMessageAt;

    const stateChanged = conversation.bmReplyStatus !== targetReply
      || (humanReply && conversation.followUpStatus !== FollowUpStatus.COMPLETED)
      || Boolean(ownerToAssign)
      || latestMessageAt.getTime() !== conversation.latestMessageAt.getTime();
    if (!stateChanged) return false;

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          bmReplyStatus: targetReply,
          ...(humanReply ? { followUpStatus: targetFollowUp } : {}),
          latestMessageAt,
          ...(ownerToAssign ? { ownerUserId: ownerToAssign } : {}),
        },
      });

      if (
        conversation.bmReplyStatus !== targetReply
        || (humanReply && conversation.followUpStatus !== FollowUpStatus.COMPLETED)
      ) {
        await tx.activityHistory.create({
          data: {
            conversationId,
            actionType: ActivityActionType.STATUS_CHANGED,
            previousStatus: conversation.followUpStatus,
            newStatus: humanReply ? FollowUpStatus.COMPLETED : conversation.followUpStatus,
            previousBmReplyStatus: conversation.bmReplyStatus,
            newBmReplyStatus: targetReply,
            createdByUserId: humanReply?.senderUserId ?? null,
            createdByName: humanReply?.senderDisplayName?.trim() || "Project B Mirror",
            description: humanReply
              ? "Reply state reconciled from LINE OA Manager mirror"
              : "Reply state reconciled from latest inbound LINE OA Manager mirror",
            metadata: {
              source: "PROJECT_B_MIRROR_RECONCILIATION",
              latestInboundAt: latestInbound.sentAt.toISOString(),
              humanReplyAt: humanReply?.sentAt.toISOString() ?? null,
            },
          },
        });
      }
    });
    return true;
  }

  private logStoreResult(
    result: LineChatMirrorReconcileCycleResult,
    since: Date,
  ): void {
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_reconcile_store_completed",
      ...result,
      since: since.toISOString(),
    }));
  }
}
