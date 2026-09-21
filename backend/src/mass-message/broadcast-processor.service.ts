import { Injectable, Logger } from "@nestjs/common";
import {
  MassMessageAudienceType,
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineMessagingService } from "../line-messaging/line-messaging.service";
import { PrismaService } from "../prisma.service";
import {
  buildFriendshipDemographicFilter,
  validateBroadcastMessages,
} from "./broadcast-targeting";
import {
  buildBroadcastStoreVariableContext,
  resolveBroadcastMessagesForStore,
} from "./broadcast-store-variables";
import type { BroadcastCampaignPayload } from "./broadcast.types";

const BROADCAST_AUDIENCES: ReadonlySet<MassMessageAudienceType> = new Set([
  MassMessageAudienceType.ALL_FRIENDS,
  MassMessageAudienceType.FRIENDSHIP_PERIOD,
]);

@Injectable()
export class BroadcastProcessorService {
  private readonly logger = new Logger(BroadcastProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineMessaging: LineMessagingService,
  ) {}

  async processCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      include: {
        storeDeliveries: {
          include: {
            lineOfficialAccount: true,
            store: { include: { storeMaster: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!campaign || !BROADCAST_AUDIENCES.has(campaign.audienceType)) return;
    if (campaign.status === MassMessageCampaignStatus.DRAFT || campaign.status === MassMessageCampaignStatus.CANCELLED) return;
    if (campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()) return;

    await this.prisma.massMessageCampaign.update({
      where: { id: campaign.id },
      data: {
        status: MassMessageCampaignStatus.RUNNING,
        startedAt: campaign.startedAt ?? new Date(),
      },
    });

    const pending = campaign.storeDeliveries.filter(
      (delivery) => delivery.status === MassMessageStoreDeliveryStatus.PENDING,
    );

    await this.runPool(pending, 5, async (delivery) => {
      if (!delivery.lineOfficialAccount?.encryptedChannelAccessToken) {
        await this.failDelivery(delivery.id, "MISSING_TOKEN", "LINE channel access token is unavailable");
        return;
      }

      let accessToken: string;
      try {
        accessToken = this.encryption.decrypt(delivery.lineOfficialAccount.encryptedChannelAccessToken);
      } catch {
        await this.failDelivery(delivery.id, "MISSING_TOKEN", "LINE channel access token cannot be decrypted");
        return;
      }

      const payload = campaign.messagePayload as unknown as BroadcastCampaignPayload;
      const existingBatch = await this.prisma.massMessageBatch.findUnique({
        where: { storeDeliveryId_batchIndex: { storeDeliveryId: delivery.id, batchIndex: 0 } },
      });

      if (existingBatch?.status === MassMessageBatchStatus.SUCCESS) {
        if (campaign.audienceType === MassMessageAudienceType.ALL_FRIENDS) {
          await this.markBroadcastAccepted(delivery.id, delivery.recipientCount);
        }
        return;
      }

      const variableContext = buildBroadcastStoreVariableContext({
        store: delivery.store,
        lineOfficialAccount: delivery.lineOfficialAccount,
      });
      const rendered = resolveBroadcastMessagesForStore(payload.messages, variableContext);
      if (!rendered.ok) {
        await this.failDelivery(
          delivery.id,
          "MISSING_TEMPLATE_VARIABLES",
          "Missing store variables: " + rendered.missingVariables.join(", "),
        );
        return;
      }

      let messages: ReturnType<typeof validateBroadcastMessages>;
      try {
        messages = validateBroadcastMessages(rendered.messages);
      } catch (error) {
        await this.failDelivery(
          delivery.id,
          "INVALID_RESOLVED_MESSAGE",
          error instanceof Error ? error.message : "Resolved broadcast message is invalid",
        );
        return;
      }

      const batch =
        existingBatch ??
        (await this.prisma.massMessageBatch.create({
          data: {
            storeDeliveryId: delivery.id,
            batchIndex: 0,
            retryKey: randomUUID(),
            recipientCount: delivery.recipientCount,
            status: MassMessageBatchStatus.PENDING,
          },
        }));

      const claimed = await this.prisma.massMessageBatch.updateMany({
        where: {
          id: batch.id,
          status: { in: [MassMessageBatchStatus.PENDING, MassMessageBatchStatus.FAILED] },
        },
        data: { status: MassMessageBatchStatus.RUNNING, startedAt: new Date() },
      });
      if (claimed.count === 0) return;

      await this.prisma.massMessageStoreDelivery.update({
        where: { id: delivery.id },
        data: { status: MassMessageStoreDeliveryStatus.RUNNING, startedAt: delivery.startedAt ?? new Date() },
      });

      let attempt = 0;
      let lastError = "LINE broadcast failed";
      while (attempt < 3) {
        attempt += 1;
        try {
          if (campaign.audienceType === MassMessageAudienceType.ALL_FRIENDS) {
            const result = await this.lineMessaging.broadcast({
              accessToken,
              messages,
              retryKey: batch.retryKey,
            });
            await this.prisma.massMessageBatch.update({
              where: { id: batch.id },
              data: {
                status: MassMessageBatchStatus.SUCCESS,
                lineRequestId: result.requestId,
                acceptedRequestId: result.acceptedRequestId,
                attemptCount: attempt,
                completedAt: new Date(),
                errorMessage: null,
              },
            });
            await this.markBroadcastAccepted(delivery.id, delivery.recipientCount);
          } else {
            const targeting = payload.broadcast.targeting;
            if (targeting.mode !== "FRIENDSHIP_PERIOD") {
              throw new Error("Friendship period targeting payload is missing");
            }
            const limit = {
              upToRemainingQuota: true,
              forbidPartialDelivery: payload.broadcast.advanced.allowPartial === false,
              ...(payload.broadcast.advanced.maxVolume
                ? { max: payload.broadcast.advanced.maxVolume }
                : {}),
            };
            const result = await this.lineMessaging.narrowcast({
              accessToken,
              messages,
              demographic: buildFriendshipDemographicFilter(targeting.periods),
              limit,
              retryKey: batch.retryKey,
            });
            const effectiveRequestId = result.acceptedRequestId ?? result.requestId;
            await this.prisma.massMessageBatch.update({
              where: { id: batch.id },
              data: {
                status: MassMessageBatchStatus.SUCCESS,
                lineRequestId: effectiveRequestId,
                acceptedRequestId: result.acceptedRequestId,
                attemptCount: attempt,
                completedAt: new Date(),
                errorMessage: null,
              },
            });
          }
          return;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "LINE broadcast failed";
          const status =
            typeof error === "object" && error && "getStatus" in error && typeof (error as { getStatus?: unknown }).getStatus === "function"
              ? Number((error as { getStatus: () => number }).getStatus())
              : 500;
          if ([400, 401, 403].includes(status) || attempt >= 3) break;
          await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 4000)));
        }
      }

      await this.prisma.massMessageBatch.update({
        where: { id: batch.id },
        data: {
          status: MassMessageBatchStatus.FAILED,
          attemptCount: attempt,
          errorMessage: lastError,
          completedAt: new Date(),
        },
      });
      await this.failDelivery(delivery.id, "LINE_REQUEST_FAILED", lastError);
    });

    await this.reconcileCampaign(campaignId);
  }

  async reconcileCampaign(campaignId: string): Promise<void> {
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      include: {
        storeDeliveries: {
          include: {
            lineOfficialAccount: true,
            batches: { orderBy: { batchIndex: "asc" } },
          },
        },
      },
    });
    if (!campaign || !BROADCAST_AUDIENCES.has(campaign.audienceType)) return;

    if (campaign.audienceType === MassMessageAudienceType.FRIENDSHIP_PERIOD) {
      const running = campaign.storeDeliveries.filter(
        (delivery) => delivery.status === MassMessageStoreDeliveryStatus.RUNNING,
      );
      await this.runPool(running, 8, async (delivery) => {
        const batch = delivery.batches.find((item) => item.batchIndex === 0);
        if (!batch?.lineRequestId || !delivery.lineOfficialAccount?.encryptedChannelAccessToken) return;

        try {
          const accessToken = this.encryption.decrypt(delivery.lineOfficialAccount.encryptedChannelAccessToken);
          const progress = await this.lineMessaging.getNarrowcastProgress({
            accessToken,
            requestId: batch.lineRequestId,
          });

          if (progress.phase === "succeeded") {
            const successCount = progress.successCount ?? progress.targetCount ?? delivery.recipientCount;
            const failedCount = progress.failureCount ?? 0;
            const processedCount = Math.max(progress.targetCount ?? 0, successCount + failedCount);
            await this.prisma.massMessageStoreDelivery.update({
              where: { id: delivery.id },
              data: {
                status:
                  failedCount > 0
                    ? MassMessageStoreDeliveryStatus.PARTIAL
                    : MassMessageStoreDeliveryStatus.SUCCESS,
                recipientCount: progress.targetCount ?? delivery.recipientCount,
                processedCount,
                successCount,
                failedCount,
                errorMessage: failedCount > 0 ? String(failedCount) + " recipients could not receive the message" : null,
                completedAt: new Date(),
              },
            });
          } else if (progress.phase === "failed") {
            await this.prisma.massMessageStoreDelivery.update({
              where: { id: delivery.id },
              data: {
                status: MassMessageStoreDeliveryStatus.FAILED,
                errorCode: progress.errorCode !== undefined ? String(progress.errorCode) : "NARROWCAST_FAILED",
                errorMessage: progress.failedDescription ?? "LINE narrowcast failed after acceptance",
                completedAt: new Date(),
              },
            });
          }
        } catch (error) {
          this.logger.warn(
            "Unable to reconcile narrowcast delivery " + delivery.id + ": " +
              (error instanceof Error ? error.message : "unknown"),
          );
        }
      });
    }

    await this.finalizeIfTerminal(campaignId);
  }

  private async markBroadcastAccepted(deliveryId: string, estimate: number): Promise<void> {
    await this.prisma.massMessageStoreDelivery.update({
      where: { id: deliveryId },
      data: {
        status: MassMessageStoreDeliveryStatus.SUCCESS,
        processedCount: estimate,
        successCount: estimate,
        failedCount: 0,
        completedAt: new Date(),
      },
    });
  }

  private async failDelivery(deliveryId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.prisma.massMessageStoreDelivery.update({
      where: { id: deliveryId },
      data: {
        status: MassMessageStoreDeliveryStatus.FAILED,
        errorCode,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  private async finalizeIfTerminal(campaignId: string): Promise<void> {
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

    if (
      deliveries.some(
        (delivery) =>
          delivery.status === MassMessageStoreDeliveryStatus.PENDING ||
          delivery.status === MassMessageStoreDeliveryStatus.RUNNING,
      )
    ) {
      await this.prisma.massMessageCampaign.update({
        where: { id: campaignId },
        data: { status: MassMessageCampaignStatus.RUNNING },
      });
      return;
    }

    const deliverable = deliveries.filter(
      (delivery) => delivery.status !== MassMessageStoreDeliveryStatus.SKIPPED,
    );
    const totalProcessed = deliveries.reduce((sum, item) => sum + item.processedCount, 0);
    const totalSuccess = deliveries.reduce((sum, item) => sum + item.successCount, 0);
    const totalFailed = deliveries.reduce((sum, item) => sum + item.failedCount, 0);

    let status: MassMessageCampaignStatus = MassMessageCampaignStatus.COMPLETED;
    if (deliverable.length > 0) {
      const allSuccess = deliverable.every((item) => item.status === MassMessageStoreDeliveryStatus.SUCCESS);
      const allFailed = deliverable.every((item) => item.status === MassMessageStoreDeliveryStatus.FAILED);
      if (allFailed) status = MassMessageCampaignStatus.FAILED;
      else if (!allSuccess) status = MassMessageCampaignStatus.PARTIAL;
    }

    await this.prisma.massMessageCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        processedRecipientCount: totalProcessed,
        successRecipientCount: totalSuccess,
        failedRecipientCount: totalFailed,
        completedAt: new Date(),
      },
    });
  }

  private async runPool<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    let index = 0;
    const runners = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        if (item !== undefined) await worker(item);
      }
    });
    await Promise.all(runners);
  }
}
