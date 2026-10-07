import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OperationsModule } from "../operations/operations.module";
import { PrismaModule } from "../prisma.module";
import { MonthCloseScheduler, MonthCloseService } from "./month-close.service";
import { NicknameTagsV4Scheduler, NicknameTagsV4Service } from "./nickname-tags-v4.service";
import { StorePartnersService } from "./store-partners.service";
import { TagCoverageService } from "./tag-coverage.service";
import { V2MonthlyController } from "./v2-monthly.controller";

/** v2 monthly reporting: Store → partner mapping, month close (snapshots + scheduler), Parser v4 tags. */
@Module({
  imports: [PrismaModule, AuthModule, OperationsModule],
  controllers: [V2MonthlyController],
  providers: [StorePartnersService, MonthCloseService, MonthCloseScheduler, NicknameTagsV4Service, NicknameTagsV4Scheduler, TagCoverageService],
  exports: [StorePartnersService, MonthCloseService, NicknameTagsV4Service],
})
export class V2MonthlyModule {}
