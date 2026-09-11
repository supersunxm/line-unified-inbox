INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-20-40', 'ANDROID', '1.1.20', 40,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.20-production.apk?sha=dfc2aed2ceed32cee689b0d5b7b15475485b05adc305797ab2468e2014ec5092',
  '60.1 MB', 'dfc2aed2ceed32cee689b0d5b7b15475485b05adc305797ab2468e2014ec5092',
  ARRAY[
    'เพิ่มปุ่มยืนยันการเลือกสำหรับลูกค้า Film',
    'ป้องกันการบันทึกข้อมูล Film โดยไม่ได้ตั้งใจ',
    'การเลือกแบรนด์จะยังไม่ถูกบันทึกจนกว่าจะกดยืนยัน',
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 40;
