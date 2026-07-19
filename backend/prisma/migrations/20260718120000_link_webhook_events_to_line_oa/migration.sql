ALTER TABLE "WebhookEvent" ADD COLUMN "lineOfficialAccountId" TEXT;
CREATE INDEX "WebhookEvent_lineOfficialAccountId_idx" ON "WebhookEvent"("lineOfficialAccountId");
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_lineOfficialAccountId_fkey" FOREIGN KEY ("lineOfficialAccountId") REFERENCES "LineOfficialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
