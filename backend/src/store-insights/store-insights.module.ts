import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoreInsightsController } from "./store-insights.controller";
import { CustomerVoiceService } from "./customer-voice.service";
import { CustomerVoiceWorkerService } from "./customer-voice-worker.service";
import { StoreInsightsService } from "./store-insights.service";

@Module({ imports: [AuthModule], controllers: [StoreInsightsController], providers: [StoreInsightsService, CustomerVoiceService, CustomerVoiceWorkerService], exports: [CustomerVoiceService] })
export class StoreInsightsModule {}
