import type { ApiConversation } from "@/types/api";

export type RealtimeMessageEvent = {
  type: "message.created" | "message.media.updated";
  conversationId: string;
  message?: {
    id: string;
    direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
    messageType: ApiConversation["messages"][number]["messageType"];
    text: string;
    sentAt: string;
    sender?: { userId: string | null; displayName: string } | null;
    media: { processingStatus: "PENDING" | "READY" | "FAILED" | "SKIPPED"; mimeType?: string | null; fileSize?: number | null; url?: string | null } | null;
  };
};

/** Convert the compact SSE message contract into the full API message shape. */
export function mapRealtimeMessage(message: NonNullable<RealtimeMessageEvent["message"]>): ApiConversation["messages"][number] {
  return {
    id: message.id,
    direction: message.direction,
    messageType: message.messageType,
    originalText: message.text,
    originalLanguage: null,
    translatedThai: null,
    translatedEnglish: null,
    translatedChinese: null,
    sentAt: message.sentAt,
    fileName: null,
    sender: message.sender ?? null,
    media: message.media
      ? {
          processingStatus: message.media.processingStatus,
          mimeType: message.media.mimeType ?? null,
          fileSize: message.media.fileSize ?? null,
          url: message.media.url ?? null,
        }
      : null,
    latitude: null,
    longitude: null,
  };
}

export function subscribeToRealtimeEvents(onEvent: (event: RealtimeMessageEvent) => void): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return () => undefined;
  const source = new EventSource("/api-backend/realtime/events");
  const handle = (event: Event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data) as RealtimeMessageEvent;
      if (payload?.conversationId && payload?.message && (payload.type === "message.created" || payload.type === "message.media.updated")) onEvent(payload);
    } catch {
      // A malformed event is recovered by the existing polling/reload path.
    }
  };
  source.addEventListener("message.created", handle);
  source.addEventListener("message.media.updated", handle);
  return () => {
    source.removeEventListener("message.created", handle);
    source.removeEventListener("message.media.updated", handle);
    source.close();
  };
}
