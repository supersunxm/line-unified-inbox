-- Seed the two reviewed Robinson Chonburi inbound-text pilot rules.
-- Safety: fail closed unless exactly one active canonical Store is mapped with
-- Store.code = 28375 and StoreMaster.externalStoreId = 28375.
DO $$
DECLARE
  v_store_id TEXT;
BEGIN
  SELECT s."id"
    INTO STRICT v_store_id
  FROM "Store" s
  JOIN "StoreMaster" sm ON sm."id" = s."storeMasterId"
  WHERE s."code" = '28375'
    AND sm."externalStoreId" = '28375'
    AND s."isActive" = TRUE
    AND s."archivedAt" IS NULL;

  INSERT INTO "AutoResponseRule" (
    "id",
    "name",
    "description",
    "status",
    "triggerType",
    "intent",
    "scopeStoreId",
    "triggerConfig",
    "contentType",
    "textTemplate",
    "contentJson",
    "version",
    "createdAt",
    "updatedAt",
    "lastActivatedAt",
    "archivedAt"
  ) VALUES (
    '28375000-0000-4000-8000-000000000001',
    'Robinson Chonburi - Store Location Pilot',
    'Approved inbound-text pilot response for store location questions. Store 28375 only.',
    'ACTIVE'::"AutoResponseStatus",
    'INBOUND_TEXT'::"AutoResponseTriggerType",
    'STORE_LOCATION'::"AutoResponseIntent",
    v_store_id,
    '{"matcherVersion":1,"pilot":"robinson-chonburi","storeExternalId":"28375"}'::jsonb,
    'TEXT'::"AutoResponseContentType",
    $location$📌Google Map สาขาของร้านเรานะครับ

https://maps.app.goo.gl/FzD4bVeFAx5Dsk3D8

👉หน้าร้านอยู่ชั้น 2  ฝั่งธนาคาร กรุงศรี ติดบูทรองเท้า Adidas  จะขายแค่ OPPO แบรนด์เดียวเท่านั้น$location$,
    NULL,
    1,
    NOW(),
    NOW(),
    NOW(),
    NULL
  )
  ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "status" = 'ACTIVE'::"AutoResponseStatus",
    "triggerType" = 'INBOUND_TEXT'::"AutoResponseTriggerType",
    "intent" = 'STORE_LOCATION'::"AutoResponseIntent",
    "scopeStoreId" = v_store_id,
    "triggerConfig" = EXCLUDED."triggerConfig",
    "contentType" = 'TEXT'::"AutoResponseContentType",
    "textTemplate" = EXCLUDED."textTemplate",
    "contentJson" = NULL,
    "version" = GREATEST("AutoResponseRule"."version", 1),
    "updatedAt" = NOW(),
    "lastActivatedAt" = NOW(),
    "archivedAt" = NULL;

  INSERT INTO "AutoResponseRule" (
    "id",
    "name",
    "description",
    "status",
    "triggerType",
    "intent",
    "scopeStoreId",
    "triggerConfig",
    "contentType",
    "textTemplate",
    "contentJson",
    "version",
    "createdAt",
    "updatedAt",
    "lastActivatedAt",
    "archivedAt"
  ) VALUES (
    '28375000-0000-4000-8000-000000000002',
    'Robinson Chonburi - Finance Info Pilot',
    'Approved inbound-text pilot response for finance information questions. Store 28375 only.',
    'ACTIVE'::"AutoResponseStatus",
    'INBOUND_TEXT'::"AutoResponseTriggerType",
    'FINANCE_INFO'::"AutoResponseIntent",
    v_store_id,
    '{"matcherVersion":1,"pilot":"robinson-chonburi","storeExternalId":"28375"}'::jsonb,
    'TEXT'::"AutoResponseContentType",
    $finance$⭐ข้อมูลในการสมัครสินเชื่อ ⭐

-บัตรประชาชนตัวจริง 1 ใบครับ
-อายุ 20 ปีขึ้นไป
-ใช้เวลาสมัคร 5 นาทีรู้ผล
-วางดาวน์รับเครื่องกลับบ้านได้เลย

❌เช็คเครดิตเบื้องต้น เงื่อนไขจะขึ้นอยู่กับสินเชื่ออีกครั้งหนึ่งครับ
❌ชำระแค่เงินดาวน์อย่างเดียวไม่ต้องชำระอย่างอื่นเพิ่ม
❌ไม่ต้องใช้คนค้ำ$finance$,
    NULL,
    1,
    NOW(),
    NOW(),
    NOW(),
    NULL
  )
  ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "status" = 'ACTIVE'::"AutoResponseStatus",
    "triggerType" = 'INBOUND_TEXT'::"AutoResponseTriggerType",
    "intent" = 'FINANCE_INFO'::"AutoResponseIntent",
    "scopeStoreId" = v_store_id,
    "triggerConfig" = EXCLUDED."triggerConfig",
    "contentType" = 'TEXT'::"AutoResponseContentType",
    "textTemplate" = EXCLUDED."textTemplate",
    "contentJson" = NULL,
    "version" = GREATEST("AutoResponseRule"."version", 1),
    "updatedAt" = NOW(),
    "lastActivatedAt" = NOW(),
    "archivedAt" = NULL;
END $$;