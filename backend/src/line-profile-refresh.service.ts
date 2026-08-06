import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { LineProfileService } from "./line-profile.service";

@Injectable()
export class LineProfileRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineProfileRefreshService.name);
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService, private readonly profiles: LineProfileService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    if (process.env.LINE_PROFILE_REFRESH_SCHEDULE_ENABLED === "false") {
      this.logger.log("LINE profile refresh schedule is disabled");
      return;
    }

    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(9, 0, 0, 0);
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const initialDelayMs = Math.max(0, nextRun.getTime() - now.getTime());
    this.logger.log(`Scheduling LINE profile refresh at ${nextRun.toISOString()}`);
    this.refreshTimer = setTimeout(() => {
      void this.executeRefresh().catch((error) => this.logger.error("Scheduled LINE profile refresh failed", error));
      this.refreshInterval = setInterval(() => {
        void this.executeRefresh().catch((error) => this.logger.error("Scheduled LINE profile refresh failed", error));
      }, 24 * 60 * 60 * 1000);
    }, initialDelayMs);
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshCustomerNameHistories() {
    const customers = await this.prisma.customer.findMany({
      where: { lineUserId: { not: null } },
      select: { id: true, lineUserId: true, displayName: true },
    });
    this.logger.log(`Refreshing LINE name history for ${customers.length} customers`);
    for (const customer of customers) {
      try {
        const lineOfficialAccountId = await this.getAnyActiveLineOaIdForCustomer(customer.id);
        if (!lineOfficialAccountId) {
          this.logger.warn(`Skipping customer ${customer.id} because no active LINE OA association was found`);
          continue;
        }
        await this.profiles.refresh(customer.id, lineOfficialAccountId, true, "LINE_PROFILE_SYNC");
      } catch (error) {
        this.logger.error(`Customer name refresh failed for ${customer.id}`, error as Error);
      }
    }
  }

  private async getAnyActiveLineOaIdForCustomer(customerId: string): Promise<string | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { customerId, store: { archivedAt: null } },
      select: { lineOfficialAccountId: true },
      orderBy: { latestMessageAt: "desc" },
    });
    return conversation?.lineOfficialAccountId ?? null;
  }

  private async executeRefresh() {
    await this.refreshCustomerNameHistories();
  }
}
