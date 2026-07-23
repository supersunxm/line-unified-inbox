import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { FriendSourceLinksController } from "./friend-source-links.controller";
import { FriendSourceLinksPublicController } from "./friend-source-links-public.controller";
import { FriendSourceLinksService } from "./friend-source-links.service";

@Module({
  imports: [PrismaModule],
  controllers: [FriendSourceLinksController, FriendSourceLinksPublicController],
  providers: [FriendSourceLinksService],
  exports: [FriendSourceLinksService],
})
export class FriendSourceLinksModule {}
