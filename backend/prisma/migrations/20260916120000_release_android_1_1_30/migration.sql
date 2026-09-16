INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-30-50', 'ANDROID', '1.1.30', 50,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.30-production.apk?sha=4b8a9d12455ddb1f2c6ec7a57c24c44b45ed0398a5fcff660c6674f9aa73e3ad',
  '60.7 MB', '4b8a9d12455ddb1f2c6ec7a57c24c44b45ed0398a5fcff660c6674f9aa73e3ad',
  ARRAY[
    'เพิ่ม HQ Store View สำหรับผู้ดูแลสำนักงานใหญ่',
    'ค้นหาและเลือกสาขาเพื่อดูและทำงานในมุมมองเดียวกับพนักงานสาขา',
    'สลับสาขาหรือกลับ HQ ได้โดยไม่ต้องออกจากระบบ',
    'เพิ่มการแยกขอบเขตข้อมูลและ audit สำหรับการทำงานในนามสาขา'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 50;
