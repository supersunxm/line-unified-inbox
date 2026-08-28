import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
  UpdatePurchaseBroadcastDraftDto,
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

type DraftMessage =
  | { type: "text"; text: string }
  | {
      type: "image";
      originalContentUrl: string;
      previewImageUrl: string;
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

export type PurchaseBroadcastComposerResult = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  status: "DRAFT";
  audienceType: "SELECTED_USERS";
  messages: DraftMessage[];
  audience: {
    recipientCount: number;
    storeCount: number;
    lineOaCount: number;
    filters: PurchaseAudienceSource["filters"];
    statuses: PurchaseAudienceStatus[];
    messageabilityDefinition: string;
    stores: Array<{
      storeId: string;
      externalStoreId: string | null;
      storeName: string;
      storeCode: string | null;
      lineOfficialAccountId: string;
      lineOaName: string;
      recipientCount: number;
    }>;
  };
  createdAt: string;
  updatedAt: string;
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
  if (value === PurchaseAudienceStatus.ONLINE) {
    return PurchaseAudienceStatus.ONLINE;
  }
  return PurchaseAudienceStatus.NOT_SPECIFIED;
}

function isPurchaseAudienceStatus(value: unknown): value is PurchaseAudienceStatus {
  return (
    value === PurchaseAudienceStatus.PURCHASED ||
    value === PurchaseAudienceStatus.INTERESTED ||
    value === PurchaseAudienceStatus.ONLINE ||
    value === PurchaseAudienceStatus.NOT_SPECIFIED
  );
}

function readAudienceSource(payload: unknown): PurchaseAudienceSource | null {
  if (!isRecord(payload) || !isRecord(payload.audienceSource)) return null;
  const source = payload.audienceSource;
  if (
    source.type !== "PURCHASE_INTELLIGENCE" ||
    source.version !== 1 ||
    source.onlyMessageable !== true ||
    typeof source.messageabilityDefinition !== "string" ||
    !isRecord(source.filters) ||
    !Array.isArray(source.statuses) ||
    !Array.isArray(source.recipientRefs)
  ) {
    return null;
  }

  const rawStatuses: unknown[] = source.statuses;
  const statuses: PurchaseAudienceStatus[] = [];
  for (const status of rawStatuses) {
    if (!isPurchaseAudienceStatus(status)) return null;
    statuses.push(status);
  }

  const nullableString = (value: unknown): string | null | undefined => {
    if (value === null) return null;
    if (typeof value === "string") return value;
    return undefined;
  };
  const from = nullableString(source.filters.from);
  const to = nullableString(source.filters.to);
  const storeId = nullableString(source.filters.storeId);
  if (from === undefined || to === undefined || storeId === undefined) return null;

  const rawRecipientRefs: unknown[] = source.recipientRefs;
  const recipientRefs: AudienceRecipientRef[] = [];
  for (const item of rawRecipientRefs) {
    if (
      !isRecord(item) ||
      typeof item.customerId !== "string" ||
      typeof item.conversationId !== "string" ||
      typeof item.storeId !== "string" ||
      typeof item.lineOfficialAccountId !== "string"
    ) {
      return null;
    }
    recipientRefs.push({
      customerId: item.customerId,
      conversationId: item.conversationId,
      storeId: item.storeId,
      lineOfficialAccountId: item.lineOfficialAccountId,
    });
  }

  return {
    type: "PURCHASE_INTELLIGENCE",
    version: 1,
    filters: { from, to, storeId },
    statuses,
    onlyMessageable: true,
    messageabilityDefinition: source.messageabilityDefinition,
    recipientRefs,
  };
}

function readRecipientRefs(payload: unknown): AudienceRecipientRef[] | null {
  return readAudienceSource(payload)?.recipientRefs ?? null;
}

function sanitizeDraftMessages(messages: unknown[]): DraftMessage[] {
  if (!Array.isArray(messages)) {
    throw new BadRequestException("messages must be an array");
  }
  if (messages.length > 2) {
    throw new BadRequestException("Draft allows at most 2 messages (1 text and 1 image)");
  }

  let textCount = 0;
  let imageCount = 0;
  const sanitized: DraftMessage[] = [];

  for (const raw of messages) {
    if (!isRecord(raw)) {
      throw new BadRequestException("Invalid draft message payload");
    }
    if (raw.type === "text") {
      textCount += 1;
      if (typeof raw.text !== "string" || !raw.text.trim()) {
        throw new BadRequestException("Text message cannot be empty");
      }
      if (raw.text.length > 5000) {
        throw new BadRequestException("Text message exceeds 5,000 character limit");
      }
      sanitized.push({ type: "text", text: raw.text.trim() });
      continue;
    }
    if (raw.type === "image") {
      imageCount += 1;
      if (
        typeof raw.originalContentUrl !== "string" ||
        !raw.originalContentUrl.startsWith("https://") ||
        typeof raw.previewImageUrl !== "string" ||
        !raw.previewImageUrl.startsWith("https://")
      ) {
        throw new BadRequestException("Image draft requires HTTPS original and preview URLs");
      }
      if (raw.originalContentUrl.length > 2000 || raw.previewImageUrl.length > 2000) {
        throw new BadRequestException("Image URL exceeds 2,000 character limit");
      }
      sanitized.push({
        type: "image",
        originalContentUrl: raw.originalContentUrl,
        previewImageUrl: raw.previewImageUrl,
      });
      continue;
    }
    throw new BadRequestException(`Unsupported draft message type: ${String(raw.type)}`);
  }

  if (textCount > 1 || imageCount > 1) {
    throw new BadRequestException("Draft allows at most 1 text message and 1 image message");
  }

  return sanitized;
}

function readDraftMessages(payload: unknown): DraftMessage[] {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return [];
  return sanitizeDraftMessages(payload.messages);
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
    this.assertAdmin(user);
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

  async getComposer(
    campaignId: string,
    user: AuthUser,
  ): Promise<PurchaseBroadcastComposerResult> {
    this.assertAdmin(user);
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        campaignRequestId: true,
        title: true,
        status: true,
        audienceType: true,
        messagePayload: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!campaign) throw new NotFoundException("Broadcast audience draft not found");

    const source = this.assertComposableDraft(campaign);
    const messages = readDraftMessages(campaign.messagePayload);
    const refs = source.recipientRefs;
    const storeIds = [...new Set(refs.map((item) => item.storeId))];
    const lineOaIds = [...new Set(refs.map((item) => item.lineOfficialAccountId))];

    const [stores, lineOas] = await Promise.all([
      this.prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: {
          id: true,
          name: true,
          code: true,
          storeMaster: { select: { externalStoreId: true } },
        },
      }),
      this.prisma.lineOfficialAccount.findMany({
        where: { id: { in: lineOaIds } },
        select: { id: true, name: true },
      }),
    ]);

    const storesById = new Map(stores.map((store) => [store.id, store]));
    const lineOasById = new Map(lineOas.map((oa) => [oa.id, oa]));
    const grouped = new Map<string, { storeId: string; lineOfficialAccountId: string; recipientCount: number }>();
    for (const ref of refs) {
      const key = `${ref.storeId}:${ref.lineOfficialAccountId}`;
      const current = grouped.get(key);
      if (current) current.recipientCount += 1;
      else grouped.set(key, { storeId: ref.storeId, lineOfficialAccountId: ref.lineOfficialAccountId, recipientCount: 1 });
    }

    const storeBreakdown = [...grouped.values()]
      .map((item) => {
        const store = storesById.get(item.storeId);
        const oa = lineOasById.get(item.lineOfficialAccountId);
        return {
          storeId: item.storeId,
          externalStoreId: store?.storeMaster?.externalStoreId ?? null,
          storeName: store?.name ?? "Unknown store",
          storeCode: store?.code ?? null,
          lineOfficialAccountId: item.lineOfficialAccountId,
          lineOaName: oa?.name ?? "Unknown LINE OA",
          recipientCount: item.recipientCount,
        };
      })
      .sort((a, b) => a.storeName.localeCompare(b.storeName) || a.lineOaName.localeCompare(b.lineOaName));

    return {
      id: campaign.id,
      campaignRequestId: campaign.campaignRequestId,
      title: campaign.title,
      status: "DRAFT",
      audienceType: "SELECTED_USERS",
      messages,
      audience: {
        recipientCount: refs.length,
        storeCount: new Set(refs.map((item) => item.storeId)).size,
        lineOaCount: new Set(refs.map((item) => item.lineOfficialAccountId)).size,
        filters: source.filters,
        statuses: source.statuses,
        messageabilityDefinition: source.messageabilityDefinition,
        stores: storeBreakdown,
      },
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }

  async updateComposer(
    campaignId: string,
    input: UpdatePurchaseBroadcastDraftDto,
    user: AuthUser,
  ): Promise<PurchaseBroadcastComposerResult> {
    this.assertAdmin(user);
    const campaign = await this.prisma.massMessageCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        audienceType: true,
        messagePayload: true,
      },
    });
    if (!campaign) throw new NotFoundException("Broadcast audience draft not found");

    const source = this.assertComposableDraft(campaign);
    const deliveryCount = await this.prisma.massMessageStoreDelivery.count({
      where: { campaignId },
    });
    if (deliveryCount > 0) {
      throw new ConflictException("Draft already has delivery records and cannot be edited");
    }

    const messages = sanitizeDraftMessages(input.messages);
    await this.prisma.massMessageCampaign.update({
      where: { id: campaignId },
      data: {
        title: input.title?.trim() || null,
        messagePayload: {
          messages,
          audienceSource: source,
        },
      },
    });

    return this.getComposer(campaignId, user);
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Broadcast audience drafts require ADMIN access");
    }
  }

  private assertComposableDraft(campaign: {
    status: MassMessageCampaignStatus;
    audienceType: MassMessageAudienceType;
    messagePayload: Prisma.JsonValue;
  }): PurchaseAudienceSource {
    const source = readAudienceSource(campaign.messagePayload);
    if (
      campaign.status !== MassMessageCampaignStatus.DRAFT ||
      campaign.audienceType !== MassMessageAudienceType.SELECTED_USERS ||
      source === null
    ) {
      throw new ConflictException(
        "Campaign is not an editable Purchase Intelligence audience draft",
      );
    }
    return source;
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
