import { Injectable } from "@nestjs/common";
import { AuditLogService } from "../../auth/audit-log.service";
import type { QuickReplyActor, QuickReplyAuditEvent } from "./quick-reply.types";

@Injectable()
export class QuickReplyAuditService {
  constructor(private readonly audit: AuditLogService) {}

  async record(event: QuickReplyAuditEvent, actor: QuickReplyActor) {
    await this.audit.record({
      actorUserId: actor.id,
      action: `AI_QUICK_REPLY_${event.eventType}`,
      metadata: {
        conversationId: event.conversationId,
        contextMessageId: event.contextMessageId,
        generationId: event.generationId,
        providerName: event.providerName,
        providerVersion: event.providerVersion,
        sourceTypes: event.sourceTypes,
        riskFlags: event.riskFlags,
        latencyMs: event.latencyMs,
        outcome: event.outcome,
      },
    });
  }
}
