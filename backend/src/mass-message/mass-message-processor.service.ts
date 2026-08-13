import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { MassMessageScopeService } from "./mass-message-scope.service";

const MAX_CONCURRENT_STORES = 5;
const MULTICAST_BATCH_SIZE = 500;
const MAX_RETRY_ATTEMPTS = 3;

@Injectable()
export class MassMessageProcessorService {
  private readonly logger = new Logger(MassMessageProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService,
    private readonly scopeService: MassMessageScopeService,
  ) {}

  async processCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      include: {
        storeDeliveries: {
          include: {
            store: { select: { id: true, name: true, code: true } },
            lineOfficialAccount: {
              select: {
                id: true,
                name: true,
                encryptedChannelAccessToken: true,
                isActive: true,
                archivedAt: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found`);
      return;
    }

    if (
      campaign.status !== MassMessageCampaignStatus.PENDING &&
      campaign.status !== MassMessageCampaignStatus.DRAFT
    ) {
      this.logger.warn(
        `Campaign ${campaignId} is already in status ${campaign.status}`,
      );
      return;
    }

    const startedAt = new Date();
    await this.prisma.massMessageCampaign.update({
      where: { id: campaignId },
      data: {
        status: MassMessageCampaignStatus.RUNNING,
        startedAt,
      },
    });

    const pendingDeliveries = campaign.storeDeliveries.filter(
      (d) => d.status === MassMessageStoreDeliveryStatus.PENDING,
    );

    const payload = campaign.messagePayload as {
      messages?: Array<Record<string, unknown>>;
    };
    const messages = payload?.messages ?? [];

    // Process store deliveries with bounded concurrency
    await this.processWithConcurrency(
      pendingDeliveries,
      MAX_CONCURRENT_STORES,
      async (delivery) => {
        await this.processStoreDelivery(campaign, delivery, messages);
      },
    );

    // Finalize campaign status and aggregation
    await this.finalizeCampaign(campaignId);
  }

  private async processStoreDelivery(
    campaign: {
      id: string;
      audienceType: any;
    },
    delivery: {
      id: string;
      storeId: string;
      lineOfficialAccountId: string | null;
      skipReason: string | null;
      lineOfficialAccount: {
        id: string;
        name: string;
        encryptedChannelAccessToken: string | null;
        isActive: boolean;
        archivedAt: Date | null;
      } | null;
    },
    messages: Array<Record<string, unknown>>,
  ): Promise<void> {
    // If already marked as skipped during creation, no further action needed
    if (delivery.skipReason) {
      return;
    }

    const storeStartedAt = new Date();
    await this.prisma.massMessageStoreDelivery.update({
      where: { id: delivery.id },
      data: {
        status: MassMessageStoreDeliveryStatus.RUNNING,
        startedAt: storeStartedAt,
      },
    });

    const oa = delivery.lineOfficialAccount;
    if (
      !oa ||
      !oa.isActive ||
      oa.archivedAt ||
      !oa.encryptedChannelAccessToken
    ) {
      await this.prisma.massMessageStoreDelivery.update({
        where: { id: delivery.id },
        data: {
          status: MassMessageStoreDeliveryStatus.SKIPPED,
          skipReason: !oa?.encryptedChannelAccessToken
            ? "MISSING_TOKEN"
            : "INVALID_CONNECTION",
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

    const recipientUserIds = await this.scopeService.resolveRecipientsForOa(
      oa.id,
      delivery.storeId,
      campaign.audienceType,
    );

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

    // Update recipientCount
    await this.prisma.massMessageStoreDelivery.update({
      where: { id: delivery.id },
      data: {
        recipientCount: recipientUserIds.length,
      },
    });

    // Chunk into 500-recipient batches
    const chunks: string[][] = [];
    for (let i = 0; i < recipientUserIds.length; i += MULTICAST_BATCH_SIZE) {
      chunks.push(recipientUserIds.slice(i, i + MULTICAST_BATCH_SIZE));
    }

    // Create batch records with stable UUID retryKeys
    const batchRecords = await this.prisma.$transaction(
      chunks.map((chunk, index) =>
        this.prisma.massMessageBatch.create({
          data: {
            storeDeliveryId: delivery.id,
            batchIndex: index,
            retryKey: randomUUID(),
            recipientCount: chunk.length,
            status: MassMessageBatchStatus.PENDING,
          },
        }),
      ),
    );

    let storeSuccessCount = 0;
    let storeFailedCount = 0;
    let storeProcessedCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const batch = batchRecords[i];

      const batchStartedAt = new Date();
      await this.prisma.massMessageBatch.update({
        where: { id: batch.id },
        data: {
          status: MassMessageBatchStatus.RUNNING,
          startedAt: batchStartedAt,
        },
      });

      let attempt = 0;
      let batchSuccess = false;
      let lineRequestId: string | null = null;
      let acceptedRequestId: string | null = null;
      let lastErrorMessage: string | null = null;

      while (attempt < MAX_RETRY_ATTEMPTS && !batchSuccess) {
        attempt++;
        try {
          const result = await this.lineMessaging.multicast({
            accessToken,
            to: chunk,
            messages,
            retryKey: batch.retryKey, // REUSE identical retry key across attempts!
          });

          lineRequestId = result.requestId;
          acceptedRequestId = result.acceptedRequestId;
          batchSuccess = true;
        } catch (error: any) {
          lastErrorMessage = error?.message || "LINE Multicast failed";
          const status = error?.status ?? error?.getStatus?.() ?? 500;

          // Non-retryable client errors (400 Bad Request, 401 Unauthorized, 403 Forbidden)
          if (status === 400 || status === 401 || status === 403) {
            this.logger.warn(
              `Non-retryable error on batch ${batch.id} (attempt ${attempt}): ${lastErrorMessage}`,
            );
            break;
          }

          // Retryable errors (429 Too Many Requests, 5xx Server Error, Timeout)
          if (attempt < MAX_RETRY_ATTEMPTS) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            this.logger.log(
              `Retrying batch ${batch.id} (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}) after ${backoffMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }
      }

      const batchCompletedAt = new Date();
      if (batchSuccess) {
        await this.prisma.massMessageBatch.update({
          where: { id: batch.id },
          data: {
            status: MassMessageBatchStatus.SUCCESS,
            lineRequestId,
            acceptedRequestId,
            attemptCount: attempt,
            completedAt: batchCompletedAt,
          },
        });
        storeSuccessCount += chunk.length;
      } else {
        await this.prisma.massMessageBatch.update({
          where: { id: batch.id },
          data: {
            status: MassMessageBatchStatus.FAILED,
            errorMessage: lastErrorMessage,
            attemptCount: attempt,
            completedAt: batchCompletedAt,
          },
        });
        storeFailedCount += chunk.length;
      }
      storeProcessedCount += chunk.length;

      // Increment campaign processed counters
      await this.prisma.massMessageCampaign.update({
        where: { id: campaign.id },
        data: {
          processedRecipientCount: { increment: chunk.length },
          ...(batchSuccess
            ? { successRecipientCount: { increment: chunk.length } }
            : { failedRecipientCount: { increment: chunk.length } }),
        },
      });
    }

    let deliveryFinalStatus: MassMessageStoreDeliveryStatus;
    if (storeSuccessCount > 0 && storeFailedCount === 0) {
      deliveryFinalStatus = MassMessageStoreDeliveryStatus.SUCCESS;
    } else if (storeSuccessCount > 0 && storeFailedCount > 0) {
      deliveryFinalStatus = MassMessageStoreDeliveryStatus.PARTIAL;
    } else {
      deliveryFinalStatus = MassMessageStoreDeliveryStatus.FAILED;
    }

    await this.prisma.massMessageStoreDelivery.update({
      where: { id: delivery.id },
      data: {
        status: deliveryFinalStatus,
        processedCount: storeProcessedCount,
        successCount: storeSuccessCount,
        failedCount: storeFailedCount,
        completedAt: new Date(),
      },
    });
  }

  private async finalizeCampaign(campaignId: string): Promise<void> {
    const deliveries = await this.prisma.massMessageStoreDelivery.findMany({
      where: { campaignId },
      select: { status: true },
    });

    const nonSkipped = deliveries.filter(
      (d) => d.status !== MassMessageStoreDeliveryStatus.SKIPPED,
    );

    let campaignStatus: MassMessageCampaignStatus;
    if (nonSkipped.length === 0) {
      campaignStatus = MassMessageCampaignStatus.COMPLETED;
    } else {
      const allSuccess = nonSkipped.every(
        (d) => d.status === MassMessageStoreDeliveryStatus.SUCCESS,
      );
      const allFailed = nonSkipped.every(
        (d) => d.status === MassMessageStoreDeliveryStatus.FAILED,
      );

      if (allSuccess) {
        campaignStatus = MassMessageCampaignStatus.COMPLETED;
      } else if (allFailed) {
        campaignStatus = MassMessageCampaignStatus.FAILED;
      } else {
        campaignStatus = MassMessageCampaignStatus.PARTIAL;
      }
    }

    await this.prisma.massMessageCampaign.update({
      where: { id: campaignId },
      data: {
        status: campaignStatus,
        completedAt: new Date(),
      },
    });
  }

  private async processWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        if (item) {
          try {
            await fn(item);
          } catch (err) {
            this.logger.error("Error executing task in worker pool", err);
          }
        }
      }
    });
    await Promise.all(workers);
  }
}
