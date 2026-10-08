import { createHash } from "node:crypto";
import { MANAGER_METADATA_EVENT_TYPES, managerEventDirection } from "./line-chat-manager-event-contract";
import { historyTimestampsOrdered } from "./line-chat-history-pagination";
import { LineChatMirrorDirection } from "@prisma/client";

export const LINE_CHAT_HISTORICAL_LOWER_BOUND_ISO = "2026-09-01T00:00:00+07:00";
export const LINE_CHAT_HISTORICAL_PILOT_STORE_CODES = ["29113", "28375", "25610"] as const;
const EVENT_ONLY_TIMELINE_TYPES = MANAGER_METADATA_EVENT_TYPES;

export const HistoricalBackfillStatus = {
  FETCHING_INITIAL_PAGE: "FETCHING_INITIAL_PAGE",
  FAST_PATH_COMPLETE: "FAST_PATH_COMPLETE",
  NEEDS_BACKWARD_PAGINATION: "NEEDS_BACKWARD_PAGINATION",
  HISTORICAL_COVERAGE_UNPROVEN: "HISTORICAL_COVERAGE_UNPROVEN",
  FAILED: "FAILED",
} as const;

export type HistoricalBackfillStatusValue =
  typeof HistoricalBackfillStatus[keyof typeof HistoricalBackfillStatus];

export interface HistoricalMirrorEvent {
  managerMessageId: string;
  eventType: string;
  direction: LineChatMirrorDirection;
  messageType: string | null;
  text: string | null;
  fileName: string | null;
  sentAt: Date;
  bizId: string | null;
  ownerName: string | null;
}

export interface ParsedManagerHistoryPage {
  events: HistoricalMirrorEvent[];
  invalidEventCount: number;
  backwardPresent: boolean;
  responseShapeValid: boolean;
  timestampOrderValid: boolean;
}

export interface HistoricalPageClassification {
  status: HistoricalBackfillStatusValue;
  errorCode: string | null;
  backwardRequired: boolean | null;
  complete: boolean;
  oldestValidTimestamp: Date | null;
  newestValidTimestamp: Date | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEpochMilliseconds(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? timestamp : null;
}

function parseManagerTimestamp(value: unknown): Date | null {
  const timestamp = parseEpochMilliseconds(value);
  return timestamp === null ? null : new Date(timestamp);
}

function parseStableNonnegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function managerIdValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return "";
}

function stableScalarString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return null;
}

function deriveHistoricalManagerEventIdentity(
  rawEvent: unknown,
): string | null {
  if (!isRecord(rawEvent)) return null;
  const rawMessage = isRecord(rawEvent.message) ? rawEvent.message : {};
  const nestedMessageId = managerIdValue(rawMessage.id);
  if (nestedMessageId) return nestedMessageId;

  const topLevelEventId = managerIdValue(rawEvent.id);
  if (topLevelEventId) return topLevelEventId;

  const eventType = typeof rawEvent.type === "string" ? rawEvent.type.trim().toLowerCase() : "";
  if (!EVENT_ONLY_TIMELINE_TYPES.has(eventType)) return null;

  const timestamp = parseEpochMilliseconds(rawEvent.timestamp);
  const source = isRecord(rawEvent.source) ? rawEvent.source : {};
  const chatId = stableScalarString(source.chatId);
  const userId = stableScalarString(source.userId);
  if (timestamp === null || !chatId || !userId) return null;

  let watermark: number | null = null;
  if (eventType === "chatread") {
    const read = isRecord(rawEvent.read) ? rawEvent.read : {};
    watermark = parseStableNonnegativeNumber(read.watermark);
    if (watermark === null) return null;
  }

  const bizId = stableScalarString(rawEvent.bizId);
  // Hash a fixed, ordered list of stable scalar fields, never the raw event object.
  const stableIdentity = JSON.stringify([
    "line-manager-event-v1",
    eventType,
    timestamp,
    chatId,
    userId,
    watermark,
    bizId,
  ]);
  const stableHash = createHash("sha256").update(stableIdentity).digest("hex");
  return `event:${eventType}:${stableHash}`;
}

export function deriveHistoricalManagerEventId(rawEvent: unknown): string | null {
  return deriveHistoricalManagerEventIdentity(rawEvent);
}

export function lineChatHistoricalLowerBound(): Date {
  return new Date(LINE_CHAT_HISTORICAL_LOWER_BOUND_ISO);
}

export function isHistoricalBackfillEventInRange(
  timestamp: Date,
  targetStartAt: Date,
  freezeAt: Date,
): boolean {
  const time = timestamp.getTime();
  return Number.isFinite(time)
    && time >= targetStartAt.getTime()
    && time <= freezeAt.getTime();
}

export function parseManagerHistoryPage(
  raw: unknown,
  ownerByBizId: ReadonlyMap<string, string> = new Map(),
): ParsedManagerHistoryPage {
  const body = isRecord(raw) ? raw : {};
  const rawList = Array.isArray(body.list) ? body.list : [];
  const events: HistoricalMirrorEvent[] = [];
  let invalidEventCount = 0;

  for (const rawEvent of rawList) {
    if (!isRecord(rawEvent)) {
      invalidEventCount += 1;
      continue;
    }
    const rawMessage = isRecord(rawEvent.message) ? rawEvent.message : {};
    const managerMessageId = deriveHistoricalManagerEventIdentity(rawEvent);
    const sentAt = parseManagerTimestamp(rawEvent.timestamp);
    if (!managerMessageId || !sentAt) {
      invalidEventCount += 1;
      continue;
    }

    const eventType = typeof rawEvent.type === "string" && rawEvent.type.trim()
      ? rawEvent.type.trim()
      : "unknown";
    const eventOnly = EVENT_ONLY_TIMELINE_TYPES.has(eventType.toLowerCase());
    const messageType = !eventOnly && typeof rawMessage.type === "string" && rawMessage.type.trim()
      ? rawMessage.type.trim()
      : null;
    const bizId = typeof rawEvent.bizId === "string" ? rawEvent.bizId : null;
    const fileName = typeof rawMessage.fileName === "string"
      ? rawMessage.fileName
      : typeof rawMessage.name === "string"
        ? rawMessage.name
        : null;
    events.push({
      managerMessageId,
      eventType,
      direction: managerEventDirection(eventType),
      messageType,
      text: !eventOnly && messageType?.toLowerCase() === "text"
        && typeof rawMessage.text === "string"
        ? rawMessage.text
        : null,
      fileName: eventOnly ? null : fileName,
      sentAt,
      bizId,
      ownerName: !eventOnly && bizId && bizId !== "__AUTO_RESPONSE"
        ? ownerByBizId.get(bizId) ?? null
        : null,
    });
  }

  return {
    events,
    invalidEventCount,
    responseShapeValid: isRecord(raw) && Array.isArray(body.list),
    timestampOrderValid: historyTimestampsOrdered(events.map((event) => event.sentAt.getTime())),
    backwardPresent: typeof body.backward === "string" && body.backward.trim().length > 0,
  };
}


export function classifyHistoricalPage(
  page: Pick<ParsedManagerHistoryPage, "events" | "backwardPresent">
    & Partial<Pick<ParsedManagerHistoryPage, "invalidEventCount" | "responseShapeValid" | "timestampOrderValid">>,
  lowerBound = lineChatHistoricalLowerBound(),
): HistoricalPageClassification {
  const times = page.events.map((event) => event.sentAt.getTime());
  const ordered = historyTimestampsOrdered(times);
  const evidenceError = page.responseShapeValid === false ? "HISTORY_INVALID_SHAPE"
    : (page.invalidEventCount ?? 0) > 0 ? "HISTORY_INVALID_EVENTS"
      : times.some((t) => !Number.isFinite(t)) ? "HISTORY_INVALID_TIMESTAMP"
        : !ordered || page.timestampOrderValid === false ? "HISTORY_TIMESTAMP_INVERSION"
          : !Number.isFinite(lowerBound.getTime()) ? "HISTORY_INVALID_BOUNDARY" : null;
  if (evidenceError) return {
    status: HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN, errorCode: evidenceError,
    backwardRequired: null, complete: false, oldestValidTimestamp: null, newestValidTimestamp: null,
  };
  if (page.events.length === 0) {
    return {
      status: HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN,
      errorCode: "NO_VALID_EVENTS",
      backwardRequired: null,
      complete: false,
      oldestValidTimestamp: null,
      newestValidTimestamp: null,
    };
  }

  let oldestValidTimestamp = page.events[0].sentAt;
  let newestValidTimestamp = page.events[0].sentAt;
  for (const event of page.events.slice(1)) {
    if (event.sentAt.getTime() < oldestValidTimestamp.getTime()) {
      oldestValidTimestamp = event.sentAt;
    }
    if (event.sentAt.getTime() > newestValidTimestamp.getTime()) {
      newestValidTimestamp = event.sentAt;
    }
  }

  if (oldestValidTimestamp.getTime() <= lowerBound.getTime()) {
    return {
      status: HistoricalBackfillStatus.FAST_PATH_COMPLETE,
      errorCode: null,
      backwardRequired: false,
      complete: true,
      oldestValidTimestamp,
      newestValidTimestamp,
    };
  }
  if (page.backwardPresent) {
    return {
      status: HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION,
      errorCode: "BACKWARD_CONTRACT_UNPROVEN",
      backwardRequired: true,
      complete: false,
      oldestValidTimestamp,
      newestValidTimestamp,
    };
  }
  return {
    status: HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN,
    errorCode: "NO_BACKWARD_CONTINUATION",
    backwardRequired: false,
    complete: false,
    oldestValidTimestamp,
    newestValidTimestamp,
  };
}

export function historicalBackfillCanResume(status: string | null): boolean {
  return status === null
    || status === HistoricalBackfillStatus.FETCHING_INITIAL_PAGE
    || status === HistoricalBackfillStatus.FAILED;
}

export function historicalFetchStartedPatch(at: Date): {
  historicalBackfillStatus: string;
  historicalBackfillLowerBoundAt: Date;
  historicalBackfillOldestAt: null;
  historicalBackfillNewestAt: null;
  historicalBackfillLastAttemptAt: Date;
  historicalBackfillBackwardRequired: null;
  historicalBackfillErrorCode: null;
} {
  return {
    historicalBackfillStatus: HistoricalBackfillStatus.FETCHING_INITIAL_PAGE,
    historicalBackfillLowerBoundAt: lineChatHistoricalLowerBound(),
    historicalBackfillOldestAt: null,
    historicalBackfillNewestAt: null,
    historicalBackfillLastAttemptAt: at,
    historicalBackfillBackwardRequired: null,
    historicalBackfillErrorCode: null,
  };
}

export function historicalFetchResultPatch(
  classification: HistoricalPageClassification,
  completedAt: Date,
): {
  historicalBackfillStatus: string;
  historicalBackfillLowerBoundAt: Date;
  historicalBackfillOldestAt: Date | null;
  historicalBackfillNewestAt: Date | null;
  historicalBackfillLastSuccessAt: Date;
  historicalBackfillBackwardRequired: boolean | null;
  historicalBackfillErrorCode: string | null;
} {
  return {
    historicalBackfillStatus: classification.status,
    historicalBackfillLowerBoundAt: lineChatHistoricalLowerBound(),
    historicalBackfillOldestAt: classification.oldestValidTimestamp,
    historicalBackfillNewestAt: classification.newestValidTimestamp,
    historicalBackfillLastSuccessAt: completedAt,
    historicalBackfillBackwardRequired: classification.backwardRequired,
    historicalBackfillErrorCode: classification.errorCode,
  };
}

export function historicalFetchFailurePatch(errorCode: string): {
  historicalBackfillStatus: string;
  historicalBackfillLowerBoundAt: Date;
  historicalBackfillErrorCode: string;
} {
  return {
    historicalBackfillStatus: HistoricalBackfillStatus.FAILED,
    historicalBackfillLowerBoundAt: lineChatHistoricalLowerBound(),
    historicalBackfillErrorCode: errorCode.slice(0, 80),
  };
}

export interface HistoricalMessageWriter {
  findExistingIds(lineOfficialAccountId: string, managerMessageIds: string[]): Promise<string[]>;
  upsert(
    lineOfficialAccountId: string,
    lineChatUserId: string,
    event: HistoricalMirrorEvent,
  ): Promise<void>;
}

export interface HistoricalMessagePersistenceResult {
  observed: number;
  upsertOperations: number;
  existingBeforeWrite: number;
}

export async function persistHistoricalEvents(input: {
  writer: HistoricalMessageWriter;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  events: HistoricalMirrorEvent[];
}): Promise<HistoricalMessagePersistenceResult> {
  const managerMessageIds = [...new Set(input.events.map((event) => event.managerMessageId))];
  const existingIds = managerMessageIds.length > 0
    ? await input.writer.findExistingIds(input.lineOfficialAccountId, managerMessageIds)
    : [];
  const existing = new Set(existingIds);
  for (const event of input.events) {
    await input.writer.upsert(input.lineOfficialAccountId, input.lineChatUserId, event);
  }
  return {
    observed: input.events.length,
    upsertOperations: input.events.length,
    existingBeforeWrite: existing.size,
  };
}

export async function runIndependently<TInput, TResult>(input: {
  items: readonly TInput[];
  process: (item: TInput) => Promise<TResult>;
  onFailure: (item: TInput, error: unknown) => Promise<void>;
}): Promise<{ results: TResult[]; failures: number }> {
  const results: TResult[] = [];
  let failures = 0;
  for (const item of input.items) {
    try {
      results.push(await input.process(item));
    } catch (error) {
      failures += 1;
      await input.onFailure(item, error).catch(() => {});
    }
  }
  return { results, failures };
}
