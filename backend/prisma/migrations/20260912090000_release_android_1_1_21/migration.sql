INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-21-41', 'ANDROID', '1.1.21', 41,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.21-production.apk?sha=30a806e507ca0eaafe452aa65cc002006f483b7c32d37f034f4d9b03b2ec0bd5',
  '60.0 MB', '30a806e507ca0eaafe452aa65cc002006f483b7c32d37f034f4d9b03b2ec0bd5',
  ARRAY[
    'เพิ่มการเลือกช่องทางสำหรับลูกค้า Online',
    'รองรับ TikTok, Facebook, Instagram, LINE, Website และช่องทางอื่น',
    'ชื่อลูกค้าใน LINE จะแสดงช่องทางพร้อมเดือน/ปี เช่น TikTok 09/26',
    'เพิ่มปุ่มยืนยันก่อนบันทึกข้อมูล Online',
    'ปรับปรุงความเสถียรของระบบ'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 41;
