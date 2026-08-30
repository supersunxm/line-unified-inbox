INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-7-27', 'ANDROID', '1.1.7', 27,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.7-production.apk?sha=bd50803e02190b54533b8128532d8727cb05eceb105f563087195bc800ada51d',
  '59.9 MB', 'bd50803e02190b54533b8128532d8727cb05eceb105f563087195bc800ada51d',
  ARRAY[
    'เพิ่มผู้ดูแลบทสนทนาและแสดงเจ้าของแชทใน Inbox/หน้าแชท',
    'เพิ่มสรุปการดูแลแชทของพนักงานแต่ละคนและสัดส่วนการตอบ',
    'แยกการตอบของ Bot ออกจากพนักงานและเพิ่มสถานะความครอบคลุมของผู้ดูแล'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 27;
