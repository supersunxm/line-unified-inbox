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
import {
  Prisma,
  RichMenuPublishJobStatus,
  RichMenuPublishStatus,
  RichMenuPreviousDefaultSource,
  RichMenuTemplateStatus,
} from "@prisma/client";
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
  buildAutoResponsePostbackData,
  normalizeAutoResponseMessages,
} from "../auto-response/auto-response.utils";
import {
  CreateRichMenuTemplateDto,
  generatePresetAreas,
  LineRichMenuPayload,
  PublishAttemptResponseDto,
  PublishBulkDto,
  PublishCanaryDto,
  PublishCapabilitiesDto,
  PublishJobResponseDto,
  PublishStoreParams,
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
    @Optional()
    @Inject(LineRichMenuClientService)
    private readonly publishAdapter: ILineRichMenuClient = new LineRichMenuClientService(),
    @Optional()
    @Inject(AuditLogService)
    private readonly auditLog?: AuditLogService,
  ) {}

  private resolveTemplateImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    const objectKey = extractMediaObjectKey(imageUrl);
    if (objectKey) {
      return createMediaPublicUrl(objectKey);
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
        name: dto.name !== undefined ? dto.name.trim() : existing.name,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
        canvasPreset: dto.canvasPreset !== undefined ? dto.canvasPreset : existing.canvasPreset,
        width,
        height,
        selected: dto.selected !== undefined ? dto.selected : existing.selected,
        chatBarText: dto.chatBarText !== undefined ? dto.chatBarText.trim() || "Menu" : existing.chatBarText,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : existing.imageUrl,
        areasJson: areas as unknown as Prisma.InputJsonValue,
        status: dto.status !== undefined ? (dto.status as RichMenuTemplateStatus) : existing.status,
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

    return { success: true, id };
  }

  async saveAssignments(templateId: string, dto: SaveAssignmentsDto, user?: AuthUser) {
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    const requestedIds = Array.from(new Set(dto.lineOfficialAccountIds || []));

    const validOas = await this.prisma.lineOfficialAccount.findMany({
      where: {
        id: { in: requestedIds },
        accountType: "STORE",
        archivedAt: null,
      },
      select: { id: true },
    });

    const validIds = validOas.map((oa) => oa.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.richMenuStoreAssignment.deleteMany({
        where: {
          templateId,
          lineOfficialAccountId: { notIn: validIds },
        },
      });

      for (const lineOfficialAccountId of validIds) {
        await tx.richMenuStoreAssignment.upsert({
          where: {
            templateId_lineOfficialAccountId: {
              templateId,
              lineOfficialAccountId,
            },
          },
          create: {
            templateId,
            lineOfficialAccountId,
          },
          update: {},
        });
      }
    });

    return {
      templateId,
      assignedCount: validIds.length,
      assignedLineOfficialAccountIds: validIds,
    };
  }

  async uploadImage(
    file: Express.Multer.File,
    userOrPreset?: AuthUser | string,
    presetParam?: string,
  ): Promise<{ imageUrl: string; width: number; height: number }> {
    const preset = typeof userOrPreset === "string" ? userOrPreset : presetParam;
    if (!file || !file.buffer || !file.buffer.length) {
      throw new BadRequestException("No image file provided");
    }

    if (file.buffer.length > 1 * 1024 * 1024 || (file.size && file.size > 1 * 1024 * 1024)) {
      throw new BadRequestException("ขนาดไฟล์ต้องไม่เกิน 1 MB (Image size must not exceed 1 MB)");
    }

    const detectedFormat = detectImageMagicBytes(file.buffer);
    if (detectedFormat === "unknown") {
      this.logger.warn(`[RichMenuUpload] Signature mismatch: name=${file.originalname} mime=${file.mimetype} size=${file.size}`);
      throw new BadRequestException("Invalid or corrupt image file (รองรับเฉพาะไฟล์ JPG หรือ PNG)");
    }

    let width: number;
    let height: number;

    try {
      const dimensions = imageSize(file.buffer);
      if (!dimensions.width || !dimensions.height) {
        throw new Error("Unable to determine image dimensions");
      }
      width = dimensions.width;
      height = dimensions.height;
    } catch {
      try {
        const meta = await sharp(file.buffer).metadata();
        if (!meta.width || !meta.height) {
          throw new Error("Unable to decode image dimensions");
        }
        width = meta.width;
        height = meta.height;
      } catch (sharpErr: any) {
        this.logger.warn(`[RichMenuUpload] Decoder failed: name=${file.originalname} size=${file.size} err=${sharpErr?.message}`);
        throw new BadRequestException("Invalid or corrupt image file");
      }
    }

    if (width < 800 || width > 2500) {
      throw new BadRequestException(
        `ความกว้างของรูปภาพ (${width} px) ต้องอยู่ระหว่าง 800 ถึง 2500 พิกเซล (Image width must be between 800 and 2500 px)`,
      );
    }

    if (height < 250) {
      throw new BadRequestException(
        `ความสูงของรูปภาพ (${height} px) ต้องมีอย่างน้อย 250 พิกเซล (Image height must be at least 250 px)`,
      );
    }

    const isCompact = preset ? preset.startsWith("COMPACT_") || preset === "GRID_3" : height <= 1000;
    const expectedAspectRatio = isCompact ? 2500 / 843 : 2500 / 1686;
    const actualAspectRatio = width / height;

    if (Math.abs(actualAspectRatio - expectedAspectRatio) > 0.05) {
      const expectedType = isCompact ? "Compact (2500x843 px)" : "Large (2500x1686 px)";
      throw new BadRequestException(
        `รูปภาพไม่ตรงกับสัดส่วนของเทมเพลตที่เลือก (${expectedType}): สัดส่วนจริง ${width}x${height} px`,
      );
    }

    const fileExt = detectedFormat === "png" ? "png" : "jpg";
    const mime = detectedFormat === "png" ? "image/png" : "image/jpeg";
    const fileId = randomUUID();
    const objectKey = `line-media/outbound/rich-menu/${fileId}.${fileExt}`;

    try {
      await this.media.put(objectKey, file.buffer, mime);
    } catch (err: any) {
      this.logger.error(`[RichMenuUpload] Storage put failed: key=${objectKey} err=${err?.message}`);
      throw new ServiceUnavailableException("ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง (Failed to save image to storage. Please try again.)");
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
      throw new BadRequestException("No suitable STORE LINE Official Account available for preview");
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
      } else if (area.actionType === "POSTBACK_AUTO_RESPONSE") {
        const ruleId =
          area.autoResponseRuleId?.trim() ||
          (area.actionData?.startsWith("oppo_ar:v1:")
            ? area.actionData.slice("oppo_ar:v1:".length).trim()
            : area.actionData?.trim());

        const rule = ruleId
          ? await this.prisma.autoResponseRule.findUnique({ where: { id: ruleId } })
          : null;

        if (!rule) {
          isValid = false;
          validationError = "Auto-response rule not found";
          isTemplateBlocked = true;
          blockedReason = "Auto-response rule not found";
        } else if (rule.status !== "ACTIVE") {
          isValid = false;
          validationError = `Auto-response rule '${rule.name}' is ${rule.status.toLowerCase()}`;
          isTemplateBlocked = true;
          blockedReason = `Auto-response rule '${rule.name}' is not active`;
        } else {
          const ruleMessages = normalizeAutoResponseMessages(rule);
          for (const msg of ruleMessages) {
            if (msg.type === "TEXT" && msg.textTemplate) {
              const ruleVars = extractTemplateVariables(msg.textTemplate);
              ruleVars.forEach((v) => usedVariablesSet.add(v));
              const resolvedRuleText = resolveTemplateVariables(msg.textTemplate, storeContext);
              const remainingMatches = resolvedRuleText.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
              if (remainingMatches && remainingMatches.length > 0) {
                isValid = false;
                validationError = `Auto-response contains unresolved variables: ${remainingMatches.join(", ")}`;
                isTemplateBlocked = true;
                blockedReason = validationError;
              }
              const ruleNeedsMaps =
                ruleVars.includes("store.googleMapsUrl") ||
                ruleVars.includes("googleMapsUrl");
              if (ruleNeedsMaps) {
                const mapsReadiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
                if (!mapsReadiness.ready) {
                  isValid = false;
                  validationError = mapsReadiness.reason || "Missing Google Maps URL";
                  isTemplateBlocked = true;
                  blockedReason = mapsReadiness.reason;
                }
              }
            }
          }
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

    const usedVariablesSet = new Set<string>();
    const autoResponseRuleIds: string[] = [];
    for (const area of areas) {
      if (area.actionType === "POSTBACK_AUTO_RESPONSE") {
        const rid =
          area.autoResponseRuleId?.trim() ||
          (area.actionData?.startsWith("oppo_ar:v1:")
            ? area.actionData.slice("oppo_ar:v1:".length).trim()
            : area.actionData?.trim());
        if (rid) autoResponseRuleIds.push(rid);
      } else {
        const vars = extractTemplateVariables(area.actionData);
        vars.forEach((v) => usedVariablesSet.add(v));
      }
    }

    const referencedRules =
      autoResponseRuleIds.length > 0
        ? await this.prisma.autoResponseRule.findMany({
            where: { id: { in: autoResponseRuleIds } },
          })
        : [];
    const ruleMap = new Map(referencedRules.map((r) => [r.id, r]));

    let globalAutoResponseBlockReason: string | null = null;
    for (const rid of autoResponseRuleIds) {
      const rule = ruleMap.get(rid);
      if (!rule) {
        globalAutoResponseBlockReason = "Auto-response rule not found";
        break;
      }
      if (rule.status !== "ACTIVE") {
        globalAutoResponseBlockReason = `Auto-response '${rule.name}' is not active`;
        break;
      }
      const ruleMessages = normalizeAutoResponseMessages(rule);
      for (const msg of ruleMessages) {
        if (msg.type === "TEXT" && msg.textTemplate) {
          const ruleVars = extractTemplateVariables(msg.textTemplate);
          ruleVars.forEach((v) => usedVariablesSet.add(v));
        }
      }
    }

    const usedVariables = Array.from(usedVariablesSet);
    const requiresGoogleMaps =
      usedVariables.includes("store.googleMapsUrl") ||
      usedVariables.includes("googleMapsUrl");

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

      if (globalAutoResponseBlockReason) {
        readinessStatus = "BLOCKED";
        readinessReason = globalAutoResponseBlockReason;
      } else if (requiresGoogleMaps) {
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
      let publishedTemplateVersion: number | null = null;
      let isCurrentVersionPublished = false;

      if (latestAttempt) {
        publishStatus = latestAttempt.status;
        publishedRichMenuId = latestAttempt.lineRichMenuId;
        lastPublishedAt = latestAttempt.status === RichMenuPublishStatus.PUBLISHED ? latestAttempt.completedAt || latestAttempt.updatedAt : null;
        lastPublishError = latestAttempt.errorMessage;
        lastPublishErrorStage = latestAttempt.errorStage;
        publishAttemptId = latestAttempt.id;
        publishedTemplateVersion = latestAttempt.templateVersion;
        isCurrentVersionPublished = latestAttempt.status === RichMenuPublishStatus.PUBLISHED && latestAttempt.templateVersion === template.version;
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
        publishedTemplateVersion,
        isCurrentVersionPublished,
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

  // Unified Per-Store Publish Engine (Used by both Canary and Bulk Worker)
  async publishOneStore(params: PublishStoreParams): Promise<PublishAttemptResponseDto> {
    const { templateId, lineOfficialAccountId, actorUserId, jobId, expectedTemplateVersion } = params;

    // 1. Fetch latest Template
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

    // Template Version Invariance Check
    if (expectedTemplateVersion !== undefined && template.version !== expectedTemplateVersion) {
      return this.recordSkippedAttempt(params, "Template changed after this publishing job was created");
    }

    if (!template.imageUrl) {
      return this.recordSkippedAttempt(params, "Template has no image uploaded");
    }

    const areas = (template.areasJson as unknown as RichMenuArea[]) || [];
    const areaValidation = validateRichMenuAreas(areas, template.width, template.height);
    if (!areaValidation.valid) {
      return this.recordSkippedAttempt(params, `Invalid area layout: ${areaValidation.errors.join("; ")}`);
    }

    // 2. Fetch LINE Official Account & Store
    const targetOa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: lineOfficialAccountId },
      include: {
        store: {
          include: { storeMaster: true },
        },
      },
    });

    if (!targetOa) {
      return this.recordSkippedAttempt(params, "Target store LINE Official Account not found");
    }

    if (targetOa.accountType === "HEAD_OFFICE") {
      return this.recordSkippedAttempt(params, "Cannot publish rich menu to Head Office account. Only STORE accounts are supported.");
    }

    if (!targetOa.isActive || targetOa.archivedAt) {
      return this.recordSkippedAttempt(params, "Target LINE OA is disabled or archived");
    }

    if (!targetOa.encryptedChannelAccessToken) {
      return this.recordSkippedAttempt(params, "Target LINE OA has no channel access token configured");
    }

    if (!targetOa.store) {
      return this.recordSkippedAttempt(params, "Target LINE OA is not linked to a store");
    }

    let assignment = template.assignments?.[0];
    if (!assignment) {
      assignment = await this.prisma.richMenuStoreAssignment.upsert({
        where: {
          templateId_lineOfficialAccountId: { templateId, lineOfficialAccountId },
        },
        create: {
          templateId,
          lineOfficialAccountId,
        },
        update: {},
      });
    }

    // 3. Live Dynamic Store Master Variable Resolution
    const storeMaster = targetOa.store.storeMaster;
    const storeContext: StoreVariableContext = {
      storeName: targetOa.store.name,
      externalStoreId: storeMaster?.externalStoreId ?? null,
      accountName: targetOa.name,
      googleMapsUrl: storeMaster?.googleMapsUrl ?? null,
    };

    const resolvedAreas: Array<{
      bounds: { x: number; y: number; width: number; height: number };
      actionType: "URI" | "MESSAGE" | "POSTBACK_AUTO_RESPONSE";
      rawActionData: string;
      resolvedActionData: string;
      label?: string;
    }> = [];

    for (const area of areas) {
      if (area.actionType === "POSTBACK_AUTO_RESPONSE") {
        const ruleId =
          area.autoResponseRuleId?.trim() ||
          (area.actionData?.startsWith("oppo_ar:v1:")
            ? area.actionData.slice("oppo_ar:v1:".length).trim()
            : area.actionData?.trim());

        if (!ruleId) {
          return this.recordSkippedAttempt(params, "Cannot publish: Area is missing Auto-response rule selection");
        }

        const rule = await this.prisma.autoResponseRule.findUnique({
          where: { id: ruleId },
        });

        if (!rule) {
          return this.recordSkippedAttempt(params, `Cannot publish: Auto-response rule '${ruleId}' was not found`);
        }

        if (rule.status !== "ACTIVE") {
          return this.recordSkippedAttempt(params, `Cannot publish: Auto-response rule '${rule.name}' is not active (${rule.status.toLowerCase()})`);
        }

        const ruleMessages = normalizeAutoResponseMessages(rule);
        for (const msg of ruleMessages) {
          if (msg.type === "TEXT" && msg.textTemplate) {
            const ruleVars = extractTemplateVariables(msg.textTemplate);
            const resolvedRuleText = resolveTemplateVariables(msg.textTemplate, storeContext);
            const remainingMatches = resolvedRuleText.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
            if (remainingMatches && remainingMatches.length > 0) {
              return this.recordSkippedAttempt(params, `Cannot publish: Auto-response rule '${rule.name}' contains unresolved variables: ${remainingMatches.join(", ")}`);
            }

            const ruleNeedsMaps =
              ruleVars.includes("store.googleMapsUrl") ||
              ruleVars.includes("googleMapsUrl");

            if (ruleNeedsMaps) {
              if (!storeMaster?.googleMapsUrl || !isValidGoogleMapsUrl(storeMaster.googleMapsUrl)) {
                return this.recordSkippedAttempt(params, `Cannot publish: Store '${targetOa.store?.name}' is missing a valid Google Maps URL required by Auto-response '${rule.name}'`);
              }
            }
          }
        }

        resolvedAreas.push({
          bounds: area.bounds,
          actionType: "POSTBACK_AUTO_RESPONSE",
          rawActionData: area.actionData,
          resolvedActionData: buildAutoResponsePostbackData(rule.id),
          label: area.label?.trim() || undefined,
        });
        continue;
      }

      const resolved = resolveTemplateVariables(area.actionData, storeContext);
      if (area.actionType === "URI") {
        const containsMapsVar = area.actionData.includes("{{store.googleMapsUrl}}") || area.actionData.includes("{{googleMapsUrl}}");
        if (containsMapsVar) {
          if (!storeMaster?.googleMapsUrl) {
            return this.recordSkippedAttempt(params, "Cannot publish: Store Master is missing Google Maps URL");
          }
          if (!isValidGoogleMapsUrl(storeMaster.googleMapsUrl)) {
            return this.recordSkippedAttempt(params, "Cannot publish: Store Master has invalid Google Maps URL");
          }
        } else if (!/^https?:\/\//i.test(resolved)) {
          return this.recordSkippedAttempt(params, `Cannot publish: invalid URI schema '${resolved}' (must start with https:// or http://)`);
        }
      } else if (area.actionType === "MESSAGE") {
        if (!resolved.trim()) {
          return this.recordSkippedAttempt(params, "Cannot publish: message action text resolved to empty");
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

    // 4. Construct LINE Rich Menu Payload
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
            : a.actionType === "POSTBACK_AUTO_RESPONSE"
            ? {
                type: "postback",
                label: a.label?.slice(0, 20),
                data: a.resolvedActionData,
              }
            : {
                type: "message",
                label: a.label?.slice(0, 20),
                text: a.resolvedActionData,
              },
      })),
    };

    // 5. Retrieve Stored Image Bytes
    const objectKey = extractMediaObjectKey(template.imageUrl);
    if (!objectKey) {
      return this.recordSkippedAttempt(params, "Invalid template image URL or object key");
    }

    let imageBuffer: Buffer;
    let mimeType: string;
    try {
      const stored = await this.media.get(objectKey);
      imageBuffer = stored.body;
      mimeType = stored.contentType || (objectKey.endsWith(".jpg") || objectKey.endsWith(".jpeg") ? "image/jpeg" : "image/png");
    } catch (err: any) {
      return this.recordSkippedAttempt(params, `Failed to retrieve template image from storage: ${err?.message || "unknown"}`);
    }

    // 6. Decrypt OA channel access token
    let token: string;
    try {
      token = this.encryption.decrypt(targetOa.encryptedChannelAccessToken);
    } catch {
      return this.recordSkippedAttempt(params, "Failed to decrypt LINE OA credentials");
    }

    // 7. Get or Create Attempt record
    let attemptRecord = params.attemptId
      ? await this.prisma.richMenuPublishAttempt.findUnique({ where: { id: params.attemptId } })
      : null;

    if (!attemptRecord) {
      const totalAttempts = await this.prisma.richMenuPublishAttempt.count({
        where: { templateId, lineOfficialAccountId },
      });

      attemptRecord = await this.prisma.richMenuPublishAttempt.create({
        data: {
          jobId: jobId || null,
          templateId,
          templateVersion: template.version,
          lineOfficialAccountId,
          assignmentId: assignment.id,
          status: RichMenuPublishStatus.VALIDATING,
          resolvedConfigJson: linePayload as unknown as Prisma.InputJsonValue,
          attemptNumber: totalAttempts + 1,
          createdByUserId: actorUserId || null,
        },
      });
    } else {
      attemptRecord = await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptRecord.id },
        data: {
          status: RichMenuPublishStatus.VALIDATING,
          resolvedConfigJson: linePayload as unknown as Prisma.InputJsonValue,
          templateVersion: template.version,
        },
      });
    }

    if (this.auditLog && actorUserId) {
      await this.auditLog.record({
        actorUserId,
        action: "RICH_MENU_PUBLISH_STARTED",
        metadata: {
          jobId: jobId || null,
          templateId,
          templateName: template.name,
          templateVersion: template.version,
          lineOfficialAccountId,
          storeName: targetOa.store.name,
          attemptId: attemptRecord.id,
        },
      });
    }

    // 8. Execute LINE Publishing Stages
    let lineRichMenuId: string | null = null;

    try {
      // Stage A: Validate Rich Menu Structure on LINE
      const validation = await this.publishAdapter.validateRichMenu(token, linePayload);
      if (!validation.valid) {
        throw new BadRequestException(`LINE validation failed: ${validation.message || "Invalid rich menu structure"}`);
      }

      // Stage B: Detect Previous Default on LINE
      let prevDefault: { richMenuId: string | null; source: "MESSAGING_API" | "OTHER_OR_MANAGER" | "NONE" };
      try {
        prevDefault = await this.publishAdapter.getDefaultRichMenu(token);
      } catch {
        prevDefault = { richMenuId: null, source: "NONE" };
      }

      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptRecord.id },
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
        where: { id: attemptRecord.id },
        data: {
          status: RichMenuPublishStatus.IMAGE_UPLOADING,
          lineRichMenuId,
        },
      });

      // Stage D: Upload Image Content to LINE
      try {
        await this.publishAdapter.uploadRichMenuImage(token, lineRichMenuId, imageBuffer, mimeType);
      } catch (imgErr: any) {
        if (lineRichMenuId) {
          try {
            await this.publishAdapter.deleteRichMenu(token, lineRichMenuId);
          } catch {
            /* ignore cleanup error */
          }
        }
        await this.prisma.richMenuPublishAttempt.update({
          where: { id: attemptRecord.id },
          data: {
            status: RichMenuPublishStatus.FAILED,
            errorStage: "IMAGE_UPLOADING",
            errorMessage: imgErr?.message || "Failed to upload image content to LINE",
          },
        });
        if (this.auditLog && actorUserId) {
          await this.auditLog.record({
            actorUserId,
            action: "RICH_MENU_PUBLISH_FAILED",
            metadata: {
              jobId: jobId || null,
              templateId,
              lineOfficialAccountId,
              attemptId: attemptRecord.id,
              errorStage: "IMAGE_UPLOADING",
              errorMessage: imgErr?.message || "Image upload failed",
            },
          });
        }
        throw imgErr;
      }

      // Stage E: Set Default Rich Menu
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptRecord.id },
        data: { status: RichMenuPublishStatus.SETTING_DEFAULT },
      });

      try {
        await this.publishAdapter.setDefaultRichMenu(token, lineRichMenuId);
      } catch (setErr: any) {
        await this.prisma.richMenuPublishAttempt.update({
          where: { id: attemptRecord.id },
          data: {
            status: RichMenuPublishStatus.FAILED,
            errorStage: "SETTING_DEFAULT",
            errorMessage: setErr?.message || "Failed to set default rich menu on LINE",
          },
        });
        if (this.auditLog && actorUserId) {
          await this.auditLog.record({
            actorUserId,
            action: "RICH_MENU_PUBLISH_FAILED",
            metadata: {
              jobId: jobId || null,
              templateId,
              lineOfficialAccountId,
              attemptId: attemptRecord.id,
              errorStage: "SETTING_DEFAULT",
              errorMessage: setErr?.message || "Set default failed",
            },
          });
        }
        throw setErr;
      }

      // Stage F: Verify Active Default
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptRecord.id },
        data: { status: RichMenuPublishStatus.VERIFYING },
      });

      const verifyDefault = await this.publishAdapter.getDefaultRichMenu(token);
      if (verifyDefault.richMenuId !== lineRichMenuId) {
        throw new BadGatewayException(
          `Verification failed: expected default rich menu '${lineRichMenuId}', but LINE returned '${verifyDefault.richMenuId}'`,
        );
      }

      // Stage G: Terminal Success
      const finalAttempt = await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptRecord.id },
        data: {
          status: RichMenuPublishStatus.PUBLISHED,
          completedAt: new Date(),
          errorStage: null,
          errorMessage: null,
          errorCode: null,
        },
      });

      if (this.auditLog && actorUserId) {
        await this.auditLog.record({
          actorUserId,
          action: "RICH_MENU_PUBLISHED",
          metadata: {
            jobId: jobId || null,
            templateId,
            templateName: template.name,
            templateVersion: template.version,
            lineOfficialAccountId,
            storeName: targetOa.store.name,
            lineRichMenuId,
            attemptId: finalAttempt.id,
          },
        });
      }

      return this.formatAttemptResponse(finalAttempt, targetOa.name, targetOa.store.name);
    } catch (err: any) {
      const errorMsg = err?.message || "Publish failed";
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptRecord.id },
        data: {
          status: RichMenuPublishStatus.FAILED,
          errorMessage: errorMsg,
          completedAt: new Date(),
        },
      });

      if (this.auditLog && actorUserId) {
        await this.auditLog.record({
          actorUserId,
          action: "RICH_MENU_PUBLISH_FAILED",
          metadata: {
            jobId: jobId || null,
            templateId,
            lineOfficialAccountId,
            attemptId: attemptRecord.id,
            errorMessage: errorMsg,
          },
        });
      }

      throw err;
    }
  }

  private async recordSkippedAttempt(params: PublishStoreParams, reason: string): Promise<PublishAttemptResponseDto> {
    const { templateId, lineOfficialAccountId, actorUserId, jobId, attemptId, expectedTemplateVersion } = params;

    let attempt: any;
    if (attemptId) {
      attempt = await this.prisma.richMenuPublishAttempt.update({
        where: { id: attemptId },
        data: {
          status: RichMenuPublishStatus.SKIPPED,
          errorMessage: reason,
          completedAt: new Date(),
        },
      });
    } else {
      const totalAttempts = await this.prisma.richMenuPublishAttempt.count({
        where: { templateId, lineOfficialAccountId },
      });
      attempt = await this.prisma.richMenuPublishAttempt.create({
        data: {
          jobId: jobId || null,
          templateId,
          templateVersion: expectedTemplateVersion || 1,
          lineOfficialAccountId,
          status: RichMenuPublishStatus.SKIPPED,
          errorMessage: reason,
          attemptNumber: totalAttempts + 1,
          createdByUserId: actorUserId || null,
          completedAt: new Date(),
        },
      });
    }

    return this.formatAttemptResponse(attempt);
  }

  // Phase 2A Single-Store Canary (reusing publishOneStore)
  async publishCanary(templateId: string, dto: PublishCanaryDto, user: AuthUser): Promise<PublishAttemptResponseDto> {
    const { lineOfficialAccountId } = dto;
    if (!lineOfficialAccountId) {
      throw new BadRequestException("lineOfficialAccountId is required");
    }

    // Idempotency check for active canary attempts
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

    return this.publishOneStore({
      templateId,
      lineOfficialAccountId,
      actorUserId: user.id,
    });
  }

  // Phase 2B Bulk Job Creation
  async createBulkPublishJob(templateId: string, dto: PublishBulkDto, user: AuthUser): Promise<PublishJobResponseDto> {
    const maxTargets = parseInt(
      process.env.RICH_MENU_MAX_BULK_TARGETS || process.env.RICH_MENU_BULK_MAX_TARGETS || "5",
      10,
    );
    const rawIds = dto.lineOfficialAccountIds || [];
    const requestedIds = Array.from(new Set(rawIds.map((id) => id?.trim()).filter(Boolean)));

    if (requestedIds.length === 0) {
      throw new BadRequestException("At least one store must be selected for bulk publishing");
    }

    if (requestedIds.length > maxTargets) {
      throw new BadRequestException(
        `ขณะนี้สามารถเผยแพร่ได้สูงสุด ${maxTargets} ร้านต่อครั้ง (Bulk publishing currently supports up to ${maxTargets} stores per job)`,
      );
    }

    // Verify Template
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
      include: {
        assignments: true,
      },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    if (!template.imageUrl) {
      throw new BadRequestException("Cannot publish: template has no image uploaded");
    }

    // Extract template variable requirements
    const areas = (template.areasJson as unknown as RichMenuArea[]) || [];
    const usedVarsSet = new Set<string>();
    for (const area of areas) {
      const vars = extractTemplateVariables(area.actionData);
      vars.forEach((v) => usedVarsSet.add(v));
    }
    const requiresGoogleMaps = usedVarsSet.has("store.googleMapsUrl") || usedVarsSet.has("googleMapsUrl");

    // Verify OAs are active STORE accounts and satisfy template readiness
    const storeOas = await this.prisma.lineOfficialAccount.findMany({
      where: {
        id: { in: requestedIds },
      },
      include: {
        store: { include: { storeMaster: true } },
      },
    });

    const foundMap = new Map(storeOas.map((oa) => [oa.id, oa]));

    for (const oaId of requestedIds) {
      const oa = foundMap.get(oaId);
      if (!oa) {
        throw new BadRequestException(`Store OA '${oaId}' not found`);
      }
      if (oa.accountType === "HEAD_OFFICE") {
        throw new BadRequestException(`Cannot publish to Head Office account '${oa.name}'`);
      }
      if (!oa.isActive || oa.archivedAt) {
        throw new BadRequestException(`Store OA '${oa.name}' is inactive or archived`);
      }
      if (!oa.encryptedChannelAccessToken) {
        throw new BadRequestException(`Store OA '${oa.name}' has no channel access token`);
      }
      if (!oa.store) {
        throw new BadRequestException(`Store OA '${oa.name}' is not linked to a store`);
      }

      if (requiresGoogleMaps) {
        const mapsUrl = oa.store.storeMaster?.googleMapsUrl;
        const mapsReadiness = getStoreGoogleMapsReadiness(mapsUrl);
        if (mapsReadiness.status === "MISSING") {
          throw new BadRequestException(
            `ร้านค้า '${oa.store.name}' ยังไม่พร้อมใช้งาน: ไม่มีลิงก์ Google Maps ใน Store Master (Store is missing Google Maps URL)`,
          );
        }
        if (mapsReadiness.status === "INVALID") {
          throw new BadRequestException(
            `ร้านค้า '${oa.store.name}' ยังไม่พร้อมใช้งาน: ลิงก์ Google Maps ไม่ถูกต้อง (Invalid Google Maps URL)`,
          );
        }
      }
    }

    // Create Bulk Job + N Attempts in a single DB transaction with automatic assignment upsert
    const job = await this.prisma.$transaction(async (tx) => {
      const createdJob = await tx.richMenuPublishJob.create({
        data: {
          templateId,
          templateVersion: template.version,
          status: RichMenuPublishJobStatus.QUEUED,
          totalCount: requestedIds.length,
          pendingCount: requestedIds.length,
          createdByUserId: user.id,
        },
      });

      for (const oaId of requestedIds) {
        const assignment = await tx.richMenuStoreAssignment.upsert({
          where: {
            templateId_lineOfficialAccountId: {
              templateId,
              lineOfficialAccountId: oaId,
            },
          },
          create: {
            templateId,
            lineOfficialAccountId: oaId,
          },
          update: {},
        });

        await tx.richMenuPublishAttempt.create({
          data: {
            jobId: createdJob.id,
            templateId,
            templateVersion: template.version,
            lineOfficialAccountId: oaId,
            assignmentId: assignment.id,
            status: RichMenuPublishStatus.PENDING,
            createdByUserId: user.id,
          },
        });
      }

      return createdJob;
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "RICH_MENU_BULK_JOB_CREATED",
        metadata: {
          jobId: job.id,
          templateId,
          templateVersion: template.version,
          totalCount: requestedIds.length,
          targetOaIds: requestedIds,
        },
      });
    }

    return this.getPublishJob(job.id);
  }

  // Phase 2B Job Cancellation
  async cancelPublishJob(jobId: string, user: AuthUser): Promise<PublishJobResponseDto> {
    const job = await this.prisma.richMenuPublishJob.findUnique({
      where: { id: jobId },
      include: { attempts: true },
    });

    if (!job) {
      throw new NotFoundException(`Publish job with ID '${jobId}' not found`);
    }

    if (
      job.status === RichMenuPublishJobStatus.COMPLETED ||
      job.status === RichMenuPublishJobStatus.COMPLETED_WITH_ERRORS ||
      job.status === RichMenuPublishJobStatus.CANCELLED ||
      job.status === RichMenuPublishJobStatus.FAILED
    ) {
      throw new BadRequestException(`Cannot cancel job in terminal status '${job.status}'`);
    }

    // Cancel all remaining PENDING attempts
    await this.prisma.richMenuPublishAttempt.updateMany({
      where: {
        jobId,
        status: RichMenuPublishStatus.PENDING,
      },
      data: {
        status: RichMenuPublishStatus.CANCELLED,
        errorMessage: "Job was cancelled by administrator",
      },
    });

    // Check if in-flight attempts exist
    const inFlightCount = await this.prisma.richMenuPublishAttempt.count({
      where: {
        jobId,
        status: {
          in: [
            RichMenuPublishStatus.VALIDATING,
            RichMenuPublishStatus.CREATING,
            RichMenuPublishStatus.IMAGE_UPLOADING,
            RichMenuPublishStatus.SETTING_DEFAULT,
            RichMenuPublishStatus.VERIFYING,
            RichMenuPublishStatus.ROLLING_BACK,
          ],
        },
      },
    });

    const finalJobStatus = inFlightCount === 0 ? RichMenuPublishJobStatus.CANCELLED : RichMenuPublishJobStatus.CANCELLING;

    await this.prisma.richMenuPublishJob.update({
      where: { id: jobId },
      data: {
        status: finalJobStatus,
        cancelRequestedAt: new Date(),
        completedAt: inFlightCount === 0 ? new Date() : null,
      },
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "RICH_MENU_BULK_JOB_CANCELLED",
        metadata: {
          jobId,
          templateId: job.templateId,
        },
      });
    }

    return this.getPublishJob(jobId);
  }

  // Phase 2B Retry Failed Attempts Only
  async retryFailedJobAttempts(jobId: string, user: AuthUser): Promise<PublishJobResponseDto> {
    const job = await this.prisma.richMenuPublishJob.findUnique({
      where: { id: jobId },
      include: { attempts: true },
    });

    if (!job) {
      throw new NotFoundException(`Publish job with ID '${jobId}' not found`);
    }

    const failedAttempts = job.attempts.filter(
      (a) => a.status === RichMenuPublishStatus.FAILED || a.status === RichMenuPublishStatus.SKIPPED,
    );

    if (failedAttempts.length === 0) {
      throw new BadRequestException("No failed or skipped attempts found to retry in this job");
    }

    const failedOaIds = failedAttempts.map((a) => a.lineOfficialAccountId);
    const newJobDto: PublishBulkDto = {
      lineOfficialAccountIds: failedOaIds,
    };

    const newJob = await this.createBulkPublishJob(job.templateId, newJobDto, user);

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "RICH_MENU_BULK_RETRY_CREATED",
        metadata: {
          originalJobId: jobId,
          newJobId: newJob.id,
          templateId: job.templateId,
          retriedCount: failedOaIds.length,
        },
      });
    }

    return newJob;
  }

  async listPublishJobs(templateId: string): Promise<PublishJobResponseDto[]> {
    const jobs = await this.prisma.richMenuPublishJob.findMany({
      where: { templateId },
      orderBy: { createdAt: "desc" },
      include: {
        attempts: {
          include: {
            lineOfficialAccount: {
              include: { store: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return jobs.map((j) => this.formatJobResponse(j));
  }

  async getPublishJob(jobId: string): Promise<PublishJobResponseDto> {
    const job = await this.prisma.richMenuPublishJob.findUnique({
      where: { id: jobId },
      include: {
        attempts: {
          include: {
            lineOfficialAccount: {
              include: { store: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Publish job with ID '${jobId}' not found`);
    }

    return this.formatJobResponse(job);
  }

  async getPublishCapabilities(): Promise<PublishCapabilitiesDto> {
    const maxTargets = parseInt(
      process.env.RICH_MENU_MAX_BULK_TARGETS || process.env.RICH_MENU_BULK_MAX_TARGETS || "5",
      10,
    );
    const concurrency = Math.min(
      parseInt(
        process.env.RICH_MENU_PUBLISH_CONCURRENCY || process.env.RICH_MENU_BULK_CONCURRENCY || "2",
        10,
      ),
      5,
    );

    const heartbeat = await this.prisma.richMenuWorkerHeartbeat.findUnique({
      where: { id: "singleton" },
    });

    let workerReady = false;
    let lastWorkerHeartbeatAt: string | null = null;

    if (heartbeat) {
      lastWorkerHeartbeatAt = heartbeat.lastHeartbeatAt.toISOString();
      const ageMs = Date.now() - new Date(heartbeat.lastHeartbeatAt).getTime();
      // Worker is ready if heartbeat recorded within last 60s
      workerReady = ageMs < 60_000;
    }

    return {
      bulkEnabled: true,
      maxTargets,
      concurrency,
      workerReady,
      lastWorkerHeartbeatAt,
    };
  }

  // Rollback Publish Attempt
  async rollbackPublish(attemptId: string, user: AuthUser): Promise<PublishAttemptResponseDto> {
    const attempt = await this.prisma.richMenuPublishAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lineOfficialAccount: {
          include: { store: true },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Publish attempt with ID '${attemptId}' not found`);
    }

    if (attempt.status !== RichMenuPublishStatus.PUBLISHED) {
      throw new BadRequestException(`Cannot rollback attempt with status '${attempt.status}'. Only PUBLISHED attempts can be rolled back.`);
    }

    const oa = attempt.lineOfficialAccount;
    if (!oa || !oa.encryptedChannelAccessToken) {
      throw new BadRequestException("Target LINE OA credentials not found");
    }

    let token: string;
    try {
      token = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    } catch {
      throw new BadRequestException("Failed to decrypt LINE OA credentials for rollback");
    }

    await this.prisma.richMenuPublishAttempt.update({
      where: { id: attempt.id },
      data: { status: RichMenuPublishStatus.ROLLING_BACK },
    });

    try {
      if (attempt.previousDefaultRichMenuId) {
        await this.publishAdapter.setDefaultRichMenu(token, attempt.previousDefaultRichMenuId);
      } else {
        await this.publishAdapter.clearDefaultRichMenu(token);
      }

      if (attempt.lineRichMenuId) {
        try {
          await this.publishAdapter.deleteRichMenu(token, attempt.lineRichMenuId);
        } catch {
          /* ignore deletion error */
        }
      }

      const rolledBack = await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RichMenuPublishStatus.ROLLED_BACK,
          completedAt: new Date(),
          errorMessage: null,
          errorCode: null,
          errorStage: null,
        },
      });

      if (this.auditLog) {
        await this.auditLog.record({
          actorUserId: user.id,
          action: "RICH_MENU_ROLLED_BACK",
          metadata: {
            attemptId: attempt.id,
            templateId: attempt.templateId,
            lineOfficialAccountId: attempt.lineOfficialAccountId,
            storeName: oa.store?.name,
            previousDefaultRichMenuId: attempt.previousDefaultRichMenuId,
            restoredSource: attempt.previousDefaultSource,
          },
        });
      }

      return this.formatAttemptResponse(rolledBack, oa.name, oa.store?.name);
    } catch (err: any) {
      await this.prisma.richMenuPublishAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RichMenuPublishStatus.FAILED,
          errorStage: "ROLLING_BACK",
          errorMessage: err?.message || "Failed to restore previous default rich menu",
        },
      });
      throw err;
    }
  }

  // Retry Failed Individual Attempt
  async retryPublish(attemptId: string, user: AuthUser): Promise<PublishAttemptResponseDto> {
    const attempt = await this.prisma.richMenuPublishAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new NotFoundException(`Publish attempt with ID '${attemptId}' not found`);
    }

    if (attempt.status !== RichMenuPublishStatus.FAILED && attempt.status !== RichMenuPublishStatus.SKIPPED) {
      throw new BadRequestException(`Cannot retry attempt with status '${attempt.status}'. Only FAILED or SKIPPED attempts can be retried.`);
    }

    return this.publishOneStore({
      templateId: attempt.templateId,
      lineOfficialAccountId: attempt.lineOfficialAccountId,
      actorUserId: user.id,
      attemptId: attempt.id,
      jobId: attempt.jobId || undefined,
    });
  }

  async getPublishAttempts(templateId: string): Promise<PublishAttemptResponseDto[]> {
    const attempts = await this.prisma.richMenuPublishAttempt.findMany({
      where: { templateId },
      orderBy: { createdAt: "desc" },
      include: {
        lineOfficialAccount: {
          include: { store: true },
        },
      },
    });

    return attempts.map((a) => this.formatAttemptResponse(a, a.lineOfficialAccount.name, a.lineOfficialAccount.store?.name));
  }

  async getPublishAttempt(attemptId: string): Promise<PublishAttemptResponseDto> {
    const attempt = await this.prisma.richMenuPublishAttempt.findUnique({
      where: { id: attemptId },
      include: {
        lineOfficialAccount: {
          include: { store: true },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`Publish attempt with ID '${attemptId}' not found`);
    }

    return this.formatAttemptResponse(attempt, attempt.lineOfficialAccount.name, attempt.lineOfficialAccount.store?.name);
  }

  private formatAttemptResponse(attempt: any, lineOfficialAccountName?: string, storeName?: string): PublishAttemptResponseDto {
    return {
      id: attempt.id,
      jobId: attempt.jobId ?? null,
      templateId: attempt.templateId,
      templateVersion: attempt.templateVersion ?? 1,
      lineOfficialAccountId: attempt.lineOfficialAccountId,
      lineOfficialAccountName,
      storeName,
      status: attempt.status,
      lineRichMenuId: attempt.lineRichMenuId,
      previousDefaultRichMenuId: attempt.previousDefaultRichMenuId,
      previousDefaultSource: attempt.previousDefaultSource,
      errorStage: attempt.errorStage,
      errorCode: attempt.errorCode,
      errorMessage: attempt.errorMessage,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  private formatJobResponse(job: any): PublishJobResponseDto {
    return {
      id: job.id,
      templateId: job.templateId,
      templateVersion: job.templateVersion ?? 1,
      status: job.status,
      totalCount: job.totalCount,
      pendingCount: job.pendingCount,
      processingCount: job.processingCount,
      publishedCount: job.publishedCount,
      failedCount: job.failedCount,
      skippedCount: job.skippedCount,
      cancelledCount: job.cancelledCount,
      createdByUserId: job.createdByUserId,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelRequestedAt: job.cancelRequestedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      attempts: job.attempts?.map((a: any) =>
        this.formatAttemptResponse(a, a.lineOfficialAccount?.name, a.lineOfficialAccount?.store?.name),
      ),
    };
  }
}
