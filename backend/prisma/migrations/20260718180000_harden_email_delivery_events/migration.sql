ALTER TABLE "EmailDeliveryEvent" RENAME COLUMN "error" TO "sanitizedError";
ALTER TABLE "EmailDeliveryEvent" ADD COLUMN "recipientEmailHash" TEXT;
ALTER TABLE "EmailDeliveryEvent" ADD COLUMN "purpose" TEXT;
UPDATE "EmailDeliveryEvent" SET "recipientEmailHash" = 'legacy', "purpose" = 'FIRST_ADMIN_REGISTRATION';
ALTER TABLE "EmailDeliveryEvent" ALTER COLUMN "recipientEmailHash" SET NOT NULL;
ALTER TABLE "EmailDeliveryEvent" ALTER COLUMN "purpose" SET NOT NULL;
CREATE INDEX "EmailDeliveryEvent_purpose_createdAt_idx" ON "EmailDeliveryEvent"("purpose", "createdAt");
