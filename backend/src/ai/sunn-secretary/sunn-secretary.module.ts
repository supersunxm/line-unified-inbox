import { Module } from "@nestjs/common";
import { SunnSecretaryWebhookController } from "./sunn-secretary-webhook.controller";
import { SunnSecretaryOwnerSettingsController } from "./sunn-secretary-owner-settings.controller";
import { PrismaModule } from "../../prisma.module";
import { CredentialsModule } from "../../credentials/credentials.module";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";

import { SunnSecretaryInboundService, SunnSecretaryCommandPreparation } from "./sunn-secretary-inbound.service";
import { ConversationsService } from "../../conversations.service";
import { OperationsModule } from "../../operations/operations.module";
import { OperationsService } from "../../operations/operations.service";
import { PrismaService } from "../../prisma.service";
import {
  SUNN_SECRETARY_SUMMARY_READER,
  SunnSecretaryReadOnlyKpiService,
  type SunnSecretarySummaryReader,
} from "./sunn-secretary-kpi-execution.service";

@Module({
  imports: [PrismaModule, CredentialsModule, OperationsModule],
  providers: [
    SunnSecretaryCredentialsService,
    SunnSecretaryEventReceiptService,
    SunnSecretaryInboundService,
    SunnSecretaryCommandPreparation,
    {
      provide: SUNN_SECRETARY_SUMMARY_READER,
      inject: [PrismaService, OperationsService],
      useFactory: (prisma: PrismaService, operations: OperationsService): SunnSecretarySummaryReader => {
        // Reuse the existing production counting implementation; only its month-scoped read client changes.
        const conversations = new ConversationsService(prisma, operations);
        return {
          read: (storeIds, month, client, maxRows) => conversations.getBmReplyStatusSummary(
            storeIds,
            month,
            undefined,
            { client, maxRows },
          ),
        };
      },
    },
    SunnSecretaryReadOnlyKpiService,
  ],
  controllers: [SunnSecretaryWebhookController, SunnSecretaryOwnerSettingsController],
})
export class SunnSecretaryModule {}
