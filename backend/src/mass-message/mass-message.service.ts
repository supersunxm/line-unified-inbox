import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { AuthUser } from "../auth/auth.guard";
import { MassMessageScopeService } from "./mass-message-scope.service";
import { MassMessageProcessorService } from "./mass-message-processor.service";
import {
  MassMessageAudienceType,
  MassMessageCampaignDetail,
  MassMessageCampaignStatus,
  MassMessageCreateInput,
  MassMessagePreviewInput,
  MassMessagePreviewResult,
  MassMessageStoreDeliveryStatus,
  MassMessageStoreMode,
  StoreDeliveryDetail,
} from "./mass-message.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MassMessageService {
  private readonly logger = new Logger(MassMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: MassMessageScopeService,
    private readonly processor: MassMessageProcessorService,
  ) {}

  async preview(
    input: MassMessagePreviewInput,
    user: AuthUser,
  ): Promise<MassMessagePreviewResult> {
    const audienceType =
      input.audienceType ?? MassMessageAudienceType.ALL_KNOWN;
    const scopes = await this.scopeService.resolveStoreScope(
      input.storeSelection,
      audienceType,
      user,
    );

    let eligibleStoreCount = 0;
    let skippedStoreCount = 0;
    let estimatedRecipientCount = 0;

    const stores = scopes.map((s) => {
      if (s.isEligible) {
        eligibleStoreCount++;
        estimatedRecipientCount += s.recipientUserIds.length;
      } else {
        skippedStoreCount++;
      }

      return {
        storeId: s.storeId,
        storeName: s.storeName,
        storeCode: s.storeCode,
        lineOfficialAccountId: s.lineOfficialAccountId,
        lineOaName: s.lineOaName,
        recipientCount: s.recipientUserIds.length,
        status: s.isEligible ? ("READY" as const) : ("SKIPPED" as const),
        skipReason: s.skipReason,
      };
    });

    return {
      storeCount: scopes.length,
      eligibleStoreCount,
      skippedStoreCount,
      estimatedRecipientCount,
      stores,
    };
  }

  async createAndSend(
    input: MassMessageCreateInput,
    user: AuthUser,
  ): Promise<MassMessageCampaignDetail & { duplicate: boolean }> {
    if (!input.campaignRequestId || !UUID_REGEX.test(input.campaignRequestId)) {
      throw new BadRequestException("campaignRequestId must be a valid UUID");
    }

    if (!input.messages || !Array.isArray(input.messages) || input.messages.length === 0) {
      throw new BadRequestException("messages must be a non-empty array of message objects");
    }

    if (input.messages.length > 5) {
      throw new BadRequestException("LINE allows at most 5 message objects per multicast request");
    }

    // Check existing campaign for idempotency
    const existing = await this.prisma.massMessageCampaign.findUnique({
      where: { campaignRequestId: input.campaignRequestId },
      include: {
        createdBy: { select: { displayName: true } },
        storeDeliveries: {
          include: {
            store: { select: { name: true, code: true } },
            lineOfficialAccount: { select: { name: true } },
          },
        },
      },
    });

    if (existing) {
      return {
        ...this.formatCampaignDetail(existing),
        duplicate: true,
      };
    }

    const audienceType =
      input.audienceType ?? MassMessageAudienceType.ALL_KNOWN;
    const scopes = await this.scopeService.resolveStoreScope(
      input.storeSelection,
      audienceType,
      user,
    );

    const eligibleStores = scopes.filter((s) => s.isEligible);
    const skippedStores = scopes.filter((s) => !s.isEligible);
    const estimatedRecipientCount = eligibleStores.reduce(
      (sum, s) => sum + s.recipientUserIds.length,
      0,
    );

    try {
      const campaign = await this.prisma.$transaction(async (tx) => {
        const created = await tx.massMessageCampaign.create({
          data: {
            campaignRequestId: input.campaignRequestId,
            title: input.title?.trim() || null,
            audienceType,
            storeMode: input.storeSelection.mode,
            selectedStoreIds: input.storeSelection.storeIds ?? [],
            messagePayload: { messages: input.messages } as unknown as Prisma.InputJsonValue,
            status: MassMessageCampaignStatus.PENDING,
            createdById: user.id,
            storeCount: scopes.length,
            eligibleStoreCount: eligibleStores.length,
            skippedStoreCount: skippedStores.length,
            estimatedRecipientCount,
          },
        });

        for (const scope of scopes) {
          await tx.massMessageStoreDelivery.create({
            data: {
              campaignId: created.id,
              storeId: scope.storeId,
              lineOfficialAccountId: scope.lineOfficialAccountId,
              status: scope.isEligible
                ? MassMessageStoreDeliveryStatus.PENDING
                : MassMessageStoreDeliveryStatus.SKIPPED,
              recipientCount: scope.recipientUserIds.length,
              skipReason: scope.skipReason,
            },
          });
        }

        return created;
      });

      // Dispatch async processor without blocking the HTTP request
      void this.processor.processCampaign(campaign.id).catch((err) => {
        this.logger.error(
          `Async processing failed for campaign ${campaign.id}`,
          err,
        );
      });

      return {
        ...this.formatCampaignSummary(campaign, user.displayName),
        duplicate: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raceExisting = await this.prisma.massMessageCampaign.findUnique({
          where: { campaignRequestId: input.campaignRequestId },
          include: {
            createdBy: { select: { displayName: true } },
            storeDeliveries: {
              include: {
                store: { select: { name: true, code: true } },
                lineOfficialAccount: { select: { name: true } },
              },
            },
          },
        });
        if (raceExisting) {
          return {
            ...this.formatCampaignDetail(raceExisting),
            duplicate: true,
          };
        }
      }
      throw error;
    }
  }

  async getCampaign(id: string, user: AuthUser): Promise<MassMessageCampaignDetail> {
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { displayName: true } },
        storeDeliveries: {
          include: {
            store: { select: { name: true, code: true } },
            lineOfficialAccount: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    return this.formatCampaignDetail(campaign);
  }

  async listCampaigns(
    limit = 20,
    offset = 0,
    user: AuthUser,
  ): Promise<{ items: MassMessageCampaignDetail[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.massMessageCampaign.findMany({
        take: Math.min(100, Math.max(1, limit)),
        skip: Math.max(0, offset),
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { displayName: true } },
        },
      }),
      this.prisma.massMessageCampaign.count(),
    ]);

    return {
      items: items.map((c) => this.formatCampaignSummary(c, c.createdBy?.displayName ?? null)),
      total,
    };
  }

  private formatCampaignDetail(campaign: {
    id: string;
    campaignRequestId: string;
    title: string | null;
    audienceType: MassMessageAudienceType;
    storeMode: MassMessageStoreMode;
    selectedStoreIds: string[];
    status: MassMessageCampaignStatus;
    createdById: string | null;
    createdBy?: { displayName: string } | null;
    storeCount: number;
    eligibleStoreCount: number;
    skippedStoreCount: number;
    estimatedRecipientCount: number;
    processedRecipientCount: number;
    successRecipientCount: number;
    failedRecipientCount: number;
    messagePayload: any;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    storeDeliveries?: Array<{
      id: string;
      storeId: string;
      lineOfficialAccountId: string | null;
      status: MassMessageStoreDeliveryStatus;
      recipientCount: number;
      processedCount: number;
      successCount: number;
      failedCount: number;
      skipReason: string | null;
      errorCode: string | null;
      errorMessage: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      store: { name: string; code: string | null };
      lineOfficialAccount: { name: string } | null;
    }>;
  }): MassMessageCampaignDetail {
    const storeDeliveries: StoreDeliveryDetail[] = (campaign.storeDeliveries ?? []).map(
      (d) => ({
        id: d.id,
        storeId: d.storeId,
        storeName: d.store.name,
        storeCode: d.store.code,
        lineOfficialAccountId: d.lineOfficialAccountId,
        lineOaName: d.lineOfficialAccount?.name ?? null,
        status: d.status,
        recipientCount: d.recipientCount,
        processedCount: d.processedCount,
        successCount: d.successCount,
        failedCount: d.failedCount,
        skipReason: d.skipReason,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        startedAt: d.startedAt ? d.startedAt.toISOString() : null,
        completedAt: d.completedAt ? d.completedAt.toISOString() : null,
      }),
    );

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
      messagePayload: campaign.messagePayload,
      errorMessage: campaign.errorMessage,
      startedAt: campaign.startedAt ? campaign.startedAt.toISOString() : null,
      completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      storeDeliveries,
    };
  }

  private formatCampaignSummary(
    campaign: {
      id: string;
      campaignRequestId: string;
      title: string | null;
      audienceType: MassMessageAudienceType;
      storeMode: MassMessageStoreMode;
      selectedStoreIds: string[];
      status: MassMessageCampaignStatus;
      createdById: string | null;
      storeCount: number;
      eligibleStoreCount: number;
      skippedStoreCount: number;
      estimatedRecipientCount: number;
      processedRecipientCount: number;
      successRecipientCount: number;
      failedRecipientCount: number;
      messagePayload: any;
      errorMessage: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    createdByName: string | null,
  ): MassMessageCampaignDetail {
    return {
      id: campaign.id,
      campaignRequestId: campaign.campaignRequestId,
      title: campaign.title,
      audienceType: campaign.audienceType,
      storeMode: campaign.storeMode,
      selectedStoreIds: campaign.selectedStoreIds,
      status: campaign.status,
      createdById: campaign.createdById,
      createdByName,
      storeCount: campaign.storeCount,
      eligibleStoreCount: campaign.eligibleStoreCount,
      skippedStoreCount: campaign.skippedStoreCount,
      estimatedRecipientCount: campaign.estimatedRecipientCount,
      processedRecipientCount: campaign.processedRecipientCount,
      successRecipientCount: campaign.successRecipientCount,
      failedRecipientCount: campaign.failedRecipientCount,
      messagePayload: campaign.messagePayload,
      errorMessage: campaign.errorMessage,
      startedAt: campaign.startedAt ? campaign.startedAt.toISOString() : null,
      completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}
