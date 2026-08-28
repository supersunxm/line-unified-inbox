export type LineSource = {
  type: string;
  userId?: string;
  groupId?: string;
  roomId?: string;
};

type LineMessageBase = { id: string; type: string };
export type LineMessage =
  | (LineMessageBase & { type: "text"; text: string })
  | (LineMessageBase & { type: "image" | "video" | "audio" | "sticker" })
  | (LineMessageBase & { type: "file"; fileName?: string })
  | (LineMessageBase & { type: "location"; title?: string; address?: string; latitude?: number; longitude?: number })
  | LineMessageBase;

export type LinePostback = {
  data: string;
  params?: Record<string, any>;
};

type LineEventBase = {
  type: string;
  timestamp: number;
  source: LineSource;
  replyToken?: string;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
};

export type LineWebhookEvent =
  | (LineEventBase & { type: "message"; message: LineMessage })
  | (LineEventBase & { type: "follow"; follow?: { isUnblocked?: boolean } })
  | (LineEventBase & { type: "unfollow" })
  | (LineEventBase & { type: "postback"; postback: LinePostback })
  | LineEventBase;

export type LineWebhookBody = {
  destination?: string;
  events: LineWebhookEvent[];
};

export function isLineWebhookBody(value: unknown): value is LineWebhookBody {
  return typeof value === "object" && value !== null && Array.isArray((value as { events?: unknown }).events);
}

export function messagePlaceholder(message: LineMessage): string {
  switch (message.type) {
    case "text": return "text" in message ? message.text : "[Unsupported message]";
    case "image": return "[Image]";
    case "video": return "[Video]";
    case "audio": return "[Audio]";
    case "file": return `[File: ${"fileName" in message && message.fileName ? message.fileName : "file"}]`;
    case "location": {
      const details = "title" in message ? message.title || message.address : undefined;
      return `[Location${details ? `: ${details}` : ""}]`;
    }
    case "sticker": return "[Sticker]";
    default: return "[Unsupported message]";
  }
}
