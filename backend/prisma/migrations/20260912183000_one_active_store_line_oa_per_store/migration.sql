-- This migration intentionally fails before creating the index if production still
-- contains conflicting active STORE LINE OAs. Run the read-only integrity audit first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "LineOfficialAccount"
    WHERE "storeId" IS NOT NULL
      AND "accountType" = 'STORE'
      AND "isActive" = TRUE
      AND "archivedAt" IS NULL
    GROUP BY "storeId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active STORE LINE OA per Store: conflicting rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "LineOfficialAccount_one_active_store_oa_per_store_key"
ON "LineOfficialAccount"("storeId")
WHERE "storeId" IS NOT NULL
  AND "accountType" = 'STORE'
  AND "isActive" = TRUE
  AND "archivedAt" IS NULL;
