INSERT INTO "AppRelease" (
  "id",
  "platform",
  "version",
  "buildNumber",
  "minimumSupportedVersion",
  "minimumSupportedBuildNumber",
  "forceUpdate",
  "apkUrl",
  "apkSize",
  "sha256",
  "releaseNotes",
  "isActive",
  "downloadCount",
  "createdAt",
  "updatedAt"
) VALUES (
  'app-release-android-1-1-3-23',
  'ANDROID',
  '1.1.3',
  23,
  '1.0.3',
  4,
  false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.3-production.apk?sha=61267e70cf27751f297d77d2c9f0600e0226ea4573a5da426e593f84334789b9',
  '59.6 MB',
  '61267e70cf27751f297d77d2c9f0600e0226ea4573a5da426e593f84334789b9',
  ARRAY[
    'เพิ่มสถานะลูกค้าออนไลน์สำหรับบทสนทนาที่มาจากช่องทางออนไลน์',
    'นำสีพื้นหลังแยกอ่านแล้ว/ยังไม่อ่านออกจากรายการข้อความ',
    'นำตัวเลขจำนวนข้อความที่ยังไม่อ่านออกจากการ์ดบทสนทนา',
    'ยังคงสถานะรอตอบ ตอบแล้ว และการแจ้ง BM ตามเดิม'
  ]::TEXT[],
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
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
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "platform" = 'ANDROID'
  AND "buildNumber" < 23;
