import { MessageDirection, MessageType, type Prisma } from "@prisma/client";

type ArchiveMediaEvent = {
  storeId: string;
  conversationId: string;
  sourceEventId: string;
  deterministicIdentity: string;
  timestamp: string;
  type: string;
  direction: string;
  messageType: string | null;
  text: string | null;
  rawMetadata: unknown;
  sourcePageIdentity?: string | null;
};

export type HistoricalMediaType = typeof MessageType.IMAGE | typeof MessageType.VIDEO | typeof MessageType.FILE | typeof MessageType.STICKER;

export type HistoricalMediaRecord = {
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  sourceEventId: string;
  sourceEventType: string;
  messageType: HistoricalMediaType;
  direction: typeof MessageDirection.INBOUND | typeof MessageDirection.OUTBOUND;
  text: "";
  mediaMetadata: Prisma.InputJsonObject;
  fileName: string | null;
  sentAt: Date;
  senderBizId: string | null;
  sourceArchiveKey: string;
  sourceArchiveSha256: string;
  sourcePageIdentity: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function metadataDuration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function isHistoricalMediaEvent(event: Pick<ArchiveMediaEvent, "type" | "messageType">): boolean {
  return ["message", "messagesent", "messagereceived"].includes(event.type.trim().toLowerCase())
    && ["image", "video", "file", "sticker"].includes(event.messageType?.trim().toLowerCase() ?? "");
}

export function mapHistoricalMediaEvent(input: {
  event: ArchiveMediaEvent;
  storeId: string;
  lineOfficialAccountId: string;
  sourceArchiveKey: string;
  sourceArchiveSha256: string;
}): HistoricalMediaRecord {
  const event = input.event;
  if (!isHistoricalMediaEvent(event)) throw new Error("NOT_A_HISTORICAL_MEDIA_EVENT");
  const sentAtMs = Date.parse(event.timestamp);
  if (!Number.isFinite(sentAtMs) || sentAtMs < Date.parse("2026-08-31T17:00:00.000Z")) throw new Error("HISTORICAL_MEDIA_OUTSIDE_TARGET");
  if (event.storeId !== input.storeId || !/^U[a-f0-9]{32}$/iu.test(event.conversationId)
    || !event.sourceEventId.trim() || event.deterministicIdentity !== `line-chat-manager:${event.sourceEventId}`
    || event.rawMetadata === null || typeof event.rawMetadata !== "object" || Array.isArray(event.rawMetadata)) {
    throw new Error("HISTORICAL_MEDIA_IDENTITY_INVALID");
  }
  const direction = event.direction === MessageDirection.INBOUND
    ? MessageDirection.INBOUND
    : event.direction === MessageDirection.OUTBOUND
      ? MessageDirection.OUTBOUND
      : null;
  if (!direction) throw new Error("HISTORICAL_MEDIA_DIRECTION_INVALID");

  const message = asRecord(asRecord(event.rawMetadata).message);
  const messageType = event.messageType?.trim().toLowerCase();
  const mediaMetadata: Record<string, string | number> = { availability: "METADATA_ONLY" };
  const sourceReferenceId = metadataString(message.id);
  const packageId = metadataString(message.packageId);
  const stickerId = metadataString(message.stickerId);
  const resourceType = metadataString(message.resourceType);
  const duration = metadataDuration(message.duration);
  const fileName = metadataString(message.fileName);
  if (sourceReferenceId) mediaMetadata.sourceReferenceId = sourceReferenceId;
  if (messageType === "sticker") {
    if (packageId) mediaMetadata.packageId = packageId;
    if (stickerId) mediaMetadata.stickerId = stickerId;
    if (resourceType) mediaMetadata.resourceType = resourceType;
    if (!packageId || !stickerId) throw new Error("HISTORICAL_STICKER_ID_METADATA_MISSING");
  }
  if (messageType === "video" && duration !== null) mediaMetadata.duration = duration;
  if (messageType === "file" && fileName) mediaMetadata.fileName = fileName;

  const type = messageType === "image" ? MessageType.IMAGE
    : messageType === "video" ? MessageType.VIDEO
      : messageType === "file" ? MessageType.FILE
        : MessageType.STICKER;
  const metadata = asRecord(event.rawMetadata);
  const senderBizId = metadataString(metadata.bizId);
  return {
    storeId: input.storeId,
    lineOfficialAccountId: input.lineOfficialAccountId,
    lineChatUserId: event.conversationId,
    sourceEventId: event.sourceEventId,
    sourceEventType: event.type,
    messageType: type,
    direction,
    text: "",
    mediaMetadata,
    fileName: fileName ?? null,
    sentAt: new Date(sentAtMs),
    senderBizId,
    sourceArchiveKey: input.sourceArchiveKey,
    sourceArchiveSha256: input.sourceArchiveSha256,
    sourcePageIdentity: event.sourcePageIdentity ?? null,
  };
}
