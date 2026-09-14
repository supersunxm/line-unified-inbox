INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-27-47', 'ANDROID', '1.1.27', 47,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.27-production.apk?sha=343005764bc5823143a2562a6de5dd5e10f2d1c918fbd4afcb8e4f3ffe5a0353',
  '60.1 MB', '343005764bc5823143a2562a6de5dd5e10f2d1c918fbd4afcb8e4f3ffe5a0353',
  ARRAY[
    'รองรับการรับไฟล์ PDF จากลูกค้าผ่าน LINE',
    'รองรับการส่งไฟล์ PDF จากแอปผ่านลิงก์เอกสารที่ปลอดภัย',
    'เพิ่มการเปิดและแสดงไฟล์ PDF ในห้องแชท'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 47;
