INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-33-53', 'ANDROID', '1.1.33', 53,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.33-production.apk?sha=e3b478d364f55a9c887effd01bddd5861f9e83c31a4e6bab683751997d385c77',
  '60.7 MB', 'e3b478d364f55a9c887effd01bddd5861f9e83c31a4e6bab683751997d385c77',
  ARRAY[
    'แก้สถานะ ตอบแล้ว ให้ตรงกับการส่งข้อความจริง',
    'กำหนดผู้ดูแลอัตโนมัติเมื่อพนักงานตอบครั้งแรก โดยไม่ทับผู้ดูแลเดิม',
    'ปรับการซิงก์สถานะแชทหลังส่งข้อความไม่ให้ย้อนกลับเป็น ยังไม่ตอบ',
    'แก้การบันทึกสินค้าซ้ำใน Mobile Sales ที่อาจทำให้บันทึกล้มเหลว'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 53;
