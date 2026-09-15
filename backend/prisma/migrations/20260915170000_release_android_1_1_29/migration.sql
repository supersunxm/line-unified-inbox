INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-29-49', 'ANDROID', '1.1.29', 49,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.29-production.apk?sha=1d7f5a5122480c76f9fea0b661b2b1ac88752de025d54d3f42794eb13d770569',
  '60.6 MB', '1d7f5a5122480c76f9fea0b661b2b1ac88752de025d54d3f42794eb13d770569',
  ARRAY[
    'อัปเดตการเข้าสู่ระบบด้วย PIN 6 หลัก',
    'พนักงานเดิมสามารถตั้ง PIN หลังเข้าสู่ระบบด้วยรหัสผ่าน',
    'ปรับปรุงความเสถียรของการเข้าสู่ระบบและการจดจำสถานะ',
    'แก้ไขปัญหาการแสดงข้อความผิดพลาดระหว่างเปลี่ยนวิธีเข้าสู่ระบบ'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 49;
