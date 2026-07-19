CREATE TYPE "LineOaConnectionStatus" AS ENUM ('CONNECTED', 'NOT_CONFIGURED', 'ERROR', 'DISABLED');

ALTER TABLE "LineOfficialAccount"
ADD COLUMN "destinationId" TEXT,
ADD COLUMN "encryptedChannelSecret" TEXT,
ADD COLUMN "encryptedChannelAccessToken" TEXT,
ADD COLUMN "connectionStatus" "LineOaConnectionStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
ADD COLUMN "lastWebhookReceivedAt" TIMESTAMP(3),
ADD COLUMN "lastConnectionTestAt" TIMESTAMP(3),
ADD COLUMN "lastConnectionError" TEXT;

CREATE UNIQUE INDEX "LineOfficialAccount_destinationId_key" ON "LineOfficialAccount"("destinationId");
