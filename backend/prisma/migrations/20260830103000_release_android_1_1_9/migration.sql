INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-9-29', 'ANDROID', '1.1.9', 29,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.9-production.apk?sha=269499376c0d5bd08c7e887eab880290152b5122c519b20aa42ad1b1c4fbc658',
  '59.9 MB', '269499376c0d5bd08c7e887eab880290152b5122c519b20aa42ad1b1c4fbc658',
  ARRAY[
    'ปรับ Inbox ให้แสดงรายการแชทได้กระชับและเห็นได้มากขึ้นต่อหน้าจอ',
    'ลดตัวกรองสถานะเหลือ ทั้งหมด รอตอบ และตอบแล้ว โดยรวมสถานะแจ้ง BM ไว้ในรอตอบ',
    'เริ่มนับผู้ดูแลเฉพาะบทสนทนาที่มีข้อความลูกค้าตั้งแต่วันที่ 30 สิงหาคม 2026 เพื่อไม่ให้แชทเก่าถูกนับเป็นงานค้าง'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 29;
