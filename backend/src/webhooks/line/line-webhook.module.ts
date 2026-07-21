import { Module } from "@nestjs/common";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineWebhookController } from "./line-webhook.controller";
import { LineWebhookService } from "./line-webhook.service";
import { LineSignatureService } from "./line-signature.service";

@Module({ controllers: [LineWebhookController], providers: [LineWebhookConfig, LineWebhookService, LineSignatureService] })
export class LineWebhookModule {}
