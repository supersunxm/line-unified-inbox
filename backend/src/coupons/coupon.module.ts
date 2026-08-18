import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { CouponController } from "./coupon.controller";
import { CouponLineClientService } from "./coupon-line-client.service";
import { CouponScopeService } from "./coupon-scope.service";
import { CouponService } from "./coupon.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CouponController],
  providers: [CouponService, CouponScopeService, CouponLineClientService],
})
export class CouponModule {}
