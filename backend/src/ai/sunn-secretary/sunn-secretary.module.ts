import { Module } from "@nestjs/common";
import { SunnSecretaryWebhookController } from "./sunn-secretary-webhook.controller";
import { SunnSecretaryOwnerSettingsController } from "./sunn-secretary-owner-settings.controller";

@Module({
  controllers: [SunnSecretaryWebhookController, SunnSecretaryOwnerSettingsController],
})
export class SunnSecretaryModule {}
