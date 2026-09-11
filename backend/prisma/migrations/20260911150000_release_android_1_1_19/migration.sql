INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-19-39', 'ANDROID', '1.1.19', 39,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.19-production.apk?sha=d55a084df0f7581541d74e340beac00a535da00e98e92cf9af287eb87c02d9a7',
  '60.1 MB', 'd55a084df0f7581541d74e340beac00a535da00e98e92cf9af287eb87c02d9a7',
  ARRAY[
    'เพิ่มประเภทลูกค้า Film สำหรับลูกค้าที่เข้าร้านเพื่อติดฟิล์ม',
    'สามารถระบุแบรนด์โทรศัพท์ได้',
    'ระบบเปลี่ยนชื่อลูกค้าใน LINE อัตโนมัติเป็น Film/<Brand>/MM/YY',
    'ปรับปรุงความเสถียรของระบบ'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 39;
