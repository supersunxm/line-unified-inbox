import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { TikTokController } from "./tiktok.controller";
import { TikTokService } from "./tiktok.service";
import { InternalTikTokSyncGuard } from "./internal-sync.guard";

@Module({
  imports: [PrismaModule],
  controllers: [TikTokController],
  providers: [TikTokService, InternalTikTokSyncGuard],
  exports: [TikTokService],
})
export class TikTokModule {}
