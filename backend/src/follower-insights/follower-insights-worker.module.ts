import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { CredentialsModule } from "../credentials/credentials.module";
import { FollowerInsightsService } from "./follower-insights.service";

@Module({
  imports: [PrismaModule, CredentialsModule],
  providers: [FollowerInsightsService],
})
export class FollowerInsightsWorkerModule {}
