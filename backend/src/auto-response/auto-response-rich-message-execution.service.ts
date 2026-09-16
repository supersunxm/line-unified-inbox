import { Injectable, Logger } from "@nestjs/common";
import {
  AutoResponseExecutionStatus,
  AutoResponseStatus,
  Prisma,
} from "@prisma/client";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { createMediaPublicUrl } from "../media/media-public-url";
import { PrismaService } from "../prisma.service";
import { RichMessageService } from "../rich-message/rich-message.service";
import {
  extractTemplateVariables,
  getStoreGoogleMapsReadiness,
  resolveTemplateVariables,
  type StoreVariableContext,
} from "../store-master/template-variable-resolver";
import { AutoResponseExecutionService, type PostbackExecutionResult } from "./auto-response-execution.service";
import {
  normalizeAutoResponseMessages,
  parseAutoResponsePostbackData,
} from "./auto-response.utils";

@Injectable()
export class AutoResponseRichMessageExecutionService extends AutoResponseExecutionService {
  private readonly richLogger = new Logger(AutoResponseRichMessageExecutionService.name);

  constructor(
    private readonly richPrisma: PrismaService,
    private readonly richEncryption: CredentialEncryptionService,
    private readonly richLineMessaging: LineMessagingService,
    private readonly richMessages: RichMessageService,
  ) {
    super(richPrisma, richEncryption, richLineMessaging);
  }

  override async handleWebhookPostback(params: {
    postbackData: string | null | undefined;
    lineOfficialAccountId: string;
    replyToken?: string;
    webhookEventId?: string;
  }): Promise<PostbackExecutionResult> {
    const parsed = parseAutoResponsePostbackData(params.postbackData);
    if (!parsed.isAutoResponse || !parsed.ruleId) {
      return super.handleWebhookPostback(params);
    }

    const rule = await this.richPrisma.autoResponseRule.findUnique({
      where: { id: parsed.ruleId },
    });
    if (!rule) return super.handleWebhookPostback(params);

    const rawBlocks = normalizeAutoResponseMessages(rule);
    if (!rawBlocks.some((block) => block.type === "RICH_MESSAGE")) {
      return super.handleWebhookPostback(params);
    }

    if (params.webhookEventId) {
      const existing = await this.richPrisma.autoResponseExecution.findFirst({
        where: {
          webhookEventId: params.webhookEventId,
          status: AutoResponseExecutionStatus.SUCCESS,
        },
      });
      if (existing) {
        return {
          handled: true,
          success: true,
          reason: "DUPLICATE_EVENT_ALREADY_PROCESSED",
          executionId: existing.id,
        };
      }
    }

    if (rule.status !== AutoResponseStatus.ACTIVE) {
      return this.finish(params, rule.id, AutoResponseExecutionStatus.SKIPPED, `RULE_${rule.status}`);
    }
    if (!params.replyToken) {
      return this.finish(params, rule.id, AutoResponseExecutionStatus.FAILED, "MISSING_REPLY_TOKEN");
    }
    if (!rawBlocks.length || rawBlocks.length > 5) {
      return this.finish(params, rule.id, AutoResponseExecutionStatus.FAILED, "INVALID_BLOCK_COUNT");
    }

    const oa = await this.richPrisma.lineOfficialAccount.findUnique({
      where: { id: params.lineOfficialAccountId },
      include: { store: { include: { storeMaster: true } } },
    });
    if (!oa) return this.finish(params, rule.id, AutoResponseExecutionStatus.SKIPPED, "OA_NOT_FOUND");
    if (oa.accountType === "HEAD_OFFICE") {
      return this.finish(params, rule.id, AutoResponseExecutionStatus.SKIPPED, "HEAD_OFFICE_NOT_SUPPORTED");
    }
    if (!oa.isActive || oa.archivedAt) {
      return this.finish(params, rule.id, AutoResponseExecutionStatus.SKIPPED, "OA_INACTIVE_OR_ARCHIVED");
    }
    if (!oa.encryptedChannelAccessToken) {
      return this.finish(params, rule.id, AutoResponseExecutionStatus.FAILED, "MISSING_CHANNEL_ACCESS_TOKEN");
    }

    const storeContext: StoreVariableContext = {
      storeName: oa.store?.name ?? oa.name,
      externalStoreId: oa.store?.storeMaster?.externalStoreId ?? null,
      accountName: oa.name,
      googleMapsUrl: oa.store?.storeMaster?.googleMapsUrl ?? null,
    };

    const lineMessages: any[] = [];
    const messageTypes: string[] = [];
    const usedVarsSet = new Set<string>();

    try {
      for (const block of rawBlocks) {
        if (block.type === "TEXT") {
          messageTypes.push("TEXT");
          const used = extractTemplateVariables(block.textTemplate || "");
          used.forEach((variable) => usedVarsSet.add(variable));
          const resolved = resolveTemplateVariables(block.textTemplate || "", storeContext);
          const unresolved = resolved.match(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g);
          if (!resolved.trim() || unresolved?.length) {
            throw new Error(unresolved?.length ? "UNRESOLVED_VARIABLE" : "EMPTY_TEXT_BLOCK");
          }
          if (used.includes("store.googleMapsUrl") || used.includes("googleMapsUrl")) {
            const readiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
            if (!readiness.ready) throw new Error("GOOGLE_MAPS_NOT_READY");
          }
          lineMessages.push({ type: "text", text: resolved });
          continue;
        }

        if (block.type === "IMAGE") {
          messageTypes.push("IMAGE");
          if (!block.mediaObjectKey) throw new Error("MISSING_MEDIA_OBJECT_KEY");
          lineMessages.push({
            type: "image",
            originalContentUrl: createMediaPublicUrl(block.mediaObjectKey),
            previewImageUrl: createMediaPublicUrl(block.previewObjectKey || block.mediaObjectKey),
          });
          continue;
        }

        if (block.type === "RICH_MESSAGE") {
          messageTypes.push("RICH_MESSAGE");
          if (!block.richMessageId) throw new Error("MISSING_RICH_MESSAGE_ID");
          lineMessages.push(await this.richMessages.buildLineImagemap(block.richMessageId));
        }
      }

      const accessToken = this.richEncryption.decrypt(oa.encryptedChannelAccessToken);
      await this.richLineMessaging.replyMessages(
        accessToken,
        params.replyToken,
        lineMessages,
        {
          storeId: oa.store?.id,
          storeName: oa.store?.name,
          messageType: "AUTO_RESPONSE",
        },
      );

      const execution = await this.richPrisma.autoResponseExecution.create({
        data: {
          ruleId: rule.id,
          lineOfficialAccountId: params.lineOfficialAccountId,
          webhookEventId: params.webhookEventId || null,
          status: AutoResponseExecutionStatus.SUCCESS,
          messageCount: lineMessages.length,
          messageTypesJson: messageTypes,
          resolvedVariablesJson: {
            usedVariables: Array.from(usedVarsSet),
            storeName: storeContext.storeName,
            hasGoogleMapsUrl: Boolean(storeContext.googleMapsUrl),
          },
        },
      });

      this.richLogger.log(
        `[AutoResponse] Rich Message rule sent ${lineMessages.length} messages: rule='${rule.name}' store='${oa.store?.name}'`,
      );
      return { handled: true, success: true, executionId: execution.id };
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : "LINE_REPLY_FAILED";
      this.richLogger.warn(`[AutoResponse] Rich Message rule failed: rule='${rule.name}' reason='${reason}'`);
      return this.finish(
        params,
        rule.id,
        AutoResponseExecutionStatus.FAILED,
        reason || "LINE_REPLY_FAILED",
        lineMessages.length,
        messageTypes,
      );
    }
  }

  private async finish(
    params: {
      lineOfficialAccountId: string;
      webhookEventId?: string;
    },
    ruleId: string,
    status: AutoResponseExecutionStatus,
    reason: string,
    messageCount?: number,
    messageTypesJson?: string[],
  ): Promise<PostbackExecutionResult> {
    try {
      const execution = await this.richPrisma.autoResponseExecution.create({
        data: {
          ruleId,
          lineOfficialAccountId: params.lineOfficialAccountId,
          webhookEventId: params.webhookEventId || null,
          status,
          reason,
          messageCount: messageCount ?? null,
          messageTypesJson: messageTypesJson || undefined,
        },
      });
      return {
        handled: true,
        success: status === AutoResponseExecutionStatus.SUCCESS,
        reason,
        executionId: execution.id,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = params.webhookEventId
          ? await this.richPrisma.autoResponseExecution.findFirst({
              where: { webhookEventId: params.webhookEventId },
              select: { id: true },
            })
          : null;
        if (existing) {
          return {
            handled: true,
            success: true,
            reason: "DUPLICATE_EVENT_ALREADY_PROCESSED",
            executionId: existing.id,
          };
        }
      }
      throw error;
    }
  }
}
