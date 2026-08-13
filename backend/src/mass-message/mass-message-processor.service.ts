import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
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
import {
  createMediaPublicUrl,
  extractMediaObjectKey,
} from "../media/media-public-url";

const MAX_CONCURRENT_STORES = 5;
const MULTICAST_BATCH_SIZE = 500;
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_BATCH_CLAIM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class MassMessageProcessorService implements OnModuleInit {
  private readonly logger = new Logger(MassMessageProcessorService.name);
  public batchClaimTimeoutMs = DEFAULT_BATCH_CLAIM_TIMEOUT_MS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService,
    private readonly scopeService: MassMessageScopeService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    void this.recoverUnfinishedCampaigns();
  }

  async recoverUnfinishedCampaigns(): Promise<number> {
    const unfinished = await this.prisma.massMessageCampaign.findMany({
      where: {
        status: {
          in: [
            MassMessageCampaignStatus.PENDING,
            MassMessageCampaignStatus.RUNNING,
          ],
        },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (unfinished.length > 0) {
      this.logger.log(
        `Discovered ${unfinished.length} unfinished campaigns on startup; resuming recovery...`,
      );

      // Do NOT blindly reset all RUNNING batches to PENDING on startup.
      // Live worker instances may still be actively processing fresh RUNNING batches.
      // Each batch's lease and staleness are atomically evaluated per-batch during processCampaign.
      for (const c of unfinished) {
        void this.processCampaign(c.id).catch((err) => {
          this.logger.error(`Recovery failed for campaign ${c.id}`, err);
        });
      }
    }

    return unfinished.length;
  }

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
      campaign.status !== MassMessageCampaignStatus.RUNNING &&
      campaign.status !== MassMessageCampaignStatus.DRAFT
    ) {
      this.logger.warn(
        `Campaign ${campaignId} is already in status ${campaign.status}`,
      );
      return;
    }

    if (campaign.status !== MassMessageCampaignStatus.RUNNING) {
      await this.prisma.massMessageCampaign.update({
        where: { id: campaignId },
        data: {
          status: MassMessageCampaignStatus.RUNNING,
          startedAt: campaign.startedAt ?? new Date(),
        },
      });
    }

    // Include both PENDING and RUNNING (interrupted) store deliveries
    const activeDeliveries = campaign.storeDeliveries.filter(
      (d) =>
        d.status === MassMessageStoreDeliveryStatus.PENDING ||
        d.status === MassMessageStoreDeliveryStatus.RUNNING,
    );

    const payload = campaign.messagePayload as {
      messages?: Array<Record<string, unknown>>;
    };
    const messages = payload?.messages ?? [];

    // Process store deliveries with bounded concurrency
    await this.processWithConcurrency(
      activeDeliveries,
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
      status: MassMessageStoreDeliveryStatus;
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
    // If already marked as skipped, no further action needed
    if (delivery.skipReason) {
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

    // Check for existing batches (for crash recovery)
    const existingBatches = await this.prisma.massMessageBatch.findMany({
      where: { storeDeliveryId: delivery.id },
      orderBy: { batchIndex: "asc" },
    });

    // Chunk into 500-recipient batches
    const chunks: string[][] = [];
    for (let i = 0; i < recipientUserIds.length; i += MULTICAST_BATCH_SIZE) {
      chunks.push(recipientUserIds.slice(i, i + MULTICAST_BATCH_SIZE));
    }

    let batchRecords: Array<{
      id: string;
      batchIndex: number;
      retryKey: string;
      recipientCount: number;
      status: MassMessageBatchStatus;
    }>;

    if (existingBatches.length > 0) {
      // Reuse existing batches with their established retryKey values
      batchRecords = existingBatches;
    } else {
      // Create batch records with stable UUID retryKeys
      try {
        batchRecords = await this.prisma.$transaction(
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
      } catch (err: any) {
        // If another concurrent worker created the batches in parallel, load them
        if (
          err?.code === "P2002" ||
          err?.message?.includes("Unique constraint")
        ) {
          batchRecords = await this.prisma.massMessageBatch.findMany({
            where: { storeDeliveryId: delivery.id },
            orderBy: { batchIndex: "asc" },
          });
        } else {
          throw err;
        }
      }
    }

    let storeSuccessCount = 0;
    let storeFailedCount = 0;
    let storeProcessedCount = 0;

    const preparedMessages = messages.map((m: any) => {
      if (m?.type === "image") {
        const originalKey =
          m.originalObjectKey ||
          (typeof m.originalContentUrl === "string"
            ? extractMediaObjectKey(m.originalContentUrl)
            : null);
        const previewKey =
          m.previewObjectKey ||
          (typeof m.previewImageUrl === "string"
            ? extractMediaObjectKey(m.previewImageUrl)
            : null);
        return {
          type: "image",
          originalContentUrl: originalKey
            ? createMediaPublicUrl(originalKey)
            : m.originalContentUrl,
          previewImageUrl: previewKey
            ? createMediaPublicUrl(previewKey)
            : m.previewImageUrl,
        };
      }
      return m;
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const batch = batchRecords[i];

      if (!batch) continue;

      // If batch already succeeded previously, DO NOT RE-SEND
      if (batch.status === MassMessageBatchStatus.SUCCESS) {
        storeSuccessCount += batch.recipientCount;
        storeProcessedCount += batch.recipientCount;
        continue;
      }

      // Atomic claim: only one worker can claim a PENDING batch, or reclaim a stale RUNNING batch whose lease expired
      const staleThreshold = new Date(Date.now() - this.batchClaimTimeoutMs);
      const claimed = await this.prisma.massMessageBatch.updateMany({
        where: {
          id: batch.id,
          OR: [
            { status: MassMessageBatchStatus.PENDING },
            {
              status: MassMessageBatchStatus.RUNNING,
              startedAt: { lt: staleThreshold },
            },
            {
              status: MassMessageBatchStatus.RUNNING,
              startedAt: null,
            },
          ],
        },
        data: {
          status: MassMessageBatchStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        const currentBatch = await this.prisma.massMessageBatch.findUnique({
          where: { id: batch.id },
          select: { status: true, recipientCount: true },
        });
        if (currentBatch?.status === MassMessageBatchStatus.SUCCESS) {
          storeSuccessCount += currentBatch.recipientCount;
          storeProcessedCount += currentBatch.recipientCount;
        } else if (currentBatch?.status === MassMessageBatchStatus.FAILED) {
          storeFailedCount += currentBatch.recipientCount;
          storeProcessedCount += currentBatch.recipientCount;
        }
        continue;
      }

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
            messages: preparedMessages,
            retryKey: batch.retryKey, // REUSE identical retry key across attempts & restarts!
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

      // Update campaign processed counters
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
      select: {
        status: true,
        recipientCount: true,
        processedCount: true,
        successCount: true,
        failedCount: true,
      },
    });

    const totalProcessed = deliveries.reduce(
      (sum, d) => sum + d.processedCount,
      0,
    );
    const totalSuccess = deliveries.reduce(
      (sum, d) => sum + d.successCount,
      0,
    );
    const totalFailed = deliveries.reduce(
      (sum, d) => sum + d.failedCount,
      0,
    );

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
        processedRecipientCount: totalProcessed,
        successRecipientCount: totalSuccess,
        failedRecipientCount: totalFailed,
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
    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      async () => {
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
      },
    );
    await Promise.all(workers);
  }
}
