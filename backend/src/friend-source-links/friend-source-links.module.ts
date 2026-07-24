import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { FriendAttributionController } from "./friend-attribution.controller";
import { FriendSourceLinksController } from "./friend-source-links.controller";
import { FriendSourceLinksPublicController } from "./friend-source-links-public.controller";
import { FriendAttributionRateLimitGuard } from "./friend-attribution-rate-limit.guard";
import { FriendSourceLinksService } from "./friend-source-links.service";

@Module({
  imports: [PrismaModule],
  controllers: [FriendSourceLinksController, FriendSourceLinksPublicController, FriendAttributionController],
  providers: [FriendSourceLinksService, FriendAttributionRateLimitGuard],
  exports: [FriendSourceLinksService],
})
export class FriendSourceLinksModule {}
