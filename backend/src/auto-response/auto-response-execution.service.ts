import { Injectable, Logger } from "@nestjs/common";
import { AutoResponseExecutionStatus, AutoResponseStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import {
  extractTemplateVariables,
  getStoreGoogleMapsReadiness,
  resolveTemplateVariables,
  StoreVariableContext,
} from "../store-master/template-variable-resolver";
import { parseAutoResponsePostbackData } from "./auto-response.utils";

export type PostbackExecutionResult = {
  handled: boolean;
  success: boolean;
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
        `[AutoResponse] OA '${oa.name}' is HEAD_OFFICE. Auto-response is STORE-only in Phase 1.`,
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

    // 4. Resolve Template Variables
    const storeMaster = oa.store?.storeMaster;
    const storeContext: StoreVariableContext = {
      storeName: oa.store?.name ?? oa.name,
      externalStoreId: storeMaster?.externalStoreId ?? null,
      accountName: oa.name,
      googleMapsUrl: storeMaster?.googleMapsUrl ?? null,
    };

    const usedVariables = extractTemplateVariables(rule.textTemplate);
    const resolvedText = resolveTemplateVariables(rule.textTemplate, storeContext);

    // Fail-safe variable check: never send broken {{...}} text
    const remainingMatches = resolvedText.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
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
      });
      return {
        handled: true,
        success: false,
        reason: "UNRESOLVED_VARIABLE",
        executionId: execution?.id,
      };
    }

    const requiresGoogleMaps =
      usedVariables.includes("store.googleMapsUrl") ||
      usedVariables.includes("googleMapsUrl");

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
        });
        return {
          handled: true,
          success: false,
          reason: "GOOGLE_MAPS_NOT_READY",
          executionId: execution?.id,
        };
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

    // 6. Send LINE Reply Message
    try {
      await this.lineMessaging.replyText({
        accessToken,
        replyToken,
        text: resolvedText,
        context: {
          storeId: oa.store?.id,
          storeName: oa.store?.name,
          messageType: "AUTO_RESPONSE",
        },
      });

      const execution = await this.recordExecution({
        ruleId,
        lineOfficialAccountId,
        webhookEventId,
        status: AutoResponseExecutionStatus.SUCCESS,
        resolvedVariablesJson: {
          usedVariables,
          storeName: storeContext.storeName,
          hasGoogleMapsUrl: Boolean(storeContext.googleMapsUrl),
        },
      });

      this.logger.log(
        `[AutoResponse] Successfully replied to postback: rule='${rule.name}' store='${oa.store?.name}'`,
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
    ruleId: string;
    lineOfficialAccountId: string;
    webhookEventId?: string;
    status: AutoResponseExecutionStatus;
    reason?: string;
    resolvedVariablesJson?: any;
  }) {
    try {
      // Check if rule actually exists before linking foreign key
      const ruleExists =
        data.ruleId !== "unknown" &&
        (await this.prisma.autoResponseRule.count({
          where: { id: data.ruleId },
        })) > 0;

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
          resolvedVariablesJson: data.resolvedVariablesJson || undefined,
        },
      });
    } catch (err: any) {
      this.logger.warn(`[AutoResponse] Failed to record execution log: ${err?.message}`);
      return null;
    }
  }
}
