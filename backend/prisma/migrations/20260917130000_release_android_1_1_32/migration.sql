INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-32-52', 'ANDROID', '1.1.32', 52,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.32-production.apk?sha=9d68f9d4a5e226a984c67a623c1c908391be8f0c81d6d2d513353bc02de7537d',
  '60.7 MB', '9d68f9d4a5e226a984c67a623c1c908391be8f0c81d6d2d513353bc02de7537d',
  ARRAY[
    'ปรับ Payment Method ในหน้า Tagging เป็น Cash, Installment และ Other',
    'เมื่อเลือก Installment สามารถเลือก Credit Card, Ufund หรือ SG Finance ได้',
    'ชื่อใน LINE OA Manager ใช้ ผ่อน, Ufund หรือ SG ตามประเภทการผ่อนที่เลือก',
    'รองรับข้อมูล Installment เดิมโดยไม่แก้ไขประวัติการขายเดิม'
  ]::TEXT[],
  true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("platform", "buildNumber") DO UPDATE SET
  "version" = EXCLUDED."version",
  "minimumSupportedVersion" = EXCLUDED."minimumSupportedVersion",
  "minimumSupportedBuildNumber" = EXCLUDED."minimumSupportedBuildNumber",
  "forceUpdate" = EXCLUDED."forceUpdate",
  "apkUrl" = EXCLUDED."apkUrl",
  "apkSize" = EXCLUDED."apkSize",
  "sha256" = EXCLUDED."sha256",
  "releaseNotes" = EXCLUDED."releaseNotes",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
UPDATE "AppRelease"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "platform" = 'ANDROID' AND "buildNumber" < 52;
