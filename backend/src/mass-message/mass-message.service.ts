import sharp from "sharp";
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import type { AuthUser } from "../auth/auth.guard";
import { MediaStorageService } from "../media/media-storage";
import { createMediaPublicUrl } from "../media/media-public-url";
import { detectImageMime } from "../conversations.service";
import { MassMessageScopeService } from "./mass-message-scope.service";
import { MassMessageProcessorService } from "./mass-message-processor.service";
import {
  MassMessageAudienceType,
  MassMessageCampaignDetail,
  MassMessageCampaignStatus,
  MassMessageCreateInput,
  MassMessageItem,
  MassMessagePreviewInput,
  MassMessagePreviewResult,
  MassMessageStoreDeliveryStatus,
  MassMessageStoreMode,
  MassMessageUploadImageResult,
  StoreDeliveryDetail,
} from "./mass-message.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

@Injectable()
export class MassMessageService {
  private readonly logger = new Logger(MassMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: MassMessageScopeService,
    private readonly processor: MassMessageProcessorService,
    private readonly media: MediaStorageService = undefined as unknown as MediaStorageService,
  ) {}

  async uploadImage(
    file: { buffer: Buffer; mimetype?: string; size?: number },
    user: AuthUser,
  ): Promise<MassMessageUploadImageResult> {
    if (!file?.buffer || !file.buffer.length) {
      throw new BadRequestException("Image file is required and cannot be empty");
    }

    if (file.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException("Image exceeds the 10 MB limit");
    }

    const mime = detectImageMime(file.buffer);
    if (!mime || !IMAGE_EXTENSIONS[mime]) {
      throw new BadRequestException("Unsupported image format. Allowed formats: JPEG, PNG.");
    }

    const declaredMime = (file.mimetype ?? "").split(";", 1)[0].trim().toLowerCase();
    if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== mime) {
      throw new BadRequestException("Image content does not match its declared MIME type");
    }

    if (!this.media) {
      throw new ServiceUnavailableException("Media storage is unavailable");
    }

    const ext = IMAGE_EXTENSIONS[mime];
    const fileId = randomUUID();
    const originalObjectKey = `line-media/outbound/mass-message/${fileId}-original.${ext}`;

    // Store original image
    await this.media.put(originalObjectKey, file.buffer, mime);

    // Generate preview image <= 1MB (JPEG or PNG) for LINE Messaging API
    let previewBuffer: Buffer;
    let previewMime: string = mime;
    let previewExt: string = ext;

    try {
      if (mime === "image/jpeg") {
        previewBuffer = await sharp(file.buffer)
          .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer();

        if (previewBuffer.length > 1024 * 1024) {
          previewBuffer = await sharp(file.buffer)
            .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 60 })
            .toBuffer();
        }
      } else {
        // PNG
        previewBuffer = await sharp(file.buffer)
          .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
          .png({ compressionLevel: 8 })
          .toBuffer();

        if (previewBuffer.length > 1024 * 1024) {
          previewBuffer = await sharp(file.buffer)
            .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          previewMime = "image/jpeg";
          previewExt = "jpg";
        }
      }
    } catch (err) {
      this.logger.error("Failed to generate preview image with sharp", err);
      if (file.buffer.length <= 1024 * 1024) {
        previewBuffer = file.buffer;
      } else {
        throw new BadRequestException("Failed to generate valid preview image for LINE");
      }
    }

    if (previewBuffer.length > 1024 * 1024) {
      throw new BadRequestException("Preview image exceeds 1 MB limit for LINE Messaging API");
    }

    const previewObjectKey = `line-media/outbound/mass-message/${fileId}-preview.${previewExt}`;
    await this.media.put(previewObjectKey, previewBuffer, previewMime);

    const originalContentUrl = createMediaPublicUrl(originalObjectKey);
    const previewImageUrl = createMediaPublicUrl(previewObjectKey);

    return {
      url: originalContentUrl,
      previewUrl: previewImageUrl,
      originalObjectKey,
      previewObjectKey,
      mimeType: mime,
      fileSize: file.buffer.length,
      previewSize: previewBuffer.length,
    };
  }

  validateMessages(messages: unknown[]): MassMessageItem[] {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestException("messages must be a non-empty array of message objects");
    }

    if (messages.length > 2) {
      throw new BadRequestException("Mass Message allows at most 2 message objects (1 text and 1 image)");
    }

    let textCount = 0;
    let imageCount = 0;
    const sanitized: MassMessageItem[] = [];

    for (const raw of messages) {
      if (!raw || typeof raw !== "object") {
        throw new BadRequestException("Invalid message payload object");
      }

      const item = raw as Record<string, unknown>;
      if (item.type === "text") {
        textCount++;
        if (typeof item.text !== "string" || !item.text.trim()) {
          throw new BadRequestException("Text message content cannot be empty");
        }
        if (item.text.length > 5000) {
          throw new BadRequestException("Text message exceeds 5,000 character limit");
        }
        sanitized.push({
          type: "text",
          text: item.text.trim(),
        });
      } else if (item.type === "image") {
        imageCount++;
        if (
          typeof item.originalContentUrl !== "string" ||
          !item.originalContentUrl.trim() ||
          !item.originalContentUrl.startsWith("https://")
        ) {
          throw new BadRequestException("Image originalContentUrl must be a valid HTTPS URL");
        }
        if (
          typeof item.previewImageUrl !== "string" ||
          !item.previewImageUrl.trim() ||
          !item.previewImageUrl.startsWith("https://")
        ) {
          throw new BadRequestException("Image previewImageUrl must be a valid HTTPS URL");
        }
        if (item.originalContentUrl.length > 2000 || item.previewImageUrl.length > 2000) {
          throw new BadRequestException("Image URL exceeds 2,000 character limit");
        }
        sanitized.push({
          type: "image",
          originalContentUrl: item.originalContentUrl.trim(),
          previewImageUrl: item.previewImageUrl.trim(),
          ...(typeof item.originalObjectKey === "string" ? { originalObjectKey: item.originalObjectKey.trim() } : {}),
          ...(typeof item.previewObjectKey === "string" ? { previewObjectKey: item.previewObjectKey.trim() } : {}),
        });
      } else {
        throw new BadRequestException(`Unsupported message type: ${String(item.type)}`);
      }
    }

    if (textCount > 1) {
      throw new BadRequestException("Mass Message allows at most 1 text message");
    }

    if (imageCount > 1) {
      throw new BadRequestException("Mass Message allows at most 1 image message");
    }

    if (textCount === 0 && imageCount === 0) {
      throw new BadRequestException("Campaign must contain at least one sendable message (text or image)");
    }

    return sanitized;
  }

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
        masterStoreId: s.masterStoreId ?? null,
        externalStoreId: s.externalStoreId ?? null,
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

    const validatedMessages = this.validateMessages(input.messages);

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
            messagePayload: { messages: validatedMessages } as unknown as Prisma.InputJsonValue,
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
      store: { name: string; code: string | null; storeMaster?: { externalStoreId: string | null } | null };
      lineOfficialAccount: { name: string } | null;
    }>;
  }): MassMessageCampaignDetail {
    const storeDeliveries: StoreDeliveryDetail[] = (campaign.storeDeliveries ?? []).map(
      (d) => ({
        id: d.id,
        storeId: d.storeId,
        masterStoreId: d.store.storeMaster?.externalStoreId ?? null,
        externalStoreId: d.store.storeMaster?.externalStoreId ?? null,
        storeName: d.store.name,
        storeCode: d.store.code,
        lineOfficialAccountId: d.lineOfficialAccountId,
        lineOaName: d.lineOfficialAccount?.name ?? null,
        status: d.status,
        recipientCount: d.recipientCount,
        processedCount: d.processedCount,
        successCount: d.successCount,
        acceptedCount: d.successCount,
        failedCount: d.failedCount,
        failedRequestCount: d.failedCount,
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
      acceptedRecipientCount: campaign.successRecipientCount,
      failedRecipientCount: campaign.failedRecipientCount,
      failedRequestRecipientCount: campaign.failedRecipientCount,
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
      acceptedRecipientCount: campaign.successRecipientCount,
      failedRecipientCount: campaign.failedRecipientCount,
      failedRequestRecipientCount: campaign.failedRecipientCount,
      messagePayload: campaign.messagePayload,
      errorMessage: campaign.errorMessage,
      startedAt: campaign.startedAt ? campaign.startedAt.toISOString() : null,
      completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }
}
