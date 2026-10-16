import { Injectable, Logger } from "@nestjs/common";
import {
  AutoResponseExecutionOutcome,
  AutoResponseExecutionStatus,
  AutoResponseStatus,
  AutoResponseTriggerType,
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
import { AutoResponseExecutionService, type PostbackExecutionResult, type InboundTextExecutionResult } from "./auto-response-execution.service";
import { chooseKeywordRule, parseKeywordConfig, targetsLineOa } from "./auto-response-keyword";
import { getAutoResponsePilotMode, PILOT_STORE_EXTERNAL_ID } from "./auto-response-pilot.config";
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


  override async handleWebhookInboundText(params: {
    text: string;
    messageId: string;
    conversationId: string;
    lineOfficialAccountId: string;
    replyToken?: string;
    webhookEventId?: string;
  }): Promise<InboundTextExecutionResult> {
    const mode = process.env.AUTO_REPLY_KEYWORD_MODE;
    if (mode !== "SHADOW" && mode !== "LIVE") return super.handleWebhookInboundText(params);

    // Preserve the separately approved legacy LIVE pilot and its existing rules.
    const oa = await this.richPrisma.lineOfficialAccount.findUnique({
      where: { id: params.lineOfficialAccountId },
      include: { store: { include: { storeMaster: true } } },
    });
    if (oa?.store?.code === PILOT_STORE_EXTERNAL_ID && getAutoResponsePilotMode() === "LIVE") {
      return super.handleWebhookInboundText(params);
    }

    if (!oa || oa.accountType !== "STORE" || !oa.isActive || oa.archivedAt ||
        !oa.store || !oa.store.isActive || oa.store.archivedAt ||
        !oa.store.storeMaster ||
        !oa.store.storeMaster.externalStoreId?.trim() ||
        oa.store.code?.trim() !== oa.store.storeMaster.externalStoreId?.trim() ||
        !oa.encryptedChannelSecret || !oa.encryptedChannelAccessToken ||
        (oa.connectionStatus !== "READY" && oa.connectionStatus !== "CONNECTED")) {
      return super.handleWebhookInboundText(params);
    }

    const source = await this.richPrisma.message.findUnique({
      where: { id: params.messageId },
      select: { direction: true, messageType: true, conversationId: true,
        conversation: { select: { lineOfficialAccountId: true, isQa: true } } },
    });
    if (!source || source.direction !== "INBOUND" || source.messageType !== "TEXT" ||
        source.conversationId !== params.conversationId ||
        source.conversation.lineOfficialAccountId !== oa.id || source.conversation.isQa) {
      return { handled: false, success: false, reason: "KEYWORD_SOURCE_NOT_ELIGIBLE" };
    }

    const rules = await this.richPrisma.autoResponseRule.findMany({
      where: { triggerType: AutoResponseTriggerType.KEYWORD, status: AutoResponseStatus.ACTIVE },
    });
    const eligible = rules.filter((rule) => {
      const config = parseKeywordConfig(rule.triggerConfig);
      return config && targetsLineOa(config, oa.id);
    });
    const match = chooseKeywordRule(params.text, eligible);
    if (!match.rule && !match.ambiguous) return super.handleWebhookInboundText(params);

    // Atomic claim before any customer-facing API calls.
    let executionId: string;
    try {
      const claim = await this.richPrisma.autoResponseExecution.create({
        data: {
          ruleId: match.rule?.id ?? null,
          lineOfficialAccountId: oa.id,
          webhookEventId: params.webhookEventId ?? null,
          sourceMessageId: params.messageId,
          conversationId: params.conversationId,
          matcherVersion: 1,
          mode,
          status: match.ambiguous || mode === "SHADOW"
            ? AutoResponseExecutionStatus.SKIPPED : AutoResponseExecutionStatus.PENDING,
          outcome: match.ambiguous ? AutoResponseExecutionOutcome.AMBIGUOUS
            : mode === "SHADOW" ? AutoResponseExecutionOutcome.MATCHED_SHADOW : null,
          reason: match.ambiguous ? "KEYWORD_PRIORITY_CONFLICT" : null,
        },
      });
      executionId = claim.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { handled: true, success: true, outcome: AutoResponseExecutionOutcome.DUPLICATE, reason: "DUPLICATE_SOURCE_MESSAGE" };
      }
      throw error;
    }
    if (match.ambiguous || mode === "SHADOW" || !match.rule) {
      return { handled: true, success: true, executionId,
        outcome: match.ambiguous ? AutoResponseExecutionOutcome.AMBIGUOUS : AutoResponseExecutionOutcome.MATCHED_SHADOW };
    }

    const blocks = normalizeAutoResponseMessages(match.rule);
    const messages: any[] = [];
    const types: string[] = [];
    const storeContext: StoreVariableContext = {
      storeName: oa.store.name,
      externalStoreId: oa.store.storeMaster.externalStoreId,
      accountName: oa.name,
      googleMapsUrl: oa.store.storeMaster.googleMapsUrl ?? null,
    };
    try {
      if (!params.replyToken?.trim()) throw new Error("MISSING_REPLY_TOKEN");
      if (!blocks.length || blocks.length > 5) throw new Error("INVALID_MESSAGE_COUNT");
      for (const block of blocks) {
        if (block.type === "TEXT") {
          const text = resolveTemplateVariables(block.textTemplate, storeContext);
          if (!text.trim() || text.length > 5000 || /\\{\\{\\s*[a-zA-Z0-9_.]+\\s*\\}\\}/.test(text)) {
            throw new Error("INVALID_TEXT_OR_UNRESOLVED_VARIABLE");
          }
          if (extractTemplateVariables(block.textTemplate).some((name) => name.includes("googleMapsUrl")) &&
              !getStoreGoogleMapsReadiness(storeContext.googleMapsUrl).ready) throw new Error("GOOGLE_MAPS_NOT_READY");
          messages.push({ type: "text", text });
        } else if (block.type === "IMAGE") {
          if (!block.mediaObjectKey) throw new Error("MISSING_IMAGE");
          messages.push({ type: "image",
            originalContentUrl: createMediaPublicUrl(block.mediaObjectKey),
            previewImageUrl: createMediaPublicUrl(block.previewObjectKey || block.mediaObjectKey) });
        } else if (block.type === "RICH_MESSAGE") {
          if (!block.richMessageId) throw new Error("MISSING_RICH_MESSAGE");
          const rich = await this.richMessages.get(block.richMessageId);
          if (!rich.isActive) throw new Error("RICH_MESSAGE_INACTIVE");
          messages.push(await this.richMessages.buildLineImagemap(block.richMessageId));
        }
        types.push(block.type);
      }
      const token = this.richEncryption.decrypt(oa.encryptedChannelAccessToken);
      await this.richLineMessaging.replyMessages(token, params.replyToken, messages, {
        storeId: oa.store.id, storeName: oa.store.name, messageType: "AUTO_RESPONSE",
      });
      await this.richPrisma.autoResponseExecution.update({ where: { id: executionId },
        data: { status: AutoResponseExecutionStatus.SUCCESS, outcome: AutoResponseExecutionOutcome.SENT,
          messageCount: messages.length, messageTypesJson: types } });
      return { handled: true, success: true, outcome: AutoResponseExecutionOutcome.SENT, executionId };
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 180) : "KEYWORD_SEND_FAILED";
      await this.richPrisma.autoResponseExecution.update({ where: { id: executionId },
        data: { status: AutoResponseExecutionStatus.FAILED, outcome: AutoResponseExecutionOutcome.FAILED,
          reason, messageCount: messages.length, messageTypesJson: types } });
      this.richLogger.warn(`[AutoResponse] Keyword execution failed ruleId=${match.rule.id} reason=${reason}`);
      return { handled: true, success: false, outcome: AutoResponseExecutionOutcome.FAILED,
        reason, executionId };
    }
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
