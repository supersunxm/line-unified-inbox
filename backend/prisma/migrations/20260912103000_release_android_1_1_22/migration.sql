INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-22-42', 'ANDROID', '1.1.22', 42,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.22-production.apk?sha=ec007ed541ee927c5e58a3af426f6820285a1a789b5e6416db75f30d0f6a935e',
  '60.1 MB', 'ec007ed541ee927c5e58a3af426f6820285a1a789b5e6416db75f30d0f6a935e',
  ARRAY[
    'เปลี่ยนชื่อ Customer Sales Info เป็น Tagging / ติดแท็ก',
    'ลูกค้า Online แสดงเฉพาะช่องทางที่มา โดยไม่แสดงการเลือกสินค้า',
    'ปรับยอด Total, Need Reply และ Completed ในหน้า Inbox ให้เป็นข้อมูลของเดือนปัจจุบัน',
    'ปรับปรุงความเสถียรของหน้า Inbox และการติดแท็ก'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 42;
