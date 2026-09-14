INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-25-45', 'ANDROID', '1.1.25', 45,
  '1.0.3', 4, true,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.25-production.apk?sha=459f9dabf16f5bdb2f705640163937e7143ad2a9cdc35804d9ecfac46946abfd',
  '60.1 MB', '459f9dabf16f5bdb2f705640163937e7143ad2a9cdc35804d9ecfac46946abfd',
  ARRAY[
    'ปรับโฉมหน้า Inbox และห้องแชทให้กระชับและใช้งานง่ายขึ้น',
    'รวมข้อมูลร้าน ผู้ดูแล แหล่งที่มา สถานะการตอบ และข้อมูลการขายไว้ในหน้าข้อมูลลูกค้า',
    'ปรับ Composer และเมนูการทำงานให้แสดงเฉพาะฟังก์ชันที่รองรับ',
    'ปรับปรุงการแสดงข้อผิดพลาดและการตอบกลับ โดยคงข้อมูลและการทำงานเดิมของแชท',
    'ปรับปรุงความเสถียรของระบบ',
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 45;
