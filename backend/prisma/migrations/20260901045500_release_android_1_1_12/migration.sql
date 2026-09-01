INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-12-32', 'ANDROID', '1.1.12', 32,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.12-production.apk?sha=7e9e7a2eb219f2595bb75516f03c4a7a5e44836e3c9597422ec1faa803ee83cb',
  '60.1 MB', '7e9e7a2eb219f2595bb75516f03c4a7a5e44836e3c9597422ec1faa803ee83cb',
  ARRAY[
    'เพิ่มการเล่นวิดีโอแบบเต็มหน้าจอจากข้อความในแชท',
    'เพิ่มการบันทึกวิดีโอลงเครื่องจากหน้าดูวิดีโอ',
    'ปรับชื่อรุ่นสินค้าที่ถูกเว้นตัวอักษรผิด เช่น OPPO Reno 1 6 5 G ให้แสดงเป็น OPPO Reno 16 5G'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 32;
