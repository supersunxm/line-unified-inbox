import { Injectable, Logger } from "@nestjs/common";
import {
  AutoResponseExecutionOutcome,
  AutoResponseExecutionStatus,
  AutoResponseIntent,
  AutoResponsePilotMode,
  AutoResponseStatus,
  AutoResponseTriggerType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { createMediaPublicUrl } from "../media/media-public-url";
import {
  extractTemplateVariables,
  getStoreGoogleMapsReadiness,
  resolveTemplateVariables,
  StoreVariableContext,
} from "../store-master/template-variable-resolver";
import {
  normalizeAutoResponseMessages,
  parseAutoResponsePostbackData,
} from "./auto-response.utils";
import {
  getAutoResponsePilotMode,
  PILOT_APPROVED_RESPONSE_TEMPLATES,
  PILOT_MATCHER_VERSION,
  PILOT_STORE_EXTERNAL_ID,
} from "./auto-response-pilot.config";
import { matchPilotInboundText, PilotIntent } from "./auto-response-pilot";

export type PostbackExecutionResult = {
  handled: boolean;
  success: boolean;
  reason?: string;
  executionId?: string;
};

export type InboundTextExecutionResult = {
  handled: boolean;
  success: boolean;
  outcome?: AutoResponseExecutionOutcome;
  intent?: AutoResponseIntent;
  reason?: string;
  executionId?: string;
};

@Injectable()
export class AutoResponseExecutionService {
  private readonly logger = new Logger(AutoResponseExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService,
  ) {}

  async handleWebhookInboundText(params: {
    text: string;
    messageId: string;
    conversationId: string;
    lineOfficialAccountId: string;
    replyToken?: string;
    webhookEventId?: string;
  }): Promise<InboundTextExecutionResult> {
    const configuredMode = getAutoResponsePilotMode();
    if (configuredMode === "OFF") {
      return { handled: false, success: false, reason: "PILOT_MODE_OFF" };
    }

    const sourceMessage = await this.prisma.message.findUnique({
      where: { id: params.messageId },
      select: {
        direction: true,
        messageType: true,
        conversationId: true,
        conversation: {
          select: {
            lineOfficialAccountId: true,
            isQa: true,
          },
        },
      },
    });
    if (
      !sourceMessage ||
      sourceMessage.direction !== "INBOUND" ||
      sourceMessage.messageType !== "TEXT" ||
      sourceMessage.conversationId !== params.conversationId ||
      sourceMessage.conversation.lineOfficialAccountId !== params.lineOfficialAccountId ||
      sourceMessage.conversation.isQa
    ) {
      return { handled: false, success: false, reason: "SOURCE_MESSAGE_NOT_ELIGIBLE" };
    }

    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: params.lineOfficialAccountId },
      include: { store: { include: { storeMaster: true } } },
    });
    const storeCode = oa?.store?.code?.trim() || null;
    const externalStoreId = oa?.store?.storeMaster?.externalStoreId?.trim() || null;
    if (
      !oa ||
      oa.accountType !== "STORE" ||
      !oa.isActive ||
      oa.archivedAt ||
      !oa.store ||
      storeCode !== PILOT_STORE_EXTERNAL_ID ||
      externalStoreId !== PILOT_STORE_EXTERNAL_ID
    ) {
      return { handled: false, success: false, reason: "PILOT_SCOPE_MISMATCH" };
    }

    // A LINE reply token is required before evaluating a pilot rule. This keeps
    // the eligibility gate identical in SHADOW and LIVE modes and prevents an
    // otherwise eligible event from being treated as sendable without a valid
    // reply window.
    if (!params.replyToken?.trim()) {
      const claim = await this.claimInboundExecution({
        ruleId: null,
        lineOfficialAccountId: oa.id,
        webhookEventId: params.webhookEventId,
        sourceMessageId: params.messageId,
        conversationId: params.conversationId,
        mode: configuredMode,
        outcome: AutoResponseExecutionOutcome.EXCLUDED,
        reason: "MISSING_REPLY_TOKEN",
        exclusionReason: "MISSING_REPLY_TOKEN",
      });
      return {
        handled: true,
        success: true,
        outcome: claim.created
          ? AutoResponseExecutionOutcome.EXCLUDED
          : AutoResponseExecutionOutcome.DUPLICATE,
        reason: claim.created ? "MISSING_REPLY_TOKEN" : "DUPLICATE_SOURCE_MESSAGE",
        executionId: claim.executionId,
      };
    }

    const match = matchPilotInboundText(params.text);
    const mode = configuredMode;
    let rule: Prisma.AutoResponseRuleGetPayload<{
      include: { scopeStore: { include: { storeMaster: true } } };
    }> | null = null;
    let outcome: AutoResponseExecutionOutcome =
      match.outcome === "EXCLUDED"
        ? AutoResponseExecutionOutcome.EXCLUDED
        : match.outcome === "AMBIGUOUS"
          ? AutoResponseExecutionOutcome.AMBIGUOUS
          : AutoResponseExecutionOutcome.NO_MATCH;
    let reason = match.reason;

    if (match.outcome === "MATCHED" && match.intent) {
      const rules = await this.prisma.autoResponseRule.findMany({
        where: {
          status: AutoResponseStatus.ACTIVE,
          triggerType: AutoResponseTriggerType.INBOUND_TEXT,
          intent: match.intent,
          scopeStoreId: oa.store.id,
        },
        orderBy: [{ updatedAt: "desc" }],
        include: { scopeStore: { include: { storeMaster: true } } },
      });
      if (rules.length === 1) {
        rule = rules[0];
        outcome = configuredMode === "SHADOW"
          ? AutoResponseExecutionOutcome.MATCHED_SHADOW
          : AutoResponseExecutionOutcome.SENT;
      } else if (rules.length === 0) {
        outcome = AutoResponseExecutionOutcome.NO_MATCH;
        reason = "NO_ACTIVE_TEXT_RULE";
      } else {
        outcome = AutoResponseExecutionOutcome.AMBIGUOUS;
        reason = "MULTIPLE_ACTIVE_TEXT_RULES";
      }
    }

    if (configuredMode === "LIVE" && outcome === AutoResponseExecutionOutcome.SENT) {
      if (!oa.encryptedChannelAccessToken) {
        outcome = AutoResponseExecutionOutcome.FAILED;
        reason = "MISSING_CHANNEL_ACCESS_TOKEN";
      }
    }

    const claim = await this.claimInboundExecution({
      ruleId: rule?.id ?? null,
      lineOfficialAccountId: oa.id,
      webhookEventId: params.webhookEventId,
      sourceMessageId: params.messageId,
      conversationId: params.conversationId,
      intent: match.intent,
      mode,
      outcome: outcome === AutoResponseExecutionOutcome.SENT ? null : outcome,
      reason,
      exclusionReason:
        outcome === AutoResponseExecutionOutcome.EXCLUDED ? reason : undefined,
    });
    if (!claim.created) {
      return {
        handled: true,
        success: true,
        outcome: AutoResponseExecutionOutcome.DUPLICATE,
        intent: match.intent,
        reason: "DUPLICATE_SOURCE_MESSAGE",
        executionId: claim.executionId,
      };
    }

    if (configuredMode === "SHADOW" || outcome !== AutoResponseExecutionOutcome.SENT || !rule) {
      await this.finalizeExecution(claim.executionId, {
        status: outcome === AutoResponseExecutionOutcome.FAILED
          ? AutoResponseExecutionStatus.FAILED
          : AutoResponseExecutionStatus.SKIPPED,
        outcome,
        reason: reason ?? undefined,
        exclusionReason: outcome === AutoResponseExecutionOutcome.EXCLUDED ? reason : undefined,
      });
      this.logger.log(
        `[AutoResponse] Pilot ${configuredMode} evaluation outcome=${outcome} intent=${match.intent ?? "none"} store=${PILOT_STORE_EXTERNAL_ID}`,
      );
      return {
        handled: true,
        success: outcome !== AutoResponseExecutionOutcome.FAILED,
        outcome,
        intent: match.intent,
        reason,
        executionId: claim.executionId,
      };
    }

    try {
      await this.sendInboundTextRule(oa, rule, params.replyToken.trim(), params.conversationId);
      await this.finalizeExecution(claim.executionId, {
        status: AutoResponseExecutionStatus.SUCCESS,
        outcome: AutoResponseExecutionOutcome.SENT,
      });
      this.logger.log(
        `[AutoResponse] Pilot LIVE sent intent=${match.intent} store=${PILOT_STORE_EXTERNAL_ID}`,
      );
      return {
        handled: true,
        success: true,
        outcome: AutoResponseExecutionOutcome.SENT,
        intent: match.intent,
        executionId: claim.executionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "LINE_REPLY_FAILED";
      await this.finalizeExecution(claim.executionId, {
        status: AutoResponseExecutionStatus.FAILED,
        outcome: AutoResponseExecutionOutcome.FAILED,
        reason: message,
      });
      this.logger.warn(
        `[AutoResponse] Pilot LIVE delivery failed intent=${match.intent} store=${PILOT_STORE_EXTERNAL_ID}`,
      );
      return {
        handled: true,
        success: false,
        outcome: AutoResponseExecutionOutcome.FAILED,
        intent: match.intent,
        reason: message,
        executionId: claim.executionId,
      };
    }
  }

  private async sendInboundTextRule(
    oa: Prisma.LineOfficialAccountGetPayload<{
      include: { store: { include: { storeMaster: true } } };
    }>,
    rule: Prisma.AutoResponseRuleGetPayload<{
      include: { scopeStore: { include: { storeMaster: true } } };
    }>,
    replyToken: string,
    conversationId: string,
  ) {
    const blocks = normalizeAutoResponseMessages(rule);
    if (!blocks.length || blocks.some((block) => block.type !== "TEXT")) {
      throw new Error("TEXT_PILOT_REQUIRES_TEXT_ONLY_RULE");
    }
    if (!oa.encryptedChannelAccessToken) throw new Error("MISSING_CHANNEL_ACCESS_TOKEN");

    const storeContext: StoreVariableContext = {
      storeName: oa.store?.name ?? oa.name,
      externalStoreId: oa.store?.storeMaster?.externalStoreId ?? null,
      accountName: oa.name,
      googleMapsUrl: oa.store?.storeMaster?.googleMapsUrl ?? null,
    };
    const textBlocks = blocks.filter((block): block is Extract<typeof block, { type: "TEXT" }> => block.type === "TEXT");
    const lineMessages = textBlocks.map((block) => {
      const text = resolveTemplateVariables(block.textTemplate, storeContext);
      if (!text.trim() || /\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/u.test(text)) {
        throw new Error("INVALID_TEXT_PILOT_TEMPLATE");
      }
      return { type: "text" as const, text };
    });

    const approvedTemplate = PILOT_APPROVED_RESPONSE_TEMPLATES[rule.intent ?? "STORE_LOCATION"];
    if (rule.intent === null || lineMessages.length !== 1 || lineMessages[0].text.trim() !== approvedTemplate.trim()) {
      throw new Error("PILOT_TEMPLATE_NOT_APPROVED");
    }

    const accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    await this.lineMessaging.replyMessages(accessToken, replyToken, lineMessages, {
      storeId: oa.store?.id,
      storeName: oa.store?.name,
      conversationId,
      messageType: "AUTO_RESPONSE",
    });
  }

  private async claimInboundExecution(data: {
    ruleId: string | null;
    lineOfficialAccountId: string;
    webhookEventId?: string;
    sourceMessageId: string;
    conversationId: string;
    intent?: PilotIntent;
    mode: AutoResponsePilotMode;
    outcome: AutoResponseExecutionOutcome | null;
    reason?: string;
    exclusionReason?: string;
  }): Promise<{ created: boolean; executionId: string }> {
    try {
      const execution = await this.prisma.autoResponseExecution.create({
        data: {
          ruleId: data.ruleId,
          lineOfficialAccountId: data.lineOfficialAccountId,
          webhookEventId: data.webhookEventId ?? null,
          sourceMessageId: data.sourceMessageId,
          conversationId: data.conversationId,
          intent: data.intent ?? null,
          matcherVersion: PILOT_MATCHER_VERSION,
          mode: data.mode,
          outcome: data.outcome,
          status: data.outcome === null ? AutoResponseExecutionStatus.PENDING : data.outcome === AutoResponseExecutionOutcome.FAILED ? AutoResponseExecutionStatus.FAILED : AutoResponseExecutionStatus.SKIPPED,
          reason: data.reason ?? null,
          exclusionReason: data.exclusionReason ?? null,
          messageCount: 1,
          messageTypesJson: ["TEXT"],
        },
      });
      return { created: true, executionId: execution.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.autoResponseExecution.findUnique({
          where: { sourceMessageId: data.sourceMessageId },
          select: { id: true },
        });
        if (existing) return { created: false, executionId: existing.id };
      }
      throw error;
    }
  }

  private async finalizeExecution(
    id: string,
    data: {
      status: AutoResponseExecutionStatus;
      outcome: AutoResponseExecutionOutcome;
      reason?: string;
      exclusionReason?: string;
    },
  ) {
    await this.prisma.autoResponseExecution.update({
      where: { id },
      data: {
        status: data.status,
        outcome: data.outcome,
        reason: data.reason ?? undefined,
        exclusionReason: data.exclusionReason ?? undefined,
      },
    });
  }

  /**
   * Main entrypoint invoked by the LINE Webhook pipeline when event.type === 'postback'.
   */
  async handleWebhookPostback(params: {
    postbackData: string | null | undefined;
    lineOfficialAccountId: string;
    replyToken?: string;
    webhookEventId?: string;
  }): Promise<PostbackExecutionResult> {
    const { postbackData, lineOfficialAccountId, replyToken, webhookEventId } =
      params;

    const parsed = parseAutoResponsePostbackData(postbackData);
    if (!parsed.isAutoResponse) {
      // Not an auto-response postback (e.g. datepicker, survey, or custom feature)
      return { handled: false, success: false };
    }

    if (!parsed.ruleId) {
      this.logger.warn(
        `[AutoResponse] Recognized namespace but malformed rule ID in postback: ${postbackData}`,
      );
      const execution = await this.recordExecution({
        ruleId: "unknown",
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.FAILED,
        reason: "MALFORMED_RULE_ID",
      });
      return {
        handled: true,
        success: false,
        reason: "MALFORMED_RULE_ID",
        executionId: execution?.id,
      };
    }

    const ruleId = parsed.ruleId;

    // 1. Idempotency Guard via webhookEventId
    if (webhookEventId) {
      const existingSuccess = await this.prisma.autoResponseExecution.findFirst({
        where: {
          webhookEventId,
          status: AutoResponseExecutionStatus.SUCCESS,
        },
      });

      if (existingSuccess) {
        this.logger.log(
          `[AutoResponse] Duplicate postback event ignored: webhookEventId=${webhookEventId}`,
        );
        return {
          handled: true,
          success: true,
          reason: "DUPLICATE_EVENT_ALREADY_PROCESSED",
          executionId: existingSuccess.id,
        };
      }
    }

    // 2. Load Auto-response Rule
    const rule = await this.prisma.autoResponseRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      this.logger.warn(`[AutoResponse] Rule not found: ${ruleId}`);
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SKIPPED,
        reason: "RULE_NOT_FOUND",
      });
      return {
        handled: true,
        success: false,
        reason: "RULE_NOT_FOUND",
        executionId: execution?.id,
      };
    }

    if (rule.status !== AutoResponseStatus.ACTIVE) {
      this.logger.log(
        `[AutoResponse] Rule '${rule.name}' (${ruleId}) is ${rule.status}. Skipping execution.`,
      );
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SKIPPED,
        reason: `RULE_${rule.status}`,
      });
      return {
        handled: true,
        success: false,
        reason: `RULE_${rule.status}`,
        executionId: execution?.id,
      };
    }

    // 3. Load Target LINE OA & Store Master
    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: lineOfficialAccountId },
      include: {
        store: { include: { storeMaster: true } },
      },
    });

    if (!oa) {
      this.logger.warn(`[AutoResponse] OA '${lineOfficialAccountId}' not found`);
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SKIPPED,
        reason: "OA_NOT_FOUND",
      });
      return {
        handled: true,
        success: false,
        reason: "OA_NOT_FOUND",
        executionId: execution?.id,
      };
    }

    if (oa.accountType === "HEAD_OFFICE") {
      this.logger.log(
        `[AutoResponse] OA '${oa.name}' is HEAD_OFFICE. Auto-response is STORE-only in Phase 2.`,
      );
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SKIPPED,
        reason: "HEAD_OFFICE_NOT_SUPPORTED",
      });
      return {
        handled: true,
        success: false,
        reason: "HEAD_OFFICE_NOT_SUPPORTED",
        executionId: execution?.id,
      };
    }

    if (!oa.isActive || oa.archivedAt) {
      this.logger.warn(`[AutoResponse] OA '${oa.name}' is inactive or archived`);
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SKIPPED,
        reason: "OA_INACTIVE_OR_ARCHIVED",
      });
      return {
        handled: true,
        success: false,
        reason: "OA_INACTIVE_OR_ARCHIVED",
        executionId: execution?.id,
      };
    }

    if (!oa.encryptedChannelAccessToken) {
      this.logger.error(`[AutoResponse] OA '${oa.name}' has no channel access token`);
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.FAILED,
        reason: "MISSING_CHANNEL_ACCESS_TOKEN",
      });
      return {
        handled: true,
        success: false,
        reason: "MISSING_CHANNEL_ACCESS_TOKEN",
        executionId: execution?.id,
      };
    }

    if (!replyToken) {
      this.logger.warn(`[AutoResponse] Missing replyToken in postback event`);
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.FAILED,
        reason: "MISSING_REPLY_TOKEN",
      });
      return {
        handled: true,
        success: false,
        reason: "MISSING_REPLY_TOKEN",
        executionId: execution?.id,
      };
    }

    // 4. Resolve Ordered Message Blocks (Atomic Pre-Flight)
    const storeMaster = oa.store?.storeMaster;
    const storeContext: StoreVariableContext = {
      storeName: oa.store?.name ?? oa.name,
      externalStoreId: storeMaster?.externalStoreId ?? null,
      accountName: oa.name,
      googleMapsUrl: storeMaster?.googleMapsUrl ?? null,
    };

    const rawBlocks = normalizeAutoResponseMessages(rule);
    if (!rawBlocks.length || rawBlocks.length > 5) {
      this.logger.warn(`[AutoResponse] Invalid block count (${rawBlocks.length}) for rule '${rule.name}'`);
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.FAILED,
        reason: `INVALID_BLOCK_COUNT_${rawBlocks.length}`,
      });
      return {
        handled: true,
        success: false,
        reason: "INVALID_BLOCK_COUNT",
        executionId: execution?.id,
      };
    }

    const lineMessages: Array<
      | { type: "text"; text: string }
      | { type: "image"; originalContentUrl: string; previewImageUrl: string }
    > = [];
    const usedVarsSet = new Set<string>();
    const messageTypes: string[] = [];

    for (const block of rawBlocks) {
      if (block.type === "TEXT") {
        messageTypes.push("TEXT");
        const used = extractTemplateVariables(block.textTemplate || "");
        used.forEach((v) => usedVarsSet.add(v));

        const resolved = resolveTemplateVariables(block.textTemplate || "", storeContext);
        const remainingMatches = resolved.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);

        if (remainingMatches && remainingMatches.length > 0) {
          this.logger.warn(
            `[AutoResponse] Unresolved variables in rule '${rule.name}': ${remainingMatches.join(", ")}`,
          );
          const execution = await this.recordExecution({
            ruleId,
            lineOfficialAccountId,
            webhookEventId,
            status: AutoResponseExecutionStatus.FAILED,
            reason: `UNRESOLVED_VARIABLE: ${remainingMatches.join(", ")}`,
            messageCount: rawBlocks.length,
            messageTypesJson: messageTypes,
          });
          return {
            handled: true,
            success: false,
            reason: "UNRESOLVED_VARIABLE",
            executionId: execution?.id,
          };
        }

        const requiresGoogleMaps =
          used.includes("store.googleMapsUrl") ||
          used.includes("googleMapsUrl");

        if (requiresGoogleMaps) {
          const mapsReadiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
          if (!mapsReadiness.ready) {
            this.logger.warn(
              `[AutoResponse] Google Maps URL not ready for store '${oa.store?.name}': ${mapsReadiness.reason}`,
            );
            const execution = await this.recordExecution({
              ruleId,
              lineOfficialAccountId,
              webhookEventId,
              status: AutoResponseExecutionStatus.FAILED,
              reason: `GOOGLE_MAPS_NOT_READY: ${mapsReadiness.reason}`,
              messageCount: rawBlocks.length,
              messageTypesJson: messageTypes,
            });
            return {
              handled: true,
              success: false,
              reason: "GOOGLE_MAPS_NOT_READY",
              executionId: execution?.id,
            };
          }
        }

        if (!resolved.trim()) {
          this.logger.warn(`[AutoResponse] Empty text block encountered in rule '${rule.name}'`);
          const execution = await this.recordExecution({
            ruleId,
            lineOfficialAccountId,
            webhookEventId,
            status: AutoResponseExecutionStatus.FAILED,
            reason: "EMPTY_TEXT_BLOCK",
            messageCount: rawBlocks.length,
            messageTypesJson: messageTypes,
          });
          return {
            handled: true,
            success: false,
            reason: "EMPTY_TEXT_BLOCK",
            executionId: execution?.id,
          };
        }

        lineMessages.push({
          type: "text",
          text: resolved,
        });
      } else if (block.type === "IMAGE") {
        messageTypes.push("IMAGE");
        if (!block.mediaObjectKey || typeof block.mediaObjectKey !== "string") {
          this.logger.warn(`[AutoResponse] Missing media object key in rule '${rule.name}'`);
          const execution = await this.recordExecution({
            ruleId,
            lineOfficialAccountId,
            webhookEventId,
            status: AutoResponseExecutionStatus.FAILED,
            reason: "MISSING_MEDIA_OBJECT_KEY",
            messageCount: rawBlocks.length,
            messageTypesJson: messageTypes,
          });
          return {
            handled: true,
            success: false,
            reason: "MISSING_MEDIA_OBJECT_KEY",
            executionId: execution?.id,
          };
        }

        const originalContentUrl = createMediaPublicUrl(block.mediaObjectKey);
        const previewImageUrl = createMediaPublicUrl(
          block.previewObjectKey || block.mediaObjectKey,
        );

        lineMessages.push({
          type: "image",
          originalContentUrl,
          previewImageUrl,
        });
      }
    }

    // 5. Decrypt Channel Access Token Server-side
    let accessToken: string;
    try {
      accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    } catch (err: any) {
      this.logger.error(
        `[AutoResponse] Token decryption failed for OA '${oa.name}': ${err?.message}`,
      );
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.FAILED,
        reason: "TOKEN_DECRYPTION_FAILED",
      });
      return {
        handled: true,
        success: false,
        reason: "TOKEN_DECRYPTION_FAILED",
        executionId: execution?.id,
      };
    }

    // 6. Send LINE Reply Messages (Single One-Request Call)
    try {
      await this.lineMessaging.replyMessages(
        accessToken,
        replyToken,
        lineMessages,
        {
          storeId: oa.store?.id,
          storeName: oa.store?.name,
          messageType: "AUTO_RESPONSE",
        },
      );

      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SUCCESS,
        messageCount: lineMessages.length,
        messageTypesJson: messageTypes,
        resolvedVariablesJson: {
          usedVariables: Array.from(usedVarsSet),
          storeName: storeContext.storeName,
          hasGoogleMapsUrl: Boolean(storeContext.googleMapsUrl),
        },
      });

      this.logger.log(
        `[AutoResponse] Successfully replied ${lineMessages.length} messages to postback: rule='${rule.name}' store='${oa.store?.name}'`,
      );

      return {
        handled: true,
        success: true,
        executionId: execution?.id,
      };
    } catch (err: any) {
      this.logger.error(
        `[AutoResponse] LINE reply delivery failed for rule '${rule.name}': ${err?.message}`,
      );
      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.FAILED,
        reason: err?.message || "LINE_REPLY_FAILED",
        messageCount: lineMessages.length,
        messageTypesJson: messageTypes,
      });
      return {
        handled: true,
        success: false,
        reason: "LINE_REPLY_FAILED",
        executionId: execution?.id,
      };
    }
  }

  private async recordExecution(data: {
    ruleId: string | null;
    lineOfficialAccountId: string;
    webhookEventId?: string;
    status: AutoResponseExecutionStatus;
    reason?: string;
    messageCount?: number;
    messageTypesJson?: any;
    resolvedVariablesJson?: any;
  }) {
    try {
      // Check if rule actually exists before linking foreign key
      const ruleExists =
        data.ruleId === null ||
        (data.ruleId !== "unknown" &&
          (await this.prisma.autoResponseRule.count({
            where: { id: data.ruleId },
          })) > 0);

      if (!ruleExists) {
        return null;
      }

      return await this.prisma.autoResponseExecution.create({
        data: {
          ruleId: data.ruleId,
          lineOfficialAccountId: data.lineOfficialAccountId,
          webhookEventId: data.webhookEventId || null,
          status: data.status,
          reason: data.reason || null,
          messageCount: data.messageCount || null,
          messageTypesJson: data.messageTypesJson || undefined,
          resolvedVariablesJson: data.resolvedVariablesJson || undefined,
        },
      });
    } catch (err: any) {
      this.logger.warn(`[AutoResponse] Failed to record execution log: ${err?.message}`);
      return null;
    }
  }
}
