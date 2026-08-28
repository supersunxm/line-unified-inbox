import { Injectable, Logger } from "@nestjs/common";
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
import {
  extractTemplateVariables,
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
  ) {}

  /**
   * Main entrypoint invoked by LINE Webhook pipeline when event.type === 'follow'.
   */
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

    // 1. Idempotency Guard via webhookEventId
    if (webhookEventId) {
      const existingSuccess = await this.prisma.greetingExecution.findFirst({
        where: {
          webhookEventId,
          status: GreetingExecutionStatus.SUCCESS,
        },
      });

      if (existingSuccess) {
        this.logger.log(
          `[Greeting] Duplicate follow event ignored: webhookEventId=${webhookEventId}`,
        );
        return {
          handled: true,
          success: true,
          reason: "DUPLICATE_EVENT_ALREADY_PROCESSED",
          executionId: existingSuccess.id,
        };
      }
    }

    // 2. Load Store Assignment
    const assignment = await this.prisma.greetingStoreAssignment.findUnique({
      where: { lineOfficialAccountId },
      include: { template: true },
    });

    if (!assignment || !assignment.template) {
      this.logger.log(
        `[Greeting] No greeting template assigned for OA '${lineOfficialAccountId}'. Skipping.`,
      );
      return {
        handled: false,
        success: false,
        reason: "NO_TEMPLATE_ASSIGNED",
      };
    }

    const template = assignment.template;

    // 3. Require template ACTIVE
    if (template.status !== GreetingTemplateStatus.ACTIVE) {
      this.logger.log(
        `[Greeting] Template '${template.name}' (${template.id}) is ${template.status}. Skipping.`,
      );
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: `TEMPLATE_${template.status}`,
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: `TEMPLATE_${template.status}`,
        executionId: execution?.id,
      };
    }

    // 4. Evaluate Send Policy
    if (template.sendPolicy === GreetingSendPolicy.FIRST_TIME_ONLY) {
      if (isUnblocked) {
        this.logger.log(
          `[Greeting] FIRST_TIME_ONLY policy: follow is unblock event. Skipping OA '${lineOfficialAccountId}'.`,
        );
        const execution = await this.recordExecution({
          templateId: template.id,
          lineOfficialAccountId,
          webhookEventId,
          lineUserIdHash,
          status: GreetingExecutionStatus.SKIPPED,
          reason: "FIRST_TIME_ONLY_UNBLOCK_SKIPPED",
          isUnblocked,
        });
        return {
          handled: true,
          success: false,
          reason: "FIRST_TIME_ONLY_UNBLOCK_SKIPPED",
          executionId: execution?.id,
        };
      }

      // Check if user previously received a greeting successfully for this OA
      const priorSuccess = await this.prisma.greetingExecution.findFirst({
        where: {
          lineOfficialAccountId,
          lineUserIdHash,
          status: GreetingExecutionStatus.SUCCESS,
        },
      });

      if (priorSuccess) {
        this.logger.log(
          `[Greeting] FIRST_TIME_ONLY policy: user already received greeting previously for OA '${lineOfficialAccountId}'. Skipping.`,
        );
        const execution = await this.recordExecution({
          templateId: template.id,
          lineOfficialAccountId,
          webhookEventId,
          lineUserIdHash,
          status: GreetingExecutionStatus.SKIPPED,
          reason: "FIRST_TIME_ONLY_ALREADY_RECEIVED",
          isUnblocked,
        });
        return {
          handled: true,
          success: false,
          reason: "FIRST_TIME_ONLY_ALREADY_RECEIVED",
          executionId: execution?.id,
        };
      }
    }

    // 5. Require replyToken
    if (!replyToken || !replyToken.trim()) {
      this.logger.warn(
        `[Greeting] Follow event for OA '${lineOfficialAccountId}' has no replyToken. Push fallback is disallowed.`,
      );
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "NO_REPLY_TOKEN",
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: "NO_REPLY_TOKEN",
        executionId: execution?.id,
      };
    }

    // 6. Load Target LINE OA & Store Master
    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: lineOfficialAccountId },
      include: {
        store: { include: { storeMaster: true } },
      },
    });

    if (!oa || !oa.isActive || oa.archivedAt !== null) {
      this.logger.warn(`[Greeting] OA '${lineOfficialAccountId}' is inactive or archived`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "OA_INACTIVE_OR_ARCHIVED",
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: "OA_INACTIVE_OR_ARCHIVED",
        executionId: execution?.id,
      };
    }

    if (oa.accountType !== LineAccountType.STORE) {
      this.logger.warn(`[Greeting] OA '${lineOfficialAccountId}' is not a STORE account`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "OA_NOT_STORE_ACCOUNT",
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: "OA_NOT_STORE_ACCOUNT",
        executionId: execution?.id,
      };
    }

    if (!oa.encryptedChannelAccessToken) {
      this.logger.error(`[Greeting] OA '${lineOfficialAccountId}' has no access token configured`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.FAILED,
        reason: "TOKEN_NOT_CONFIGURED",
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: "TOKEN_NOT_CONFIGURED",
        executionId: execution?.id,
      };
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
      return {
        handled: true,
        success: false,
        reason: "TOKEN_DECRYPTION_FAILED",
        executionId: execution?.id,
      };
    }

    // 7. Normalize message blocks
    const rawMessages = normalizeGreetingMessages(template);
    const validation = validateGreetingMessages(rawMessages);
    if (!validation.valid) {
      this.logger.error(`[Greeting] Invalid message blocks in template '${template.id}': ${validation.errors.join("; ")}`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.FAILED,
        reason: `INVALID_TEMPLATE_MESSAGES: ${validation.errors.join("; ")}`,
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: "INVALID_TEMPLATE_MESSAGES",
        executionId: execution?.id,
      };
    }

    // 8. User Display Name resolution (only fetch profile if {{user.displayName}} is actually used)
    const usedVariables = extractAllGreetingVariables(rawMessages);
    const usesUserDisplayName = usedVariables.some(
      (v) =>
        v === "user.displayName" ||
        v === "user.name" ||
        v === "customer.displayName",
    );

    let customerDisplayName = "ลูกค้าคนสำคัญ";

    if (usesUserDisplayName) {
      try {
        const customer = await this.prisma.customer.findUnique({
          where: { lineUserId },
        });

        if (customer) {
          // If customer has a default name or stale profile, try refreshing from LINE profile service
          if (
            customer.displayName === "LINE Customer" ||
            !customer.profileFetchedAt
          ) {
            const refreshed = await this.profiles
              .refresh(customer.id, lineOfficialAccountId, false, "GREETING_EXECUTION")
              .catch(() => null);

            if (refreshed && refreshed.displayName && refreshed.displayName !== "LINE Customer") {
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
        customerDisplayName = "ลูกค้าคนสำคัญ";
      }
    }

    // 9. Build context & resolve variables
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

    // Pre-flight validate each block
    const lineMessages: unknown[] = [];
    const messageTypes: string[] = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const block = rawMessages[i];
      const blockNum = i + 1;

      if (block.type === "TEXT") {
        const textTemplate = block.textTemplate || "";
        const blockValidation = validateTemplateVariables(textTemplate, storeContext);

        if (blockValidation.status !== "READY") {
          this.logger.warn(
            `[Greeting] Block #${blockNum} (TEXT) missing required store variables: ${blockValidation.missingVariables.join(", ")}`,
          );
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason: `MISSING_STORE_VARIABLES: ${blockValidation.missingVariables.join(", ")}`,
            isUnblocked,
          });
          return {
            handled: true,
            success: false,
            reason: `MISSING_STORE_VARIABLES: ${blockValidation.missingVariables.join(", ")}`,
            executionId: execution?.id,
          };
        }

        const resolvedText = resolveTemplateVariables(textTemplate, storeContext);
        if (!resolvedText.trim()) {
          this.logger.warn(`[Greeting] Block #${blockNum} (TEXT) resolved to empty text.`);
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason: "EMPTY_RESOLVED_TEXT",
            isUnblocked,
          });
          return {
            handled: true,
            success: false,
            reason: "EMPTY_RESOLVED_TEXT",
            executionId: execution?.id,
          };
        }

        lineMessages.push({
          type: "text",
          text: resolvedText,
        });
        messageTypes.push("TEXT");
      } else if (block.type === "IMAGE") {
        if (!block.mediaObjectKey || !block.mediaObjectKey.trim()) {
          this.logger.warn(`[Greeting] Block #${blockNum} (IMAGE) missing mediaObjectKey.`);
          const execution = await this.recordExecution({
            templateId: template.id,
            lineOfficialAccountId,
            webhookEventId,
            lineUserIdHash,
            status: GreetingExecutionStatus.SKIPPED,
            reason: "MISSING_IMAGE_MEDIA",
            isUnblocked,
          });
          return {
            handled: true,
            success: false,
            reason: "MISSING_IMAGE_MEDIA",
            executionId: execution?.id,
          };
        }

        const originalContentUrl = createMediaPublicUrl(block.mediaObjectKey);
        const previewImageUrl = (block.previewObjectKey || block.mediaObjectKey)
          ? createMediaPublicUrl(block.previewObjectKey || block.mediaObjectKey)
          : originalContentUrl;

        lineMessages.push({
          type: "image",
          originalContentUrl,
          previewImageUrl,
        });
        messageTypes.push("IMAGE");
      }
    }

    if (lineMessages.length === 0 || lineMessages.length > 5) {
      this.logger.warn(`[Greeting] Invalid message count: ${lineMessages.length}.`);
      const execution = await this.recordExecution({
        templateId: template.id,
        lineOfficialAccountId,
        webhookEventId,
        lineUserIdHash,
        status: GreetingExecutionStatus.SKIPPED,
        reason: "INVALID_MESSAGE_COUNT",
        isUnblocked,
      });
      return {
        handled: true,
        success: false,
        reason: "INVALID_MESSAGE_COUNT",
        executionId: execution?.id,
      };
    }

    // 10. Dispatch SINGLE reply request to LINE Messaging API
    try {
      this.logger.log(
        `[Greeting] Sending ${lineMessages.length} greeting message(s) to user for OA '${lineOfficialAccountId}'`,
      );

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

      return {
        handled: true,
        success: true,
        executionId: execution?.id,
        messageCount: lineMessages.length,
      };
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

      return {
        handled: true,
        success: false,
        reason: `REPLY_API_FAILED: ${errorMessage}`,
        executionId: execution?.id,
      };
    }
  }

  /**
   * Helper to persist execution logs in the database.
   */
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
