INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-34-54', 'ANDROID', '1.1.34', 54,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.34-production.apk?sha=9cc03520df0bf00b078179707e0524b3a5b43bbad294bae1c37fa9f92b0a6763',
  '60.1 MB', '9cc03520df0bf00b078179707e0524b3a5b43bbad294bae1c37fa9f92b0a6763',
  ARRAY[
    'ปรับการ reconcile สถานะการส่งให้รอผลยืนยันจาก backend ได้นานขึ้น',
    'ป้องกันข้อความซ้ำเมื่อซิงก์ข้อความที่ถูกแทนที่',
    'ปรับปรุงสถานะ ✓ และ ✓✓ ให้ตรงกับหลักฐานการส่ง',
    'ปรับปรุงความปลอดภัยของ Retry และ lifecycle ของหน้าแชท'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 54;
