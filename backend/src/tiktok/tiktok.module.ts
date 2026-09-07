import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { TikTokController } from "./tiktok.controller";
import { TikTokService } from "./tiktok.service";
import { InternalTikTokSyncGuard } from "./internal-sync.guard";
import { TikTokPublicAnalyticsService } from "./tiktok-public-analytics.service";

@Module({
  imports: [PrismaModule],
  controllers: [TikTokController],
  providers: [TikTokService, InternalTikTokSyncGuard, TikTokPublicAnalyticsService],
  exports: [TikTokService, TikTokPublicAnalyticsService],
})
export class TikTokModule {}
