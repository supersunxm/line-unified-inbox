import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { RichMenuController } from "./rich-menu.controller";
import { RichMenuService } from "./rich-menu.service";
import { LineRichMenuClientService } from "./line-rich-menu-client.service";
import { RichMenuPublishWorkerService } from "./rich-menu-publish-worker.service";

@Module({
  imports: [PrismaModule, AuthModule, MediaModule, CredentialsModule],
  controllers: [RichMenuController],
  providers: [
    RichMenuService,
    LineRichMenuClientService,
    RichMenuPublishWorkerService,
    {
      provide: "IRichMenuPublishService",
      useClass: LineRichMenuClientService,
    },
  ],
  exports: [RichMenuService, LineRichMenuClientService, RichMenuPublishWorkerService],
})
export class RichMenuModule {}
