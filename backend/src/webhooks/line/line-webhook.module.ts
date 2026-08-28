import { Module } from "@nestjs/common";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineWebhookController } from "./line-webhook.controller";
import { LineWebhookService } from "./line-webhook.service";
import { LineSignatureService } from "./line-signature.service";
import { NotificationsModule } from "../../notifications/notifications.module";
import { AutoResponseModule } from "../../auto-response/auto-response.module";
import { GreetingMessageModule } from "../../greeting-message/greeting-message.module";

@Module({ imports: [NotificationsModule, AutoResponseModule, GreetingMessageModule], controllers: [LineWebhookController], providers: [LineWebhookConfig, LineWebhookService, LineSignatureService] })
export class LineWebhookModule {}
