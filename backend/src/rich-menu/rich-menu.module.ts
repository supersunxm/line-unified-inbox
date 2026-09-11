import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { RichMenuController } from "./rich-menu.controller";
import { RichMenuOverviewController } from "./rich-menu-overview.controller";
import { RichMenuService } from "./rich-menu.service";
import { RichMenuOverviewService } from "./rich-menu-overview.service";
import { LineRichMenuClientService } from "./line-rich-menu-client.service";
import { RichMenuPublishWorkerService } from "./rich-menu-publish-worker.service";

@Module({
  imports: [PrismaModule, AuthModule, MediaModule, CredentialsModule],
  controllers: [RichMenuController, RichMenuOverviewController],
  providers: [
    RichMenuService,
    RichMenuOverviewService,
    LineRichMenuClientService,
    RichMenuPublishWorkerService,
    {
      provide: "IRichMenuPublishService",
      useClass: LineRichMenuClientService,
    },
  ],
  exports: [RichMenuService, RichMenuOverviewService, LineRichMenuClientService, RichMenuPublishWorkerService],
})
export class RichMenuModule {}
