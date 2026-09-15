INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-28-48', 'ANDROID', '1.1.28', 48,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.28-production.apk?sha=2c605fd6c57fd743af9b87f44209ecb79cc3ff03900ff5956e0a00dc98916573',
  '60.1 MB', '2c605fd6c57fd743af9b87f44209ecb79cc3ff03900ff5956e0a00dc98916573',
  ARRAY[
    'รองรับการแจ้งเตือนอัปเดตเวอร์ชันใหม่แบบรายวัน',
    'คงการรองรับการรับและส่งไฟล์ PDF ผ่าน LINE OA',
    'อัปเดตเวอร์ชันสำหรับการทดสอบระบบอัปเดตอัตโนมัติจาก 1.1.27'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 48;
