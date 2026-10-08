import { LineChatMirrorDirection, MessageType } from "@prisma/client";

export const MANAGER_METADATA_EVENT_TYPES: ReadonlySet<string> = new Set(["chatread", "follow", "unfollow"]);
export function managerEventDirection(eventType: string | null | undefined): LineChatMirrorDirection {
  const normalized = eventType?.trim().toLowerCase() ?? "";
  if (normalized === "messagesent") return LineChatMirrorDirection.OUTBOUND;
  if (normalized === "messagereceived" || normalized === "message") return LineChatMirrorDirection.INBOUND;
  return LineChatMirrorDirection.UNKNOWN;
}
export function managerCanonicalMessageType(raw: string | null | undefined): MessageType {
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
export interface ManagerEventEligibility {
  kind: "CUSTOMER_MESSAGE" | "METADATA_ONLY" | "UNKNOWN";
  direction: LineChatMirrorDirection;
  normalRaw: "REQUIRED" | "NOT_REQUIRED" | "UNPROVEN";
  historicalRaw: "REQUIRED" | "UNPROVEN";
  canonical: "OUTBOUND_REQUIRED" | "INBOUND_WEBHOOK_EQUIVALENT" | "NOT_REQUIRED" | "UNPROVEN";
  reason: string | null;
}
export interface ManagerEventEligibilityInput {
  eventType: string;
  messageType: string | null;
  managerEventId: string | null;
  normalMessageIdPresent: boolean;
  timestampValid: boolean;
}
/** Certification contract, not an instruction to replay or to create canonical inbound messages. */
export function managerEventEligibility(input: ManagerEventEligibilityInput): ManagerEventEligibility {
  const normalized = input.eventType.trim().toLowerCase();
  const direction = managerEventDirection(normalized);
  const historicalRaw = input.managerEventId?.trim() && input.timestampValid ? "REQUIRED" : "UNPROVEN";
  if (!input.timestampValid) return {
    kind: "UNKNOWN", direction, normalRaw: "UNPROVEN", historicalRaw, canonical: "UNPROVEN", reason: "HISTORY_TIMESTAMP_INVALID",
  };
  if (MANAGER_METADATA_EVENT_TYPES.has(normalized)) return {
    kind: "METADATA_ONLY", direction: LineChatMirrorDirection.UNKNOWN, normalRaw: "NOT_REQUIRED",
    historicalRaw, canonical: "NOT_REQUIRED", reason: historicalRaw === "UNPROVEN" ? "METADATA_IDENTITY_UNPROVEN" : null,
  };
  const idValid = Boolean(input.managerEventId?.trim()) && !input.managerEventId?.startsWith("event:");
  const supported = managerCanonicalMessageType(input.messageType) !== MessageType.UNSUPPORTED;
  const known = direction !== LineChatMirrorDirection.UNKNOWN && supported && idValid;
  if (!known) return {
    kind: "UNKNOWN", direction, normalRaw: input.normalMessageIdPresent && idValid ? "REQUIRED" : "UNPROVEN",
    historicalRaw, canonical: "UNPROVEN", reason: !idValid ? "MESSAGE_IDENTITY_UNPROVEN"
      : direction === LineChatMirrorDirection.UNKNOWN ? "UNKNOWN_MANAGER_EVENT_TYPE" : "UNSUPPORTED_MANAGER_MESSAGE_TYPE",
  };
  return { kind: "CUSTOMER_MESSAGE", direction, normalRaw: input.normalMessageIdPresent ? "REQUIRED" : "UNPROVEN",
    historicalRaw, canonical: direction === LineChatMirrorDirection.OUTBOUND ? "OUTBOUND_REQUIRED" : "INBOUND_WEBHOOK_EQUIVALENT",
    reason: input.normalMessageIdPresent ? null : "NORMAL_MESSAGE_ID_UNPROVEN" };
}

/** Reconciliation applies the same eligibility contract and rejects stored direction drift. */
export function managerMirrorRowEligibility(input: ManagerEventEligibilityInput & {
  storedDirection: LineChatMirrorDirection;
}): ManagerEventEligibility {
  const eligibility = managerEventEligibility(input);
  if (eligibility.kind === "CUSTOMER_MESSAGE" && eligibility.direction !== input.storedDirection) {
    return {
      ...eligibility,
      kind: "UNKNOWN",
      canonical: "UNPROVEN",
      reason: "MIRROR_DIRECTION_CONFLICT",
    };
  }
  return eligibility;
}

export interface NormalManagerHistoryEvent {
  managerMessageId: string;
  eventType: string;
  direction: LineChatMirrorDirection;
  messageType: string | null;
  text: string | null;
  fileName: string | null;
  sentAt: Date;
  bizId: string | null;
}
export interface ParsedNormalManagerHistory {
  events: NormalManagerHistoryEvent[];
  issues: Readonly<Record<string, number>>;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stableManagerId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return null;
}
/** Preserve supported and unknown message-like rows, while refusing false history-success evidence. */
export function parseNormalManagerHistoryList(rawList: unknown): ParsedNormalManagerHistory {
  const issues: Record<string, number> = {};
  const addIssue = (reason: string) => { issues[reason] = (issues[reason] ?? 0) + 1; };
  if (!Array.isArray(rawList)) return { events: [], issues: { HISTORY_INVALID_SHAPE: 1 } };
  const byId = new Map<string, NormalManagerHistoryEvent>();
  const conflicting = new Set<string>();
  for (const raw of rawList) {
    if (!isRecord(raw)) { addIssue("HISTORY_TIMELINE_RECORD_INVALID"); continue; }
    const message = isRecord(raw.message) ? raw.message : {};
    const eventType = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim() : "unknown";
    const messageType = typeof message.type === "string" && message.type.trim() ? message.type.trim() : null;
    const id = stableManagerId(message.id);
    const timestamp = typeof raw.timestamp === "number" || typeof raw.timestamp === "string" && raw.timestamp.trim()
      ? Number(raw.timestamp) : Number.NaN;
    const timestampValid = Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(new Date(timestamp).getTime());
    const eligibility = managerEventEligibility({ eventType, messageType, managerEventId: id,
      normalMessageIdPresent: Boolean(id), timestampValid });
    if (eligibility.kind === "METADATA_ONLY") continue;
    if (!id || !timestampValid) { addIssue(eligibility.reason ?? "HISTORY_EVENT_IDENTITY_UNPROVEN"); continue; }
    if (eligibility.kind === "UNKNOWN") addIssue(eligibility.reason ?? "HISTORY_EVENT_ELIGIBILITY_UNPROVEN");
    const bizId = typeof raw.bizId === "string" ? raw.bizId : null;
    const event: NormalManagerHistoryEvent = { managerMessageId: id, eventType, direction: eligibility.direction,
      messageType, text: typeof message.text === "string" ? message.text : null,
      fileName: typeof message.fileName === "string" ? message.fileName : typeof message.name === "string" ? message.name : null,
      sentAt: new Date(timestamp), bizId };
    const existing = byId.get(id);
    if (existing && (existing.eventType !== event.eventType || existing.direction !== event.direction
      || existing.messageType !== event.messageType || existing.sentAt.getTime() !== event.sentAt.getTime())) {
      conflicting.add(id); addIssue("HISTORY_DUPLICATE_ID_CONFLICT");
    } else if (!existing) byId.set(id, event);
  }
  for (const id of conflicting) byId.delete(id);
  return { events: [...byId.values()], issues };
}
