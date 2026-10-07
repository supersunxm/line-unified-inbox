import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OperationsModule } from "../operations/operations.module";
import { PrismaModule } from "../prisma.module";
import { MonthCloseScheduler, MonthCloseService } from "./month-close.service";
import { StorePartnersService } from "./store-partners.service";
import { V2MonthlyController } from "./v2-monthly.controller";

/** v2 monthly reporting: Store → partner mapping, month close (snapshots + scheduler). */
@Module({
  imports: [PrismaModule, AuthModule, OperationsModule],
  controllers: [V2MonthlyController],
  providers: [StorePartnersService, MonthCloseService, MonthCloseScheduler],
  exports: [StorePartnersService, MonthCloseService],
})
export class V2MonthlyModule {}
