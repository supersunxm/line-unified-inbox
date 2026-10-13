import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type OperationalSessionReader = Pick<Prisma.TransactionClient, "operationalSession">;

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestResetAt(client: OperationalSessionReader = this.prisma): Promise<Date | null> {
    type OpSession = { resetAt?: Date | null } | null;
    // Keep the general operations baseline isolated from feature-specific reset records.
    const latest = (await client.operationalSession.findFirst({
      where: { type: "GLOBAL" },
      orderBy: { resetAt: "desc" },
    })) as unknown as OpSession;
    return latest?.resetAt ?? null;
  }

  async getOperationalConversationFilter(client: OperationalSessionReader = this.prisma): Promise<Record<string, unknown>> {
    const resetAt = await this.getLatestResetAt(client);
    if (!resetAt) return {};
    return { latestMessageAt: { gte: resetAt } };
  }

  createReset(resetById?: string | null, type = "GLOBAL") {
    return this.prisma.operationalSession.create({ data: { resetById: resetById ?? null, type } });
  }
}
