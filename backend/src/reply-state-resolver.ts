export type ReplyState = "REPLIED" | "NOT_REPLIED" | "AMBIGUOUS";

export type ReplyStateAmbiguityReason =
  | "UNKNOWN_OUTBOUND_ACTOR"
  | "ORDERING_CONFLICT"
  | "UNKNOWN_EVENT_CLASSIFICATION"
  | "NO_MESSAGE_EVIDENCE";

export type ReplyEventDirection = "INBOUND" | "OUTBOUND" | "SYSTEM";
export type ReplyEventActor = "CUSTOMER" | "HUMAN_STAFF" | "AUTOMATED" | "UNKNOWN" | "NONE";
export type ReplyEventKind = "MESSAGE" | "NON_MESSAGE" | "UNKNOWN";

export type CanonicalReplyMessage = {
  id: string;
  externalMessageId?: string | null;
  direction: ReplyEventDirection;
  deliveryStatus?: "DELIVERED" | "FAILED" | "PENDING" | null;
  originalText?: string | null;
  sentAt: Date;
  senderUserId?: string | null;
  senderDisplayName?: string | null;
  rawPayload?: unknown;
};

export type HistoricalReplyMessage = {
  id: string;
  sourceEventId: string;
  sourceEventType: string;
  direction: ReplyEventDirection;
  text?: string | null;
  sentAt: Date;
  senderBizId?: string | null;
};

export type NormalizedReplyEvent = {
  stableId: string;
  source: "CANONICAL" | "HISTORICAL";
  durableIds: string[];
  direction: ReplyEventDirection;
  sentAt: Date;
  actor: ReplyEventActor;
  eventKind: ReplyEventKind;
  textFingerprint: string | null;
  classificationConflict: boolean;
};

export type ReplyCycle = {
  startedAt: Date;
  answeredAt: Date | null;
  durationSeconds: number | null;
};

export type ReplyStateResolution =
  | {
      state: "REPLIED" | "NOT_REPLIED";
      confidence: "DETERMINISTIC";
      latestCycle: ReplyCycle | null;
      eventCount: number;
    }
  | {
      state: "AMBIGUOUS";
      confidence: "AMBIGUOUS";
      reason: ReplyStateAmbiguityReason;
      reasons: ReplyStateAmbiguityReason[];
      eventCount: number;
    };

export type ResponseCycleBuildResult =
  | { status: "DETERMINISTIC"; cycles: ReplyCycle[] }
  | { status: "AMBIGUOUS"; reason: Exclude<ReplyStateAmbiguityReason, "NO_MESSAGE_EVIDENCE"> };

const AUTO_REPLY_BOT_DISPLAY_NAME = "Auto Reply Bot";
const AUTO_REPLY_BIZ_ID = "__AUTO_RESPONSE";
const MANAGER_ID_PREFIX = "line-chat-manager:";

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized.length > 0 ? normalized : null;
}

function sourceIdKeys(value: string | null | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith(MANAGER_ID_PREFIX)) {
    const bare = trimmed.slice(MANAGER_ID_PREFIX.length);
    return bare ? [trimmed, bare] : [trimmed];
  }
  return [trimmed, MANAGER_ID_PREFIX + trimmed];
}

function payloadRecord(rawPayload: unknown): Record<string, unknown> {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return {};
  return rawPayload as Record<string, unknown>;
}

function hasAutoResponsePayload(rawPayload: unknown): boolean {
  return payloadRecord(rawPayload).source === "AUTO_RESPONSE";
}

function hasManagerReplyEvidence(rawPayload: unknown): boolean {
  const raw = payloadRecord(rawPayload);
  return raw.source === "LINE_MANAGER_MIRROR" || raw.provider === "LINE_MANAGER";
}

function historicalEventKind(sourceEventType: string): ReplyEventKind {
  const normalized = sourceEventType.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized) return "UNKNOWN";
  if (["message", "messagereceived", "messagesent", "text", "textmessage", "messagetext"].includes(normalized)) return "MESSAGE";
  if (["chatread", "read", "follow", "unfollow", "postback", "unsend", "activity"].includes(normalized)) return "NON_MESSAGE";
  return "UNKNOWN";
}

export function normalizeCanonicalReplyMessage(message: CanonicalReplyMessage): NormalizedReplyEvent {
  const automated =
    message.direction === "OUTBOUND" &&
    (message.senderDisplayName?.trim() === AUTO_REPLY_BOT_DISPLAY_NAME || hasAutoResponsePayload(message.rawPayload));

  let actor: ReplyEventActor = "NONE";
  if (message.direction === "INBOUND") actor = "CUSTOMER";
  else if (message.direction === "OUTBOUND" && automated) actor = "AUTOMATED";
  else if (
    message.direction === "OUTBOUND" &&
    message.deliveryStatus === "DELIVERED" &&
    (message.senderUserId || hasManagerReplyEvidence(message.rawPayload))
  ) actor = "HUMAN_STAFF";
  else if (message.direction === "OUTBOUND" && message.deliveryStatus === "DELIVERED") actor = "UNKNOWN";

  return {
    stableId: "canonical:" + message.id,
    source: "CANONICAL",
    durableIds: sourceIdKeys(message.externalMessageId),
    direction: message.direction,
    sentAt: message.sentAt,
    actor,
    eventKind: "MESSAGE",
    textFingerprint: normalizeText(message.originalText),
    classificationConflict: false,
  };
}

export function normalizeHistoricalReplyMessage(message: HistoricalReplyMessage): NormalizedReplyEvent {
  const eventKind = historicalEventKind(message.sourceEventType);
  let actor: ReplyEventActor = "NONE";
  if (eventKind !== "NON_MESSAGE") {
    if (message.direction === "INBOUND") actor = "CUSTOMER";
    else if (message.direction === "OUTBOUND" && message.senderBizId?.trim() === AUTO_REPLY_BIZ_ID) actor = "AUTOMATED";
    else if (
      message.direction === "OUTBOUND" &&
      (message.senderBizId?.trim() || message.sourceEventType.trim().toLowerCase() === "messagesent")
    ) actor = "HUMAN_STAFF";
    else if (message.direction === "OUTBOUND") actor = "UNKNOWN";
  }

  return {
    stableId: "historical:" + message.id,
    source: "HISTORICAL",
    durableIds: sourceIdKeys(message.sourceEventId),
    direction: message.direction,
    sentAt: message.sentAt,
    actor,
    eventKind,
    textFingerprint: normalizeText(message.text),
    classificationConflict: false,
  };
}

function hasDurableOverlap(left: NormalizedReplyEvent, right: NormalizedReplyEvent): boolean {
  if (left.durableIds.length === 0 || right.durableIds.length === 0) return false;
  const ids = new Set(right.durableIds);
  return left.durableIds.some((id) => ids.has(id));
}

function mergeDuplicate(left: NormalizedReplyEvent, right: NormalizedReplyEvent): NormalizedReplyEvent {
  const canonical = left.source === "CANONICAL" ? left : right.source === "CANONICAL" ? right : left;
  const other = canonical === left ? right : left;
  const actorConflict =
    canonical.actor !== "UNKNOWN" &&
    canonical.actor !== "NONE" &&
    other.actor !== "UNKNOWN" &&
    other.actor !== "NONE" &&
    canonical.actor !== other.actor;
  const eventKindConflict =
    canonical.eventKind !== "UNKNOWN" &&
    other.eventKind !== "UNKNOWN" &&
    canonical.eventKind !== other.eventKind;
  const classificationConflict =
    canonical.classificationConflict ||
    other.classificationConflict ||
    canonical.direction !== other.direction ||
    canonical.sentAt.getTime() !== other.sentAt.getTime() ||
    actorConflict ||
    eventKindConflict;

  return {
    ...canonical,
    durableIds: [...new Set([...canonical.durableIds, ...other.durableIds])],
    actor: actorConflict ? "UNKNOWN" : canonical.actor === "UNKNOWN" || canonical.actor === "NONE" ? other.actor : canonical.actor,
    eventKind: eventKindConflict ? "UNKNOWN" : canonical.eventKind === "UNKNOWN" ? other.eventKind : canonical.eventKind,
    classificationConflict,
  };
}

function fallbackKey(event: NormalizedReplyEvent): string | null {
  if (!event.textFingerprint || event.eventKind !== "MESSAGE") return null;
  return event.sentAt.toISOString() + "\u0000" + event.direction + "\u0000" + event.textFingerprint;
}

export function deduplicateReplyEvents(events: readonly NormalizedReplyEvent[]): NormalizedReplyEvent[] {
  const merged: NormalizedReplyEvent[] = [];
  for (const event of events) {
    const index = merged.findIndex((candidate) => candidate.source !== event.source && hasDurableOverlap(candidate, event));
    if (index >= 0) merged[index] = mergeDuplicate(merged[index], event);
    else merged.push(event);
  }

  const canonicalByKey = new Map<string, number[]>();
  const historicalByKey = new Map<string, number[]>();
  merged.forEach((event, index) => {
    const key = fallbackKey(event);
    if (!key) return;
    const target = event.source === "CANONICAL" ? canonicalByKey : historicalByKey;
    target.set(key, [...(target.get(key) ?? []), index]);
  });

  const removed = new Set<number>();
  for (const [key, canonicalIndexes] of canonicalByKey) {
    const historicalIndexes = historicalByKey.get(key) ?? [];
    if (canonicalIndexes.length !== 1 || historicalIndexes.length !== 1) continue;
    const canonicalIndex = canonicalIndexes[0];
    const historicalIndex = historicalIndexes[0];
    if (removed.has(canonicalIndex) || removed.has(historicalIndex)) continue;
    merged[canonicalIndex] = mergeDuplicate(merged[canonicalIndex], merged[historicalIndex]);
    removed.add(historicalIndex);
  }
  return merged.filter((_, index) => !removed.has(index));
}

type PossibleState = {
  open: boolean;
  startedAt: Date | null;
  reasons: Set<Exclude<ReplyStateAmbiguityReason, "NO_MESSAGE_EVIDENCE">>;
};

function stateKey(state: PossibleState): string {
  return (state.open ? "1:" : "0:") + (state.startedAt?.toISOString() ?? "");
}

function mergeStates(states: PossibleState[]): PossibleState[] {
  const result = new Map<string, PossibleState>();
  for (const state of states) {
    const key = stateKey(state);
    const current = result.get(key);
    if (!current) result.set(key, { ...state, reasons: new Set(state.reasons) });
    else for (const reason of state.reasons) current.reasons.add(reason);
  }
  return [...result.values()];
}

function applyInbound(states: PossibleState[], sentAt: Date): PossibleState[] {
  return mergeStates(states.map((state) => ({
    open: true,
    startedAt: state.open ? state.startedAt : sentAt,
    reasons: new Set(state.reasons),
  })));
}

function applyHumanReply(states: PossibleState[]): PossibleState[] {
  return mergeStates(states.map((state) => ({ open: false, startedAt: null, reasons: new Set(state.reasons) })));
}

function branchUnknownOutbound(states: PossibleState[]): PossibleState[] {
  const result: PossibleState[] = [];
  for (const state of states) {
    const reasons = new Set([...state.reasons, "UNKNOWN_OUTBOUND_ACTOR" as const]);
    result.push({ ...state, reasons });
    if (state.open) result.push({ open: false, startedAt: null, reasons: new Set(reasons) });
  }
  return mergeStates(result);
}

function branchUnknownClassification(states: PossibleState[], event: NormalizedReplyEvent): PossibleState[] {
  const reason = "UNKNOWN_EVENT_CLASSIFICATION" as const;
  const ignored = states.map((state) => ({ ...state, reasons: new Set([...state.reasons, reason]) }));
  let active: PossibleState[] = [];
  if (event.direction === "INBOUND") active = applyInbound(states, event.sentAt);
  else if (event.direction === "OUTBOUND" && event.actor === "HUMAN_STAFF") active = applyHumanReply(states);
  else if (event.direction === "OUTBOUND" && event.actor === "UNKNOWN") active = branchUnknownOutbound(states);
  active = active.map((state) => ({ ...state, reasons: new Set([...state.reasons, reason]) }));
  return mergeStates([...ignored, ...active]);
}

function applyEvents(states: PossibleState[], events: readonly NormalizedReplyEvent[]): PossibleState[] {
  let current = states;
  for (const event of events) {
    if (event.eventKind === "NON_MESSAGE") continue;
    if (event.classificationConflict || event.eventKind === "UNKNOWN") {
      current = branchUnknownClassification(current, event);
      continue;
    }
    if (event.direction === "INBOUND") current = applyInbound(current, event.sentAt);
    else if (event.direction === "OUTBOUND" && event.actor === "HUMAN_STAFF") current = applyHumanReply(current);
    else if (event.direction === "OUTBOUND" && event.actor === "UNKNOWN") current = branchUnknownOutbound(current);
  }
  return mergeStates(current);
}

function sorted(events: readonly NormalizedReplyEvent[]): NormalizedReplyEvent[] {
  return [...events].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime() || a.stableId.localeCompare(b.stableId));
}

function possibilities(events: readonly NormalizedReplyEvent[]): { states: PossibleState[]; sawPotentialInbound: boolean } {
  const ordered = sorted(events);
  let states: PossibleState[] = [{ open: false, startedAt: null, reasons: new Set() }];
  let sawPotentialInbound = false;

  for (let index = 0; index < ordered.length;) {
    const time = ordered[index].sentAt.getTime();
    const group: NormalizedReplyEvent[] = [];
    while (index < ordered.length && ordered[index].sentAt.getTime() === time) group.push(ordered[index++]);

    if (group.some((event) => event.direction === "INBOUND" && event.eventKind !== "NON_MESSAGE")) sawPotentialInbound = true;

    const inbound = group.filter((event) => !event.classificationConflict && event.eventKind === "MESSAGE" && event.direction === "INBOUND");
    const replies = group.filter((event) =>
      !event.classificationConflict &&
      event.eventKind === "MESSAGE" &&
      event.direction === "OUTBOUND" &&
      (event.actor === "HUMAN_STAFF" || event.actor === "UNKNOWN"),
    );

    if (inbound.length > 0 && replies.length > 0) {
      const other = group.filter((event) => !inbound.includes(event) && !replies.includes(event));
      const addReason = (items: PossibleState[]) => items.map((state) => ({
        ...state,
        reasons: new Set([...state.reasons, "ORDERING_CONFLICT" as const]),
      }));
      states = mergeStates([
        ...addReason(applyEvents(states, [...inbound, ...replies, ...other])),
        ...addReason(applyEvents(states, [...replies, ...inbound, ...other])),
      ]);
    } else states = applyEvents(states, group);
  }
  return { states: mergeStates(states), sawPotentialInbound };
}

function ambiguity(states: PossibleState[]) {
  const found = new Set<Exclude<ReplyStateAmbiguityReason, "NO_MESSAGE_EVIDENCE">>();
  for (const state of states) for (const reason of state.reasons) found.add(reason);
  const ordered: Array<Exclude<ReplyStateAmbiguityReason, "NO_MESSAGE_EVIDENCE">> = [
    "ORDERING_CONFLICT",
    "UNKNOWN_OUTBOUND_ACTOR",
    "UNKNOWN_EVENT_CLASSIFICATION",
  ];
  const reasons = ordered.filter((reason) => found.has(reason));
  return { reason: reasons[0] ?? "UNKNOWN_EVENT_CLASSIFICATION", reasons };
}

export function buildDeterministicResponseCycles(events: readonly NormalizedReplyEvent[]): ResponseCycleBuildResult {
  const ordered = sorted(deduplicateReplyEvents(events));
  const cycles: ReplyCycle[] = [];
  let openStartedAt: Date | null = null;

  for (let index = 0; index < ordered.length;) {
    const time = ordered[index].sentAt.getTime();
    const group: NormalizedReplyEvent[] = [];
    while (index < ordered.length && ordered[index].sentAt.getTime() === time) group.push(ordered[index++]);
    const relevant = group.filter((event) => event.eventKind !== "NON_MESSAGE" && event.direction !== "SYSTEM");

    if (relevant.some((event) => event.classificationConflict || event.eventKind === "UNKNOWN")) {
      return { status: "AMBIGUOUS", reason: "UNKNOWN_EVENT_CLASSIFICATION" };
    }
    if (
      relevant.some((event) => event.direction === "INBOUND") &&
      relevant.some((event) =>
        event.direction === "OUTBOUND" &&
        (event.actor === "HUMAN_STAFF" || event.actor === "UNKNOWN"),
      )
    ) return { status: "AMBIGUOUS", reason: "ORDERING_CONFLICT" };

    for (const event of relevant) {
      if (event.direction === "INBOUND") {
        openStartedAt ??= event.sentAt;
        continue;
      }
      if (event.direction !== "OUTBOUND") continue;
      if (event.actor === "UNKNOWN" && openStartedAt) return { status: "AMBIGUOUS", reason: "UNKNOWN_OUTBOUND_ACTOR" };
      if (event.actor !== "HUMAN_STAFF" || !openStartedAt) continue;
      cycles.push({
        startedAt: openStartedAt,
        answeredAt: event.sentAt,
        durationSeconds: Math.max(0, (event.sentAt.getTime() - openStartedAt.getTime()) / 1000),
      });
      openStartedAt = null;
    }
  }

  if (openStartedAt) cycles.push({ startedAt: openStartedAt, answeredAt: null, durationSeconds: null });
  return { status: "DETERMINISTIC", cycles };
}

export function resolveReplyState(events: readonly NormalizedReplyEvent[]): ReplyStateResolution {
  const deduped = deduplicateReplyEvents(events);
  const evaluation = possibilities(deduped);
  if (!evaluation.sawPotentialInbound) {
    return {
      state: "AMBIGUOUS",
      confidence: "AMBIGUOUS",
      reason: "NO_MESSAGE_EVIDENCE",
      reasons: ["NO_MESSAGE_EVIDENCE"],
      eventCount: deduped.length,
    };
  }

  const openValues = new Set(evaluation.states.map((state) => state.open));
  if (openValues.size > 1) {
    const detail = ambiguity(evaluation.states);
    return {
      state: "AMBIGUOUS",
      confidence: "AMBIGUOUS",
      reason: detail.reason,
      reasons: detail.reasons,
      eventCount: deduped.length,
    };
  }

  const cycleResult = buildDeterministicResponseCycles(deduped);
  return {
    state: openValues.has(true) ? "NOT_REPLIED" : "REPLIED",
    confidence: "DETERMINISTIC",
    latestCycle: cycleResult.status === "DETERMINISTIC" ? cycleResult.cycles.at(-1) ?? null : null,
    eventCount: deduped.length,
  };
}

export function normalizeReplyTimeline(input: {
  canonical?: readonly CanonicalReplyMessage[];
  historical?: readonly HistoricalReplyMessage[];
}): NormalizedReplyEvent[] {
  return deduplicateReplyEvents([
    ...(input.canonical ?? []).map(normalizeCanonicalReplyMessage),
    ...(input.historical ?? []).map(normalizeHistoricalReplyMessage),
  ]);
}
