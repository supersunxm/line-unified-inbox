import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { StorePartnersService } from "./store-partners.service";
import { V2MonthlyController } from "./v2-monthly.controller";

/** v2 monthly reporting: Store → partner mapping (more to come: month close, tag coverage). */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [V2MonthlyController],
  providers: [StorePartnersService],
  exports: [StorePartnersService],
})
export class V2MonthlyModule {}
