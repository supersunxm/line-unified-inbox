import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, RichMenuPublishStatus, RichMenuPreviousDefaultSource, RichMenuTemplateStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import sharp from "sharp";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "../media/media-storage";
import { createMediaPublicUrl, extractMediaObjectKey } from "../media/media-public-url";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { AuditLogService } from "../auth/audit-log.service";
import { LineRichMenuClientService, ILineRichMenuClient } from "./line-rich-menu-client.service";
import { AuthUser } from "../auth/auth.guard";
import {
  extractTemplateVariables,
  getStoreGoogleMapsReadiness,
  resolveTemplateVariables,
  StoreVariableContext,
} from "../store-master/template-variable-resolver";
import { isValidGoogleMapsUrl } from "../store-master/store-master.utils";
import {
  CreateRichMenuTemplateDto,
  generatePresetAreas,
  LineRichMenuPayload,
  PublishAttemptResponseDto,
  PublishCanaryDto,
  RichMenuArea,
  RichMenuCanvasPreset,
  RichMenuPreviewInputDto,
  RichMenuPreviewResolvedArea,
  RichMenuPreviewResult,
  RichMenuReadinessSummary,
  RichMenuStoreReadinessItem,
  SaveAssignmentsDto,
  UpdateRichMenuTemplateDto,
  validateRichMenuAreas,
} from "./rich-menu.types";

export type DetectedImageFormat = "jpeg" | "png" | "unknown";

export function detectImageMagicBytes(buffer: Buffer): DetectedImageFormat {
  if (!buffer || buffer.length < 8) return "unknown";

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  return "unknown";
}

@Injectable()
export class RichMenuPublishNoopAdapter implements ILineRichMenuClient {
  async validateRichMenu(): Promise<{ valid: boolean; message?: string }> {
    throw new BadRequestException("Rich Menu publishing is disabled.");
  }
  async createRichMenu(): Promise<{ richMenuId: string }> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async uploadRichMenuImage(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async getDefaultRichMenu(): Promise<{ richMenuId: string | null; source: "MESSAGING_API" | "OTHER_OR_MANAGER" | "NONE" }> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async setDefaultRichMenu(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async clearDefaultRichMenu(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async deleteRichMenu(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async getRichMenu(): Promise<any> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
}

@Injectable()
export class RichMenuService {
  private readonly logger = new Logger(RichMenuService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MediaStorageService) private readonly media: MediaStorageService,
    @Inject(CredentialEncryptionService) private readonly encryption: CredentialEncryptionService,
    @Inject(LineRichMenuClientService) private readonly publishAdapter: ILineRichMenuClient,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  private resolveTemplateImageUrl(imageUrl: string | null): string | null {
    if (!imageUrl) return null;
    const objectKey = extractMediaObjectKey(imageUrl);
    if (objectKey) {
      try {
        return createMediaPublicUrl(objectKey);
      } catch (err) {
        this.logger.warn(`Failed to refresh signed URL for objectKey '${objectKey}': ${err}`);
      }
    }
    return imageUrl;
  }

  async listTemplates() {
    const templates = await this.prisma.richMenuTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status,
      canvasPreset: t.canvasPreset,
      width: t.width,
      height: t.height,
      selected: t.selected ?? true,
      chatBarText: t.chatBarText,
      imageUrl: this.resolveTemplateImageUrl(t.imageUrl),
      areas: (t.areasJson as unknown as RichMenuArea[]) || [],
      version: t.version,
      assignedStoresCount: t._count.assignments,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getTemplate(id: string) {
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${id}' not found`);
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      status: template.status,
      canvasPreset: template.canvasPreset,
      width: template.width,
      height: template.height,
      selected: template.selected ?? true,
      chatBarText: template.chatBarText,
      imageUrl: this.resolveTemplateImageUrl(template.imageUrl),
      areas: (template.areasJson as unknown as RichMenuArea[]) || [],
      version: template.version,
      assignedLineOfficialAccountIds: template.assignments.map((a) => a.lineOfficialAccountId),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  async createTemplate(dto: CreateRichMenuTemplateDto, user?: AuthUser) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException("Template name is required");
    }

    const preset = dto.canvasPreset || "GRID_6";
    let width = dto.width ?? 2500;
    let height = dto.height ?? 1686;
    let areas = dto.areas;

    if (!areas || areas.length === 0) {
      const generated = generatePresetAreas(preset, width, height);
      width = generated.width;
      height = generated.height;
      areas = generated.areas;
    }

    const validation = validateRichMenuAreas(areas, width, height);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid area layout: ${validation.errors.join("; ")}`);
    }

    const created = await this.prisma.richMenuTemplate.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        status: RichMenuTemplateStatus.DRAFT,
        canvasPreset: preset,
        width,
        height,
        selected: dto.selected !== undefined ? dto.selected : true,
        chatBarText: dto.chatBarText?.trim() || "Menu",
        imageUrl: dto.imageUrl?.trim() || null,
        areasJson: areas as unknown as Prisma.InputJsonValue,
        createdByUserId: user?.id || null,
      },
    });

    return this.getTemplate(created.id);
  }

  async updateTemplate(id: string, dto: UpdateRichMenuTemplateDto) {
    const existing = await this.prisma.richMenuTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Rich Menu template with ID '${id}' not found`);
    }

    const width = dto.width ?? existing.width;
    const height = dto.height ?? existing.height;
    const areas = dto.areas ?? ((existing.areasJson as unknown as RichMenuArea[]) || []);

    if (dto.areas) {
      const validation = validateRichMenuAreas(areas, width, height);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid area layout: ${validation.errors.join("; ")}`);
      }
    }

    const updated = await this.prisma.richMenuTemplate.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        status: dto.status !== undefined ? (dto.status as RichMenuTemplateStatus) : undefined,
        canvasPreset: dto.canvasPreset !== undefined ? dto.canvasPreset : undefined,
        width: dto.width !== undefined ? dto.width : undefined,
        height: dto.height !== undefined ? dto.height : undefined,
        selected: dto.selected !== undefined ? dto.selected : undefined,
        chatBarText: dto.chatBarText !== undefined ? dto.chatBarText.trim() || "Menu" : undefined,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : undefined,
        areasJson: dto.areas ? (areas as unknown as Prisma.InputJsonValue) : undefined,
        version: { increment: 1 },
      },
    });

    return this.getTemplate(updated.id);
  }

  async deleteTemplate(id: string) {
    const existing = await this.prisma.richMenuTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Rich Menu template with ID '${id}' not found`);
    }

    await this.prisma.richMenuTemplate.delete({
      where: { id },
    });

    return { success: true, message: `Template '${existing.name}' deleted successfully` };
  }

  async saveAssignments(templateId: string, dto: SaveAssignmentsDto) {
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    const oaIds = Array.from(new Set(dto.lineOfficialAccountIds || []));

    if (oaIds.length > 0) {
      const validOas = await this.prisma.lineOfficialAccount.findMany({
        where: {
          id: { in: oaIds },
          accountType: "STORE",
          archivedAt: null,
        },
        select: { id: true },
      });

      const validOaIdSet = new Set(validOas.map((o) => o.id));
      const invalid = oaIds.filter((id) => !validOaIdSet.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid or ineligible LineOfficialAccount IDs: ${invalid.join(", ")}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.richMenuStoreAssignment.deleteMany({
        where: { templateId },
      });

      if (oaIds.length > 0) {
        await tx.richMenuStoreAssignment.createMany({
          data: oaIds.map((lineOfficialAccountId) => ({
            templateId,
            lineOfficialAccountId,
          })),
        });
      }
    });

    return {
      templateId,
      assignedCount: oaIds.length,
      assignedLineOfficialAccountIds: oaIds,
    };
  }

  private async parseImageMetadata(file: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number }): Promise<{
    format: DetectedImageFormat;
    width: number;
    height: number;
  }> {
    const detectedFormat = detectImageMagicBytes(file.buffer);
    if (detectedFormat === "unknown") {
      this.logger.warn(
        `[RichMenu Image Upload] Rejected file due to unsupported magic bytes: ` +
          JSON.stringify({
            originalname: file.originalname || "unknown",
            mimetype: file.mimetype || "unknown",
            fileSize: file.size ?? file.buffer.length,
            bufferLength: file.buffer.length,
            detectedSignature: detectedFormat,
          }),
      );
      throw new BadRequestException("รองรับเฉพาะไฟล์ JPG หรือ PNG กรุณาแปลงรูปภาพแล้วลองอีกครั้ง");
    }

    let width = 0;
    let height = 0;
    let imageSizeErrorMsg: string | null = null;

    // 1. Primary parser: image-size (pure JavaScript)
    try {
      const dimensions = imageSize(file.buffer);
      if (dimensions.width && dimensions.height) {
        width = dimensions.width;
        height = dimensions.height;
      }
    } catch (err: any) {
      imageSizeErrorMsg = err?.message || "image-size parse failed";
    }

    // 2. Secondary fallback parser: Sharp
    if (!width || !height) {
      try {
        const metadata = await sharp(file.buffer).metadata();
        if (metadata.width && metadata.height) {
          width = metadata.width;
          height = metadata.height;
        }
      } catch (sharpErr: any) {
        this.logger.warn(
          `[RichMenu Image Upload] Metadata decoding failure: ` +
            JSON.stringify({
              originalname: file.originalname || "unknown",
              mimetype: file.mimetype || "unknown",
              fileSize: file.size ?? file.buffer.length,
              bufferLength: file.buffer.length,
              detectedFormat,
              imageSizeError: imageSizeErrorMsg,
              sharpError: sharpErr?.message || null,
            }),
        );
        throw new BadRequestException("รองรับเฉพาะไฟล์ JPG หรือ PNG กรุณาแปลงรูปภาพแล้วลองอีกครั้ง");
      }
    }

    if (!width || !height) {
      this.logger.warn(
        `[RichMenu Image Upload] Could not determine dimensions: ` +
          JSON.stringify({
            originalname: file.originalname || "unknown",
            mimetype: file.mimetype || "unknown",
            fileSize: file.size ?? file.buffer.length,
            bufferLength: file.buffer.length,
            detectedFormat,
            imageSizeError: imageSizeErrorMsg,
          }),
      );
      throw new BadRequestException("รองรับเฉพาะไฟล์ JPG หรือ PNG กรุณาแปลงรูปภาพแล้วลองอีกครั้ง");
    }

    return {
      format: detectedFormat,
      width,
      height,
    };
  }

  async uploadImage(
    file: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number },
    user: AuthUser,
    preset?: string,
  ): Promise<{ imageUrl: string; width: number; height: number }> {
    if (!file?.buffer || !file.buffer.length) {
      throw new BadRequestException("Image file is required and cannot be empty");
    }

    if (file.buffer.length > 1 * 1024 * 1024) {
      throw new BadRequestException("ขนาดไฟล์รูปภาพเกินขีดจำกัด 1 MB (ข้อกำหนดของ LINE Messaging API)");
    }

    const { format, width, height } = await this.parseImageMetadata(file);

    if (width < 800 || width > 2500) {
      throw new BadRequestException(`ความกว้างของรูปภาพต้องอยู่ระหว่าง 800 ถึง 2500 พิกเซล (ขนาดปัจจุบัน: ${width}px)`);
    }
    if (height < 250) {
      throw new BadRequestException(`ความสูงของรูปภาพต้องไม่น้อยกว่า 250 พิกเซล (ขนาดปัจจุบัน: ${height}px)`);
    }

    const aspectRatio = width / height;
    if (aspectRatio < 1.40) {
      throw new BadRequestException(`สัดส่วนรูปภาพไม่ถูกต้อง (กว้าง/สูง ต้องไม่น้อยกว่า 1.45)`);
    }

    // Template aspect ratio validation if preset is provided
    if (preset) {
      const isCompact = preset.startsWith("COMPACT_") || preset === "GRID_3";
      const isLarge = preset.startsWith("LARGE_") || preset === "GRID_6" || preset === "GRID_4";

      if (isLarge && aspectRatio > 2.0) {
        throw new BadRequestException("รูปภาพไม่ตรงกับสัดส่วนของเทมเพลตที่เลือก (เทมเพลตขนาดใหญ่ต้องมีสัดส่วนประมาณ 2500x1686)");
      }
      if (isCompact && aspectRatio < 2.0) {
        throw new BadRequestException("รูปภาพไม่ตรงกับสัดส่วนของเทมเพลตที่เลือก (เทมเพลตแบบกะทัดรัดต้องมีสัดส่วนประมาณ 2500x843)");
      }
    }

    const ext = format === "jpeg" ? "jpg" : "png";
    const mime = format === "jpeg" ? "image/jpeg" : "image/png";
    const fileId = randomUUID();
    const objectKey = `line-media/outbound/rich-menu/${fileId}.${ext}`;

    try {
      await this.media.put(objectKey, file.buffer, mime);
    } catch (storageErr: any) {
      this.logger.error(
        `[RichMenu Image Storage Failure] ` +
          JSON.stringify({
            objectKey,
            errorName: storageErr?.name || "StorageError",
            errorMessage: storageErr?.message || "Failed to store image",
          }),
      );
      throw new BadRequestException("ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง");
    }

    const imageUrl = createMediaPublicUrl(objectKey);

    return {
      imageUrl,
      width,
      height,
    };
  }

  async preview(templateId: string, input?: RichMenuPreviewInputDto): Promise<RichMenuPreviewResult> {
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    // Find the target LineOfficialAccount
    let targetOa: Prisma.LineOfficialAccountGetPayload<{
      include: { store: { include: { storeMaster: true } } };
    }> | null = null;

    if (input?.lineOfficialAccountId) {
      targetOa = await this.prisma.lineOfficialAccount.findUnique({
        where: { id: input.lineOfficialAccountId },
        include: { store: { include: { storeMaster: true } } },
      });
    } else if (input?.storeId) {
      targetOa = await this.prisma.lineOfficialAccount.findFirst({
        where: { storeId: input.storeId, accountType: "STORE", archivedAt: null },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    if (!targetOa) {
      targetOa = await this.prisma.lineOfficialAccount.findFirst({
        where: {
          accountType: "STORE",
          archivedAt: null,
          richMenuAssignments: { some: { templateId } },
        },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    if (!targetOa) {
      targetOa = await this.prisma.lineOfficialAccount.findFirst({
        where: { accountType: "STORE", archivedAt: null },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    if (!targetOa || !targetOa.store) {
      throw new BadRequestException(
        "No suitable STORE LINE Official Account available for preview",
      );
    }

    const storeContext: StoreVariableContext = {
      storeName: targetOa.store.name,
      externalStoreId: targetOa.store.storeMaster?.externalStoreId ?? null,
      accountName: targetOa.name,
      googleMapsUrl: targetOa.store.storeMaster?.googleMapsUrl ?? null,
    };

    const areas = (template.areasJson as unknown as RichMenuArea[]) || [];
    const usedVariablesSet = new Set<string>();
    const resolvedAreas: RichMenuPreviewResolvedArea[] = [];
    let isTemplateBlocked = false;
    let blockedReason: string | null = null;

    for (const area of areas) {
      const vars = extractTemplateVariables(area.actionData);
      vars.forEach((v) => usedVariablesSet.add(v));

      const resolved = resolveTemplateVariables(area.actionData, storeContext);
      let isValid = true;
      let validationError: string | null = null;

      if (area.actionType === "URI") {
        const containsMapsVar =
          area.actionData.includes("{{store.googleMapsUrl}}") ||
          area.actionData.includes("{{googleMapsUrl}}");

        if (containsMapsVar) {
          const mapsReadiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
          if (mapsReadiness.status === "MISSING") {
            isValid = false;
            validationError = "Missing Google Maps URL in Store Master";
            isTemplateBlocked = true;
            blockedReason = "Missing Google Maps URL";
          } else if (mapsReadiness.status === "INVALID") {
            isValid = false;
            validationError = "Invalid Google Maps URL in Store Master";
            isTemplateBlocked = true;
            blockedReason = "Invalid Google Maps URL";
          }
        } else if (!/^https?:\/\//i.test(resolved)) {
          isValid = false;
          validationError = "Invalid URI schema (must start with https:// or http://)";
          isTemplateBlocked = true;
          blockedReason = validationError;
        }
      } else if (area.actionType === "MESSAGE") {
        if (!resolved.trim()) {
          isValid = false;
          validationError = "Message text resolved to empty";
        }
      }

      resolvedAreas.push({
        id: area.id,
        bounds: area.bounds,
        actionType: area.actionType,
        rawActionData: area.actionData,
        resolvedActionData: resolved,
        label: area.label,
        isValid,
        validationError,
      });
    }

    return {
      template: {
        id: template.id,
        name: template.name,
        canvasPreset: template.canvasPreset,
        width: template.width,
        height: template.height,
        chatBarText: template.chatBarText,
        imageUrl: this.resolveTemplateImageUrl(template.imageUrl),
      },
      store: {
        lineOfficialAccountId: targetOa.id,
        lineOfficialAccountName: targetOa.name,
        storeName: targetOa.store.name,
        externalStoreId: targetOa.store.storeMaster?.externalStoreId ?? null,
        googleMapsUrl: targetOa.store.storeMaster?.googleMapsUrl ?? null,
      },
      usedVariables: Array.from(usedVariablesSet),
      readinessStatus: isTemplateBlocked ? "BLOCKED" : "READY",
      readinessReason: isTemplateBlocked ? blockedReason : null,
      areas: resolvedAreas,
    };
  }

  async evaluateReadiness(templateId: string): Promise<{
    templateId: string;
    templateName: string;
    usedVariables: string[];
    summary: RichMenuReadinessSummary;
    items: RichMenuStoreReadinessItem[];
  }> {
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    const assignedSet = new Set(template.assignments.map((a) => a.lineOfficialAccountId));
    const areas = (template.areasJson as unknown as RichMenuArea[]) || [];

    // Extract all variables referenced in the template
    const usedVariablesSet = new Set<string>();
    for (const area of areas) {
      const vars = extractTemplateVariables(area.actionData);
      vars.forEach((v) => usedVariablesSet.add(v));
    }
    const usedVariables = Array.from(usedVariablesSet);
    const requiresGoogleMaps = usedVariables.includes("store.googleMapsUrl") || usedVariables.includes("googleMapsUrl");

    // Fetch all active connected STORE LINE OAs with latest publish attempt for this template
    const storeOas = await this.prisma.lineOfficialAccount.findMany({
      where: {
        accountType: "STORE",
        archivedAt: null,
      },
      include: {
        store: {
          include: { storeMaster: true },
        },
        richMenuPublishAttempts: {
          where: { templateId },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    let readyCount = 0;
    let blockedCount = 0;
    let selectedCount = 0;

    const items: RichMenuStoreReadinessItem[] = storeOas.map((oa) => {
      const storeMaster = oa.store?.storeMaster;
      const mapsUrl = storeMaster?.googleMapsUrl ?? null;
      let readinessStatus: "READY" | "BLOCKED" = "READY";
      let readinessReason: string | null = null;

      if (requiresGoogleMaps) {
        const mapsReadiness = getStoreGoogleMapsReadiness(mapsUrl);
        if (mapsReadiness.status === "MISSING") {
          readinessStatus = "BLOCKED";
          readinessReason = "Missing Google Maps URL";
        } else if (mapsReadiness.status === "INVALID") {
          readinessStatus = "BLOCKED";
          readinessReason = "Invalid Google Maps URL";
        }
      }

      if (readinessStatus === "READY") {
        readyCount++;
      } else {
        blockedCount++;
      }

      const isSelected = assignedSet.has(oa.id) && readinessStatus === "READY";
      if (isSelected) {
        selectedCount++;
      }

      const latestAttempt = oa.richMenuPublishAttempts?.[0];
      let publishStatus = "NOT_PUBLISHED";
      let publishedRichMenuId: string | null = null;
      let lastPublishedAt: Date | null = null;
      let lastPublishError: string | null = null;
      let lastPublishErrorStage: string | null = null;
      let publishAttemptId: string | null = null;

      if (latestAttempt) {
        publishStatus = latestAttempt.status;
        publishedRichMenuId = latestAttempt.lineRichMenuId;
        lastPublishedAt = latestAttempt.status === RichMenuPublishStatus.PUBLISHED ? latestAttempt.completedAt || latestAttempt.updatedAt : null;
        lastPublishError = latestAttempt.errorMessage;
        lastPublishErrorStage = latestAttempt.errorStage;
        publishAttemptId = latestAttempt.id;
      }

      return {
        lineOfficialAccountId: oa.id,
        lineOfficialAccountName: oa.name,
        storeId: oa.store?.id ?? null,
        externalStoreId: storeMaster?.externalStoreId ?? null,
        storeName: oa.store?.name ?? oa.name,
        accountName: storeMaster?.accountName ?? null,
        province: storeMaster?.province ?? oa.store?.area ?? null,
        region: oa.store?.region ?? null,
        googleMapsUrl: mapsUrl,
        readinessStatus,
        readinessReason,
        selected: isSelected,
        publishStatus,
        publishedRichMenuId,
        lastPublishedAt,
        lastPublishError,
        lastPublishErrorStage,
        publishAttemptId,
      };
    });

    return {
      templateId: template.id,
      templateName: template.name,
      usedVariables,
      summary: {
        total: items.length,
        ready: readyCount,
        blocked: blockedCount,
        selected: selectedCount,
      },
      items,
    };
  }

  // =========================================================================
  // Phase 2A: Single-Store Canary Publishing to LINE Messaging API
  // =========================================================================

  async publishCanary(
    templateId: string,
    dto: PublishCanaryDto,
    user: AuthUser,
  ): Promise<PublishAttemptResponseDto> {
    if (!dto?.lineOfficialAccountId || typeof dto.lineOfficialAccountId !== "string" || !dto.lineOfficialAccountId.trim()) {
      throw new BadRequestException("Phase 2A supports publishing to exactly one store at a time. Target store is required.");
    }
    const lineOfficialAccountId = dto.lineOfficialAccountId.trim();

    // 1. Fetch template
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
      include: {
        assignments: {
          where: { lineOfficialAccountId },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    if (!template.imageUrl) {
      throw new BadRequestException("Cannot publish: template has no image");
    }

    const areas = (template.areasJson as unknown as RichMenuArea[]) || [];
    const areaValidation = validateRichMenuAreas(areas, template.width, template.height);
    if (!areaValidation.valid) {
      throw new BadRequestException(`Cannot publish: invalid area layout (${areaValidation.errors.join("; ")})`);
    }

    // 2. Fetch LINE Official Account
    const targetOa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: lineOfficialAccountId },
      include: {
        store: {
          include: { storeMaster: true },
        },
      },
    });

    if (!targetOa) {
      throw new NotFoundException(`Target store LINE Official Account not found`);
    }

    if (targetOa.accountType === "HEAD_OFFICE") {
      throw new BadRequestException("Cannot publish rich menu to Head Office account. Only STORE accounts are supported.");
    }

    if (!targetOa.isActive || targetOa.archivedAt) {
      throw new BadRequestException("Target LINE OA is disabled or archived");
    }

    if (!targetOa.encryptedChannelAccessToken) {
      throw new BadRequestException("Target LINE OA has no channel access token configured");
    }

    if (!targetOa.store) {
      throw new BadRequestException("Target LINE OA is not linked to a store");
    }

    // Assignment check
    const assignment = template.assignments[0];
    if (!assignment) {
      throw new BadRequestException("Target store is not assigned to this template. Please save assignment first.");
    }

    // 3. Idempotency Guard (prevent double-clicks or concurrent publishes)
    const activeAttempt = await this.prisma.richMenuPublishAttempt.findFirst({
      where: {
        templateId,
        lineOfficialAccountId,
        status: {
          in: [
            RichMenuPublishStatus.PENDING,
            RichMenuPublishStatus.VALIDATING,
            RichMenuPublishStatus.CREATING,
            RichMenuPublishStatus.IMAGE_UPLOADING,
            RichMenuPublishStatus.SETTING_DEFAULT,
            RichMenuPublishStatus.VERIFYING,
            RichMenuPublishStatus.ROLLING_BACK,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeAttempt) {
      const activeAgeMs = Date.now() - new Date(activeAttempt.createdAt).getTime();
      if (activeAgeMs < 5 * 60 * 1000) {
        throw new ConflictException("A publish action is already in progress for this store. Please wait.");
      }
    }

    // Count existing attempts for attempt numbering
    const totalAttempts = await this.prisma.richMenuPublishAttempt.count({
      where: { templateId, lineOfficialAccountId },
    });

    // 4. Fresh Dynamic Template Variable Resolution
    const storeMaster = targetOa.store.storeMaster;
    const storeContext: StoreVariableContext = {
      storeName: targetOa.store.name,
      externalStoreId: storeMaster?.externalStoreId ?? null,
      accountName: targetOa.name,
      googleMapsUrl: storeMaster?.googleMapsUrl ?? null,
    };

    const resolvedAreas: Array<{
      bounds: { x: number; y: number; width: number; height: number };
      actionType: "URI" | "MESSAGE";
      rawActionData: string;
      resolvedActionData: string;
      label?: string;
    }> = [];

    for (const area of areas) {
      const resolved = resolveTemplateVariables(area.actionData, storeContext);
      if (area.actionType === "URI") {
        const containsMapsVar = area.actionData.includes("{{store.googleMapsUrl}}") || area.actionData.includes("{{googleMapsUrl}}");
        if (containsMapsVar) {
          if (!storeMaster?.googleMapsUrl) {
            throw new BadRequestException("Cannot publish: Store Master is missing Google Maps URL");
          }
          if (!isValidGoogleMapsUrl(storeMaster.googleMapsUrl)) {
            throw new BadRequestException("Cannot publish: Store Master has invalid Google Maps URL");
          }
        } else if (!/^https?:\/\//i.test(resolved)) {
          throw new BadRequestException(`Cannot publish: invalid URI schema '${resolved}' (must start with https:// or http://)`);
        }
      } else if (area.actionType === "MESSAGE") {
        if (!resolved.trim()) {
          throw new BadRequestException("Cannot publish: message action text resolved to empty");
        }
      }

      resolvedAreas.push({
        bounds: area.bounds,
        actionType: area.actionType,
        rawActionData: area.actionData,
        resolvedActionData: resolved,
        label: area.label?.trim() || undefined,
      });
    }

    // 5. Construct LINE Rich Menu Payload
    const linePayload: LineRichMenuPayload = {
      size: {
        width: template.width,
        height: template.height,
      },
      selected: template.selected ?? true,
      name: template.name.slice(0, 300),
      chatBarText: template.chatBarText.slice(0, 14),
      areas: resolvedAreas.map((a) => ({
        bounds: a.bounds,
        action:
          a.actionType === "URI"
            ? {
                type: "uri",
                label: a.label?.slice(0, 20),
                uri: a.resolvedActionData,
              }
            : {
                type: "message",
                label: a.label?.slice(0, 20),
                text: a.resolvedActionData,
              },
      })),
    };

    // 6. Retrieve stored image content
    const objectKey = extractMediaObjectKey(template.imageUrl);
    if (!objectKey) {
      throw new BadRequestException("Invalid template image URL or object key");
    }

    let imageBuffer: Buffer;
    let mimeType: string;
    try {
      const stored = await this.media.get(objectKey);
      imageBuffer = stored.body;
      mimeType = stored.contentType || (objectKey.endsWith(".jpg") || objectKey.endsWith(".jpeg") ? "image/jpeg" : "image/png");
    } catch (err: any) {
      throw new BadRequestException(`Failed to retrieve template image from storage: ${err?.message || "unknown"}`);
    }

    // 7. Decrypt OA channel access token
    let token: string;
    try {
      token = this.encryption.decrypt(targetOa.encryptedChannelAccessToken);
    } catch {
      throw new BadRequestException("Failed to decrypt LINE OA credentials");
    }

    // 8. Create initial Publish Attempt record
    const attempt = await this.prisma.richMenuPublishAttempt.create({
      data: {
        templateId,
        lineOfficialAccountId,
        assignmentId: assignment.id,
        status: RichMenuPublishStatus.VALIDATING,
        resolvedConfigJson: linePayload as unknown as Prisma.InputJsonValue,
        attemptNumber: totalAttempts + 1,
        createdByUserId: user.id,
      },
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "RICH_MENU_PUBLISH_STARTED",
        metadata: {
          templateId,
          templateName: template.name,
          lineOfficialAccountId,
          storeName: targetOa.store.name,
          attemptId: attempt.id,
        },
      });
    }

    // 9. Execute Publish Pipeline
    let lineRichMenuId: string | null = null;

    try {
      // Stage A: Validate Rich Menu
      const validation = await this.publishAdapter.validateRichMenu(token, linePayload);
      if (!validation.valid) {
        throw new BadRequestException(`LINE validation failed: ${validation.message || "Invalid rich menu structure"}`);
      }

      // Stage B: Detect Previous Default
      let prevDefault: { richMenuId: string | null; source: "MESSAGING_API" | "OTHER_OR_MANAGER" | "NONE" };
      try {
        prevDefault = await this.publishAdapter.getDefaultRichMenu(token);
      } catch {
        prevDefault = { richMenuId: null, source: "NONE" };
      }

      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RichMenuPublishStatus.CREATING,
          previousDefaultRichMenuId: prevDefault.richMenuId,
          previousDefaultSource: prevDefault.source as RichMenuPreviousDefaultSource,
        },
      });

      // Stage C: Create Rich Menu on LINE
      const createRes = await this.publishAdapter.createRichMenu(token, linePayload);
      lineRichMenuId = createRes.richMenuId;

      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RichMenuPublishStatus.IMAGE_UPLOADING,
          lineRichMenuId,
        },
      });

      // Stage D: Upload Image Content
      try {
        await this.publishAdapter.uploadRichMenuImage(token, lineRichMenuId, imageBuffer, mimeType);
      } catch (imgErr: any) {
        // Attempt cleanup of orphaned rich menu
        if (lineRichMenuId) {
          try {
            await this.publishAdapter.deleteRichMenu(token, lineRichMenuId);
          } catch {
            /* ignore cleanup error */
          }
        }
        await this.prisma.richMenuPublishAttempt.update({
          where: { id: attempt.id },
          data: {
            status: RichMenuPublishStatus.FAILED,
            errorStage: "IMAGE_UPLOADING",
            errorMessage: imgErr?.message || "Failed to upload image content to LINE",
          },
        });
        if (this.auditLog) {
          await this.auditLog.record({
            actorUserId: user.id,
            action: "RICH_MENU_PUBLISH_FAILED",
            metadata: {
              templateId,
              lineOfficialAccountId,
              attemptId: attempt.id,
              errorStage: "IMAGE_UPLOADING",
              errorMessage: imgErr?.message || "Image upload failed",
            },
          });
        }
        throw imgErr;
      }

      // Stage E: Set Default Rich Menu
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: { status: RichMenuPublishStatus.SETTING_DEFAULT },
      });

      try {
        await this.publishAdapter.setDefaultRichMenu(token, lineRichMenuId);
      } catch (setErr: any) {
        await this.prisma.richMenuPublishAttempt.update({
          where: { id: attempt.id },
          data: {
            status: RichMenuPublishStatus.FAILED,
            errorStage: "SETTING_DEFAULT",
            errorMessage: setErr?.message || "Failed to set default rich menu on LINE",
          },
        });
        if (this.auditLog) {
          await this.auditLog.record({
            actorUserId: user.id,
            action: "RICH_MENU_PUBLISH_FAILED",
            metadata: {
              templateId,
              lineOfficialAccountId,
              attemptId: attempt.id,
              errorStage: "SETTING_DEFAULT",
              errorMessage: setErr?.message || "Set default failed",
            },
          });
        }
        throw setErr;
      }

      // Stage F: Verify Default Rich Menu
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: { status: RichMenuPublishStatus.VERIFYING },
      });

      const verifyRes = await this.publishAdapter.getDefaultRichMenu(token);
      if (verifyRes.richMenuId !== lineRichMenuId) {
        const mismatchErr = `Default rich menu mismatch: expected ${lineRichMenuId}, got ${verifyRes.richMenuId || "none"}`;
        await this.prisma.richMenuPublishAttempt.update({
          where: { id: attempt.id },
          data: {
            status: RichMenuPublishStatus.FAILED,
            errorStage: "VERIFYING",
            errorMessage: mismatchErr,
          },
        });
        if (this.auditLog) {
          await this.auditLog.record({
            actorUserId: user.id,
            action: "RICH_MENU_PUBLISH_FAILED",
            metadata: {
              templateId,
              lineOfficialAccountId,
              attemptId: attempt.id,
              errorStage: "VERIFYING",
              errorMessage: mismatchErr,
            },
          });
        }
        throw new BadGatewayException(mismatchErr);
      }

      // Final: Success! Mark PUBLISHED
      const updatedAttempt = await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RichMenuPublishStatus.PUBLISHED,
          completedAt: new Date(),
        },
      });

      if (this.auditLog) {
        await this.auditLog.record({
          actorUserId: user.id,
          action: "RICH_MENU_PUBLISHED",
          metadata: {
            templateId,
            lineOfficialAccountId,
            attemptId: attempt.id,
            richMenuId: lineRichMenuId,
            storeName: targetOa.store.name,
          },
        });
      }

      return {
        id: updatedAttempt.id,
        templateId: updatedAttempt.templateId,
        lineOfficialAccountId: updatedAttempt.lineOfficialAccountId,
        lineOfficialAccountName: targetOa.name,
        storeName: targetOa.store.name,
        status: updatedAttempt.status,
        lineRichMenuId: updatedAttempt.lineRichMenuId,
        previousDefaultRichMenuId: updatedAttempt.previousDefaultRichMenuId,
        previousDefaultSource: updatedAttempt.previousDefaultSource,
        errorStage: updatedAttempt.errorStage,
        errorCode: updatedAttempt.errorCode,
        errorMessage: updatedAttempt.errorMessage,
        attemptNumber: updatedAttempt.attemptNumber,
        startedAt: updatedAttempt.startedAt,
        completedAt: updatedAttempt.completedAt,
        createdAt: updatedAttempt.createdAt,
        updatedAt: updatedAttempt.updatedAt,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof BadGatewayException || err instanceof ConflictException) {
        throw err;
      }
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RichMenuPublishStatus.FAILED,
          errorMessage: err?.message || "Unexpected publishing error",
        },
      });
      throw err;
    }
  }

  async rollbackPublish(
    attemptId: string,
    user: AuthUser,
  ): Promise<PublishAttemptResponseDto> {
    const attempt = await this.prisma.richMenuPublishAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lineOfficialAccount: {
          include: { store: true },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Publish attempt '${attemptId}' not found`);
    }

    if (attempt.status !== RichMenuPublishStatus.PUBLISHED) {
      throw new BadRequestException(
        `Cannot rollback attempt with status '${attempt.status}'. Only PUBLISHED attempts can be rolled back.`,
      );
    }

    if (!attempt.lineOfficialAccount.encryptedChannelAccessToken) {
      throw new BadRequestException("LINE OA access token is missing");
    }

    let token: string;
    try {
      token = this.encryption.decrypt(attempt.lineOfficialAccount.encryptedChannelAccessToken);
    } catch {
      throw new BadRequestException("Failed to decrypt LINE OA credentials");
    }

    await this.prisma.richMenuPublishAttempt.update({
      where: { id: attemptId },
      data: { status: RichMenuPublishStatus.ROLLING_BACK },
    });

    try {
      if (attempt.previousDefaultSource === "MESSAGING_API" && attempt.previousDefaultRichMenuId) {
        await this.publishAdapter.setDefaultRichMenu(token, attempt.previousDefaultRichMenuId);
      } else {
        // NONE or OTHER_OR_MANAGER: unlink Messaging API default
        await this.publishAdapter.clearDefaultRichMenu(token);
      }

      const updated = await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptId },
        data: {
          status: RichMenuPublishStatus.ROLLED_BACK,
          completedAt: new Date(),
        },
      });

      if (this.auditLog) {
        await this.auditLog.record({
          actorUserId: user.id,
          action: "RICH_MENU_ROLLED_BACK",
          metadata: {
            templateId: attempt.templateId,
            lineOfficialAccountId: attempt.lineOfficialAccountId,
            attemptId: attempt.id,
            restoredRichMenuId: attempt.previousDefaultRichMenuId,
            previousDefaultSource: attempt.previousDefaultSource,
          },
        });
      }

      return {
        id: updated.id,
        templateId: updated.templateId,
        lineOfficialAccountId: updated.lineOfficialAccountId,
        lineOfficialAccountName: attempt.lineOfficialAccount.name,
        storeName: attempt.lineOfficialAccount.store?.name,
        status: updated.status,
        lineRichMenuId: updated.lineRichMenuId,
        previousDefaultRichMenuId: updated.previousDefaultRichMenuId,
        previousDefaultSource: updated.previousDefaultSource,
        errorStage: updated.errorStage,
        errorCode: updated.errorCode,
        errorMessage: updated.errorMessage,
        attemptNumber: updated.attemptNumber,
        startedAt: updated.startedAt,
        completedAt: updated.completedAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (err: any) {
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptId },
        data: {
          status: RichMenuPublishStatus.FAILED,
          errorStage: "ROLLING_BACK",
          errorMessage: `Rollback failed: ${err?.message || "unknown"}`,
        },
      });
      throw err;
    }
  }

  async retryPublish(
    attemptId: string,
    user: AuthUser,
  ): Promise<PublishAttemptResponseDto> {
    const attempt = await this.prisma.richMenuPublishAttempt.findUnique({
      where: { id: attemptId },
      include: { lineOfficialAccount: true },
    });

    if (!attempt) {
      throw new NotFoundException(`Publish attempt '${attemptId}' not found`);
    }

    if (attempt.status !== RichMenuPublishStatus.FAILED) {
      throw new BadRequestException(
        `Cannot retry attempt with status '${attempt.status}'. Only FAILED attempts can be retried.`,
      );
    }

    // If an unlinked menu was created on LINE, attempt to clean it up first
    if (attempt.lineRichMenuId && attempt.lineOfficialAccount.encryptedChannelAccessToken) {
      try {
        const token = this.encryption.decrypt(attempt.lineOfficialAccount.encryptedChannelAccessToken);
        await this.publishAdapter.deleteRichMenu(token, attempt.lineRichMenuId);
      } catch {
        /* ignore delete cleanup error */
      }
    }

    return this.publishCanary(
      attempt.templateId,
      { lineOfficialAccountId: attempt.lineOfficialAccountId },
      user,
    );
  }

  async getPublishAttempts(templateId: string): Promise<PublishAttemptResponseDto[]> {
    const attempts = await this.prisma.richMenuPublishAttempt.findMany({
      where: { templateId },
      include: {
        lineOfficialAccount: {
          include: { store: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return attempts.map((a) => ({
      id: a.id,
      templateId: a.templateId,
      lineOfficialAccountId: a.lineOfficialAccountId,
      lineOfficialAccountName: a.lineOfficialAccount.name,
      storeName: a.lineOfficialAccount.store?.name,
      status: a.status,
      lineRichMenuId: a.lineRichMenuId,
      previousDefaultRichMenuId: a.previousDefaultRichMenuId,
      previousDefaultSource: a.previousDefaultSource,
      errorStage: a.errorStage,
      errorCode: a.errorCode,
      errorMessage: a.errorMessage,
      attemptNumber: a.attemptNumber,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  }

  async getPublishAttempt(attemptId: string): Promise<PublishAttemptResponseDto> {
    const a = await this.prisma.richMenuPublishAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lineOfficialAccount: {
          include: { store: true },
        },
      },
    });

    if (!a) {
      throw new NotFoundException(`Publish attempt '${attemptId}' not found`);
    }

    return {
      id: a.id,
      templateId: a.templateId,
      lineOfficialAccountId: a.lineOfficialAccountId,
      lineOfficialAccountName: a.lineOfficialAccount.name,
      storeName: a.lineOfficialAccount.store?.name,
      status: a.status,
      lineRichMenuId: a.lineRichMenuId,
      previousDefaultRichMenuId: a.previousDefaultRichMenuId,
      previousDefaultSource: a.previousDefaultSource,
      errorStage: a.errorStage,
      errorCode: a.errorCode,
      errorMessage: a.errorMessage,
      attemptNumber: a.attemptNumber,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
