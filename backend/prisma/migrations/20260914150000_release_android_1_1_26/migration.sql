INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-26-46', 'ANDROID', '1.1.26', 46,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.26-production.apk?sha=30821a68b913edfe7b34f4257b825e0adf9f4b403b7ba17fc3e0904fc0726cf1',
  '60.1 MB', '30821a68b913edfe7b34f4257b825e0adf9f4b403b7ba17fc3e0904fc0726cf1',
  ARRAY[
    'เพิ่มการตรวจสอบการอัปเดตแอปอัตโนมัติวันละครั้ง',
    'เตือนการอัปเดตตามวันที่ของเครื่อง โดยสามารถเลือกไว้ภายหลังได้',
    'ปรับปรุงความเสถียรของระบบอัปเดตและการใช้งาน'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 46;
