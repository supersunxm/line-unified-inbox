import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestResetAt(): Promise<Date | null> {
    type OpSession = { resetAt?: Date | null } | null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const latest = (await this.prisma.operationalSession.findFirst({ orderBy: { resetAt: "desc" } })) as unknown as OpSession;
    return latest?.resetAt ?? null;
  }

  async getOperationalConversationFilter(): Promise<Record<string, unknown>> {
    const resetAt = await this.getLatestResetAt();
    if (!resetAt) return {};
    return { latestMessageAt: { gte: resetAt } };
  }

  createReset(resetById?: string | null, type = "GLOBAL") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.operationalSession.create({ data: { resetById: resetById ?? null, type } });
  }
}
