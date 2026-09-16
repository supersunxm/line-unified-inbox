import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { AutoResponseTriggerType } from "@prisma/client";
import { AuditLogService } from "../auth/audit-log.service";
import type { AuthUser } from "../auth/auth.guard";
import { MediaStorageService } from "../media/media-storage";
import { PrismaService } from "../prisma.service";
import { RichMessageService } from "../rich-message/rich-message.service";
import { AutoResponseService } from "./auto-response.service";
import type {
  AutoResponseMessageBlock,
  AutoResponsePreviewDto,
  AutoResponsePreviewResult,
  AutoResponseRuleResponseDto,
  CreateAutoResponseDto,
  UpdateAutoResponseDto,
} from "./auto-response.types";
import { normalizeAutoResponseMessages } from "./auto-response.utils";

@Injectable()
export class AutoResponseRichMessageService extends AutoResponseService {
  constructor(
    private readonly richPrisma: PrismaService,
    private readonly richMessages: RichMessageService,
    @Optional() auditLog?: AuditLogService,
    @Optional() media?: MediaStorageService,
  ) {
    super(richPrisma, auditLog, media);
  }

  private getRichBlocks(messages: AutoResponseMessageBlock[] | undefined) {
    return (messages || []).filter(
      (block): block is Extract<AutoResponseMessageBlock, { type: "RICH_MESSAGE" }> =>
        block.type === "RICH_MESSAGE",
    );
  }

  private async validateRichReferences(
    messages: AutoResponseMessageBlock[] | undefined,
    options?: { requireActive?: boolean; triggerType?: AutoResponseTriggerType },
  ) {
    const richBlocks = this.getRichBlocks(messages);
    if (!richBlocks.length) return;

    if (options?.triggerType === AutoResponseTriggerType.INBOUND_TEXT) {
      throw new BadRequestException(
        "Rich Message blocks are supported for postback auto-response rules only.",
      );
    }

    for (const block of richBlocks) {
      let rich;
      try {
        rich = await this.richMessages.get(block.richMessageId);
      } catch {
        throw new BadRequestException(
          `Rich Message '${block.richMessageId}' was not found.`,
        );
      }
      if (options?.requireActive && !rich.isActive) {
        throw new BadRequestException(
          `Rich Message '${rich.name}' is inactive and cannot be used by an active Auto-response rule.`,
        );
      }
    }
  }

  override async createRule(
    dto: CreateAutoResponseDto,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    await this.validateRichReferences(dto.messages, {
      triggerType: dto.triggerType,
    });
    return super.createRule(dto, user);
  }

  override async updateRule(
    id: string,
    dto: UpdateAutoResponseDto,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    if (dto.messages) {
      const current = await this.richPrisma.autoResponseRule.findUnique({
        where: { id },
        select: { triggerType: true },
      });
      await this.validateRichReferences(dto.messages, {
        triggerType: dto.triggerType ?? current?.triggerType,
      });
    }
    return super.updateRule(id, dto, user);
  }

  override async activateRule(
    id: string,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    const rule = await this.richPrisma.autoResponseRule.findUnique({
      where: { id },
      select: { textTemplate: true, contentJson: true, triggerType: true },
    });
    if (rule) {
      await this.validateRichReferences(normalizeAutoResponseMessages(rule), {
        requireActive: true,
        triggerType: rule.triggerType,
      });
    }
    return super.activateRule(id, user);
  }

  override async previewRule(
    id: string,
    input?: AutoResponsePreviewDto,
  ): Promise<AutoResponsePreviewResult> {
    const base = await super.previewRule(id, input);
    const rule = await this.richPrisma.autoResponseRule.findUnique({
      where: { id },
      select: { textTemplate: true, contentJson: true },
    });
    if (!rule) return base;

    const raw = normalizeAutoResponseMessages(rule);
    if (!raw.some((block) => block.type === "RICH_MESSAGE")) return base;

    const existingById = new Map(base.messages.map((block) => [block.id, block]));
    let ready = base.ready;
    let reason = base.reason;
    const messages: AutoResponsePreviewResult["messages"] = [];

    for (const block of raw) {
      if (block.type !== "RICH_MESSAGE") {
        const existing = existingById.get(block.id);
        if (existing) messages.push(existing);
        continue;
      }

      try {
        const rich = await this.richMessages.get(block.richMessageId);
        const isValid = rich.isActive;
        if (!isValid) {
          ready = false;
          reason ||= `Rich Message '${rich.name}' is inactive`;
        }
        messages.push({
          id: block.id,
          type: "RICH_MESSAGE",
          richMessageId: rich.id,
          richMessageName: rich.name,
          previewUrl: rich.previewUrl || rich.imageUrl,
          altText: rich.altText,
          isValid,
          validationError: isValid ? undefined : "Rich Message is inactive",
        });
      } catch {
        ready = false;
        reason ||= "Rich Message not found";
        messages.push({
          id: block.id,
          type: "RICH_MESSAGE",
          richMessageId: block.richMessageId,
          richMessageName: block.richMessageName || "Rich Message",
          previewUrl: block.previewUrl || "",
          altText: block.altText || "Rich Message",
          isValid: false,
          validationError: "Rich Message not found",
        });
      }
    }

    return {
      ...base,
      messages,
      ready: ready && messages.length > 0,
      reason,
    };
  }
}
