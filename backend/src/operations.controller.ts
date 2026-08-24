import { Body, Controller, Get, NotFoundException, Param, Put, Post } from "@nestjs/common";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PrismaService } from "./prisma.service";
import { Roles } from "./auth/auth.decorators";
import { UserRole } from "@prisma/client";
import { OperationsService } from "./operations/operations.service";
import { emailFromAddress } from "./email/email.config";

const checklistKeys = ["credentials_saved", "webhook_copied", "verify_passed", "webhook_enabled", "text_received", "profile_fetched", "history_visible", "product_detected", "topic_detected", "reanalysis_works", "note_saves", "status_changes", "reminder_status", "dashboard_updates", "manager_button"] as const;
type ChecklistKey = typeof checklistKeys[number];

class ChecklistDto {
  @IsIn(["NOT_TESTED", "PASSED", "FAILED", "NOT_APPLICABLE"]) status!: "NOT_TESTED" | "PASSED" | "FAILED" | "NOT_APPLICABLE";
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@Controller("operations")
export class OperationsController {
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService) {}
  @Get("status") async status() {
    let database: "HEALTHY" | "ERROR" = "HEALTHY";
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { database = "ERROR"; }
    const activeOas = await this.prisma.lineOfficialAccount.count({ where: { isActive: true, archivedAt: null, store: { archivedAt: null } } });
    const connectedOas = await this.prisma.lineOfficialAccount.count({ where: { isActive: true, connectionStatus: "CONNECTED", store: { archivedAt: null } } });
    const issueOas = await this.prisma.lineOfficialAccount.count({ where: { isActive: true, connectionStatus: { in: ["ERROR", "NOT_CONFIGURED"] }, store: { archivedAt: null } } });
    const lastWebhook = (await this.prisma.lineOfficialAccount.aggregate({ _max: { lastWebhookReceivedAt: true } })) as { _max: { lastWebhookReceivedAt: Date | null } };
    const storeMasterCount = await this.prisma.storeMaster.count();
    const lastStoreMasterImport = (await this.prisma.storeMaster.aggregate({ _max: { updatedAt: true } })) as { _max: { updatedAt: Date | null } };
    const activeAdminCount = await this.prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    const lastEmail = await this.prisma.emailDeliveryEvent.findFirst({ orderBy: { createdAt: "desc" } });
    const publicWebhookUrlConfigured = Boolean(process.env.PUBLIC_WEBHOOK_BASE_URL?.trim());
    const emailMode = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "none"; const emailProviderConfigured = emailMode === "console" ? process.env.NODE_ENV !== "production" : emailMode === "resend" && Boolean(process.env.RESEND_API_KEY?.trim() && emailFromAddress());
    return { frontend: "HEALTHY", backendApi: "HEALTHY", database, lineWebhookEnabled: process.env.LINE_WEBHOOK_ENABLED !== "false", publicWebhookUrlConfigured, activeLineOaCount: activeOas, connectedLineOaCount: connectedOas, lineOaIssueCount: issueOas, lastValidWebhookReceived: lastWebhook._max.lastWebhookReceivedAt, lastStoreMasterImport: lastStoreMasterImport._max.updatedAt, storeMasterRecordCount: storeMasterCount, classificationEngine: "HEALTHY", pilotMode: process.env.PILOT_MODE === "true", emailProviderConfigured, emailProviderMode: emailMode, lastSuccessfulEmailSent: lastEmail?.success ? lastEmail.createdAt : null, lastEmailError: lastEmail && !lastEmail.success ? lastEmail.sanitizedError : null, firstAdminRequired: activeAdminCount === 0, activeAdminCount };
  }
  @Get("errors") errors() { return this.prisma.operationalError.findMany({ take: 20, orderBy: { createdAt: "desc" }, select: { id: true, feature: true, summary: true, resolved: true, createdAt: true } }); }
  @Get("pilot-checklist/:lineOaId") async checklist(@Param("lineOaId") lineOaId: string) {
    const oa = await this.prisma.lineOfficialAccount.findUnique({ where: { id: lineOaId }, select: { id: true, name: true } });
    if (!oa) throw new NotFoundException("LINE Official Account not found");
    const saved = await this.prisma.pilotChecklistItem.findMany({ where: { lineOfficialAccountId: lineOaId } });
    return { oa, items: checklistKeys.map((itemKey) => saved.find((item) => item.itemKey === itemKey) ?? { itemKey, status: "NOT_TESTED", note: null }) };
  }
  @Put("pilot-checklist/:lineOaId/:itemKey") async updateChecklist(@Param("lineOaId") lineOaId: string, @Param("itemKey") rawItemKey: string, @Body() dto: ChecklistDto) {
    if (!checklistKeys.includes(rawItemKey as ChecklistKey)) throw new NotFoundException("Checklist item not found");
    return this.prisma.pilotChecklistItem.upsert({ where: { lineOfficialAccountId_itemKey: { lineOfficialAccountId: lineOaId, itemKey: rawItemKey } }, update: { status: dto.status, note: dto.note?.trim() || null }, create: { lineOfficialAccountId: lineOaId, itemKey: rawItemKey, status: dto.status, note: dto.note?.trim() || null } });
  }

  @Get("reset-counter") async getReset() {
    const latest: Date | null = await this.operations.getLatestResetAt();
    return { resetAt: latest };
  }

  @Post("reset-counter") @Roles(UserRole.ADMIN) async resetCounter(@Body() body: { type?: string }) {
    const record = (await this.operations.createReset(undefined, body?.type ?? "GLOBAL")) as { resetAt?: Date | null };
    return { resetAt: record.resetAt };
  }
}
