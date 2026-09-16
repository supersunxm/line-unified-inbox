import { Injectable, NotFoundException } from "@nestjs/common";
import { GreetingTemplateStatus, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { AuditLogService } from "../auth/audit-log.service";
import { PrismaService } from "../prisma.service";

const HISTORY_ACTIONS = [
  "GREETING_TEMPLATE_CREATED",
  "GREETING_TEMPLATE_UPDATED",
  "GREETING_TEMPLATE_ACTIVATED",
  "GREETING_TEMPLATE_DEACTIVATED",
  "GREETING_TEMPLATE_ARCHIVED",
  "GREETING_TEMPLATE_DUPLICATED",
] as const;

@Injectable()
export class GreetingManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async history(templateId: string) {
    const template = await this.prisma.greetingTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException(`Greeting template with ID '${templateId}' not found`);
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: { in: [...HISTORY_ACTIONS] },
        metadata: {
          path: ["templateId"],
          equals: templateId,
        },
      },
      include: {
        actorUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      actor: log.actorUser
        ? {
            id: log.actorUser.id,
            displayName: log.actorUser.displayName,
            email: log.actorUser.email,
          }
        : null,
      metadata: log.metadata,
    }));
  }

  async duplicate(templateId: string, user?: AuthUser) {
    const source = await this.prisma.greetingTemplate.findUnique({
      where: { id: templateId },
    });
    if (!source) {
      throw new NotFoundException(`Greeting template with ID '${templateId}' not found`);
    }

    const duplicate = await this.prisma.greetingTemplate.create({
      data: {
        name: `${source.name} (Copy)`,
        description: source.description,
        status: GreetingTemplateStatus.DRAFT,
        sendPolicy: source.sendPolicy,
        ...(source.contentJson
          ? { contentJson: source.contentJson as Prisma.InputJsonValue }
          : {}),
        version: 1,
        createdByUserId: user?.id ?? null,
      },
      include: {
        assignments: {
          select: { lineOfficialAccountId: true },
        },
      },
    });

    if (user) {
      await this.auditLog
        .record({
          actorUserId: user.id,
          action: "GREETING_TEMPLATE_DUPLICATED",
          metadata: {
            templateId: duplicate.id,
            sourceTemplateId: source.id,
            sourceTemplateName: source.name,
            name: duplicate.name,
          },
        })
        .catch(() => null);
    }

    return duplicate;
  }
}
