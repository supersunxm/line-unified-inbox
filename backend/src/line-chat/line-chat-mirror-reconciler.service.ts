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
import { MirrorIdentityBridgeService } from "./mirror-identity-bridge.service";
import {
  AUTO_REPLY_BOT_DISPLAY_NAME,
  isAutomatedOutboundMessage,
} from "../conversation-reply-state";
import { isLineChatUserId } from "./line-chat-chat-discovery";
import { configuredLineChatMirrorStoreCodes } from "./line-chat-mirror.service";
import { selectLineChatStoreOa } from "./line-chat-store-oa-selector";
import { resolveConfiguredMirrorFleetScope, type MirrorFleetScope } from "./line-chat-mirror-fleet-scope";
import {
  approvedExactMirrorManifest,
  EXACT_MIRROR_MANIFEST_MAX_ROWS,
  POST_LIVE_AUDIT_START_AT,
  exactMirrorIdentityKey,
  exactMirrorIdentityWhere,
  exactMirrorRawRowMatches,
  exactMirrorRawRowMatchesPriorState,
  parseExactMirrorManifestCsv,
} from "./line-chat-mirror-exact-manifest";

/** Only durable provider/Manager IDs prove that a near-match is a distinct event.
 * Client/execution external IDs cannot prove Manager equivalence or difference.
 */
function authoritativeCanonicalIds(message: {
  externalMessageId: string | null;
  rawPayload: Prisma.JsonValue;
  direction: MessageDirection;
}): string[] {
  const payload = message.rawPayload && typeof message.rawPayload === "object"
    && !Array.isArray(message.rawPayload) ? message.rawPayload : {};
  const external = message.externalMessageId;
  // The webhook persists message.id as the inbound external ID. Application
  // outbound external IDs are client keys; their provider alias must be explicit.
  const sourceExternal = external && (message.direction === MessageDirection.INBOUND
    || external.startsWith("line-chat-manager:"))
    ? external : null;
  return [...new Set([sourceExternal, payload.managerMessageId, payload.providerMessageId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().replace(/^line-chat-manager:/u, ""))
    .filter((value) => value.length > 0 && !value.startsWith("event:")))];
}

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 1_000;
const FULL_FLEET_BATCH_THRESHOLD = 32;
const FULL_FLEET_MAX_BATCH_PER_STORE = 100;
const START_DELAY_MS = 15_000;
const IDENTITY_EVIDENCE_LIMIT = 100;
const CONTENT_TIME_CANDIDATE_LIMIT = 100;
const MIN_IDENTITY_MATCHES = 3;
const INBOUND_MAPPING_EVIDENCE_LIMIT = 25;
const CONTENT_TIME_TOLERANCE_MS = 2_000;
const RETRY_ACTIVE_WINDOW_MS = 24 * 60 * 60_000;
const RETRY_MIN_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 6 * 60 * 60_000;
const MAX_OUTBOUND_CANONICALIZATION_DETAIL_LOGS_PER_STORE_CYCLE = 10;

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
      source: "DIRECT_LINE_CHAT_USER_ID" | "EXACT_INBOUND_MESSAGE_ID" | "VERIFIED_WEBHOOK_USER_ID" | "EXACT_MANIFEST_DESTINATION";
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

export type ExactMirrorManifestExecutionResult = {
  manifestRows: number;
  manifestSha256: string;
  storeCount: number;
  rawRowsFound: number;
  alreadyCanonical: number;
  alreadyRepresentedEquivalent: number;
  historicalOverlap: number;
  stillSafeToApply: number;
  newConflict: number;
  newHold: number;
  missingRawSource: number;
  outsideManifestConsidered: 0;
  unexplained: number;
  writes: number;
  reconcilerResults: LineChatMirrorReconcileCycleResult[];
  reasons: Record<string, number>;
};

type ExactReconcileScope = {
  storeId: string;
  oaId: string;
  rows: MirrorRow[];
  conversationByChatId: ReadonlyMap<string, string>;
  strictNonTextDuplicateGuard?: boolean;
};

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
      const configuredPrimaryStoreCodes = configuredLineChatMirrorReconcileStoreCodes();
      const configuredDryRunStoreCodes = configuredLineChatMirrorReconcileDryRunStoreCodes();
      let fleetScope: MirrorFleetScope;
      try {
        fleetScope = await resolveConfiguredMirrorFleetScope(this.prisma, [
          ...configuredPrimaryStoreCodes,
          ...configuredDryRunStoreCodes,
        ]);
      } catch (error) {
        this.logger.error(JSON.stringify({
          event: "line_chat_mirror_reconcile_fleet_scope_resolution_failed",
          errorType: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        }));
        return [];
      }
      const eligibleCodes = new Set(fleetScope.eligibleStoreCodes);
      const primaryStoreCodes = configuredPrimaryStoreCodes.filter((storeCode) => eligibleCodes.has(storeCode));
      const dryRunStoreCodes = configuredDryRunStoreCodes.filter((storeCode) => eligibleCodes.has(storeCode));
      this.logger.log(JSON.stringify({
        event: "line_chat_mirror_reconcile_fleet_scope_resolved",
        configuredStoreCount: configuredPrimaryStoreCodes.length + configuredDryRunStoreCodes.length,
        activeEligibleStoreCount: primaryStoreCodes.length,
        observationOnlyStoreCount: dryRunStoreCodes.length,
        exclusions: fleetScope.exclusions,
      }));
      const effectiveBatchSize = lineChatMirrorReconcileEffectiveBatchSize(primaryStoreCodes.length);
      const scopes = [
        ...primaryStoreCodes.map((storeCode) => ({
          storeCode,
          apply: isLineChatMirrorReconcileApplyEnabled(),
        })),
        ...dryRunStoreCodes.map((storeCode) => ({
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

  /**
   * Executes only source identities in a digest-verified immutable manifest.
   * The Raw Mirror query is OA-scoped and uses the table's unique
   * (lineOfficialAccountId, managerMessageId) identity. It never calls runCycle
   * and never performs a time-window candidate scan.
   */
  public async reconcileExactManifestCsv(input: {
    bytes: Uint8Array;
    apply?: boolean;
  }): Promise<ExactMirrorManifestExecutionResult> {
    const approved = approvedExactMirrorManifest(input.bytes);
    return this.reconcileExactManifestCsvWithExpectedHash(
      input.bytes,
      approved.sha256,
      input.apply ?? false,
      approved.rows,
      approved.stores,
    );
  }

  private async reconcileExactManifestCsvWithExpectedHash(
    bytes: Uint8Array,
    expectedSha256: string,
    apply: boolean,
    expectedRows: number = EXACT_MIRROR_MANIFEST_MAX_ROWS,
    expectedStores: number = 24,
  ): Promise<ExactMirrorManifestExecutionResult> {
    const manifest = parseExactMirrorManifestCsv(bytes, expectedSha256);
    if (manifest.rows.length !== expectedRows || manifest.storeCount !== expectedStores) {
      throw new Error(manifest.rows[0]?.kind === "MEDIA"
        ? "EXACT_MIRROR_MEDIA_MANIFEST_APPROVED_SIZE_MISMATCH"
        : "EXACT_MIRROR_MANIFEST_EXPECTED_490_ROWS_ACROSS_24_STORES");
    }

    const result: ExactMirrorManifestExecutionResult = {
      manifestRows: manifest.rows.length,
      manifestSha256: manifest.sha256,
      storeCount: manifest.storeCount,
      rawRowsFound: 0,
      alreadyCanonical: 0,
      alreadyRepresentedEquivalent: 0,
      historicalOverlap: 0,
      stillSafeToApply: 0,
      newConflict: 0,
      newHold: 0,
      missingRawSource: 0,
      outsideManifestConsidered: 0,
      unexplained: 0,
      writes: 0,
      reconcilerResults: [],
      reasons: {},
    };
    const identities = manifest.rows.map((row) => ({
      lineOfficialAccountId: row.lineOfficialAccountId,
      sourceEventId: row.sourceEventId,
    }));
    const rawRows = await this.prisma.lineChatMirrorMessage.findMany({
      where: exactMirrorIdentityWhere(identities),
      select: {
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
        reconcileStatus: true,
        reconcileAttempts: true,
      },
    });
    result.rawRowsFound = rawRows.length;
    if (rawRows.length > manifest.rows.length) {
      throw new Error("EXACT_MIRROR_MANIFEST_RAW_CANDIDATE_LIMIT_EXCEEDED");
    }

    const rawSourceIdOaRows = await this.prisma.lineChatMirrorMessage.findMany({
      where: { managerMessageId: { in: [...new Set(manifest.rows.map((row) => row.sourceEventId))] } },
      select: { lineOfficialAccountId: true, managerMessageId: true },
    });
    const rawOasBySourceId = new Map<string, Set<string>>();
    for (const raw of rawSourceIdOaRows) {
      const oas = rawOasBySourceId.get(raw.managerMessageId) ?? new Set<string>();
      oas.add(raw.lineOfficialAccountId);
      rawOasBySourceId.set(raw.managerMessageId, oas);
    }

    const rawByIdentity = new Map(rawRows.map((row) => [exactMirrorIdentityKey({
      lineOfficialAccountId: row.lineOfficialAccountId,
      sourceEventId: row.managerMessageId,
    }), row]));
    const oaIds = [...new Set(manifest.rows.map((row) => row.lineOfficialAccountId))];
    const conversationIds = [...new Set(manifest.rows.map((row) => row.canonicalConversationId))];
    const historicalIdentityOr = manifest.rows.flatMap((row) => ([
      { lineOfficialAccountId: row.lineOfficialAccountId, sourceEventId: row.sourceEventId },
      { lineOfficialAccountId: row.lineOfficialAccountId, sourceEventId: `line-chat-manager:${row.sourceEventId}` },
    ]));
    const [oas, conversations, historicalMessages] = await Promise.all([
      this.prisma.lineOfficialAccount.findMany({
        where: { id: { in: oaIds } },
        select: {
          id: true,
          storeId: true,
          accountType: true,
          isActive: true,
          archivedAt: true,
          store: {
            select: {
              id: true,
              code: true,
              isActive: true,
              archivedAt: true,
              storeMaster: { select: { externalStoreId: true } },
            },
          },
        },
      }),
      this.prisma.conversation.findMany({
        where: { id: { in: conversationIds } },
        select: { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true },
      }),
      this.prisma.historicalTimelineMessage.findMany({
        where: { OR: historicalIdentityOr },
        select: {
          storeId: true,
          lineOfficialAccountId: true,
          lineChatUserId: true,
          sourceEventId: true,
          sourceEventType: true,
          direction: true,
          text: true,
          sentAt: true,
        },
      }),
    ]);
    const oaById = new Map(oas.map((oa) => [oa.id, oa]));
    const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    const historicalByIdentity = new Map<string, typeof historicalMessages>();
    for (const historical of historicalMessages) {
      const sourceEventId = historical.sourceEventId.replace(/^line-chat-manager:/u, "");
      const key = exactMirrorIdentityKey({
        lineOfficialAccountId: historical.lineOfficialAccountId,
        sourceEventId,
      });
      const matches = historicalByIdentity.get(key) ?? [];
      matches.push(historical);
      historicalByIdentity.set(key, matches);
    }

    const crosswalkRequirements = manifest.rows.filter((row) => {
      const conversation = conversationById.get(row.canonicalConversationId);
      return Boolean(conversation) && conversation?.lineChatUserId !== row.lineChatUserId;
    });
    const crosswalks = crosswalkRequirements.length > 0
      ? await this.prisma.historicalConversationCrosswalk.findMany({
          where: {
            OR: crosswalkRequirements.map((row) => ({
              storeId: row.storeId,
              lineOfficialAccountId: row.lineOfficialAccountId,
              historicalLineChatUserId: row.lineChatUserId,
            })),
          },
          select: {
            storeId: true,
            lineOfficialAccountId: true,
            historicalLineChatUserId: true,
            classification: true,
            canonicalConversationId: true,
          },
        })
      : [];
    const crosswalkByIdentity = new Map(crosswalks.map((crosswalk) => [
      `${crosswalk.storeId}\u0000${crosswalk.lineOfficialAccountId}\u0000${crosswalk.historicalLineChatUserId}`,
      crosswalk,
    ]));

    const safeRowsByStore = new Map<string, {
      storeId: string;
      storeCode: string;
      oaId: string;
      rows: MirrorRow[];
      conversationByChatId: Map<string, string>;
      strictNonTextDuplicateGuard?: boolean;
    }>();
    const destinationByChat = new Map<string, string>();
    const ambiguousManifestChats = new Set<string>();
    for (const expected of manifest.rows) {
      const chatKey = `${expected.lineOfficialAccountId}\u0000${expected.lineChatUserId}`;
      const previous = destinationByChat.get(chatKey);
      if (previous && previous !== expected.canonicalConversationId) ambiguousManifestChats.add(chatKey);
      else destinationByChat.set(chatKey, expected.canonicalConversationId);
    }
    const classify = (kind: "alreadyCanonical" | "alreadyRepresentedEquivalent" | "newConflict" | "newHold" | "missingRawSource" | "stillSafeToApply", reason?: string) => {
      result[kind] += 1;
      if (reason) result.reasons[reason] = (result.reasons[reason] ?? 0) + 1;
    };

    for (const expected of manifest.rows) {
      const identityKey = exactMirrorIdentityKey(expected);
      const raw = rawByIdentity.get(identityKey);
      if (!raw) {
        classify("missingRawSource", "MANIFEST_RAW_IDENTITY_NOT_FOUND");
        continue;
      }

      if (!exactMirrorRawRowMatches(raw, expected)) {
        classify("newConflict", "RAW_SOURCE_PAYLOAD_OR_IDENTITY_CHANGED");
        continue;
      }
      if ((rawOasBySourceId.get(expected.sourceEventId)?.size ?? 0) !== expected.rawSourceIdOaCount) {
        classify("newHold", "RAW_SOURCE_ID_OA_CARDINALITY_CHANGED");
        continue;
      }
      const chatKey = `${expected.lineOfficialAccountId}\u0000${expected.lineChatUserId}`;
      if (ambiguousManifestChats.has(chatKey)) {
        classify("newHold", "MANIFEST_CHAT_HAS_MULTIPLE_CANONICAL_DESTINATIONS");
        continue;
      }

      const oa = oaById.get(expected.lineOfficialAccountId);
      const store = oa?.store;
      if (
        !oa
        || oa.accountType !== LineAccountType.STORE
        || !oa.isActive
        || oa.archivedAt !== null
        || oa.storeId !== expected.storeId
        || !store
        || store.id !== expected.storeId
        || !store.isActive
        || store.archivedAt !== null
        || (store.code !== expected.storeCode && store.storeMaster?.externalStoreId !== expected.storeCode)
      ) {
        classify("newHold", "CURRENT_OA_STORE_MAPPING_NOT_PROVEN");
        continue;
      }

      const conversation = conversationById.get(expected.canonicalConversationId);
      if (
        !conversation
        || conversation.storeId !== expected.storeId
        || conversation.lineOfficialAccountId !== expected.lineOfficialAccountId
      ) {
        classify("newHold", "CANONICAL_DESTINATION_STORE_OR_OA_MISMATCH");
        continue;
      }
      if (conversation.lineChatUserId !== expected.lineChatUserId) {
        const crosswalkKey = `${expected.storeId}\u0000${expected.lineOfficialAccountId}\u0000${expected.lineChatUserId}`;
        const crosswalk = crosswalkByIdentity.get(crosswalkKey);
        if (
          !crosswalk
          || crosswalk.classification !== "LINK_SAFE"
          || crosswalk.canonicalConversationId !== expected.canonicalConversationId
        ) {
          classify("newHold", "CANONICAL_DESTINATION_IDENTITY_NOT_PROVEN");
          continue;
        }
      }

      const historicalCandidates = historicalByIdentity.get(identityKey) ?? [];
      if (historicalCandidates.length > 1) {
        classify("newConflict", "DUPLICATE_HISTORICAL_SOURCE_IDENTITY");
        continue;
      }
      const historical = historicalCandidates[0];
      if (historical) {
        const historicalType = historical.sourceEventType?.trim().toLowerCase();
        const historicalPayloadMatches = expected.kind === "MEDIA"
          ? historicalType === expected.messageType
          : historical.text === raw.text;
        if (
          historical.storeId !== expected.storeId
          || historical.lineChatUserId !== expected.lineChatUserId
          || historical.direction !== MessageDirection.OUTBOUND
          || !historicalPayloadMatches
          || historical.sentAt.getTime() !== expected.sentAt.getTime()
        ) {
          classify("newConflict", "HISTORICAL_OVERLAP_PAYLOAD_OR_DESTINATION_CONFLICT");
          continue;
        }
        result.historicalOverlap += 1;
      }

      const canonicalCandidates = await this.findExactCanonicals(
        expected.sourceEventId,
        expected.lineOfficialAccountId,
      );
      if (canonicalCandidates.length > 1) {
        classify("newConflict", "MULTIPLE_CANONICAL_SOURCE_IDENTITY_FORMS");
        continue;
      }
      const canonical = canonicalCandidates[0];
      if (canonical) {
        const matches = canonical.conversationId === expected.canonicalConversationId
          && canonical.conversation.storeId === expected.storeId
          && canonical.conversation.lineOfficialAccountId === expected.lineOfficialAccountId
          && authoritativeCanonicalIds(canonical).every((identity) => identity === expected.sourceEventId)
          && canonical.direction === MessageDirection.OUTBOUND
          && canonical.deliveryStatus === MessageDeliveryStatus.DELIVERED
          && canonical.messageType === canonicalMessageTypeFromMirror(raw.messageType)
          && canonical.originalText === mirrorCanonicalText(raw)
          && (canonical.messageType !== MessageType.FILE || canonical.fileName === raw.fileName)
          && canonical.sentAt.getTime() === expected.sentAt.getTime();
        if (!matches) {
          classify("newConflict", "EXISTING_CANONICAL_IDENTITY_PAYLOAD_OR_DESTINATION_CONFLICT");
        } else if (canonical.externalMessageId === expected.sourceEventId) {
          classify("alreadyRepresentedEquivalent");
        } else {
          classify("alreadyCanonical");
        }
        continue;
      }

      if (!exactMirrorRawRowMatchesPriorState(raw, expected)) {
        classify("newHold", "RAW_RECONCILE_STATE_CHANGED_WITHOUT_CANONICAL_REPRESENTATION");
        continue;
      }

      const mirrorRow = raw as MirrorRow;
      const contentTime = await this.findContentTimeDuplicate(
        expected.canonicalConversationId,
        mirrorRow,
        expected.kind === "MEDIA",
      );
      if (contentTime.length > 0) {
        classify("newHold", "CANONICAL_CONTENT_TIME_NEAR_MATCH_REQUIRES_REVIEW");
        continue;
      }

      const groupKey = `${expected.storeId}\u0000${expected.lineOfficialAccountId}`;
      let group = safeRowsByStore.get(groupKey);
      if (!group) {
        group = {
          storeId: expected.storeId,
          storeCode: expected.storeCode,
          oaId: expected.lineOfficialAccountId,
          rows: [],
          conversationByChatId: new Map<string, string>(),
          strictNonTextDuplicateGuard: expected.kind === "MEDIA",
        };
        safeRowsByStore.set(groupKey, group);
      }
      group.conversationByChatId.set(expected.lineChatUserId, expected.canonicalConversationId);
      group.rows.push(raw);
      classify("stillSafeToApply");
    }

    result.unexplained = manifest.rows.length
      - result.alreadyCanonical
      - result.alreadyRepresentedEquivalent
      - result.stillSafeToApply
      - result.newConflict
      - result.newHold
      - result.missingRawSource;
    if (result.unexplained !== 0) throw new Error("EXACT_MIRROR_MANIFEST_ACCOUNTING_MISMATCH");

    const scopes = [...safeRowsByStore.values()];
    const dryResults: LineChatMirrorReconcileCycleResult[] = [];
    for (const scope of scopes) {
      dryResults.push(await this.reconcileStore(
        scope.storeCode,
        new Date(POST_LIVE_AUDIT_START_AT),
        false,
        scope.rows.length,
        {
          storeId: scope.storeId,
          oaId: scope.oaId,
          rows: scope.rows,
          conversationByChatId: scope.conversationByChatId,
          strictNonTextDuplicateGuard: scope.strictNonTextDuplicateGuard,
        },
      ));
    }
    result.reconcilerResults = dryResults;

    const wouldImport = dryResults.reduce((sum, item) => sum + item.wouldImportOutbound, 0);
    const dryRunFailures = dryResults.reduce((sum, item) => sum + item.failed + item.unmapped + item.ambiguous, 0);
    if (wouldImport !== result.stillSafeToApply || dryRunFailures !== 0) {
      result.newHold += result.stillSafeToApply;
      result.reasons.EXISTING_RECONCILER_DRY_RUN_DID_NOT_CONFIRM_EXACT_SAFE_SET = 1;
      result.stillSafeToApply = 0;
      result.unexplained = 0;
      return result;
    }

    if (!apply || result.stillSafeToApply === 0) return result;

    const applyResults: LineChatMirrorReconcileCycleResult[] = [];
    for (const scope of scopes) {
      applyResults.push(await this.reconcileStore(
        scope.storeCode,
        new Date(POST_LIVE_AUDIT_START_AT),
        true,
        scope.rows.length,
        {
          storeId: scope.storeId,
          oaId: scope.oaId,
          rows: scope.rows,
          conversationByChatId: scope.conversationByChatId,
          strictNonTextDuplicateGuard: scope.strictNonTextDuplicateGuard,
        },
      ));
    }
    result.reconcilerResults = applyResults;
    result.writes = applyResults.reduce((sum, item) => sum + item.importedOutbound, 0);
    const applyFailures = applyResults.reduce((sum, item) => sum + item.failed + item.unmapped + item.ambiguous, 0);
    if (result.writes !== result.stillSafeToApply || applyFailures > 0) {
      result.reasons.APPLY_RESULT_REQUIRES_READ_BACK_REVIEW = Math.max(1, applyFailures);
    }
    return result;
  }

  private async reconcileStore(
    storeCode: string,
    since: Date,
    apply: boolean,
    batchSize: number = lineChatMirrorReconcileBatchSize(),
    exactScope?: ExactReconcileScope,
  ): Promise<LineChatMirrorReconcileCycleResult> {
    const startedAt = Date.now();
    const store = await this.prisma.store.findFirst({
      where: exactScope
        ? { id: exactScope.storeId, isActive: true, archivedAt: null }
        : {
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
          select: { id: true, storeId: true, name: true, basicId: true },
        },
      },
    });
    if (!store) throw new Error("RECONCILE_STORE_NOT_FOUND");

    const oaSelection = exactScope
      ? null
      : selectLineChatStoreOa(
          store.storeMaster,
          store.lineOfficialAccounts.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            basicId: candidate.basicId,
          })),
        );
    if (oaSelection && !oaSelection.ok) {
      throw new Error(`RECONCILE_OA_IDENTITY_${oaSelection.reason}`);
    }
    const selectedOaId = exactScope?.oaId ?? (oaSelection?.ok ? oaSelection.oaId : null);
    const oa = selectedOaId
      ? store.lineOfficialAccounts.find((candidate) => candidate.id === selectedOaId)
      : undefined;
    if (!oa) throw new Error("RECONCILE_SELECTED_OA_NOT_FOUND");
    if (exactScope && (oa.storeId !== exactScope.storeId || oa.id !== exactScope.oaId)) {
      throw new Error("EXACT_RECONCILE_SCOPE_OA_STORE_MISMATCH");
    }

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
      selectionSource: exactScope ? "EXACT_MANIFEST" : oaSelection?.ok ? oaSelection.source : null,
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
    const pendingOutbound = exactScope ? [] : await this.prisma.lineChatMirrorMessage.findMany({
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
    const pendingOther = !exactScope && remainingAfterOutbound > 0
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
    const retryRows = !exactScope && remainingAfterPending > 0
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

    const rows = exactScope ? exactScope.rows : [...pendingOutbound, ...pendingOther, ...retryRows];

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

    const identityEvidence = exactScope
      ? { verified: false, matches: 0, mismatches: 0, validPairs: 0, invalidPairs: 0 }
      : await this.identityEvidence(oa.id);
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
          if (exactScope) {
            const destinationId = exactScope.conversationByChatId.get(row.lineChatUserId);
            mapping = destinationId
              ? {
                  status: "MAPPED",
                  conversationId: destinationId,
                  source: "EXACT_MANIFEST_DESTINATION",
                }
              : { status: "UNMAPPED", reason: "EXACT_MANIFEST_DESTINATION_NOT_FOUND" };
          } else {
            mapping = await this.resolveConversation({
              lineOfficialAccountId: oa.id,
              storeId: store.id,
              lineChatUserId: row.lineChatUserId,
              identityEquivalent: identityEvidence.verified,
              apply,
            });
          }
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

        // A content/time resemblance is never proof of event identity.
        if (!row.managerMessageId.trim() || row.managerMessageId !== row.managerMessageId.trim()
          || row.managerMessageId.startsWith("event:")) {
          result.ambiguous += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.AMBIGUOUS,
            conversationId: mapping.conversationId,
            source: "SOURCE_IDENTITY_UNPROVEN",
            error: "An authoritative Manager message identity is required.",
          }, apply);
          continue;
        }
        const exactCandidates = await this.findExactCanonicals(row.managerMessageId, oa.id);
        if (exactCandidates.length > 1) {
          result.ambiguous += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.AMBIGUOUS,
            conversationId: mapping.conversationId,
            source: "EXACT_SOURCE_IDENTITY_AMBIGUOUS",
            error: "Multiple Canonical records claim the same source identity.",
          }, apply);
          continue;
        }
        const exact = exactCandidates[0];
        if (exact) {
          const expectedDirection = row.direction === LineChatMirrorDirection.INBOUND
            ? MessageDirection.INBOUND : MessageDirection.OUTBOUND;
          const identities = authoritativeCanonicalIds(exact);
          if (exact.conversationId !== mapping.conversationId
            || exact.conversation.storeId !== store.id
            || exact.conversation.lineOfficialAccountId !== oa.id
            || exact.direction !== expectedDirection
            || exact.deliveryStatus !== MessageDeliveryStatus.DELIVERED
            || identities.some((identity) => identity !== row.managerMessageId)
            || (exactScope && !this.canonicalMatchesMirrorRow(exact, row))) {
            result.failed += 1;
            await this.markMirror(row.id, {
              status: LineChatMirrorReconcileStatus.FAILED,
              conversationId: mapping.conversationId,
              source: "EXACT_EXTERNAL_ID_CONFLICT",
              error: "Existing Canonical source identity conflicts with destination, direction, or payload evidence.",
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

        const contentTime = await this.findContentTimeDuplicate(
          mapping.conversationId,
          row,
          exactScope?.strictNonTextDuplicateGuard ?? false,
        );
        if (exactScope && contentTime.length > 0) {
          result.failed += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.FAILED,
            conversationId: mapping.conversationId,
            source: "EXACT_MANIFEST_CONTENT_TIME_CONFLICT",
            error: "A content/time near-match appeared after exact manifest preflight.",
          }, apply);
          continue;
        }
        // Known different source IDs are separate events. Unknown or conflicting
        // identities may be application/auto-reply echoes: hold without linking
        // or blindly importing. A capped candidate set cannot certify absence.
        const unprovenNearMatch = contentTime.some((candidate) => {
          const identities = authoritativeCanonicalIds(candidate);
          return identities.length !== 1 || identities[0] === row.managerMessageId;
        });
        if (unprovenNearMatch || contentTime.length === CONTENT_TIME_CANDIDATE_LIMIT) {
          result.ambiguous += 1;
          await this.markMirror(row.id, {
            status: LineChatMirrorReconcileStatus.AMBIGUOUS,
            conversationId: mapping.conversationId,
            source: "CONTENT_TIME_IDENTITY_UNPROVEN",
            error: "Content/time candidates lack unambiguous distinct source identity evidence.",
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
        if (await this.recomputeConversationState(conversationId, !exactScope)) {
          result.conversationsRecomputed += 1;
        }
      }
    }

    const loggedOutboundEvidence = importedOutboundEvidence.slice(
      0,
      MAX_OUTBOUND_CANONICALIZATION_DETAIL_LOGS_PER_STORE_CYCLE,
    );
    const replyStateByConversationId = new Map<string, {
      bmReplyStatus: BmReplyStatus;
      followUpStatus: FollowUpStatus;
    }>();
    if (loggedOutboundEvidence.length > 0) {
      try {
        const replyStates = await this.prisma.conversation.findMany({
          where: {
            id: { in: [...new Set(loggedOutboundEvidence.map((evidence) => evidence.conversationId))] },
          },
          select: { id: true, bmReplyStatus: true, followUpStatus: true },
        });
        for (const state of replyStates) {
          replyStateByConversationId.set(state.id, {
            bmReplyStatus: state.bmReplyStatus,
            followUpStatus: state.followUpStatus,
          });
        }
      } catch (error) {
        this.logger.warn(JSON.stringify({
          event: "line_chat_mirror_manager_outbound_reply_state_observation_failed",
          storeCode: effectiveStoreCode,
          errorType: error instanceof Error ? error.name : "UNKNOWN",
        }));
      }
    }
    for (const evidence of loggedOutboundEvidence) {
      const state = replyStateByConversationId.get(evidence.conversationId);
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
    if (importedOutboundEvidence.length > loggedOutboundEvidence.length) {
      this.logger.log(JSON.stringify({
        event: "line_chat_mirror_manager_outbound_canonicalized_details_capped",
        storeCode: effectiveStoreCode,
        eventsWithDetailsSuppressed: importedOutboundEvidence.length - loggedOutboundEvidence.length,
        maximumDetailsPerStoreCycle: MAX_OUTBOUND_CANONICALIZATION_DETAIL_LOGS_PER_STORE_CYCLE,
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

  private async findExactCanonicals(
    managerMessageId: string,
    oaId: string,
  ): Promise<Array<{
    id: string;
    conversationId: string;
    externalMessageId: string | null;
    direction: MessageDirection;
    deliveryStatus: MessageDeliveryStatus;
    messageType: MessageType;
    originalText: string;
    fileName: string | null;
    sentAt: Date;
    rawPayload: Prisma.JsonValue;
    conversation: { storeId: string | null; lineOfficialAccountId: string | null };
  }>> {
    return this.prisma.message.findMany({
      where: this.exactCanonicalIdentityWhere(managerMessageId, oaId),
      orderBy: [{ externalMessageId: "asc" }, { id: "asc" }],
      take: 3,
      select: {
        id: true,
        conversationId: true,
        externalMessageId: true,
        direction: true,
        deliveryStatus: true,
        messageType: true,
        originalText: true,
        fileName: true,
        sentAt: true,
        rawPayload: true,
        conversation: { select: { storeId: true, lineOfficialAccountId: true } },
      },
    });
  }

  private exactCanonicalIdentityWhere(
    managerMessageId: string,
    oaId?: string,
  ): Prisma.MessageWhereInput {
    const identities = [managerMessageId, mirrorCanonicalExternalId(managerMessageId)];
    if (!oaId) return { externalMessageId: { in: identities } };
    const identityFilters: Prisma.MessageWhereInput[] = [
      { externalMessageId: { in: identities } },
    ];
    for (const identity of identities) {
      identityFilters.push({
        AND: [
          { conversation: { lineOfficialAccountId: oaId } },
          { rawPayload: { path: ["providerMessageId"], equals: identity } },
        ],
      });
      identityFilters.push({
        AND: [
          { conversation: { lineOfficialAccountId: oaId } },
          { rawPayload: { path: ["managerMessageId"], equals: identity } },
        ],
      });
    }
    return { OR: identityFilters };
  }

  private canonicalMatchesMirrorRow(
    canonical: {
      conversationId: string;
      direction: MessageDirection;
      deliveryStatus: MessageDeliveryStatus;
      messageType: MessageType;
      originalText: string;
      fileName: string | null;
      sentAt: Date;
    },
    row: MirrorRow,
  ): boolean {
    return canonical.direction === MessageDirection.OUTBOUND
      && canonical.deliveryStatus === MessageDeliveryStatus.DELIVERED
      && canonical.messageType === canonicalMessageTypeFromMirror(row.messageType)
      && canonical.originalText === mirrorCanonicalText(row)
      && (canonical.messageType !== MessageType.FILE || canonical.fileName === row.fileName)
      && canonical.sentAt.getTime() === row.sentAt.getTime();
  }

  private async findContentTimeDuplicate(
    conversationId: string,
    row: MirrorRow,
    strictNonTextGuard = false,
  ): Promise<Array<{ id: string; externalMessageId: string | null; rawPayload: Prisma.JsonValue; direction: MessageDirection }>> {
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

    if (
      strictNonTextGuard
      && (messageType === MessageType.IMAGE
        || messageType === MessageType.STICKER
        || messageType === MessageType.FILE)
    ) {
      // An exact media manifest has no canonical media-byte comparator. A
      // same-type, same-direction near-time row therefore fails closed.
    } else if (messageType === MessageType.TEXT && row.text !== null) {
      where.originalText = row.text;
    } else if (messageType === MessageType.FILE && row.fileName) {
      where.fileName = row.fileName;
    } else {
      return [];
    }

    return this.prisma.message.findMany({
      where,
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: CONTENT_TIME_CANDIDATE_LIMIT,
      select: { id: true, externalMessageId: true, rawPayload: true, direction: true },
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
          select: { id: true, conversationId: true, direction: true, deliveryStatus: true, rawPayload: true, externalMessageId: true },
        });
        if (existing?.conversationId === input.conversationId
          && existing.direction === MessageDirection.OUTBOUND
          && existing.deliveryStatus === MessageDeliveryStatus.DELIVERED
          && authoritativeCanonicalIds(existing).every((identity) => identity === input.row.managerMessageId)) {
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
    if (input.conversationId && (input.source === "EXACT_EXTERNAL_ID" || input.source === "IMPORTED_OUTBOUND")) {
      try {
        const result = await new MirrorIdentityBridgeService(this.prisma).linkReconciled(mirrorMessageId);
        if (result !== "ALREADY_LINKED") this.logger.log(JSON.stringify({ event: "line_chat_mirror_identity_bridge", result }));
      } catch {
        // Identity is optional metadata. Fail closed without rewriting a successful
        // reconciliation receipt or introducing failures into normal Mirror cycles.
        this.logger.warn(JSON.stringify({ event: "line_chat_mirror_identity_bridge", result: "IDENTITY_BRIDGE_FAILED_REQUIRES_READBACK" }));
      }
    }
  }

  private async recomputeConversationState(
    conversationId: string,
    assignOwner = true,
  ): Promise<boolean> {
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
    const ownerToAssign = assignOwner && humanReply?.senderUserId && !conversation.ownerUserId
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
