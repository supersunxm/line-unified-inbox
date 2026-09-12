INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-23-43', 'ANDROID', '1.1.23', 43,
  '1.0.3', 4, true,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.23-production.apk?sha=5301dba617841d0e27b9ebfa5012ec3fde8b72fe754359e4d7ac6cadddc2e727',
  '60.1 MB', '5301dba617841d0e27b9ebfa5012ec3fde8b72fe754359e4d7ac6cadddc2e727',
  ARRAY[
    'แก้ปัญหาข้อความส่งถึงลูกค้าแล้ว แต่แอปแสดงว่าส่งไม่สำเร็จ',
    'ตรวจสอบผลการส่งด้วยรหัสคำขอเดิม โดยไม่ส่งข้อความซ้ำ',
    'ครอบคลุมการส่งข้อความ รูปภาพ และวิดีโอ',
    'ปรับปรุงความเสถียรเมื่อเครือข่ายหรือการรับผลตอบกลับสะดุด'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 43;
