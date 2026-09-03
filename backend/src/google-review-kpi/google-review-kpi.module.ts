import { Module } from "@nestjs/common";
import { GoogleReviewKpiController } from "./google-review-kpi.controller";
import { GoogleReviewKpiService } from "./google-review-kpi.service";
import { PrismaModule } from "../prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GoogleReviewKpiController],
  providers: [GoogleReviewKpiService],
  exports: [GoogleReviewKpiService],
})
export class GoogleReviewKpiModule {}
