CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE "LineOfficialAccount" ADD COLUMN "webhookKey" TEXT;

UPDATE "LineOfficialAccount"
SET "webhookKey" = encode(gen_random_bytes(24), 'hex')
WHERE "webhookKey" IS NULL;

ALTER TABLE "LineOfficialAccount" ALTER COLUMN "webhookKey" SET NOT NULL;

CREATE UNIQUE INDEX "LineOfficialAccount_webhookKey_key" ON "LineOfficialAccount"("webhookKey");
