import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogService } from "../auth/audit-log.service";
import { MediaModule } from "../media/media.module";
import { PrismaService } from "../prisma.service";
import { RichMessageController } from "./rich-message.controller";
import { RichMessageService } from "./rich-message.service";

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [RichMessageController],
  providers: [PrismaService, AuditLogService, RichMessageService],
  exports: [RichMessageService],
})
export class RichMessageModule {}
