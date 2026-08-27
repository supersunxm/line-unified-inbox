import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, RichMenuTemplateStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "../media/media-storage";
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

export interface IRichMenuPublishService {
  createRichMenu(lineOaId: string, templateId: string): Promise<{ richMenuId: string }>;
  uploadRichMenuImage(lineOaId: string, richMenuId: string, imageBuffer: Buffer, contentType: string): Promise<void>;
  setDefaultRichMenu(lineOaId: string, richMenuId: string): Promise<void>;
  deleteRichMenu(lineOaId: string, richMenuId: string): Promise<void>;
}

@Injectable()
export class RichMenuPublishNoopAdapter implements IRichMenuPublishService {
  async createRichMenu(): Promise<{ richMenuId: string }> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async uploadRichMenuImage(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async setDefaultRichMenu(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
  async deleteRichMenu(): Promise<void> {
    throw new BadRequestException("Rich Menu publishing is disabled in Phase 1. Publishing will be available in Phase 2.");
  }
}

@Injectable()
export class RichMenuService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(MediaStorageService) private readonly media?: MediaStorageService,
  ) {}

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
      chatBarText: t.chatBarText,
      imageUrl: t.imageUrl,
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
      chatBarText: template.chatBarText,
      imageUrl: template.imageUrl,
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

    return { deleted: true, id };
  }

  async saveAssignments(templateId: string, dto: SaveAssignmentsDto) {
    const template = await this.prisma.richMenuTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Rich Menu template with ID '${templateId}' not found`);
    }

    const targetOaIds = [...new Set(dto.lineOfficialAccountIds || [])];

    // Filter to only existing store OAs
    const validOas = await this.prisma.lineOfficialAccount.findMany({
      where: {
        id: { in: targetOaIds },
        accountType: "STORE",
        archivedAt: null,
      },
      select: { id: true },
    });

    const validOaIdSet = new Set(validOas.map((oa) => oa.id));

    await this.prisma.$transaction(async (tx) => {
      // Clear existing assignments for this template
      await tx.richMenuStoreAssignment.deleteMany({
        where: { templateId },
      });

      if (validOaIdSet.size > 0) {
        await tx.richMenuStoreAssignment.createMany({
          data: Array.from(validOaIdSet).map((lineOfficialAccountId) => ({
            templateId,
            lineOfficialAccountId,
          })),
        });
      }
    });

    return {
      templateId,
      assignedCount: validOaIdSet.size,
      lineOfficialAccountIds: Array.from(validOaIdSet),
    };
  }

  async uploadImage(
    file: { buffer: Buffer; mimetype?: string; size?: number },
    user: AuthUser,
  ): Promise<{ imageUrl: string; width: number; height: number }> {
    if (!file?.buffer || !file.buffer.length) {
      throw new BadRequestException("Image file is required and cannot be empty");
    }

    if (file.buffer.length > 1 * 1024 * 1024) {
      throw new BadRequestException("Rich Menu image exceeds the 1 MB limit (LINE Messaging API requirement).");
    }

    let metadata: { format?: string; width?: number; height?: number };
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch {
      throw new BadRequestException("Invalid or corrupt image file");
    }

    if (metadata.format !== "jpeg" && metadata.format !== "png") {
      throw new BadRequestException("Unsupported image format. Allowed formats: JPEG, PNG.");
    }

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width < 800 || width > 2500) {
      throw new BadRequestException(`Rich Menu image width must be between 800 and 2500 pixels (uploaded: ${width}px).`);
    }
    if (height < 250) {
      throw new BadRequestException(`Rich Menu image height must be at least 250 pixels (uploaded: ${height}px).`);
    }

    const aspectRatio = width / height;
    if (aspectRatio < 1.45) {
      throw new BadRequestException(`Rich Menu image aspect ratio (width/height) must be at least 1.45 (uploaded: ${aspectRatio.toFixed(2)}).`);
    }

    if (!this.media) {
      throw new ServiceUnavailableException("Media storage is unavailable");
    }

    const ext = metadata.format === "jpeg" ? "jpg" : "png";
    const mime = metadata.format === "jpeg" ? "image/jpeg" : "image/png";
    const fileId = randomUUID();
    const objectKey = `line-media/outbound/rich-menu/${fileId}.${ext}`;

    await this.media.put(objectKey, file.buffer, mime);

    const publicBase = process.env.PUBLIC_WEBHOOK_BASE_URL?.replace(/\/+$/, "") || "";
    const imageUrl = `${publicBase}/api/media/${objectKey}`;

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
        where: { id: input.lineOfficialAccountId, accountType: "STORE" },
        include: { store: { include: { storeMaster: true } } },
      });
    } else if (input?.storeId) {
      targetOa = await this.prisma.lineOfficialAccount.findFirst({
        where: {
          storeId: input.storeId,
          accountType: "STORE",
          archivedAt: null,
        },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    // Default to first active connected store OA
    if (!targetOa) {
      targetOa = await this.prisma.lineOfficialAccount.findFirst({
        where: { accountType: "STORE", archivedAt: null },
        orderBy: { name: "asc" },
        include: { store: { include: { storeMaster: true } } },
      });
    }

    if (!targetOa || !targetOa.store) {
      throw new NotFoundException("No active store LINE Official Account available for preview");
    }

    const storeContext: StoreVariableContext = {
      id: targetOa.store.id,
      name: targetOa.store.name,
      storeName: targetOa.store.name,
      code: targetOa.store.code,
      storeId: targetOa.store.storeMaster?.externalStoreId ?? null,
      externalStoreId: targetOa.store.storeMaster?.externalStoreId ?? null,
      accountName: targetOa.store.storeMaster?.accountName ?? null,
      province: targetOa.store.storeMaster?.province ?? targetOa.store.area ?? null,
      region: targetOa.store.region ?? null,
      lineId: targetOa.store.storeMaster?.lineId ?? null,
      lineOaLink: targetOa.store.storeMaster?.lineOaLink ?? null,
      lineManagerUrl: targetOa.store.storeMaster?.lineManagerUrl ?? null,
      tiktokUsername: targetOa.store.storeMaster?.tiktokUsername ?? null,
      tiktokProfileUrl: targetOa.store.storeMaster?.tiktokProfileUrl ?? null,
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
        if (!resolved) {
          isValid = false;
          validationError = "URL resolved to empty string";
        } else if (vars.includes("store.googleMapsUrl") || vars.includes("googleMapsUrl")) {
          const mapsReadiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
          if (mapsReadiness.status !== "CONFIGURED") {
            isValid = false;
            validationError = mapsReadiness.reason || "Invalid Google Maps URL";
            isTemplateBlocked = true;
            blockedReason = validationError;
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
        imageUrl: template.imageUrl,
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

    // Fetch all active connected STORE LINE OAs
    const storeOas = await this.prisma.lineOfficialAccount.findMany({
      where: {
        accountType: "STORE",
        archivedAt: null,
      },
      include: {
        store: {
          include: { storeMaster: true },
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
}
