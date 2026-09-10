import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoreInsightsController } from "./store-insights.controller";
import { StoreInsightsService } from "./store-insights.service";

@Module({ imports: [AuthModule], controllers: [StoreInsightsController], providers: [StoreInsightsService] })
export class StoreInsightsModule {}
