import { Module } from "@nestjs/common";
import { SunnSecretaryWebhookController } from "./sunn-secretary-webhook.controller";

@Module({
  controllers: [SunnSecretaryWebhookController],
})
export class SunnSecretaryModule {}
