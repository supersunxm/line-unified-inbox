import { Injectable, Logger, Optional } from "@nestjs/common";
import {
  GreetingExecutionStatus,
  GreetingSendPolicy,
  GreetingTemplateStatus,
  LineAccountType,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { LineProfileService } from "../line-profile.service";
import {
  getFriendAttributionHashSecret,
  hashLineUserId,
} from "../friend-source-links/friend-attribution.config";
import { createMediaPublicUrl } from "../media/media-public-url";
import { RichMessageService } from "../rich-message/rich-message.service";
import {
  resolveTemplateVariables,
  StoreVariableContext,
  validateTemplateVariables,
} from "../store-master/template-variable-resolver";
import {
  extractAllGreetingVariables,
  normalizeGreetingMessages,
  validateGreetingMessages,
} from "./greeting-message.utils";

export type GreetingFollowExecutionParams = {
  lineOfficialAccountId: string;
  lineUserId: string;
  replyToken?: string;
  webhookEventId?: string;
  isUnblocked?: boolean;
};

export type GreetingExecutionResult = {
  handled: boolean;
  success: boolean;
  reason?: string;
  executionId?: string;
  messageCount?: number;
};

@Injectable()
export class GreetingExecutionService {
  private readonly logger = new Logger(GreetingExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService,
    private readonly profiles: LineProfileService,
    @Optional() private readonly richMessages?: RichMessageService,
  ) {}

  async handleFollowEvent(
    params: GreetingFollowExecutionParams,
  ): Promise<GreetingExecutionResult> {
    const {
      lineOfficialAccountId,
      lineUserId,
      replyToken,
      webhookEventId,
      isUnblocked = false,
    } = params;

    const hashSecret = getFriendAttributionHashSecret();
    const lineUserIdHash = hashLineUserId(lineUserId, hashSecret);

    if (webhookEventId) {
      const existingSuccess = await this.prisma.greetingExecution.findFirst({
        where: {
          webhookEventId,
          status: GreetingExecutionStatus.SUCCESS,
        },
      });
      if (existingSuccess) {
        this.logger.log(`[Greeting] Duplicate follow event ignored: webhookEventId=${webhookEventId}`);
        return {
          handled: true,
          success: true,
          reason: "DUPLICATE_EVENT_ALREADY_PROCESSED",
          executionId: existingSuccess.id,
        };
      }
    }

    const assignment = await this.prisma.greetingStoreAssignment.findUnique({
      where: { lineOfficialAccountId },
      include: { template: true },
    });

    if (!assignment || !assignment.template) {
      this.logger.log(`[Greeting] No greeting template assigned for OA '${lineOfficialAccountId}'. Skipping.`);
      return { handled: false, success: false, reason: "NO_TEMPLATE_ASSIGNED" };
    }

    const template = assignment.template;

    if (template.status !== GreetingTemplateStatus.ACTIVE) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: `TEMPLATE_${template.status}`,
        isUnblocked,
      });
      return { handled: true, success: false, reason: `TEMPLATE_${template.status}`, executionId: execution?.id };
    }

    if (template.sendPolicy === GreetingSendPolicy.FIRST_TIME_ONLY) {
      if (isUnblocked) {
        const execution = await this.recordExecution({
          templateId: template.id,
          lineOfficialAccountId,
          webhookEventId,
          lineUserIdHash,
          status: GreetingExecutionStatus.SKIPPED,
          reason: "FIRST_TIME_ONLY_UNBLOCK_SKIPPED",
          isUnblocked,
        });
        return { handled: true, success: false, reason: "FIRST_TIME_ONLY_UNBLOCK_SKIPPED", executionId: execution?.id };
      }

      const priorSuccess = await this.prisma.greetingExecution.findFirst({
        where: { lineOfficialAccountId, lineUserIdHash, status: GreetingExecutionStatus.SUCCESS },
      });
      if (priorSuccess) {
        const execution = await this.recordExecution({
          templateId: template.id,
          lineOfficialAccountId,
          webhookEventId,
          lineUserIdHash,
          status: GreetingExecutionStatus.SKIPPED,
          reason: "FIRST_TIME_ONLY_ALREADY_RECEIVED",
          isUnblocked,
        });
        return { handled: true, success: false, reason: "FIRST_TIME_ONLY_ALREADY_RECEIVED", executionId: execution?.id };
      }
    }

    if (!replyToken || !replyToken.trim()) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "NO_REPLY_TOKEN",
        isUnblocked,
      });
      return { handled: true, success: false, reason: "NO_REPLY_TOKEN", executionId: execution?.id };
    }

    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: lineOfficialAccountId },
      include: { store: { include: { storeMaster: true } } },
    });

    if (!oa || !oa.isActive || oa.archivedAt !== null) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "OA_INACTIVE_OR_ARCHIVED",
        isUnblocked,
      });
      return { handled: true, success: false, reason: "OA_INACTIVE_OR_ARCHIVED", executionId: execution?.id };
    }

    if (oa.accountType !== LineAccountType.STORE) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "OA_NOT_STORE_ACCOUNT",
        isUnblocked,
      });
      return { handled: true, success: false, reason: "OA_NOT_STORE_ACCOUNT", executionId: execution?.id };
    }

    if (!oa.encryptedChannelAccessToken) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.FAILED,
        reason: "TOKEN_NOT_CONFIGURED",
        isUnblocked,
      });
      return { handled: true, success: false, reason: "TOKEN_NOT_CONFIGURED", executionId: execution?.id };
    }

    let accessToken: string;
    try {
      accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    } catch (err) {
      this.logger.error(`[Greeting] Failed to decrypt token for OA '${lineOfficialAccountId}': ${err}`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.FAILED,
        reason: "TOKEN_DECRYPTION_FAILED",
        isUnblocked,
      });
      return { handled: true, success: false, reason: "TOKEN_DECRYPTION_FAILED", executionId: execution?.id };
    }

    const rawMessages = normalizeGreetingMessages(template);
    const validation = validateGreetingMessages(rawMessages);
    if (!validation.valid) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.FAILED,
        reason: `INVALID_TEMPLATE_MESSAGES: ${validation.errors.join("; ")}`,
        isUnblocked,
      });
      return { handled: true, success: false, reason: "INVALID_TEMPLATE_MESSAGES", executionId: execution?.id };
    }

    const usedVariables = extractAllGreetingVariables(rawMessages);
    const usesUserDisplayName = usedVariables.some(
      (v) => v === "user.displayName" || v === "user.name" || v === "customer.displayName",
    );

    let customerDisplayName = "ลูกค้าคนสำคัญ";
    if (usesUserDisplayName) {
      try {
        const customer = await this.prisma.customer.findUnique({ where: { lineUserId } });
        if (customer) {
          if (customer.displayName === "LINE Customer" || !customer.profileFetchedAt) {
            const refreshed = await this.profiles
              .refresh(customer.id, lineOfficialAccountId, false, "GREETING_EXECUTION")
              .catch(() => null);
            if (refreshed?.displayName && refreshed.displayName !== "LINE Customer") {
              customerDisplayName = refreshed.displayName;
            } else if (customer.displayName && customer.displayName !== "LINE Customer") {
              customerDisplayName = customer.displayName;
            }
          } else {
            customerDisplayName = customer.displayName;
          }
        }
      } catch (err) {
        this.logger.warn(`[Greeting] Profile lookup error for user '${lineUserId}': ${err}. Using fallback.`);
      }
    }

    const store = oa.store;
    const storeMaster = store?.storeMaster;
    const storeContext: StoreVariableContext = {
      id: store?.id,
      name: store?.name,
      storeName: storeMaster?.storeName || store?.name || oa.name,
      code: store?.code || storeMaster?.externalStoreId,
      storeId: store?.id,
      externalStoreId: storeMaster?.externalStoreId,
      accountName: oa.name,
      lineOfficialAccountName: oa.name,
      province: storeMaster?.province,
      region: storeMaster?.region || store?.region,
      lineId: storeMaster?.lineId || oa.basicId,
      lineOaLink: storeMaster?.lineOaLink,
      lineManagerUrl: storeMaster?.lineManagerUrl,
      tiktokUsername: storeMaster?.tiktokUsername,
      tiktokProfileUrl: storeMaster?.tiktokProfileUrl,
      googleMapsUrl: storeMaster?.googleMapsUrl,
      user: { displayName: customerDisplayName },
      userDisplayName: customerDisplayName,
      userName: customerDisplayName,
      account: { name: oa.name },
    };

    const lineMessages: unknown[] = [];
    const messageTypes: string[] = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const block = rawMessages[i];
      const blockNum = i + 1;

      if (block.type === "TEXT") {
        const textTemplate = block.textTemplate || "";
        const blockValidation = validateTemplateVariables(textTemplate, storeContext);
        if (blockValidation.status !== "READY") {
          const reason = `MISSING_STORE_VARIABLES: ${blockValidation.missingVariables.join(", ")}`;
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason,
            isUnblocked,
          });
          return { handled: true, success: false, reason, executionId: execution?.id };
        }
        const resolvedText = resolveTemplateVariables(textTemplate, storeContext);
        if (!resolvedText.trim()) {
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason: "EMPTY_RESOLVED_TEXT",
            isUnblocked,
          });
          return { handled: true, success: false, reason: "EMPTY_RESOLVED_TEXT", executionId: execution?.id };
        }
        lineMessages.push({ type: "text", text: resolvedText });
        messageTypes.push("TEXT");
        continue;
      }

      if (block.type === "IMAGE") {
        if (!block.mediaObjectKey?.trim()) {
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason: "MISSING_IMAGE_MEDIA",
            isUnblocked,
          });
          return { handled: true, success: false, reason: "MISSING_IMAGE_MEDIA", executionId: execution?.id };
        }
        const originalContentUrl = createMediaPublicUrl(block.mediaObjectKey);
        const previewImageUrl = createMediaPublicUrl(block.previewObjectKey || block.mediaObjectKey);
        lineMessages.push({ type: "image", originalContentUrl, previewImageUrl });
        messageTypes.push("IMAGE");
        continue;
      }

      if (block.type === "RICH_MESSAGE") {
        if (!this.richMessages) {
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.FAILED,
            reason: "RICH_MESSAGE_SERVICE_UNAVAILABLE",
            isUnblocked,
          });
          return { handled: true, success: false, reason: "RICH_MESSAGE_SERVICE_UNAVAILABLE", executionId: execution?.id };
        }
        try {
          lineMessages.push(await this.richMessages.buildLineImagemap(block.richMessageId));
          messageTypes.push("RICH_MESSAGE");
        } catch (err) {
          const detail = err instanceof Error ? err.message : "Rich Message is unavailable";
          this.logger.warn(`[Greeting] Block #${blockNum} (RICH_MESSAGE) unavailable: ${detail}`);
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason: `RICH_MESSAGE_UNAVAILABLE: ${detail.slice(0, 160)}`,
            isUnblocked,
          });
          return { handled: true, success: false, reason: "RICH_MESSAGE_UNAVAILABLE", executionId: execution?.id };
        }
      }
    }

    if (lineMessages.length === 0 || lineMessages.length > 5) {
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "INVALID_MESSAGE_COUNT",
        isUnblocked,
      });
      return { handled: true, success: false, reason: "INVALID_MESSAGE_COUNT", executionId: execution?.id };
    }

    try {
      this.logger.log(`[Greeting] Sending ${lineMessages.length} greeting message(s) to user for OA '${lineOfficialAccountId}'`);
      await this.lineMessaging.replyMessages(accessToken, replyToken, lineMessages, {
        userId: lineUserId,
        storeId: store?.id,
        storeName: storeMaster?.storeName || store?.name,
        channelId: oa.channelId || undefined,
        messageType: messageTypes.join("+"),
      });

      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SUCCESS,
        reason: null,
        messageCount: lineMessages.length,
        messageTypesJson: messageTypes,
        isUnblocked,
      });
      return { handled: true, success: true, executionId: execution?.id, messageCount: lineMessages.length };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`[Greeting] LINE replyMessages call failed: ${errorMessage}`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.FAILED,
        reason: `REPLY_API_FAILED: ${errorMessage.slice(0, 200)}`,
        messageCount: lineMessages.length,
        messageTypesJson: messageTypes,
        isUnblocked,
      });
      return { handled: true, success: false, reason: `REPLY_API_FAILED: ${errorMessage}`, executionId: execution?.id };
    }
  }

  private async recordExecution(data: {
    templateId?: string | null;
    lineOfficialAccountId: string;
    webhookEventId?: string | null;
    lineUserIdHash: string;
    status: GreetingExecutionStatus;
    reason?: string | null;
    messageCount?: number;
    messageTypesJson?: unknown;
    isUnblocked?: boolean;
  }) {
    try {
      return await this.prisma.greetingExecution.create({
        data: {
          templateId: data.templateId || null,
          lineOfficialAccountId: data.lineOfficialAccountId,
          webhookEventId: data.webhookEventId || null,
          lineUserIdHash: data.lineUserIdHash,
          status: data.status,
          reason: data.reason || null,
          messageCount: data.messageCount || null,
          messageTypesJson: (data.messageTypesJson as any) || null,
          isUnblocked: data.isUnblocked ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`[Greeting] Failed to record execution log: ${err}`);
      return null;
    }
  }
}
