import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { FollowerInsightsController } from "./follower-insights.controller";
import { FollowerInsightsService } from "./follower-insights.service";

@Module({
  imports: [PrismaModule, CredentialsModule],
  controllers: [FollowerInsightsController],
  providers: [FollowerInsightsService],
  exports: [FollowerInsightsService],
})
export class FollowerInsightsModule {}
