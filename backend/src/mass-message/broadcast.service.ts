import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MassMessageAudienceType,
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import { BroadcastProcessorService } from "./broadcast-processor.service";
import { BroadcastScopeService } from "./broadcast-scope.service";
import {
  normalizeBroadcastAdvanced,
  resolveScheduledAt,
  validateBroadcastMessages,
  validateBroadcastTargeting,
} from "./broadcast-targeting";
import type {
  BroadcastCampaignPayload,
  BroadcastCreateInput,
  BroadcastDraftInput,
  BroadcastPreviewInput,
  BroadcastPreviewResult,
} from "./broadcast.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BROADCAST_AUDIENCES: ReadonlySet<MassMessageAudienceType> = new Set([
  MassMessageAudienceType.ALL_FRIENDS,
  MassMessageAudienceType.FRIENDSHIP_PERIOD,
]);

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: BroadcastScopeService,
    private readonly processor: BroadcastProcessorService,
  ) {}

  async preview(input: BroadcastPreviewInput, user: AuthUser): Promise<BroadcastPreviewResult> {
    const targeting = validateBroadcastTargeting(input.targeting);
    const messages =
      Array.isArray(input.messages) && input.messages.length > 0
        ? validateBroadcastMessages(input.messages)
        : [];
    const scopes = await this.scope.resolve(input.storeSelection, targeting, user, messages);
    return this.formatPreview(scopes);
  }

  async saveDraft(input: BroadcastDraftInput, user: AuthUser) {
    this.assertRequestId(input.campaignRequestId);
    const targeting = validateBroadcastTargeting(input.targeting);
    const advanced = normalizeBroadcastAdvanced(input.advanced);
    const draftScheduledAt = input.schedule?.mode === "SCHEDULED"
      ? resolveScheduledAt(input.schedule)
      : null;
    const schedule = draftScheduledAt
      ? { mode: "SCHEDULED" as const, scheduledAt: draftScheduledAt.toISOString() }
      : { mode: "NOW" as const };
    const messages = Array.isArray(input.messages) && input.messages.length > 0
      ? validateBroadcastMessages(input.messages)
      : [];
    const audienceType = this.audienceType(targeting.mode);
    const payload: BroadcastCampaignPayload = {
      messages,
      broadcast: { targeting, advanced, schedule },
    };

    const existing = await this.prisma.massMessageCampaign.findUnique({
      where: { campaignRequestId: input.campaignRequestId },
    });
    if (existing && existing.status !== MassMessageCampaignStatus.DRAFT) {
      throw new ConflictException("This broadcast has already been submitted");
    }

    const record = existing
      ? await this.prisma.massMessageCampaign.update({
          where: { id: existing.id },
          data: {
            title: input.title?.trim() || null,
            audienceType,
            storeMode: input.storeSelection.mode,
            selectedStoreIds: input.storeSelection.storeIds ?? [],
            messagePayload: payload as unknown as Prisma.InputJsonValue,
            scheduledAt: draftScheduledAt,
          },
        })
      : await this.prisma.massMessageCampaign.create({
          data: {
            campaignRequestId: input.campaignRequestId,
            title: input.title?.trim() || null,
            audienceType,
            storeMode: input.storeSelection.mode,
            selectedStoreIds: input.storeSelection.storeIds ?? [],
            messagePayload: payload as unknown as Prisma.InputJsonValue,
            status: MassMessageCampaignStatus.DRAFT,
            createdById: user.id,
            scheduledAt: draftScheduledAt,
          },
        });

    return this.formatCampaign(record);
  }

  async createAndSend(input: BroadcastCreateInput, user: AuthUser) {
    this.assertRequestId(input.campaignRequestId);
    const messages = validateBroadcastMessages(input.messages);
    const targeting = validateBroadcastTargeting(input.targeting);
    const advanced = normalizeBroadcastAdvanced(input.advanced);
    const scheduledAt = resolveScheduledAt(input.schedule);
    const schedule = scheduledAt
      ? { mode: "SCHEDULED" as const, scheduledAt: scheduledAt.toISOString() }
      : { mode: "NOW" as const };
    const audienceType = this.audienceType(targeting.mode);
    const payload: BroadcastCampaignPayload = {
      messages,
      broadcast: { targeting, advanced, schedule },
    };

    const existing = await this.prisma.massMessageCampaign.findUnique({
      where: { campaignRequestId: input.campaignRequestId },
      include: { createdBy: { select: { displayName: true } }, storeDeliveries: true },
    });
    if (existing && existing.status !== MassMessageCampaignStatus.DRAFT) {
      return { ...this.formatCampaign(existing), duplicate: true };
    }

    const scopes = await this.scope.resolve(input.storeSelection, targeting, user, messages);
    const ready = scopes.filter((item) => item.isEligible);
    const blocked = scopes.filter((item) => !item.isEligible);
    if (ready.length === 0) {
      throw new BadRequestException("No selected stores are ready for this broadcast");
    }

    const estimatedReach = ready.reduce((sum, item) => sum + (item.estimatedReach ?? 0), 0);

    const campaign = await this.prisma.$transaction(async (tx) => {
      let created;
      if (existing) {
        await tx.massMessageStoreDelivery.deleteMany({ where: { campaignId: existing.id } });
        created = await tx.massMessageCampaign.update({
          where: { id: existing.id },
          data: {
            title: input.title?.trim() || null,
            audienceType,
            storeMode: input.storeSelection.mode,
            selectedStoreIds: input.storeSelection.storeIds ?? [],
            messagePayload: payload as unknown as Prisma.InputJsonValue,
            status: MassMessageCampaignStatus.PENDING,
            storeCount: scopes.length,
            eligibleStoreCount: ready.length,
            skippedStoreCount: blocked.length,
            estimatedRecipientCount: estimatedReach,
            processedRecipientCount: 0,
            successRecipientCount: 0,
            failedRecipientCount: 0,
            errorMessage: null,
            scheduledAt,
            startedAt: null,
            completedAt: null,
          },
        });
      } else {
        created = await tx.massMessageCampaign.create({
          data: {
            campaignRequestId: input.campaignRequestId,
            title: input.title?.trim() || null,
            audienceType,
            storeMode: input.storeSelection.mode,
            selectedStoreIds: input.storeSelection.storeIds ?? [],
            messagePayload: payload as unknown as Prisma.InputJsonValue,
            status: MassMessageCampaignStatus.PENDING,
            createdById: user.id,
            storeCount: scopes.length,
            eligibleStoreCount: ready.length,
            skippedStoreCount: blocked.length,
            estimatedRecipientCount: estimatedReach,
            scheduledAt,
          },
        });
      }

      for (const item of scopes) {
        await tx.massMessageStoreDelivery.create({
          data: {
            campaignId: created.id,
            storeId: item.storeId,
            lineOfficialAccountId: item.lineOfficialAccountId,
            status: item.isEligible
              ? MassMessageStoreDeliveryStatus.PENDING
              : MassMessageStoreDeliveryStatus.SKIPPED,
            recipientCount: item.estimatedReach ?? 0,
            skipReason: item.skipReason,
            errorMessage: item.warnings.length ? item.warnings.join(",") : null,
          },
        });
      }
      return created;
    });

    if (!scheduledAt) {
      void this.processor.processCampaign(campaign.id);
    }

    return { ...this.formatCampaign(campaign), duplicate: false };
  }

  async getCampaign(id: string, user: AuthUser) {
    void user;
    const current = await this.prisma.massMessageCampaign.findUnique({
      where: { id },
      select: { status: true, audienceType: true },
    });
    if (
      current &&
      current.status === MassMessageCampaignStatus.RUNNING &&
      BROADCAST_AUDIENCES.has(current.audienceType)
    ) {
      await this.processor.reconcileCampaign(id);
    }
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { displayName: true } },
        storeDeliveries: {
          include: {
            store: {
              select: {
                name: true,
                code: true,
                storeMaster: { select: { externalStoreId: true } },
              },
            },
            lineOfficialAccount: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!campaign || !BROADCAST_AUDIENCES.has(campaign.audienceType)) {
      throw new NotFoundException("Broadcast campaign not found");
    }
    return this.formatCampaign(campaign);
  }

  async listCampaigns(limit: number, offset: number, user: AuthUser) {
    void user;
    const take = Math.min(100, Math.max(1, limit));
    const skip = Math.max(0, offset);
    const where = {
      audienceType: {
        in: [
          MassMessageAudienceType.ALL_FRIENDS,
          MassMessageAudienceType.FRIENDSHIP_PERIOD,
        ],
      },
    };
    const [items, total] = await Promise.all([
      this.prisma.massMessageCampaign.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { displayName: true } } },
      }),
      this.prisma.massMessageCampaign.count({ where }),
    ]);
    return { items: items.map((item) => this.formatCampaign(item)), total };
  }

  async retryFailed(id: string, user: AuthUser) {
    void user;
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id },
      include: { storeDeliveries: true },
    });
    if (!campaign || !BROADCAST_AUDIENCES.has(campaign.audienceType)) {
      throw new NotFoundException("Broadcast campaign not found");
    }

    const failed = campaign.storeDeliveries.filter(
      (delivery) =>
        delivery.status === MassMessageStoreDeliveryStatus.FAILED ||
        delivery.status === MassMessageStoreDeliveryStatus.PARTIAL,
    );
    if (failed.length === 0) {
      throw new BadRequestException("There are no failed stores to retry");
    }

    await this.prisma.$transaction(async (tx) => {
      for (const delivery of failed) {
        const batch = await tx.massMessageBatch.findUnique({
          where: { storeDeliveryId_batchIndex: { storeDeliveryId: delivery.id, batchIndex: 0 } },
        });
        if (batch) {
          await tx.massMessageBatch.update({
            where: { id: batch.id },
            data: {
              status: MassMessageBatchStatus.PENDING,
              retryKey: randomUUID(),
              lineRequestId: null,
              acceptedRequestId: null,
              attemptCount: 0,
              errorMessage: null,
              startedAt: null,
              completedAt: null,
            },
          });
        }
        await tx.massMessageStoreDelivery.update({
          where: { id: delivery.id },
          data: {
            status: MassMessageStoreDeliveryStatus.PENDING,
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
            errorCode: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
          },
        });
      }
      await tx.massMessageCampaign.update({
        where: { id },
        data: {
          status: MassMessageCampaignStatus.PENDING,
          completedAt: null,
          errorMessage: null,
        },
      });
    });

    void this.processor.processCampaign(id);
    return this.getCampaign(id, user);
  }

  private formatPreview(scopes: Awaited<ReturnType<BroadcastScopeService["resolve"]>>): BroadcastPreviewResult {
    const ready = scopes.filter((item) => item.isEligible);
    return {
      storeCount: scopes.length,
      readyStoreCount: ready.length,
      blockedStoreCount: scopes.length - ready.length,
      warningStoreCount: scopes.filter((item) => item.warnings.length > 0).length,
      estimatedReach: ready.reduce((sum, item) => sum + (item.estimatedReach ?? 0), 0),
      stores: scopes.map(({ encryptedChannelAccessToken: _secret, ...item }) => ({
        ...item,
        status: item.isEligible ? ("READY" as const) : ("BLOCKED" as const),
      })),
    };
  }

  private formatCampaign(campaign: any) {
    const payload = (campaign.messagePayload ?? {}) as BroadcastCampaignPayload;
    const deliveries = Array.isArray(campaign.storeDeliveries)
      ? campaign.storeDeliveries.map((delivery: any) => ({
          id: delivery.id,
          storeId: delivery.storeId,
          masterStoreId: delivery.store?.storeMaster?.externalStoreId ?? null,
          externalStoreId: delivery.store?.storeMaster?.externalStoreId ?? null,
          storeName: delivery.store?.name ?? delivery.storeId,
          storeCode: delivery.store?.code ?? null,
          lineOfficialAccountId: delivery.lineOfficialAccountId,
          lineOaName: delivery.lineOfficialAccount?.name ?? null,
          status: delivery.status,
          recipientCount: delivery.recipientCount,
          processedCount: delivery.processedCount,
          successCount: delivery.successCount,
          failedCount: delivery.failedCount,
          skipReason: delivery.skipReason,
          errorCode: delivery.errorCode,
          errorMessage: delivery.errorMessage,
          startedAt: delivery.startedAt?.toISOString?.() ?? null,
          completedAt: delivery.completedAt?.toISOString?.() ?? null,
        }))
      : undefined;

    return {
      id: campaign.id,
      campaignRequestId: campaign.campaignRequestId,
      title: campaign.title,
      audienceType: campaign.audienceType,
      storeMode: campaign.storeMode,
      selectedStoreIds: campaign.selectedStoreIds,
      status: campaign.status,
      createdById: campaign.createdById,
      createdByName: campaign.createdBy?.displayName ?? null,
      storeCount: campaign.storeCount,
      eligibleStoreCount: campaign.eligibleStoreCount,
      skippedStoreCount: campaign.skippedStoreCount,
      estimatedRecipientCount: campaign.estimatedRecipientCount,
      processedRecipientCount: campaign.processedRecipientCount,
      successRecipientCount: campaign.successRecipientCount,
      failedRecipientCount: campaign.failedRecipientCount,
      targeting: payload.broadcast?.targeting ?? null,
      advanced: payload.broadcast?.advanced ?? null,
      schedule: payload.broadcast?.schedule ?? null,
      messages: payload.messages ?? [],
      scheduledAt: campaign.scheduledAt?.toISOString?.() ?? null,
      errorMessage: campaign.errorMessage ?? null,
      startedAt: campaign.startedAt?.toISOString?.() ?? null,
      completedAt: campaign.completedAt?.toISOString?.() ?? null,
      createdAt: campaign.createdAt?.toISOString?.() ?? campaign.createdAt,
      updatedAt: campaign.updatedAt?.toISOString?.() ?? campaign.updatedAt,
      storeDeliveries: deliveries,
    };
  }

  private audienceType(mode: "ALL_FRIENDS" | "FRIENDSHIP_PERIOD") {
    return mode === "ALL_FRIENDS"
      ? MassMessageAudienceType.ALL_FRIENDS
      : MassMessageAudienceType.FRIENDSHIP_PERIOD;
  }

  private assertRequestId(value: string) {
    if (!value || !UUID_REGEX.test(value)) {
      throw new BadRequestException("campaignRequestId must be a valid UUID");
    }
  }
}
