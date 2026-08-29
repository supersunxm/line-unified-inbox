INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-6-26', 'ANDROID', '1.1.6', 26,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.6-production.apk?sha=c130632f2e9f55ad3ed71418241e1cbc5251d41a99cab92bf1eea7a5e947a626',
  '59.8 MB', 'c130632f2e9f55ad3ed71418241e1cbc5251d41a99cab92bf1eea7a5e947a626',
  ARRAY[
    'ปรับการแสดงสติกเกอร์ LINE ให้เข้าใจง่ายขึ้นในหน้าแชท',
    'แสดงข้อความหรือคีย์เวิร์ดของสติกเกอร์เมื่อ LINE ส่งข้อมูลมา',
    'ปรับข้อความตัวอย่างในหน้ารวมแชทไม่ให้แสดง [Sticker]'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 26;
