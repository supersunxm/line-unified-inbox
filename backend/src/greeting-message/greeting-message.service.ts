import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  GreetingExecutionStatus,
  GreetingSendPolicy,
  GreetingTemplateStatus,
  LineAccountType,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaService } from "../prisma.service";
import { AuditLogService } from "../auth/audit-log.service";
import { AuthUser } from "../auth/auth.guard";
import { MediaStorageService } from "../media/media-storage";
import { createMediaPublicUrl } from "../media/media-public-url";
import {
  extractTemplateVariables,
  getStoreGoogleMapsReadiness,
  resolveTemplateVariables,
  StoreVariableContext,
  validateTemplateVariables,
} from "../store-master/template-variable-resolver";
import {
  CreateGreetingTemplateDto,
  GreetingAssignStoresDto,
  GreetingContentJson,
  GreetingMessageBlock,
  GreetingPreviewDto,
  GreetingPreviewResult,
  GreetingReadinessResponseDto,
  GreetingStoreReadinessItem,
  GreetingTemplateResponseDto,
  GreetingUploadMediaResult,
  ResolvedGreetingBlock,
  UpdateGreetingTemplateDto,
} from "./greeting-message.types";
import {
  detectImageMime,
  extractAllGreetingVariables,
  IMAGE_EXTENSIONS,
  normalizeGreetingMessages,
  validateGreetingMessages,
} from "./greeting-message.utils";

@Injectable()
export class GreetingMessageService {
  private readonly logger = new Logger(GreetingMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() private readonly media?: MediaStorageService,
  ) {}

  /**
   * Enriches normalized message blocks with fresh public signed URLs for image previews.
   */
  private enrichMessageBlocks(
    messages: GreetingMessageBlock[],
  ): GreetingMessageBlock[] {
    return messages.map((m) => {
      if (m.type === "IMAGE") {
        return {
          ...m,
          imageUrl: m.mediaObjectKey
            ? createMediaPublicUrl(m.mediaObjectKey)
            : undefined,
          previewUrl: (m.previewObjectKey || m.mediaObjectKey)
            ? createMediaPublicUrl(m.previewObjectKey || m.mediaObjectKey)
            : undefined,
        };
      }
      return m;
    });
  }

  /**
   * Serializes a GreetingTemplate into the canonical response DTO.
   */
  private serializeTemplate(
    template: any,
    assignments?: Array<{ lineOfficialAccountId: string }>,
  ): GreetingTemplateResponseDto {
    const rawMessages = normalizeGreetingMessages(template);
    const enrichedMessages = this.enrichMessageBlocks(rawMessages);
    const usedVariables = extractAllGreetingVariables(rawMessages);
    const assignedOaIds =
      assignments?.map((a) => a.lineOfficialAccountId) ??
      template.assignments?.map((a: any) => a.lineOfficialAccountId) ??
      [];

    return {
      id: template.id,
      name: template.name,
      description: template.description ?? null,
      status: template.status,
      sendPolicy: template.sendPolicy,
      contentJson: template.contentJson
        ? { version: (template.contentJson as any).version || 1, messages: enrichedMessages }
        : null,
      messages: enrichedMessages,
      version: template.version,
      usedVariables,
      assignedStoreCount: assignedOaIds.length,
      assignedOaIds,
      createdByUserId: template.createdByUserId ?? null,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      activatedAt: template.activatedAt ?? null,
      archivedAt: template.archivedAt ?? null,
    };
  }

  /**
   * Lists all Greeting Templates.
   */
  async listTemplates(params?: {
    status?: GreetingTemplateStatus;
    search?: string;
  }): Promise<GreetingTemplateResponseDto[]> {
    const where: Prisma.GreetingTemplateWhereInput = {};

    if (params?.status) {
      where.status = params.status;
    } else {
      where.status = { not: GreetingTemplateStatus.ARCHIVED };
    }

    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const templates = await this.prisma.greetingTemplate.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    return templates.map((t) => this.serializeTemplate(t));
  }

  /**
   * Retrieves a single Greeting Template by ID.
   */
  async getTemplate(id: string): Promise<GreetingTemplateResponseDto> {
    const template = await this.prisma.greetingTemplate.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Greeting template with ID '${id}' not found`);
    }

    return this.serializeTemplate(template);
  }

  /**
   * Creates a new Greeting Template.
   */
  async createTemplate(
    dto: CreateGreetingTemplateDto,
    user?: AuthUser,
  ): Promise<GreetingTemplateResponseDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException("Greeting template name is required");
    }

    let messages: GreetingMessageBlock[] = [];
    if (Array.isArray(dto.messages) && dto.messages.length > 0) {
      const validation = validateGreetingMessages(dto.messages);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join("; "));
      }
      messages = dto.messages;
    }

    const contentJson: GreetingContentJson | null =
      messages.length > 0 ? { version: 1, messages } : null;

    const template = await this.prisma.greetingTemplate.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        status: GreetingTemplateStatus.DRAFT,
        sendPolicy: dto.sendPolicy || GreetingSendPolicy.FIRST_TIME_ONLY,
        contentJson: contentJson as any,
        version: 1,
        createdByUserId: user?.id || null,
      },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (this.auditLog && user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_TEMPLATE_CREATED",
          metadata: {
            templateId: template.id,
            name: template.name,
            status: template.status,
            sendPolicy: template.sendPolicy,
          },
        })
        .catch(() => null);
    }

    return this.serializeTemplate(template);
  }

  /**
   * Updates an existing Greeting Template.
   * Increments version if content, message order, or sendPolicy changes.
   */
  async updateTemplate(
    id: string,
    dto: UpdateGreetingTemplateDto,
    user?: AuthUser,
  ): Promise<GreetingTemplateResponseDto> {
    const existing = await this.prisma.greetingTemplate.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Greeting template with ID '${id}' not found`);
    }

    if (existing.status === GreetingTemplateStatus.ARCHIVED) {
      throw new BadRequestException("Cannot update an archived greeting template");
    }

    const updateData: Prisma.GreetingTemplateUpdateInput = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name?.trim();
      if (!trimmedName) {
        throw new BadRequestException("Greeting template name cannot be empty");
      }
      updateData.name = trimmedName;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description?.trim() || null;
    }

    let shouldIncrementVersion = false;

    if (dto.sendPolicy !== undefined && dto.sendPolicy !== existing.sendPolicy) {
      updateData.sendPolicy = dto.sendPolicy;
      shouldIncrementVersion = true;
    }

    if (dto.messages !== undefined) {
      const validation = validateGreetingMessages(dto.messages);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join("; "));
      }

      const newContentJson: GreetingContentJson = {
        version: 1,
        messages: dto.messages,
      };

      const oldMessages = normalizeGreetingMessages(existing);
      const isContentChanged =
        JSON.stringify(oldMessages) !== JSON.stringify(dto.messages);

      if (isContentChanged) {
        shouldIncrementVersion = true;
      }

      updateData.contentJson = newContentJson as any;
    }

    if (shouldIncrementVersion) {
      updateData.version = { increment: 1 };
    }

    const updated = await this.prisma.greetingTemplate.update({
      where: { id },
      data: updateData,
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (this.auditLog && user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_TEMPLATE_UPDATED",
          metadata: {
            templateId: updated.id,
            name: updated.name,
            versionIncremented: shouldIncrementVersion,
            newVersion: updated.version,
          },
        })
        .catch(() => null);
    }

    return this.serializeTemplate(updated);
  }

  /**
   * Activates a Greeting Template.
   */
  async activateTemplate(
    id: string,
    user?: AuthUser,
  ): Promise<GreetingTemplateResponseDto> {
    const existing = await this.prisma.greetingTemplate.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Greeting template with ID '${id}' not found`);
    }

    if (existing.status === GreetingTemplateStatus.ARCHIVED) {
      throw new BadRequestException("Cannot activate an archived greeting template");
    }

    const messages = normalizeGreetingMessages(existing);
    const validation = validateGreetingMessages(messages);
    if (!validation.valid) {
      throw new BadRequestException(
        `Cannot activate greeting template: ${validation.errors.join("; ")}`,
      );
    }

    const updated = await this.prisma.greetingTemplate.update({
      where: { id },
      data: {
        status: GreetingTemplateStatus.ACTIVE,
        activatedAt: new Date(),
      },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (this.auditLog && user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_TEMPLATE_ACTIVATED",
          metadata: {
            templateId: updated.id,
            name: updated.name,
            assignedStoreCount: updated.assignments.length,
          },
        })
        .catch(() => null);
    }

    return this.serializeTemplate(updated);
  }

  /**
   * Deactivates a Greeting Template (assignments are kept).
   */
  async deactivateTemplate(
    id: string,
    user?: AuthUser,
  ): Promise<GreetingTemplateResponseDto> {
    const existing = await this.prisma.greetingTemplate.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Greeting template with ID '${id}' not found`);
    }

    if (existing.status === GreetingTemplateStatus.ARCHIVED) {
      throw new BadRequestException("Cannot deactivate an archived greeting template");
    }

    const updated = await this.prisma.greetingTemplate.update({
      where: { id },
      data: {
        status: GreetingTemplateStatus.INACTIVE,
      },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (this.auditLog && user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_TEMPLATE_DEACTIVATED",
          metadata: {
            templateId: updated.id,
            name: updated.name,
            assignedStoreCount: updated.assignments.length,
          },
        })
        .catch(() => null);
    }

    return this.serializeTemplate(updated);
  }

  /**
   * Archives a Greeting Template.
   */
  async archiveTemplate(
    id: string,
    user?: AuthUser,
  ): Promise<GreetingTemplateResponseDto> {
    const existing = await this.prisma.greetingTemplate.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Greeting template with ID '${id}' not found`);
    }

    // Remove store assignments on archive so accounts are freed
    await this.prisma.greetingStoreAssignment.deleteMany({
      where: { templateId: id },
    });

    const updated = await this.prisma.greetingTemplate.update({
      where: { id },
      data: {
        status: GreetingTemplateStatus.ARCHIVED,
        archivedAt: new Date(),
      },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (this.auditLog && user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_TEMPLATE_ARCHIVED",
          metadata: {
            templateId: updated.id,
            name: updated.name,
          },
        })
        .catch(() => null);
    }

    return this.serializeTemplate(updated);
  }

  /**
   * Uploads an image asset for a Greeting Message block.
   */
  async uploadMedia(
    file: Express.Multer.File,
    user?: AuthUser,
  ): Promise<GreetingUploadMediaResult> {
    if (!this.media) {
      throw new ServiceUnavailableException("Media storage is unavailable");
    }

    if (!file || !file.buffer) {
      throw new BadRequestException("No image file provided");
    }

    if (file.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException("Image file size exceeds maximum limit of 10MB");
    }

    const mime = detectImageMime(file.buffer);
    if (!mime) {
      throw new BadRequestException(
        "Invalid image format. Only JPEG and PNG files are supported.",
      );
    }

    const ext = IMAGE_EXTENSIONS[mime] || "jpg";
    const fileId = randomUUID();
    const mediaObjectKey = `line-media/greeting/${fileId}-original.${ext}`;
    const previewObjectKey = `line-media/greeting/${fileId}-preview.jpg`;

    let width: number | undefined;
    let height: number | undefined;
    let previewBuffer: Buffer;

    try {
      const imageInstance = sharp(file.buffer);
      const metadata = await imageInstance.metadata();
      width = metadata.width;
      height = metadata.height;

      // LINE Messaging API requires preview image <= 1MB
      previewBuffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (err) {
      this.logger.warn(`Sharp processing failed for greeting upload: ${err}`);
      previewBuffer = file.buffer;
    }

    try {
      await this.media.put(mediaObjectKey, file.buffer, mime);
      await this.media.put(previewObjectKey, previewBuffer, "image/jpeg");
    } catch (err) {
      this.logger.error(`Failed to store greeting media: ${err}`);
      throw new ServiceUnavailableException("Failed to store image. Please try again.");
    }

    const imageUrl = createMediaPublicUrl(mediaObjectKey);
    const previewUrl = createMediaPublicUrl(previewObjectKey);

    return {
      mediaObjectKey,
      previewObjectKey,
      imageUrl,
      previewUrl,
      mimeType: mime,
      fileSize: file.buffer.length,
      width,
      height,
    };
  }

  /**
   * Evaluates store readiness for all eligible STORE LINE Official Accounts.
   */
  async getReadiness(templateId: string): Promise<GreetingReadinessResponseDto> {
    const template = await this.prisma.greetingTemplate.findUnique({
      where: { id: templateId },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Greeting template with ID '${templateId}' not found`,
      );
    }

    const messages = normalizeGreetingMessages(template);
    const usedVariables = extractAllGreetingVariables(messages);

    // Concatenate all text templates for variable validation
    const combinedText = messages
      .filter((m) => m.type === "TEXT")
      .map((m) => (m as any).textTemplate)
      .join(" ");

    const assignedOaIdSet = new Set(
      template.assignments.map((a) => a.lineOfficialAccountId),
    );

    // Fetch all eligible STORE LINE OAs
    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        accountType: LineAccountType.STORE,
        isActive: true,
        archivedAt: null,
        storeId: { not: null },
        encryptedChannelAccessToken: { not: null },
      },
      include: {
        store: {
          include: {
            storeMaster: true,
          },
        },
        greetingStoreAssignment: {
          include: {
            template: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ store: { name: "asc" } }, { name: "asc" }],
    });

    let readyCount = 0;
    let blockedCount = 0;
    let assignedCount = 0;

    const storeItems: GreetingStoreReadinessItem[] = accounts.map((oa) => {
      const store = oa.store;
      const storeMaster = store?.storeMaster;

      const storeContext: StoreVariableContext = {
        id: store?.id,
        name: store?.name,
        storeName: storeMaster?.storeName || store?.name,
        code: store?.code || storeMaster?.externalStoreId,
        storeId: store?.id,
        externalStoreId: storeMaster?.externalStoreId,
        accountName: oa.name,
        lineOfficialAccountName: oa.name,
        province: storeMaster?.province,
        region: storeMaster?.region || store?.region,
        lineId: storeMaster?.lineId || oa.basicId,
        lineOaLink: storeMaster?.lineOaLink,
        lineManagerUrl: storeMaster?.lineManagerUrl,
        tiktokUsername: storeMaster?.tiktokUsername,
        tiktokProfileUrl: storeMaster?.tiktokProfileUrl,
        googleMapsUrl: storeMaster?.googleMapsUrl,
      };

      const validation = validateTemplateVariables(combinedText, storeContext);
      const isReady = validation.status === "READY";
      const isAssigned = assignedOaIdSet.has(oa.id);

      if (isReady) readyCount++;
      else blockedCount++;

      if (isAssigned) assignedCount++;

      return {
        lineOfficialAccountId: oa.id,
        lineOfficialAccountName: oa.name,
        storeId: store?.id ?? null,
        storeCode: store?.code || storeMaster?.externalStoreId || null,
        storeName: storeMaster?.storeName || store?.name || oa.name,
        province: storeMaster?.province || null,
        region: storeMaster?.region || store?.region || null,
        googleMapsUrl: storeMaster?.googleMapsUrl || null,
        readinessStatus: isReady ? "READY" : "BLOCKED",
        missingVariables: validation.missingVariables,
        reason: validation.reason || null,
        isAssigned,
        currentTemplateId: oa.greetingStoreAssignment?.template?.id || null,
        currentTemplateName: oa.greetingStoreAssignment?.template?.name || null,
      };
    });

    return {
      templateId: template.id,
      templateName: template.name,
      usedVariables,
      totalStores: storeItems.length,
      readyStores: readyCount,
      blockedStores: blockedCount,
      assignedStores: assignedCount,
      stores: storeItems,
    };
  }

  /**
   * Assigns this Greeting Template to the given list of eligible store LINE OAs.
   * Replaces any existing greeting assignment for the target OAs.
   */
  async assignStores(
    templateId: string,
    dto: GreetingAssignStoresDto,
    user?: AuthUser,
  ): Promise<{ assignedCount: number }> {
    const template = await this.prisma.greetingTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(
        `Greeting template with ID '${templateId}' not found`,
      );
    }

    if (template.status === GreetingTemplateStatus.ARCHIVED) {
      throw new BadRequestException("Cannot assign stores to an archived template");
    }

    const targetOaIds = Array.from(new Set(dto.lineOfficialAccountIds || []));

    if (targetOaIds.length > 0) {
      // Validate all target accounts are eligible STORE accounts
      const targetAccounts = await this.prisma.lineOfficialAccount.findMany({
        where: { id: { in: targetOaIds } },
        select: { id: true, accountType: true, isActive: true, archivedAt: true },
      });

      const invalidAccounts = targetAccounts.filter(
        (a) =>
          a.accountType !== LineAccountType.STORE ||
          !a.isActive ||
          a.archivedAt !== null,
      );

      if (invalidAccounts.length > 0) {
        throw new BadRequestException(
          "One or more selected accounts are ineligible (HEAD_OFFICE, inactive, or archived).",
        );
      }
    }

    // Execute atomic assignment in transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Remove assignments for accounts currently assigned to this template but no longer in the list
      await tx.greetingStoreAssignment.deleteMany({
        where: {
          templateId,
          lineOfficialAccountId: { notIn: targetOaIds },
        },
      });

      // 2. Upsert assignments for all target accounts
      for (const oaId of targetOaIds) {
        await tx.greetingStoreAssignment.upsert({
          where: { lineOfficialAccountId: oaId },
          update: { templateId },
          create: { templateId, lineOfficialAccountId: oaId },
        });
      }
    });

    if (this.auditLog && user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_STORES_ASSIGNED",
          metadata: {
            templateId,
            assignedCount: targetOaIds.length,
          },
        })
        .catch(() => null);
    }

    return { assignedCount: targetOaIds.length };
  }

  /**
   * Simulates a live preview of the greeting message for a target store and sample customer name.
   * Sends ZERO LINE messages.
   */
  async preview(
    id: string,
    dto?: GreetingPreviewDto,
  ): Promise<GreetingPreviewResult> {
    const template = await this.prisma.greetingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Greeting template with ID '${id}' not found`);
    }

    const messages = normalizeGreetingMessages(template);
    const usedVariables = extractAllGreetingVariables(messages);

    // Resolve target OA
    let oa: any = null;
    if (dto?.lineOfficialAccountId) {
      oa = await this.prisma.lineOfficialAccount.findUnique({
        where: { id: dto.lineOfficialAccountId },
        include: { store: { include: { storeMaster: true } } },
      });
    } else if (dto?.storeId) {
      oa = await this.prisma.lineOfficialAccount.findFirst({
        where: {
          storeId: dto.storeId,
          accountType: LineAccountType.STORE,
          isActive: true,
          archivedAt: null,
        },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    if (!oa) {
      // Pick first active store OA
      oa = await this.prisma.lineOfficialAccount.findFirst({
        where: {
          accountType: LineAccountType.STORE,
          isActive: true,
          archivedAt: null,
          storeId: { not: null },
        },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    const store = oa?.store;
    const storeMaster = store?.storeMaster;
    const sampleCustomerName =
      dto?.sampleCustomerName?.trim() || "ลูกค้าคนสำคัญ";

    const storeContext: StoreVariableContext = {
      id: store?.id || "preview-store-id",
      name: store?.name || "OPPO Brand Shop Preview",
      storeName: storeMaster?.storeName || store?.name || "OPPO Brand Shop Preview",
      code: store?.code || storeMaster?.externalStoreId || "ST-001",
      storeId: store?.id || "preview-store-id",
      externalStoreId: storeMaster?.externalStoreId || "ST-001",
      accountName: oa?.name || "OPPO Store Preview",
      lineOfficialAccountName: oa?.name || "OPPO Store Preview",
      province: storeMaster?.province || "กรุงเทพมหานคร",
      region: storeMaster?.region || store?.region || "ภาคกลาง",
      lineId: storeMaster?.lineId || oa?.basicId || "@oppo_store",
      lineOaLink: storeMaster?.lineOaLink || "https://line.me/R/ti/p/@oppo_store",
      lineManagerUrl: storeMaster?.lineManagerUrl,
      tiktokUsername: storeMaster?.tiktokUsername || "oppo_th",
      tiktokProfileUrl: storeMaster?.tiktokProfileUrl || "https://tiktok.com/@oppo_th",
      googleMapsUrl: storeMaster?.googleMapsUrl || "https://maps.app.goo.gl/preview",
      user: { displayName: sampleCustomerName },
      userDisplayName: sampleCustomerName,
      userName: sampleCustomerName,
      account: { name: oa?.name || "OPPO Store Preview" },
    };

    let allValid = true;
    let readinessReason: string | null = null;

    const resolvedBlocks: ResolvedGreetingBlock[] = messages.map((block) => {
      if (block.type === "TEXT") {
        const textTemplate = block.textTemplate || "";
        const blockVars = extractTemplateVariables(textTemplate);
        const resolvedText = resolveTemplateVariables(textTemplate, storeContext);
        const validation = validateTemplateVariables(textTemplate, storeContext);

        if (validation.status !== "READY") {
          allValid = false;
          if (!readinessReason) readinessReason = validation.reason || null;
        }

        return {
          id: block.id,
          type: "TEXT",
          resolvedText,
          usedVariables: blockVars,
          unresolvedVariables: validation.missingVariables,
          isValid: validation.status === "READY",
          validationError: validation.reason,
        };
      }

      if (block.type === "IMAGE") {
        const isValid = Boolean(block.mediaObjectKey && block.mediaObjectKey.trim());
        if (!isValid) {
          allValid = false;
          if (!readinessReason) readinessReason = "Missing image media";
        }

        const imageUrl = block.mediaObjectKey
          ? createMediaPublicUrl(block.mediaObjectKey)
          : "";
        const previewUrl = (block.previewObjectKey || block.mediaObjectKey)
          ? createMediaPublicUrl(block.previewObjectKey || block.mediaObjectKey)
          : "";

        return {
          id: block.id,
          type: "IMAGE",
          imageUrl,
          previewUrl,
          mediaObjectKey: block.mediaObjectKey,
          previewObjectKey: block.previewObjectKey,
          isValid,
          validationError: isValid ? undefined : "Missing image media",
        };
      }

      allValid = false;
      return {
        id: (block as any).id || "unknown",
        type: "TEXT",
        resolvedText: "[Unsupported block]",
        usedVariables: [],
        unresolvedVariables: [],
        isValid: false,
        validationError: "Unsupported block type",
      };
    });

    return {
      templateId: template.id,
      templateName: template.name,
      sendPolicy: template.sendPolicy,
      store: {
        lineOfficialAccountId: oa?.id || "preview-oa-id",
        lineOfficialAccountName: oa?.name || "OPPO Store Preview",
        storeId: store?.id || null,
        storeName: storeMaster?.storeName || store?.name || "OPPO Store Preview",
        externalStoreId: storeMaster?.externalStoreId || null,
        googleMapsUrl: storeMaster?.googleMapsUrl || null,
      },
      sampleCustomerName,
      usedVariables,
      messages: resolvedBlocks,
      ready: allValid,
      reason: readinessReason,
    };
  }
}
