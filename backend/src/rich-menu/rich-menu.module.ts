import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { RichMenuController } from "./rich-menu.controller";
import { RichMenuPublishNoopAdapter, RichMenuService } from "./rich-menu.service";

@Module({
  imports: [PrismaModule, AuthModule, MediaModule],
  controllers: [RichMenuController],
  providers: [
    RichMenuService,
    {
      provide: "IRichMenuPublishService",
      useClass: RichMenuPublishNoopAdapter,
    },
  ],
  exports: [RichMenuService],
})
export class RichMenuModule {}
