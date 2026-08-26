import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export type RealtimeEvent = {
  type: "conversation.updated" | "message.created" | "message.media.updated";
  version: 1;
  conversationId: string;
  storeId: string | null;
  message?: { id: string; direction: string; messageType: string; text: string; sentAt: string; media: null | { processingStatus: string; mimeType?: string | null; fileSize?: number | null; url?: string | null } };
  conversation?: { id: string; latestMessageAt: string; bmReplyStatus: string };
};

@Injectable()
export class RealtimeEventService {
  private readonly events = new Subject<RealtimeEvent>();
  publish(event: RealtimeEvent) { this.events.next(event); }
  stream() { return this.events.asObservable(); }
}
