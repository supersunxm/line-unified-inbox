import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { AutoResponseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuditLogService } from "../auth/audit-log.service";
import { AuthUser } from "../auth/auth.guard";
import {
  extractTemplateVariables,
  getStoreGoogleMapsReadiness,
  resolveTemplateVariables,
  StoreVariableContext,
} from "../store-master/template-variable-resolver";
import {
  AutoResponsePreviewDto,
  AutoResponsePreviewResult,
  AutoResponseRuleResponseDto,
  AutoResponseUsageResponseDto,
  CreateAutoResponseDto,
  UpdateAutoResponseDto,
} from "./auto-response.types";
import { AUTO_RESPONSE_POSTBACK_PREFIX } from "./auto-response.utils";

@Injectable()
export class AutoResponseService {
  private readonly logger = new Logger(AutoResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLog?: AuditLogService,
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
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status,
        triggerType: r.triggerType,
        contentType: r.contentType,
        textTemplate: r.textTemplate,
        version: r.version,
        usedVariables: extractTemplateVariables(r.textTemplate),
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

    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      status: rule.status,
      triggerType: rule.triggerType,
      contentType: rule.contentType,
      textTemplate: rule.textTemplate,
      version: rule.version,
      usedVariables: extractTemplateVariables(rule.textTemplate),
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

    const textTemplate = dto.textTemplate?.trim() ?? "";

    const rule = await this.prisma.autoResponseRule.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        textTemplate,
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
    if (dto.textTemplate !== undefined) {
      const trimmedText = dto.textTemplate.trim();
      if (trimmedText !== existing.textTemplate) {
        updates.textTemplate = trimmedText;
        // Bump version when text template changes meaningfully
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

    if (!existing.textTemplate || !existing.textTemplate.trim()) {
      throw new BadRequestException("ไม่สามารถเปิดใช้งานข้อความตอบกลับที่ว่างเปล่าได้ (Response message cannot be empty)");
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

    const usedVariables = extractTemplateVariables(rule.textTemplate);
    const resolvedText = resolveTemplateVariables(rule.textTemplate, storeContext);

    // Evaluate readiness
    let ready = true;
    let reason: string | null = null;
    const unresolvedVariables: string[] = [];

    const remainingMatches = resolvedText.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
    if (remainingMatches) {
      for (const m of remainingMatches) {
        unresolvedVariables.push(m.slice(2, -2).trim());
      }
      ready = false;
      reason = `ตัวแปรไม่สามารถแทนค่าได้: ${unresolvedVariables.join(", ")}`;
    }

    const requiresGoogleMaps =
      usedVariables.includes("store.googleMapsUrl") ||
      usedVariables.includes("googleMapsUrl");

    if (requiresGoogleMaps) {
      const mapsReadiness = getStoreGoogleMapsReadiness(storeContext.googleMapsUrl);
      if (mapsReadiness.status === "MISSING") {
        ready = false;
        reason = "ไม่มีลิงก์ Google Maps ใน Store Master";
      } else if (mapsReadiness.status === "INVALID") {
        ready = false;
        reason = "ลิงก์ Google Maps ไม่ถูกต้อง";
      }
    }

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
      usedVariables,
      resolvedText,
      unresolvedVariables,
      ready,
      reason,
    };
  }
}
