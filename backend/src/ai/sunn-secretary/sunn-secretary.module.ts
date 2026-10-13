import { Module } from "@nestjs/common";
import { SunnSecretaryWebhookController } from "./sunn-secretary-webhook.controller";
import { SunnSecretaryOwnerSettingsController } from "./sunn-secretary-owner-settings.controller";
import { PrismaModule } from "../../prisma.module";
import { CredentialsModule } from "../../credentials/credentials.module";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";

@Module({
  imports: [PrismaModule, CredentialsModule],
  providers: [SunnSecretaryCredentialsService, SunnSecretaryEventReceiptService],
  controllers: [SunnSecretaryWebhookController, SunnSecretaryOwnerSettingsController],
})
export class SunnSecretaryModule {}
