import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  LineOaConnectionStatus,
  MassMessageAudienceType,
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import type { AuthUser } from "./auth/auth.guard";
import { AuditLogService } from "./auth/audit-log.service";
import { StoreAccessService } from "./auth/store-access.service";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { LineMessagingService } from "./line-messaging/line-messaging.service";
import { MassMessageService } from "./mass-message/mass-message.service";
import type { MassMessageItem } from "./mass-message/mass-message.types";
import { PrismaService } from "./prisma.service";
import type { ExecutePurchaseBroadcastDto } from "./purchase-broadcast-audience.dto";

const REVIEW_TTL_MS = 10 * 60 * 1000;
const MULTICAST_BATCH_SIZE = 500;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_CONCURRENT_STORES = 5;
const BATCH_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

type RecipientRef = {
  customerId: string;
  conversationId: string;
  storeId: string;
  lineOfficialAccountId: string;
};

type PurchaseAudienceSource = {
  type: "PURCHASE_INTELLIGENCE";
  version: 1;
  recipientRefs: RecipientRef[];
};

type SendReviewSnapshot = {
  version: 1;
  reviewToken: string;
  fingerprint: string;
  reviewedAt: string;
  expiresAt: string;
  eligibleRecipientCount: number;
  excludedRecipientCount: number;
  storeCount: number;
  lineOaCount: number;
};

type ExecutionSource = {
  type: "PURCHASE_INTELLIGENCE_SELECTED_SEND";
  version: 1;
  reviewToken: string;
  fingerprint: string;
  state: "QUEUED" | "RUNNING" | "COMPLETED";
  recipientRefs: RecipientRef[];
  executedById: string;
  executedAt: string;
  completedAt?: string;
};

type LineQuota =
  | { type: "none" }
  | { type: "limited"; value: number };

type QuotaAssessment = {
  type: "NONE" | "LIMITED" | "ERROR";
  limit: number | null;
  usage: number | null;
  remaining: number | null;
  required: number;
  safe: boolean;
  error: string | null;
};

type EligibleRecipient = {
  ref: RecipientRef;
  lineUserId: string;
  storeName: string;
  storeCode: string | null;
  lineOaName: string;
  encryptedChannelAccessToken: string;
};

type ReviewStore = {
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string;
  lineOaName: string;
  recipientCount: number;
  quota: QuotaAssessment;
};

export type PurchaseBroadcastSendReviewResult = {
  campaignId: string;
  title: string | null;
  reviewToken: string;
  expiresAt: string;
  safeToSend: boolean;
  messageCount: number;
  audience: {
    snapshotRecipientCount: number;
    eligibleRecipientCount: number;
    excludedRecipientCount: number;
    storeCount: number;
    lineOaCount: number;
  };
  exclusions: Array<{ reason: string; count: number }>;
  stores: ReviewStore[];
};

export type PurchaseBroadcastSendStatusResult = {
  campaignId: string;
  title: string | null;
  status: MassMessageCampaignStatus;
  executionState: ExecutionSource["state"] | null;
  estimatedRecipientCount: number;
  processedRecipientCount: number;
  successRecipientCount: number;
  failedRecipientCount: number;
  storeCount: number;
  stores: Array<{
    storeId: string;
    storeName: string;
    storeCode: string | null;
    lineOfficialAccountId: string | null;
    lineOaName: string | null;
    status: MassMessageStoreDeliveryStatus;
    recipientCount: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    skipReason: string | null;
  }>;
  startedAt: string | null;
  completedAt: string | null;
  duplicate?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecipientRef(value: unknown): RecipientRef | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.customerId !== "string" ||
    typeof value.conversationId !== "string" ||
    typeof value.storeId !== "string" ||
    typeof value.lineOfficialAccountId !== "string"
  ) {
    return null;
  }
  return {
    customerId: value.customerId,
    conversationId: value.conversationId,
    storeId: value.storeId,
    lineOfficialAccountId: value.lineOfficialAccountId,
  };
}

function readAudienceSource(payload: unknown): PurchaseAudienceSource | null {
  if (!isRecord(payload) || !isRecord(payload.audienceSource)) return null;
  const source = payload.audienceSource;
  if (
    source.type !== "PURCHASE_INTELLIGENCE" ||
    source.version !== 1 ||
    !Array.isArray(source.recipientRefs)
  ) {
    return null;
  }
  const recipientRefs: RecipientRef[] = [];
  for (const item of source.recipientRefs) {
    const ref = readRecipientRef(item);
    if (!ref) return null;
    recipientRefs.push(ref);
  }
  return { type: "PURCHASE_INTELLIGENCE", version: 1, recipientRefs };
}

function readReview(payload: unknown): SendReviewSnapshot | null {
  if (!isRecord(payload) || !isRecord(payload.sendReview)) return null;
  const review = payload.sendReview;
  if (
    review.version !== 1 ||
    typeof review.reviewToken !== "string" ||
    typeof review.fingerprint !== "string" ||
    typeof review.reviewedAt !== "string" ||
    typeof review.expiresAt !== "string" ||
    typeof review.eligibleRecipientCount !== "number" ||
    typeof review.excludedRecipientCount !== "number" ||
    typeof review.storeCount !== "number" ||
    typeof review.lineOaCount !== "number"
  ) {
    return null;
  }
  return {
    version: 1,
    reviewToken: review.reviewToken,
    fingerprint: review.fingerprint,
    reviewedAt: review.reviewedAt,
    expiresAt: review.expiresAt,
    eligibleRecipientCount: review.eligibleRecipientCount,
    excludedRecipientCount: review.excludedRecipientCount,
    storeCount: review.storeCount,
    lineOaCount: review.lineOaCount,
  };
}

function readExecutionSource(payload: unknown): ExecutionSource | null {
  if (!isRecord(payload) || !isRecord(payload.executionSource)) return null;
  const execution = payload.executionSource;
  if (
    execution.type !== "PURCHASE_INTELLIGENCE_SELECTED_SEND" ||
    execution.version !== 1 ||
    typeof execution.reviewToken !== "string" ||
    typeof execution.fingerprint !== "string" ||
    typeof execution.executedById !== "string" ||
    typeof execution.executedAt !== "string" ||
    (execution.state !== "QUEUED" &&
      execution.state !== "RUNNING" &&
      execution.state !== "COMPLETED") ||
    !Array.isArray(execution.recipientRefs)
  ) {
    return null;
  }
  const recipientRefs: RecipientRef[] = [];
  for (const item of execution.recipientRefs) {
    const ref = readRecipientRef(item);
    if (!ref) return null;
    recipientRefs.push(ref);
  }
  return {
    type: "PURCHASE_INTELLIGENCE_SELECTED_SEND",
    version: 1,
    reviewToken: execution.reviewToken,
    fingerprint: execution.fingerprint,
    state: execution.state,
    recipientRefs,
    executedById: execution.executedById,
    executedAt: execution.executedAt,
    ...(typeof execution.completedAt === "string"
      ? { completedAt: execution.completedAt }
      : {}),
  };
}

function jsonPayload(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  return isRecord(value) ? (value as Record<string, Prisma.JsonValue>) : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function errorStatus(error: unknown): number {
  if (isRecord(error) && typeof error.status === "number") return error.status;
  if (isRecord(error) && typeof error.statusCode === "number") return error.statusCode;
  return 500;
}

export function assessPurchaseBroadcastQuota(
  quota: LineQuota,
  usage: number,
  required: number,
): QuotaAssessment {
  if (quota.type === "none") {
    return {
      type: "NONE",
      limit: null,
      usage,
      remaining: null,
      required,
      safe: true,
      error: null,
    };
  }
  const remaining = Math.max(0, quota.value - usage);
  return {
    type: "LIMITED",
    limit: quota.value,
    usage,
    remaining,
    required,
    safe: remaining >= required,
    error: null,
  };
}

export function buildPurchaseBroadcastSendFingerprint(input: {
  campaignId: string;
  title: string | null;
  messages: MassMessageItem[];
  recipientRefs: RecipientRef[];
}): string {
  const refs = [...input.recipientRefs]
    .map(
      (ref) =>
        `${ref.customerId}:${ref.conversationId}:${ref.storeId}:${ref.lineOfficialAccountId}`,
    )
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({
        campaignId: input.campaignId,
        title: input.title ?? null,
        messages: input.messages,
        recipientRefs: refs,
      }),
    )
    .digest("hex");
}

@Injectable()
export class PurchaseBroadcastSafeSendService implements OnModuleInit {
  private readonly logger = new Logger(PurchaseBroadcastSafeSendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService,
    private readonly massMessages: MassMessageService,
    private readonly auditLog: AuditLogService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    void this.recoverSelectedAudienceExecutions().catch((error) => {
      this.logger.error(
        `Selected audience recovery failed: ${errorMessage(error)}`,
      );
    });
  }

  async review(
    campaignId: string,
    user: AuthUser,
  ): Promise<PurchaseBroadcastSendReviewResult> {
    this.assertAdmin(user);
    const preflight = await this.buildPreflight(campaignId, user);
    if (preflight.deliveryCount > 0 || preflight.execution) {
      throw new ConflictException("Campaign execution has already started");
    }

    const reviewToken = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REVIEW_TTL_MS);
    const review: SendReviewSnapshot = {
      version: 1,
      reviewToken,
      fingerprint: preflight.fingerprint,
      reviewedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      eligibleRecipientCount: preflight.eligible.length,
      excludedRecipientCount: preflight.snapshotCount - preflight.eligible.length,
      storeCount: preflight.stores.length,
      lineOaCount: new Set(
        preflight.stores.map((store) => store.lineOfficialAccountId),
      ).size,
    };

    const payload = jsonPayload(preflight.campaign.messagePayload);
    await this.prisma.massMessageCampaign.update({
      where: { id: campaignId },
      data: {
        messagePayload: {
          ...payload,
          sendReview: review,
        } as Prisma.InputJsonValue,
      },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: "PURCHASE_BROADCAST_SEND_REVIEWED",
      metadata: {
        campaignId,
        eligibleRecipientCount: review.eligibleRecipientCount,
        excludedRecipientCount: review.excludedRecipientCount,
        storeCount: review.storeCount,
        lineOaCount: review.lineOaCount,
        safeToSend: preflight.safeToSend,
      },
    });

    return {
      campaignId,
      title: preflight.campaign.title,
      reviewToken,
      expiresAt: review.expiresAt,
      safeToSend: preflight.safeToSend,
      messageCount: preflight.messages.length,
      audience: {
        snapshotRecipientCount: preflight.snapshotCount,
        eligibleRecipientCount: preflight.eligible.length,
        excludedRecipientCount: preflight.snapshotCount - preflight.eligible.length,
        storeCount: preflight.stores.length,
        lineOaCount: new Set(
          preflight.stores.map((store) => store.lineOfficialAccountId),
        ).size,
      },
      exclusions: preflight.exclusions,
      stores: preflight.stores,
    };
  }

  async execute(
    campaignId: string,
    input: ExecutePurchaseBroadcastDto,
    user: AuthUser,
  ): Promise<PurchaseBroadcastSendStatusResult> {
    this.assertAdmin(user);
    if (input.confirm !== true) {
      throw new BadRequestException("Final send confirmation is required");
    }

    const initial = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        audienceType: true,
        messagePayload: true,
        storeDeliveries: { select: { id: true }, take: 1 },
      },
    });
    if (!initial) throw new NotFoundException("Broadcast audience draft not found");

    const existingExecution = readExecutionSource(initial.messagePayload);
    if (existingExecution && initial.storeDeliveries.length > 0) {
      if (existingExecution.reviewToken !== input.reviewToken) {
        throw new ConflictException("Campaign execution already started from another review");
      }
      return { ...(await this.getStatus(campaignId, user)), duplicate: true };
    }

    const savedReview = readReview(initial.messagePayload);
    if (!savedReview || savedReview.reviewToken !== input.reviewToken) {
      throw new ConflictException("Safety review is missing or stale. Run review again before sending");
    }
    if (new Date(savedReview.expiresAt).getTime() <= Date.now()) {
      throw new ConflictException("Safety review expired. Run review again before sending");
    }

    const preflight = await this.buildPreflight(campaignId, user);
    const currentReview = readReview(preflight.campaign.messagePayload);
    if (!currentReview || currentReview.reviewToken !== input.reviewToken) {
      throw new ConflictException(
        "Safety review was replaced while validating. Run review again before sending",
      );
    }
    if (!preflight.safeToSend) {
      throw new ConflictException("Safety review no longer passes. Review the campaign again");
    }
    if (preflight.eligible.length === 0) {
      throw new BadRequestException("No eligible recipients remain for this campaign");
    }
    if (savedReview.fingerprint !== preflight.fingerprint) {
      throw new ConflictException("Campaign content or eligible audience changed after review");
    }

    const execution: ExecutionSource = {
      type: "PURCHASE_INTELLIGENCE_SELECTED_SEND",
      version: 1,
      reviewToken: input.reviewToken,
      fingerprint: preflight.fingerprint,
      state: "QUEUED",
      recipientRefs: preflight.eligible.map((item) => item.ref),
      executedById: user.id,
      executedAt: new Date().toISOString(),
    };
    const payload = jsonPayload(preflight.campaign.messagePayload);

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.massMessageCampaign.updateMany({
        where: {
          id: campaignId,
          status: MassMessageCampaignStatus.DRAFT,
          audienceType: MassMessageAudienceType.SELECTED_USERS,
        },
        data: {
          messagePayload: {
            ...payload,
            sendReview: null,
            executionSource: execution,
          } as Prisma.InputJsonValue,
          storeCount: preflight.stores.length,
          eligibleStoreCount: preflight.stores.length,
          skippedStoreCount: 0,
          estimatedRecipientCount: preflight.eligible.length,
          processedRecipientCount: 0,
          successRecipientCount: 0,
          failedRecipientCount: 0,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("Campaign could not be claimed for execution");
      }

      for (const store of preflight.stores) {
        await tx.massMessageStoreDelivery.create({
          data: {
            campaignId,
            storeId: store.storeId,
            lineOfficialAccountId: store.lineOfficialAccountId,
            status: MassMessageStoreDeliveryStatus.PENDING,
            recipientCount: store.recipientCount,
          },
        });
      }
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: "PURCHASE_BROADCAST_SEND_CONFIRMED",
      metadata: {
        campaignId,
        recipientCount: preflight.eligible.length,
        storeCount: preflight.stores.length,
        lineOaCount: new Set(
          preflight.stores.map((store) => store.lineOfficialAccountId),
        ).size,
      },
    });

    void this.processSelectedCampaign(campaignId).catch((error) => {
      this.logger.error(
        `Selected audience execution failed for ${campaignId}: ${errorMessage(error)}`,
      );
    });

    return this.getStatus(campaignId, user);
  }

  async getStatus(
    campaignId: string,
    user: AuthUser,
  ): Promise<PurchaseBroadcastSendStatusResult> {
    this.assertAdmin(user);
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      include: {
        storeDeliveries: {
          include: {
            store: { select: { name: true, code: true } },
            lineOfficialAccount: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!campaign) throw new NotFoundException("Broadcast campaign not found");
    if (campaign.audienceType !== MassMessageAudienceType.SELECTED_USERS) {
      throw new ConflictException("Campaign is not a Purchase Intelligence selected audience");
    }
    const execution = readExecutionSource(campaign.messagePayload);
    return {
      campaignId: campaign.id,
      title: campaign.title,
      status: campaign.status,
      executionState: execution?.state ?? null,
      estimatedRecipientCount: campaign.estimatedRecipientCount,
      processedRecipientCount: campaign.processedRecipientCount,
      successRecipientCount: campaign.successRecipientCount,
      failedRecipientCount: campaign.failedRecipientCount,
      storeCount: campaign.storeCount,
      stores: campaign.storeDeliveries.map((delivery) => ({
        storeId: delivery.storeId,
        storeName: delivery.store.name,
        storeCode: delivery.store.code,
        lineOfficialAccountId: delivery.lineOfficialAccountId,
        lineOaName: delivery.lineOfficialAccount?.name ?? null,
        status: delivery.status,
        recipientCount: delivery.recipientCount,
        processedCount: delivery.processedCount,
        successCount: delivery.successCount,
        failedCount: delivery.failedCount,
        skipReason: delivery.skipReason,
      })),
      startedAt: campaign.startedAt?.toISOString() ?? null,
      completedAt: campaign.completedAt?.toISOString() ?? null,
    };
  }

  async recoverSelectedAudienceExecutions(): Promise<number> {
    const campaigns = await this.prisma.massMessageCampaign.findMany({
      where: {
        audienceType: MassMessageAudienceType.SELECTED_USERS,
        status: MassMessageCampaignStatus.DRAFT,
        storeDeliveries: { some: {} },
      },
      select: { id: true, messagePayload: true },
      orderBy: { createdAt: "asc" },
    });
    const recoverable = campaigns.filter((campaign) => {
      const execution = readExecutionSource(campaign.messagePayload);
      return execution?.state === "QUEUED" || execution?.state === "RUNNING";
    });
    for (const campaign of recoverable) {
      void this.processSelectedCampaign(campaign.id).catch((error) => {
        this.logger.error(
          `Recovery failed for selected campaign ${campaign.id}: ${errorMessage(error)}`,
        );
      });
    }
    return recoverable.length;
  }

  private async buildPreflight(campaignId: string, user: AuthUser) {
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        title: true,
        status: true,
        audienceType: true,
        messagePayload: true,
        storeDeliveries: { select: { id: true } },
      },
    });
    if (!campaign) throw new NotFoundException("Broadcast audience draft not found");
    if (
      campaign.status !== MassMessageCampaignStatus.DRAFT ||
      campaign.audienceType !== MassMessageAudienceType.SELECTED_USERS
    ) {
      throw new ConflictException("Campaign is not a sendable Purchase Intelligence draft");
    }

    const source = readAudienceSource(campaign.messagePayload);
    if (!source || source.recipientRefs.length === 0) {
      throw new ConflictException("Purchase Intelligence recipient snapshot is missing or invalid");
    }
    const payload = jsonPayload(campaign.messagePayload);
    const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
    const messages = this.massMessages.validateMessages(rawMessages);
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);

    const conversationIds = [...new Set(source.recipientRefs.map((ref) => ref.conversationId))];
    const conversations = await this.prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      select: {
        id: true,
        customerId: true,
        storeId: true,
        lineOfficialAccountId: true,
        customer: { select: { lineUserId: true } },
        store: {
          select: { id: true, name: true, code: true, isActive: true, archivedAt: true },
        },
        lineOfficialAccount: {
          select: {
            id: true,
            name: true,
            storeId: true,
            isActive: true,
            archivedAt: true,
            connectionStatus: true,
            encryptedChannelAccessToken: true,
          },
        },
      },
    });
    const byConversationId = new Map(conversations.map((item) => [item.id, item]));
    const exclusions = new Map<string, number>();
    const addExclusion = (reason: string) => {
      exclusions.set(reason, (exclusions.get(reason) ?? 0) + 1);
    };

    const candidates: EligibleRecipient[] = [];
    const seen = new Set<string>();
    for (const ref of source.recipientRefs) {
      if (accessibleStoreIds && !accessibleStoreIds.includes(ref.storeId)) {
        addExclusion("UNAUTHORIZED");
        continue;
      }
      const conversation = byConversationId.get(ref.conversationId);
      if (
        !conversation ||
        conversation.customerId !== ref.customerId ||
        conversation.storeId !== ref.storeId ||
        conversation.lineOfficialAccountId !== ref.lineOfficialAccountId
      ) {
        addExclusion("SNAPSHOT_MISMATCH");
        continue;
      }
      if (!conversation.store.isActive || conversation.store.archivedAt) {
        addExclusion("STORE_NOT_ACTIVE");
        continue;
      }
      const oa = conversation.lineOfficialAccount;
      if (
        oa.storeId !== ref.storeId ||
        !oa.isActive ||
        oa.archivedAt ||
        (oa.connectionStatus !== LineOaConnectionStatus.READY &&
          oa.connectionStatus !== LineOaConnectionStatus.CONNECTED)
      ) {
        addExclusion("OA_NOT_READY");
        continue;
      }
      if (!oa.encryptedChannelAccessToken) {
        addExclusion("MISSING_TOKEN");
        continue;
      }
      const lineUserId = conversation.customer.lineUserId?.trim();
      if (!lineUserId) {
        addExclusion("NO_LINE_USER_ID");
        continue;
      }
      const duplicateKey = `${oa.id}:${lineUserId}`;
      if (seen.has(duplicateKey)) {
        addExclusion("DUPLICATE_RECIPIENT");
        continue;
      }
      seen.add(duplicateKey);
      try {
        this.encryption.decrypt(oa.encryptedChannelAccessToken);
      } catch {
        addExclusion("TOKEN_UNREADABLE");
        continue;
      }
      candidates.push({
        ref,
        lineUserId,
        storeName: conversation.store.name,
        storeCode: conversation.store.code,
        lineOaName: oa.name,
        encryptedChannelAccessToken: oa.encryptedChannelAccessToken,
      });
    }

    const grouped = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        storeCode: string | null;
        lineOfficialAccountId: string;
        lineOaName: string;
        encryptedChannelAccessToken: string;
        recipients: EligibleRecipient[];
      }
    >();
    for (const recipient of candidates) {
      const key = `${recipient.ref.storeId}:${recipient.ref.lineOfficialAccountId}`;
      const current = grouped.get(key);
      if (current) current.recipients.push(recipient);
      else {
        grouped.set(key, {
          storeId: recipient.ref.storeId,
          storeName: recipient.storeName,
          storeCode: recipient.storeCode,
          lineOfficialAccountId: recipient.ref.lineOfficialAccountId,
          lineOaName: recipient.lineOaName,
          encryptedChannelAccessToken: recipient.encryptedChannelAccessToken,
          recipients: [recipient],
        });
      }
    }

    const stores: ReviewStore[] = [];
    let quotaSafe = true;
    for (const group of [...grouped.values()].sort((a, b) => a.storeName.localeCompare(b.storeName))) {
      let quota: QuotaAssessment;
      try {
        const token = this.encryption.decrypt(group.encryptedChannelAccessToken);
        const [limit, usage] = await Promise.all([
          this.getLineQuota(token),
          this.getLineQuotaConsumption(token),
        ]);
        quota = assessPurchaseBroadcastQuota(limit, usage, group.recipients.length);
      } catch (error) {
        quota = {
          type: "ERROR",
          limit: null,
          usage: null,
          remaining: null,
          required: group.recipients.length,
          safe: false,
          error: errorMessage(error),
        };
      }
      if (!quota.safe) quotaSafe = false;
      stores.push({
        storeId: group.storeId,
        storeName: group.storeName,
        storeCode: group.storeCode,
        lineOfficialAccountId: group.lineOfficialAccountId,
        lineOaName: group.lineOaName,
        recipientCount: group.recipients.length,
        quota,
      });
    }

    const fingerprint = buildPurchaseBroadcastSendFingerprint({
      campaignId,
      title: campaign.title,
      messages,
      recipientRefs: candidates.map((item) => item.ref),
    });

    return {
      campaign,
      messages,
      snapshotCount: source.recipientRefs.length,
      eligible: candidates,
      exclusions: [...exclusions.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => a.reason.localeCompare(b.reason)),
      stores,
      safeToSend: candidates.length > 0 && quotaSafe,
      fingerprint,
      deliveryCount: campaign.storeDeliveries.length,
      execution: readExecutionSource(campaign.messagePayload),
    };
  }

  private async getLineQuota(accessToken: string): Promise<LineQuota> {
    const body = await this.getLineJson(
      "https://api.line.me/v2/bot/message/quota",
      accessToken,
    );
    if (body.type === "none") return { type: "none" };
    if (body.type === "limited" && typeof body.value === "number" && body.value >= 0) {
      return { type: "limited", value: body.value };
    }
    throw new ServiceUnavailableException("LINE quota response is invalid");
  }

  private async getLineQuotaConsumption(accessToken: string): Promise<number> {
    const body = await this.getLineJson(
      "https://api.line.me/v2/bot/message/quota/consumption",
      accessToken,
    );
    if (typeof body.totalUsage !== "number" || body.totalUsage < 0) {
      throw new ServiceUnavailableException("LINE quota consumption response is invalid");
    }
    return body.totalUsage;
  }

  private async getLineJson(
    url: string,
    accessToken: string,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException(`LINE quota check failed: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(`LINE quota check failed with HTTP ${response.status}`);
    }
    const value: unknown = await response.json();
    if (!isRecord(value)) {
      throw new ServiceUnavailableException("LINE quota response is invalid");
    }
    return value;
  }

  private async processSelectedCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      include: {
        storeDeliveries: {
          include: {
            store: { select: { name: true, code: true } },
            lineOfficialAccount: {
              select: {
                id: true,
                name: true,
                storeId: true,
                isActive: true,
                archivedAt: true,
                connectionStatus: true,
                encryptedChannelAccessToken: true,
              },
            },
          },
        },
      },
    });
    if (!campaign) return;
    if (
      campaign.audienceType !== MassMessageAudienceType.SELECTED_USERS ||
      campaign.status !== MassMessageCampaignStatus.DRAFT
    ) {
      return;
    }
    const execution = readExecutionSource(campaign.messagePayload);
    if (!execution || (execution.state !== "QUEUED" && execution.state !== "RUNNING")) {
      return;
    }
    const payload = jsonPayload(campaign.messagePayload);
    const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
    const messages = this.massMessages.validateMessages(rawMessages);

    if (execution.state === "QUEUED") {
      await this.prisma.massMessageCampaign.update({
        where: { id: campaignId },
        data: {
          startedAt: campaign.startedAt ?? new Date(),
          messagePayload: {
            ...payload,
            executionSource: { ...execution, state: "RUNNING" },
          } as Prisma.InputJsonValue,
        },
      });
    }

    await this.processWithConcurrency(
      campaign.storeDeliveries,
      MAX_CONCURRENT_STORES,
      async (delivery) => {
        await this.processSelectedDelivery(campaignId, execution, delivery, messages);
      },
    );

    await this.finalizeSelectedCampaign(campaignId);
  }

  private async processSelectedDelivery(
    campaignId: string,
    execution: ExecutionSource,
    delivery: {
      id: string;
      storeId: string;
      lineOfficialAccountId: string | null;
      status: MassMessageStoreDeliveryStatus;
      store: { name: string; code: string | null };
      lineOfficialAccount: {
        id: string;
        name: string;
        storeId: string;
        isActive: boolean;
        archivedAt: Date | null;
        connectionStatus: LineOaConnectionStatus;
        encryptedChannelAccessToken: string | null;
      } | null;
    },
    messages: MassMessageItem[],
  ) {
    if (
      delivery.status === MassMessageStoreDeliveryStatus.SUCCESS ||
      delivery.status === MassMessageStoreDeliveryStatus.PARTIAL ||
      delivery.status === MassMessageStoreDeliveryStatus.FAILED ||
      delivery.status === MassMessageStoreDeliveryStatus.SKIPPED
    ) {
      return;
    }

    const oa = delivery.lineOfficialAccount;
    if (
      !oa ||
      oa.id !== delivery.lineOfficialAccountId ||
      oa.storeId !== delivery.storeId ||
      !oa.isActive ||
      oa.archivedAt ||
      (oa.connectionStatus !== LineOaConnectionStatus.READY &&
        oa.connectionStatus !== LineOaConnectionStatus.CONNECTED) ||
      !oa.encryptedChannelAccessToken
    ) {
      await this.prisma.massMessageStoreDelivery.update({
        where: { id: delivery.id },
        data: {
          status: MassMessageStoreDeliveryStatus.SKIPPED,
          skipReason: "OA_NOT_READY",
          completedAt: new Date(),
        },
      });
      return;
    }

    let accessToken: string;
    try {
      accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    } catch {
      await this.prisma.massMessageStoreDelivery.update({
        where: { id: delivery.id },
        data: {
          status: MassMessageStoreDeliveryStatus.SKIPPED,
          skipReason: "MISSING_TOKEN",
          completedAt: new Date(),
        },
      });
      return;
    }

    if (delivery.status !== MassMessageStoreDeliveryStatus.RUNNING) {
      await this.prisma.massMessageStoreDelivery.update({
        where: { id: delivery.id },
        data: {
          status: MassMessageStoreDeliveryStatus.RUNNING,
          startedAt: new Date(),
        },
      });
    }

    const refs = execution.recipientRefs.filter(
      (ref) =>
        ref.storeId === delivery.storeId &&
        ref.lineOfficialAccountId === delivery.lineOfficialAccountId,
    );
    const recipientUserIds = await this.resolveExactLineUserIds(refs);
    if (recipientUserIds.length === 0) {
      await this.prisma.massMessageStoreDelivery.update({
        where: { id: delivery.id },
        data: {
          status: MassMessageStoreDeliveryStatus.SKIPPED,
          skipReason: "NO_RECIPIENTS",
          recipientCount: 0,
          completedAt: new Date(),
        },
      });
      return;
    }
    await this.prisma.massMessageStoreDelivery.update({
      where: { id: delivery.id },
      data: { recipientCount: recipientUserIds.length },
    });

    const chunks: string[][] = [];
    for (let index = 0; index < recipientUserIds.length; index += MULTICAST_BATCH_SIZE) {
      chunks.push(recipientUserIds.slice(index, index + MULTICAST_BATCH_SIZE));
    }

    let batches = await this.prisma.massMessageBatch.findMany({
      where: { storeDeliveryId: delivery.id },
      orderBy: { batchIndex: "asc" },
    });
    if (batches.length === 0) {
      try {
        await this.prisma.$transaction(
          chunks.map((chunk, batchIndex) =>
            this.prisma.massMessageBatch.create({
              data: {
                storeDeliveryId: delivery.id,
                batchIndex,
                retryKey: randomUUID(),
                recipientCount: chunk.length,
                status: MassMessageBatchStatus.PENDING,
              },
            }),
          ),
        );
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
      }
      batches = await this.prisma.massMessageBatch.findMany({
        where: { storeDeliveryId: delivery.id },
        orderBy: { batchIndex: "asc" },
      });
    }

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const batch = batches[index];
      if (!batch || batch.status === MassMessageBatchStatus.SUCCESS) continue;

      const staleThreshold = new Date(Date.now() - BATCH_CLAIM_TIMEOUT_MS);
      const claimed = await this.prisma.massMessageBatch.updateMany({
        where: {
          id: batch.id,
          OR: [
            { status: MassMessageBatchStatus.PENDING },
            { status: MassMessageBatchStatus.RUNNING, startedAt: { lt: staleThreshold } },
            { status: MassMessageBatchStatus.RUNNING, startedAt: null },
          ],
        },
        data: { status: MassMessageBatchStatus.RUNNING, startedAt: new Date() },
      });
      if (claimed.count === 0) continue;

      let attempt = 0;
      let succeeded = false;
      let lineRequestId: string | null = null;
      let acceptedRequestId: string | null = null;
      let lastError: string | null = null;
      while (attempt < MAX_RETRY_ATTEMPTS && !succeeded) {
        attempt += 1;
        try {
          const result = await this.lineMessaging.multicast({
            accessToken,
            to: chunk,
            messages,
            retryKey: batch.retryKey,
            context: {
              storeId: delivery.storeId,
              storeName: delivery.store.name,
              channelId: oa.id,
            },
          });
          lineRequestId = result.requestId;
          acceptedRequestId = result.acceptedRequestId;
          succeeded = true;
        } catch (error) {
          lastError = errorMessage(error);
          const status = errorStatus(error);
          if (status === 400 || status === 401 || status === 403) break;
          if (attempt < MAX_RETRY_ATTEMPTS) {
            const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      await this.prisma.massMessageBatch.update({
        where: { id: batch.id },
        data: succeeded
          ? {
              status: MassMessageBatchStatus.SUCCESS,
              lineRequestId,
              acceptedRequestId,
              attemptCount: attempt,
              completedAt: new Date(),
              errorMessage: null,
            }
          : {
              status: MassMessageBatchStatus.FAILED,
              attemptCount: attempt,
              completedAt: new Date(),
              errorMessage: lastError,
            },
      });
      await this.prisma.massMessageCampaign.update({
        where: { id: campaignId },
        data: {
          processedRecipientCount: { increment: chunk.length },
          ...(succeeded
            ? { successRecipientCount: { increment: chunk.length } }
            : { failedRecipientCount: { increment: chunk.length } }),
        },
      });
    }

    const currentBatches = await this.prisma.massMessageBatch.findMany({
      where: { storeDeliveryId: delivery.id },
      select: { status: true, recipientCount: true },
    });
    if (
      currentBatches.some(
        (batch) =>
          batch.status === MassMessageBatchStatus.PENDING ||
          batch.status === MassMessageBatchStatus.RUNNING,
      )
    ) {
      return;
    }
    const successCount = currentBatches
      .filter((batch) => batch.status === MassMessageBatchStatus.SUCCESS)
      .reduce((sum, batch) => sum + batch.recipientCount, 0);
    const failedCount = currentBatches
      .filter((batch) => batch.status === MassMessageBatchStatus.FAILED)
      .reduce((sum, batch) => sum + batch.recipientCount, 0);
    const finalStatus =
      successCount > 0 && failedCount === 0
        ? MassMessageStoreDeliveryStatus.SUCCESS
        : successCount > 0
          ? MassMessageStoreDeliveryStatus.PARTIAL
          : MassMessageStoreDeliveryStatus.FAILED;
    await this.prisma.massMessageStoreDelivery.update({
      where: { id: delivery.id },
      data: {
        status: finalStatus,
        processedCount: successCount + failedCount,
        successCount,
        failedCount,
        completedAt: new Date(),
      },
    });
  }

  private async resolveExactLineUserIds(refs: RecipientRef[]): Promise<string[]> {
    if (refs.length === 0) return [];
    const refByConversationId = new Map(refs.map((ref) => [ref.conversationId, ref]));
    const conversations = await this.prisma.conversation.findMany({
      where: { id: { in: refs.map((ref) => ref.conversationId) } },
      select: {
        id: true,
        customerId: true,
        storeId: true,
        lineOfficialAccountId: true,
        customer: { select: { lineUserId: true } },
      },
    });
    const recipients = new Set<string>();
    for (const conversation of conversations) {
      const ref = refByConversationId.get(conversation.id);
      if (
        !ref ||
        conversation.customerId !== ref.customerId ||
        conversation.storeId !== ref.storeId ||
        conversation.lineOfficialAccountId !== ref.lineOfficialAccountId
      ) {
        continue;
      }
      const lineUserId = conversation.customer.lineUserId?.trim();
      if (lineUserId) recipients.add(lineUserId);
    }
    return [...recipients];
  }

  private async finalizeSelectedCampaign(campaignId: string) {
    const deliveries = await this.prisma.massMessageStoreDelivery.findMany({
      where: { campaignId },
      select: { status: true },
    });
    if (
      deliveries.length === 0 ||
      deliveries.some(
        (delivery) =>
          delivery.status === MassMessageStoreDeliveryStatus.PENDING ||
          delivery.status === MassMessageStoreDeliveryStatus.RUNNING,
      )
    ) {
      return;
    }

    const hasSuccess = deliveries.some(
      (delivery) =>
        delivery.status === MassMessageStoreDeliveryStatus.SUCCESS ||
        delivery.status === MassMessageStoreDeliveryStatus.PARTIAL,
    );
    const hasFailure = deliveries.some(
      (delivery) =>
        delivery.status === MassMessageStoreDeliveryStatus.FAILED ||
        delivery.status === MassMessageStoreDeliveryStatus.PARTIAL ||
        delivery.status === MassMessageStoreDeliveryStatus.SKIPPED,
    );
    const status = hasSuccess
      ? hasFailure
        ? MassMessageCampaignStatus.PARTIAL
        : MassMessageCampaignStatus.COMPLETED
      : MassMessageCampaignStatus.FAILED;

    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      select: { messagePayload: true },
    });
    if (!campaign) return;
    const payload = jsonPayload(campaign.messagePayload);
    const execution = readExecutionSource(campaign.messagePayload);
    await this.prisma.massMessageCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        completedAt: new Date(),
        messagePayload: execution
          ? {
              ...payload,
              executionSource: {
                ...execution,
                state: "COMPLETED",
                completedAt: new Date().toISOString(),
              },
            }
          : undefined,
      },
    });

    if (execution) {
      await this.auditLog.record({
        actorUserId: execution.executedById,
        action: "PURCHASE_BROADCAST_SEND_COMPLETED",
        metadata: { campaignId, status },
      });
    }
  }

  private async processWithConcurrency<T>(
    items: T[],
    limit: number,
    handler: (item: T) => Promise<void>,
  ) {
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await handler(items[index]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, () => worker()),
    );
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Purchase broadcast sending requires ADMIN access");
    }
  }
}
