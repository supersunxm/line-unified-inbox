import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { TikTokController } from "./tiktok.controller";
import { TikTokService } from "./tiktok.service";

@Module({
  imports: [PrismaModule],
  controllers: [TikTokController],
  providers: [TikTokService],
  exports: [TikTokService],
})
export class TikTokModule {}
