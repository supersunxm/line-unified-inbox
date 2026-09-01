INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-14-34', 'ANDROID', '1.1.14', 34,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.14-production.apk?sha=130b617daf5cede8bb4d89f569599e4c9870fffe1aa7cec9ec232235cb4b0364',
  '60.1 MB', '130b617daf5cede8bb4d89f569599e4c9870fffe1aa7cec9ec232235cb4b0364',
  ARRAY[
    'แก้ชื่อรุ่นสินค้าในหน้ารายการแชท Android ให้แสดงถูกต้องเมื่อข้อมูลต้นทางมีตัวเลขหรือ 5G ถูกเว้นผิด เช่น OPPO Reno 1 6 5 G ให้แสดงเป็น OPPO Reno 16 5G'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 34;
