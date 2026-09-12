-- Historical/archived LINE OA rows retain their identifiers for auditability,
-- but only active operational accounts participate in uniqueness protection.
DROP INDEX IF EXISTS "LineOfficialAccount_basicId_key";
DROP INDEX IF EXISTS "LineOfficialAccount_channelId_key";
DROP INDEX IF EXISTS "LineOfficialAccount_destinationId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "LineOfficialAccount_active_basicId_key"
ON "LineOfficialAccount"("basicId")
WHERE "basicId" IS NOT NULL AND "isActive" = TRUE AND "archivedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "LineOfficialAccount_active_channelId_key"
ON "LineOfficialAccount"("channelId")
WHERE "channelId" IS NOT NULL AND "isActive" = TRUE AND "archivedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "LineOfficialAccount_active_destinationId_key"
ON "LineOfficialAccount"("destinationId")
WHERE "destinationId" IS NOT NULL AND "isActive" = TRUE AND "archivedAt" IS NULL;
