import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export type AuditLogInput = {
  actorUserId?: string;
  action: string;
  targetUserId?: string;
  targetRegistrationId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput) {
    try {
      await this.prisma.auditLog.create({ data: { ...input, metadata: input.metadata ?? undefined } });
    } catch (error) {
      this.logger.error(JSON.stringify({ event: "audit_log_write_failed", action: input.action, error: error instanceof Error ? error.message : "unknown" }));
    }
  }

  async list(input: { page: number; pageSize: number; action?: string; from?: string; to?: string }) {
    const page = Math.max(1, input.page);
    const pageSize = Math.min(100, Math.max(1, input.pageSize));
    const where: Prisma.AuditLogWhereInput = { ...(input.action ? { action: input.action } : {}), ...(input.from || input.to ? { createdAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) } } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
