import type { ApiConversation } from "@/types/api";

type Message = ApiConversation["messages"][number];

export function historicalMediaPlaceholder(message: Message): { label: string; detail: string | null } | null {
  if (!message.historical || message.messageType === "TEXT") return null;
  if (message.messageType === "STICKER") {
    const ids = message.historicalMediaMetadata?.packageId && message.historicalMediaMetadata.stickerId
      ? `Package ${message.historicalMediaMetadata.packageId} · Sticker ${message.historicalMediaMetadata.stickerId}`
      : "Sticker identifiers unavailable";
    return { label: "Historical sticker unavailable", detail: ids };
  }
  if (message.messageType === "IMAGE") return { label: "Historical image unavailable", detail: null };
  if (message.messageType === "VIDEO") {
    const duration = message.historicalMediaMetadata?.duration;
    return { label: "Historical video unavailable", detail: duration === null || duration === undefined ? null : `Duration: ${duration}s` };
  }
  if (message.messageType === "FILE") return { label: "Historical file unavailable", detail: message.fileName };
  return { label: `Historical ${message.messageType.toLowerCase()} unavailable`, detail: null };
}
