import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  MassMessageAudienceType,
  MassMessageCampaignStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { BroadcastProcessorService } from "./broadcast-processor.service";

@Injectable()
export class BroadcastSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BroadcastSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: BroadcastProcessorService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 30_000);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.massMessageCampaign.findMany({
        where: {
          status: MassMessageCampaignStatus.PENDING,
          audienceType: {
            in: [
              MassMessageAudienceType.ALL_FRIENDS,
              MassMessageAudienceType.FRIENDSHIP_PERIOD,
            ],
          },
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      for (const item of due) {
        await this.processor.processCampaign(item.id);
      }

      const running = await this.prisma.massMessageCampaign.findMany({
        where: {
          status: MassMessageCampaignStatus.RUNNING,
          audienceType: MassMessageAudienceType.FRIENDSHIP_PERIOD,
        },
        select: { id: true },
        orderBy: { updatedAt: "asc" },
        take: 50,
      });
      for (const item of running) {
        await this.processor.reconcileCampaign(item.id);
      }
    } catch (error) {
      this.logger.error(
        "Broadcast scheduler tick failed: " +
          (error instanceof Error ? error.message : "unknown"),
      );
    } finally {
      this.running = false;
    }
  }
}
