-- One-time production data repair for a LINE OA that was incorrectly attached to
-- Store 30538 / OPPO Phitsanulok. The API credentials belong to
-- OPPOLotusChumphaeBS, whose canonical Store Master row is Store 17469.
--
-- This migration intentionally does NOT delete Store Master 30538. It only removes
-- the Phitsanulok association from the connected Chum Phae LINE OA. If a canonical
-- Store 17469 row already exists, the OA is rebound to it. Otherwise the currently
-- attached Store row is repaired in place. LINE credentials/webhook configuration
-- are untouched.
DO $$
DECLARE
  v_oa_id TEXT;
  v_current_store_id TEXT;
  v_master_id TEXT;
  v_master_name TEXT;
  v_master_region TEXT;
  v_master_province TEXT;
  v_target_store_id TEXT;
BEGIN
  SELECT "id", "storeId"
    INTO v_oa_id, v_current_store_id
  FROM "LineOfficialAccount"
  WHERE "archivedAt" IS NULL
    AND (
      "name" = 'OPPOLotusChumphaeBS'
      OR LOWER(COALESCE("basicId", '')) = '@975tvkio'
    )
  ORDER BY
    CASE WHEN "name" = 'OPPOLotusChumphaeBS' THEN 0 ELSE 1 END,
    "updatedAt" DESC
  LIMIT 1;

  -- Clean databases used by CI do not contain production rows, so this repair is a no-op there.
  IF v_oa_id IS NULL OR v_current_store_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "id", "storeName", "region", "province"
    INTO v_master_id, v_master_name, v_master_region, v_master_province
  FROM "StoreMaster"
  WHERE "isActive" = TRUE
    AND (
      LOWER(COALESCE("lineId", '')) = '@975tvkio'
      OR "externalStoreId" = '17469'
      OR "accountName" = 'OPPOLotusChumphaeBS'
    )
  ORDER BY
    CASE WHEN LOWER(COALESCE("lineId", '')) = '@975tvkio' THEN 0 ELSE 1 END,
    CASE WHEN "externalStoreId" = '17469' THEN 0 ELSE 1 END,
    "updatedAt" DESC
  LIMIT 1;

  IF v_master_id IS NULL THEN
    RETURN;
  END IF;

  -- Reuse the canonical Store row when it already exists.
  SELECT "id"
    INTO v_target_store_id
  FROM "Store"
  WHERE "archivedAt" IS NULL
    AND (
      "storeMasterId" = v_master_id
      OR "code" = '17469'
    )
  ORDER BY
    CASE WHEN "storeMasterId" = v_master_id THEN 0 ELSE 1 END,
    "updatedAt" DESC
  LIMIT 1;

  -- In this incident the connected Store row itself was overwritten with 30538.
  -- If no separate 17469 Store exists, safely restore that same Store row in place.
  IF v_target_store_id IS NULL THEN
    v_target_store_id := v_current_store_id;
  END IF;

  UPDATE "Store"
  SET
    "storeMasterId" = v_master_id,
    "code" = '17469',
    "name" = COALESCE(NULLIF(v_master_name, ''), 'OBS Lotus Chum Phae Khonkaen FL.1 By Com7'),
    "region" = v_master_region,
    "area" = v_master_province,
    "provinceSource" = 'MASTER'::"StoreMetadataSource",
    "regionSource" = CASE
      WHEN v_master_region IS NOT NULL THEN 'MASTER'::"StoreMetadataSource"
      ELSE 'PROVINCE_MAPPING'::"StoreMetadataSource"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = v_target_store_id;

  UPDATE "LineOfficialAccount"
  SET
    "name" = 'OPPOLotusChumphaeBS',
    "storeId" = v_target_store_id,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = v_oa_id;

  -- Keep store filters, analytics, and inbox routing aligned with the repaired OA.
  UPDATE "Conversation"
  SET
    "storeId" = v_target_store_id,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "lineOfficialAccountId" = v_oa_id
    AND "storeId" IS DISTINCT FROM v_target_store_id;
END $$;
