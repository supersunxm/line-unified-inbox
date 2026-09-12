-- sourceRowNumber is mutable provenance, not StoreMaster identity.
DROP INDEX IF EXISTS "StoreMaster_source_sourceRowNumber_key";
CREATE INDEX IF NOT EXISTS "StoreMaster_source_sourceRowNumber_idx"
ON "StoreMaster"("source", "sourceRowNumber");

-- Active Google Sheet Store IDs are canonical and must not have two masters.
CREATE UNIQUE INDEX IF NOT EXISTS "StoreMaster_active_google_sheet_externalStoreId_key"
ON "StoreMaster"("externalStoreId")
WHERE "source" = 'GOOGLE_SHEET'
  AND "isActive" = TRUE
  AND "externalStoreId" IS NOT NULL;
