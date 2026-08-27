import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AutoResponseContentType,
  AutoResponseStatus,
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
} from "../store-master/template-variable-resolver";
import {
  AutoResponseMessageBlock,
  AutoResponsePreviewDto,
  AutoResponsePreviewResult,
  AutoResponseRuleResponseDto,
  AutoResponseUploadMediaResult,
  AutoResponseUsageResponseDto,
  CreateAutoResponseDto,
  ResolvedAutoResponseBlock,
  UpdateAutoResponseDto,
} from "./auto-response.types";
import {
  AUTO_RESPONSE_POSTBACK_PREFIX,
  detectImageMime,
  IMAGE_EXTENSIONS,
  normalizeAutoResponseMessages,
  validateAutoResponseMessages,
} from "./auto-response.utils";

@Injectable()
export class AutoResponseService {
  private readonly logger = new Logger(AutoResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLog?: AuditLogService,
    @Optional() private readonly media?: MediaStorageService,
  ) {}

  /**
   * Helper to scan all RichMenu templates and find usages for one or all rules.
   */
  private async findRichMenuUsages(ruleId?: string): Promise<
    Map<
      string,
      Array<{
        templateId: string;
        templateName: string;
        templateStatus: string;
        areaCount: number;
      }>
    >
  > {
    const templates = await this.prisma.richMenuTemplate.findMany({
      where: {
        status: { not: "ARCHIVED" },
      },
      select: {
        id: true,
        name: true,
        status: true,
        areasJson: true,
      },
    });

    const usageMap = new Map<
      string,
      Array<{
        templateId: string;
        templateName: string;
        templateStatus: string;
        areaCount: number;
      }>
    >();

    for (const tmpl of templates) {
      const areas = (tmpl.areasJson as any[]) || [];
      const ruleAreaCounts = new Map<string, number>();

      for (const area of areas) {
        let matchedRuleId: string | null = null;
        if (
          area.actionType === "POSTBACK_AUTO_RESPONSE" &&
          area.autoResponseRuleId
        ) {
          matchedRuleId = String(area.autoResponseRuleId).trim();
        } else if (
          typeof area.actionData === "string" &&
          area.actionData.startsWith(AUTO_RESPONSE_POSTBACK_PREFIX)
        ) {
          matchedRuleId = area.actionData
            .slice(AUTO_RESPONSE_POSTBACK_PREFIX.length)
            .trim();
        }

        if (matchedRuleId) {
          if (!ruleId || matchedRuleId === ruleId) {
            ruleAreaCounts.set(
              matchedRuleId,
              (ruleAreaCounts.get(matchedRuleId) || 0) + 1,
            );
          }
        }
      }

      for (const [rid, count] of ruleAreaCounts.entries()) {
        const list = usageMap.get(rid) || [];
        list.push({
          templateId: tmpl.id,
          templateName: tmpl.name,
          templateStatus: tmpl.status,
          areaCount: count,
        });
        usageMap.set(rid, list);
      }
    }

    return usageMap;
  }

  /**
   * Enriches normalized message blocks with fresh public signed URLs for image previews.
   */
  private enrichMessageBlocks(
    messages: AutoResponseMessageBlock[],
  ): AutoResponseMessageBlock[] {
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
   * Computes all dynamic variables used across all TEXT blocks in a rule.
   */
  private extractAllUsedVariables(messages: AutoResponseMessageBlock[]): string[] {
    const varsSet = new Set<string>();
    for (const m of messages) {
      if (m.type === "TEXT" && m.textTemplate) {
        for (const v of extractTemplateVariables(m.textTemplate)) {
          varsSet.add(v);
        }
      }
    }
    return Array.from(varsSet);
  }

  /**
   * Computes appropriate AutoResponseContentType from message blocks.
   */
  private determineContentType(
    messages: AutoResponseMessageBlock[],
  ): AutoResponseContentType {
    if (messages.length === 1) {
      if (messages[0].type === "IMAGE") return AutoResponseContentType.IMAGE;
      return AutoResponseContentType.TEXT;
    }
    return AutoResponseContentType.MULTI_MESSAGE;
  }

  /**
   * Upload an image to S3 for use in Auto-response IMAGE blocks.
   * Enforces JPEG/PNG via magic bytes, max 10MB, and creates a <= 1MB preview for LINE.
   */
  async uploadMedia(
    file: { buffer: Buffer; mimetype?: string; size?: number },
    user: AuthUser,
  ): Promise<AutoResponseUploadMediaResult> {
    if (!file?.buffer || !file.buffer.length) {
      throw new BadRequestException("Image file is required and cannot be empty");
    }

    if (file.buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException("รูปภาพต้องมีขนาดไม่เกิน 10 MB (Image exceeds 10 MB limit)");
    }

    const mime = detectImageMime(file.buffer);
    if (!mime || !IMAGE_EXTENSIONS[mime]) {
      throw new BadRequestException(
        "รองรับเฉพาะไฟล์ JPG และ PNG เท่านั้น (Only JPEG and PNG images are supported)",
      );
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
    const originalObjectKey = `line-media/auto-response/${fileId}-original.${ext}`;

    // Store original image
    await this.media.put(originalObjectKey, file.buffer, mime);

    // Generate preview image <= 1MB (JPEG or PNG) for LINE Messaging API
    let previewBuffer: Buffer;
    let previewMime: string = mime;
    let previewExt: string = ext;
    let width: number | undefined;
    let height: number | undefined;

    try {
      const metadata = await sharp(file.buffer).metadata();
      width = metadata.width;
      height = metadata.height;

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
        throw new BadRequestException("ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ (Failed to process image)");
      }
    }

    if (previewBuffer.length > 1024 * 1024) {
      throw new BadRequestException("Preview image exceeds 1 MB limit for LINE Messaging API");
    }

    const previewObjectKey = `line-media/auto-response/${fileId}-preview.${previewExt}`;
    await this.media.put(previewObjectKey, previewBuffer, previewMime);

    const originalContentUrl = createMediaPublicUrl(originalObjectKey);
    const previewImageUrl = createMediaPublicUrl(previewObjectKey);

    return {
      mediaObjectKey: originalObjectKey,
      previewObjectKey,
      imageUrl: originalContentUrl,
      previewUrl: previewImageUrl,
      mimeType: mime,
      fileSize: file.buffer.length,
      width,
      height,
    };
  }

  async listRules(query?: {
    status?: AutoResponseStatus;
    search?: string;
  }): Promise<AutoResponseRuleResponseDto[]> {
    const where: Prisma.AutoResponseRuleWhereInput = {};

    if (query?.status) {
      where.status = query.status;
    } else {
      where.status = { not: AutoResponseStatus.ARCHIVED };
    }

    if (query?.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { description: { contains: s, mode: "insensitive" } },
        { textTemplate: { contains: s, mode: "insensitive" } },
      ];
    }

    const rules = await this.prisma.autoResponseRule.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    const usageMap = await this.findRichMenuUsages();

    return rules.map((r) => {
      const linked = usageMap.get(r.id) || [];
      const messages = this.enrichMessageBlocks(normalizeAutoResponseMessages(r));
      const usedVariables = this.extractAllUsedVariables(messages);
      const textTemplate =
        r.textTemplate ||
        (messages.find((m) => m.type === "TEXT") as any)?.textTemplate ||
        "";

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status,
        triggerType: r.triggerType,
        contentType: this.determineContentType(messages),
        textTemplate,
        contentJson: (r.contentJson as any) || { version: 1, messages },
        messages,
        version: r.version,
        usedVariables,
        usageCount: linked.length,
        createdByUserId: r.createdByUserId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        lastActivatedAt: r.lastActivatedAt,
        archivedAt: r.archivedAt,
      };
    });
  }

  async getRule(id: string): Promise<AutoResponseRuleResponseDto> {
    const rule = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
    }

    const usageMap = await this.findRichMenuUsages(id);
    const linked = usageMap.get(id) || [];
    const messages = this.enrichMessageBlocks(normalizeAutoResponseMessages(rule));
    const usedVariables = this.extractAllUsedVariables(messages);
    const textTemplate =
      rule.textTemplate ||
      (messages.find((m) => m.type === "TEXT") as any)?.textTemplate ||
      "";

    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      status: rule.status,
      triggerType: rule.triggerType,
      contentType: this.determineContentType(messages),
      textTemplate,
      contentJson: (rule.contentJson as any) || { version: 1, messages },
      messages,
      version: rule.version,
      usedVariables,
      usageCount: linked.length,
      linkedRichMenus: linked,
      createdByUserId: rule.createdByUserId,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      lastActivatedAt: rule.lastActivatedAt,
      archivedAt: rule.archivedAt,
    };
  }

  async createRule(
    dto: CreateAutoResponseDto,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException("กรุณากรอกชื่อข้อความตอบกลับ (Rule name is required)");
    }

    let messages: AutoResponseMessageBlock[] = [];
    if (dto.messages !== undefined && Array.isArray(dto.messages)) {
      const validation = validateAutoResponseMessages(dto.messages);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join("; "));
      }
      messages = dto.messages.map((m) => ({
        ...m,
        id: m.id || randomUUID(),
      }));
    } else if (dto.textTemplate && dto.textTemplate.trim().length > 0) {
      messages = [
        {
          id: randomUUID(),
          type: "TEXT",
          textTemplate: dto.textTemplate.trim(),
        },
      ];
    } else {
      messages = [
        {
          id: randomUUID(),
          type: "TEXT",
          textTemplate: "",
        },
      ];
    }

    const firstTextBlock = messages.find((m) => m.type === "TEXT") as any;
    const textTemplate = firstTextBlock?.textTemplate || null;
    const contentType = this.determineContentType(messages);

    const rule = await this.prisma.autoResponseRule.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        contentType,
        textTemplate,
        contentJson: { version: 1, messages },
        status: AutoResponseStatus.DRAFT,
        createdByUserId: user.id,
      },
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "AUTO_RESPONSE_CREATED",
        metadata: {
          ruleId: rule.id,
          name: rule.name,
          version: rule.version,
          messageCount: messages.length,
        },
      });
    }

    return this.getRule(rule.id);
  }

  async updateRule(
    id: string,
    dto: UpdateAutoResponseDto,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    const existing = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
    }

    if (existing.status === AutoResponseStatus.ARCHIVED) {
      throw new BadRequestException("Cannot edit an archived auto-response rule");
    }

    const updates: Prisma.AutoResponseRuleUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name?.trim();
      if (!name) {
        throw new BadRequestException("กรุณากรอกชื่อข้อความตอบกลับ (Rule name cannot be empty)");
      }
      updates.name = name;
    }

    if (dto.description !== undefined) {
      updates.description = dto.description?.trim() || null;
    }

    let bumpedVersion = false;

    if (dto.messages !== undefined && Array.isArray(dto.messages)) {
      const validation = validateAutoResponseMessages(dto.messages);
      if (!validation.valid) {
        throw new BadRequestException(validation.errors.join("; "));
      }

      const normalizedNew = dto.messages.map((m) => ({
        ...m,
        id: m.id || randomUUID(),
      }));

      const existingMessages = normalizeAutoResponseMessages(existing);
      const isDifferent =
        JSON.stringify(normalizedNew) !== JSON.stringify(existingMessages);

      if (isDifferent) {
        updates.contentJson = { version: 1, messages: normalizedNew };
        updates.contentType = this.determineContentType(normalizedNew);

        const singleText =
          normalizedNew.length === 1 && normalizedNew[0].type === "TEXT"
            ? normalizedNew[0].textTemplate
            : (normalizedNew.find((m) => m.type === "TEXT") as any)?.textTemplate || null;
        updates.textTemplate = singleText;

        updates.version = { increment: 1 };
        bumpedVersion = true;
      }
    } else if (dto.textTemplate !== undefined) {
      const trimmedText = dto.textTemplate.trim();
      if (trimmedText !== existing.textTemplate) {
        const singleBlock = [
          {
            id: randomUUID(),
            type: "TEXT" as const,
            textTemplate: trimmedText,
          },
        ];
        updates.textTemplate = trimmedText;
        updates.contentJson = { version: 1, messages: singleBlock };
        updates.contentType = AutoResponseContentType.TEXT;
        updates.version = { increment: 1 };
        bumpedVersion = true;
      }
    }

    if (dto.status !== undefined) {
      updates.status = dto.status;
      if (dto.status === AutoResponseStatus.ACTIVE && !existing.lastActivatedAt) {
        updates.lastActivatedAt = new Date();
      }
    }

    const updated = await this.prisma.autoResponseRule.update({
      where: { id },
      data: updates,
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "AUTO_RESPONSE_UPDATED",
        metadata: {
          ruleId: updated.id,
          name: updated.name,
          version: updated.version,
          bumpedVersion,
          status: updated.status,
        },
      });
    }

    return this.getRule(updated.id);
  }

  async activateRule(
    id: string,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    const existing = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
    }

    const messages = normalizeAutoResponseMessages(existing);
    if (!messages.length) {
      throw new BadRequestException("ไม่สามารถเปิดใช้งานข้อความตอบกลับที่ว่างเปล่าได้ (Cannot activate empty rule)");
    }

    const validation = validateAutoResponseMessages(messages);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join("; "));
    }

    const updated = await this.prisma.autoResponseRule.update({
      where: { id },
      data: {
        status: AutoResponseStatus.ACTIVE,
        lastActivatedAt: new Date(),
      },
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "AUTO_RESPONSE_ACTIVATED",
        metadata: {
          ruleId: updated.id,
          name: updated.name,
          version: updated.version,
        },
      });
    }

    return this.getRule(updated.id);
  }

  async deactivateRule(
    id: string,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    const existing = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
    }

    const updated = await this.prisma.autoResponseRule.update({
      where: { id },
      data: {
        status: AutoResponseStatus.INACTIVE,
      },
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "AUTO_RESPONSE_DEACTIVATED",
        metadata: {
          ruleId: updated.id,
          name: updated.name,
          version: updated.version,
        },
      });
    }

    return this.getRule(updated.id);
  }

  async archiveRule(
    id: string,
    user: AuthUser,
  ): Promise<AutoResponseRuleResponseDto> {
    const existing = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
    }

    const updated = await this.prisma.autoResponseRule.update({
      where: { id },
      data: {
        status: AutoResponseStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    if (this.auditLog) {
      await this.auditLog.record({
        actorUserId: user.id,
        action: "AUTO_RESPONSE_ARCHIVED",
        metadata: {
          ruleId: updated.id,
          name: updated.name,
        },
      });
    }

    return this.getRule(updated.id);
  }

  async getRuleUsage(id: string): Promise<AutoResponseUsageResponseDto> {
    const rule = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
    }

    const usageMap = await this.findRichMenuUsages(id);
    const linked = usageMap.get(id) || [];

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      usageCount: linked.length,
      linkedRichMenus: linked,
    };
  }

  async previewRule(
    id: string,
    input?: AutoResponsePreviewDto,
  ): Promise<AutoResponsePreviewResult> {
    const rule = await this.prisma.autoResponseRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Auto-response rule with ID '${id}' not found`);
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

    const rawMessages = normalizeAutoResponseMessages(rule);
    const resolvedBlocks: ResolvedAutoResponseBlock[] = [];
    const usedVarsSet = new Set<string>();
    const unresVarsSet = new Set<string>();
    let allBlocksReady = true;
    let firstFailReason: string | null = null;

    for (const msg of rawMessages) {
      if (msg.type === "TEXT") {
        const used = extractTemplateVariables(msg.textTemplate || "");
        used.forEach((v) => usedVarsSet.add(v));

        const resolved = resolveTemplateVariables(msg.textTemplate || "", storeContext);
        const unres: string[] = [];
        const remainingMatches = resolved.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
        if (remainingMatches) {
          for (const m of remainingMatches) {
            const v = m.slice(2, -2).trim();
            unres.push(v);
            unresVarsSet.add(v);
          }
        }

        let isBlockValid = unres.length === 0;
        let blockError: string | undefined;

        if (unres.length > 0) {
          blockError = `ตัวแปรไม่สามารถแทนค่าได้: ${unres.join(", ")}`;
          if (allBlocksReady) {
            allBlocksReady = false;
            firstFailReason = blockError;
          }
        }

        const requiresGoogleMaps =
          used.includes("store.googleMapsUrl") || used.includes("googleMapsUrl");

        if (requiresGoogleMaps) {
          const mapsReadiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
          if (!mapsReadiness.ready) {
            isBlockValid = false;
            blockError =
              mapsReadiness.status === "MISSING"
                ? "ไม่มีลิงก์ Google Maps ใน Store Master"
                : "ลิงก์ Google Maps ไม่ถูกต้อง";
            if (allBlocksReady) {
              allBlocksReady = false;
              firstFailReason = blockError;
            }
          }
        }

        resolvedBlocks.push({
          id: msg.id,
          type: "TEXT",
          resolvedText: resolved,
          usedVariables: used,
          unresolvedVariables: unres,
          isValid: isBlockValid,
          validationError: blockError,
        });
      } else if (msg.type === "IMAGE") {
        const imageUrl = msg.mediaObjectKey
          ? createMediaPublicUrl(msg.mediaObjectKey)
          : "";
        const previewUrl = (msg.previewObjectKey || msg.mediaObjectKey)
          ? createMediaPublicUrl(msg.previewObjectKey || msg.mediaObjectKey)
          : "";

        const isBlockValid = Boolean(imageUrl);
        let blockError: string | undefined;
        if (!isBlockValid) {
          blockError = "ไม่พบไฟล์รูปภาพ (Missing image media)";
          if (allBlocksReady) {
            allBlocksReady = false;
            firstFailReason = blockError;
          }
        }

        resolvedBlocks.push({
          id: msg.id,
          type: "IMAGE",
          imageUrl,
          previewUrl,
          mediaObjectKey: msg.mediaObjectKey,
          previewObjectKey: msg.previewObjectKey,
          isValid: isBlockValid,
          validationError: blockError,
        });
      }
    }

    const firstTextBlock = resolvedBlocks.find((b) => b.type === "TEXT") as any;
    const resolvedText = firstTextBlock?.resolvedText || "";

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      store: {
        lineOfficialAccountId: targetOa.id,
        lineOfficialAccountName: targetOa.name,
        storeId: targetOa.store.id,
        storeName: targetOa.store.name,
        externalStoreId: targetOa.store.storeMaster?.externalStoreId ?? null,
        googleMapsUrl: targetOa.store.storeMaster?.googleMapsUrl ?? null,
      },
      usedVariables: Array.from(usedVarsSet),
      resolvedText,
      unresolvedVariables: Array.from(unresVarsSet),
      messages: resolvedBlocks,
      ready: allBlocksReady && resolvedBlocks.length > 0,
      reason: firstFailReason,
    };
  }
}
