import { Injectable } from "@nestjs/common";
import type { QuickReplyGenerationRecord } from "./quick-reply.types";

@Injectable()
export class QuickReplyGenerationStore {
  private readonly records = new Map<string, QuickReplyGenerationRecord>();

  remember(record: QuickReplyGenerationRecord) {
    this.removeExpired();
    this.records.set(record.generationId, record);
  }

  get(generationId: string) {
    this.removeExpired();
    return this.records.get(generationId);
  }

  delete(generationId: string) {
    this.records.delete(generationId);
  }

  private removeExpired() {
    const now = Date.now();
    for (const [id, record] of this.records) if (record.expiresAt <= now) this.records.delete(id);
  }
}
