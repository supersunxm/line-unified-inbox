import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  MassMessageAudienceType,
  MassMessageCampaignStatus,
  MassMessageStoreMode,
  Prisma,
  UserRole,
} from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import { PrismaService } from "./prisma.service";
import {
  CreatePurchaseBroadcastDraftDto,
  PurchaseAudienceStatus,
} from "./purchase-broadcast-audience.dto";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";

type AudienceRecipientRef = {
  customerId: string;
  conversationId: string;
  storeId: string;
  lineOfficialAccountId: string;
};

type PurchaseAudienceSource = {
  type: "PURCHASE_INTELLIGENCE";
  version: 1;
  filters: {
    from: string | null;
    to: string | null;
    storeId: string | null;
  };
  statuses: PurchaseAudienceStatus[];
  onlyMessageable: true;
  messageabilityDefinition: string;
  recipientRefs: AudienceRecipientRef[];
};

export type PurchaseBroadcastDraftResult = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  status: "DRAFT";
  recipientCount: number;
  storeCount: number;
  lineOaCount: number;
  createdAt: string;
  duplicate: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function audienceStatus(value: string | null): PurchaseAudienceStatus {
  if (value === PurchaseAudienceStatus.PURCHASED) {
    return PurchaseAudienceStatus.PURCHASED;
  }
  if (value === PurchaseAudienceStatus.INTERESTED) {
    return PurchaseAudienceStatus.INTERESTED;
  }
  return PurchaseAudienceStatus.NOT_SPECIFIED;
}

function readRecipientRefs(payload: unknown): AudienceRecipientRef[] | null {
  if (!isRecord(payload) || !isRecord(payload.audienceSource)) return null;
  const source = payload.audienceSource;
  if (source.type !== "PURCHASE_INTELLIGENCE" || !Array.isArray(source.recipientRefs)) {
    return null;
  }

  const refs: AudienceRecipientRef[] = [];
  for (const item of source.recipientRefs) {
    if (
      !isRecord(item) ||
      typeof item.customerId !== "string" ||
      typeof item.conversationId !== "string" ||
      typeof item.storeId !== "string" ||
      typeof item.lineOfficialAccountId !== "string"
    ) {
      return null;
    }
    refs.push({
      customerId: item.customerId,
      conversationId: item.conversationId,
      storeId: item.storeId,
      lineOfficialAccountId: item.lineOfficialAccountId,
    });
  }
  return refs;
}

@Injectable()
export class PurchaseBroadcastAudienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseAnalytics: PurchaseAnalyticsService,
  ) {}

  async createDraft(
    input: CreatePurchaseBroadcastDraftDto,
    user: AuthUser,
  ): Promise<PurchaseBroadcastDraftResult> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Broadcast audience drafts require ADMIN access");
    }
    if (input.onlyMessageable !== true) {
      throw new BadRequestException(
        "Broadcast audience drafts require Only messageable users to be enabled",
      );
    }

    const existing = await this.prisma.massMessageCampaign.findUnique({
      where: { campaignRequestId: input.campaignRequestId },
      select: {
        id: true,
        campaignRequestId: true,
        title: true,
        status: true,
        audienceType: true,
        storeCount: true,
        estimatedRecipientCount: true,
        messagePayload: true,
        createdAt: true,
      },
    });
    if (existing) return this.existingDraftResult(existing);

    const audience = await this.purchaseAnalytics.getAudience(user, input);
    const selectedStatuses = new Set(input.statuses);
    const selected = audience.audience.filter(
      (item) => item.canMessage && selectedStatuses.has(audienceStatus(item.customerStatus)),
    );

    if (selected.length === 0) {
      throw new BadRequestException(
        "No messageable customers match the selected audience filters",
      );
    }

    const recipientRefs: AudienceRecipientRef[] = selected.map((item) => ({
      customerId: item.customerId,
      conversationId: item.conversationId,
      storeId: item.storeId,
      lineOfficialAccountId: item.lineOaId,
    }));
    const storeIds = [...new Set(recipientRefs.map((item) => item.storeId))].sort();
    const lineOaIds = [
      ...new Set(recipientRefs.map((item) => item.lineOfficialAccountId)),
    ].sort();
    const source: PurchaseAudienceSource = {
      type: "PURCHASE_INTELLIGENCE",
      version: 1,
      filters: audience.filters,
      statuses: [...input.statuses].sort(),
      onlyMessageable: true,
      messageabilityDefinition: audience.messageabilityDefinition,
      recipientRefs,
    };

    try {
      const created = await this.prisma.massMessageCampaign.create({
        data: {
          campaignRequestId: input.campaignRequestId,
          title: input.title?.trim() || "Purchase Intelligence Audience",
          audienceType: MassMessageAudienceType.SELECTED_USERS,
          storeMode:
            storeIds.length === 1
              ? MassMessageStoreMode.SINGLE
              : MassMessageStoreMode.MULTIPLE,
          selectedStoreIds: storeIds,
          messagePayload: {
            messages: [],
            audienceSource: source,
          },
          status: MassMessageCampaignStatus.DRAFT,
          createdById: user.id,
          storeCount: storeIds.length,
          eligibleStoreCount: storeIds.length,
          skippedStoreCount: 0,
          estimatedRecipientCount: recipientRefs.length,
        },
        select: {
          id: true,
          campaignRequestId: true,
          title: true,
          status: true,
          createdAt: true,
        },
      });

      return {
        id: created.id,
        campaignRequestId: created.campaignRequestId,
        title: created.title,
        status: "DRAFT",
        recipientCount: recipientRefs.length,
        storeCount: storeIds.length,
        lineOaCount: lineOaIds.length,
        createdAt: created.createdAt.toISOString(),
        duplicate: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.prisma.massMessageCampaign.findUnique({
          where: { campaignRequestId: input.campaignRequestId },
          select: {
            id: true,
            campaignRequestId: true,
            title: true,
            status: true,
            audienceType: true,
            storeCount: true,
            estimatedRecipientCount: true,
            messagePayload: true,
            createdAt: true,
          },
        });
        if (raced) return this.existingDraftResult(raced);
      }
      throw error;
    }
  }

  private existingDraftResult(existing: {
    id: string;
    campaignRequestId: string;
    title: string | null;
    status: MassMessageCampaignStatus;
    audienceType: MassMessageAudienceType;
    storeCount: number;
    estimatedRecipientCount: number;
    messagePayload: Prisma.JsonValue;
    createdAt: Date;
  }): PurchaseBroadcastDraftResult {
    const refs = readRecipientRefs(existing.messagePayload);
    if (
      existing.status !== MassMessageCampaignStatus.DRAFT ||
      existing.audienceType !== MassMessageAudienceType.SELECTED_USERS ||
      refs === null
    ) {
      throw new ConflictException(
        "campaignRequestId is already used by another mass message campaign",
      );
    }

    return {
      id: existing.id,
      campaignRequestId: existing.campaignRequestId,
      title: existing.title,
      status: "DRAFT",
      recipientCount: existing.estimatedRecipientCount,
      storeCount: existing.storeCount,
      lineOaCount: new Set(refs.map((item) => item.lineOfficialAccountId)).size,
      createdAt: existing.createdAt.toISOString(),
      duplicate: true,
    };
  }
}
