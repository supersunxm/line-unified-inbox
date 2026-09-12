INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-24-44', 'ANDROID', '1.1.24', 44,
  '1.0.3', 4, true,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.24-production.apk?sha=ba2bef27a30df764f6e930811ae15d6f491c346a01140950ad3298dfbf5f13b3',
  '60.1 MB', 'ba2bef27a30df764f6e930811ae15d6f491c346a01140950ad3298dfbf5f13b3',
  ARRAY[
    'แก้หน้าสรุปข้อมูลสินค้าที่ซื้อบนหน้าจอแคบ ไม่ให้ตัวอักษรเรียงลงแนวตั้ง',
    'ปรับชื่อสินค้าและรายละเอียดให้ตัดบรรทัดอย่างอ่านง่ายสูงสุด 2 บรรทัด',
    'อัปเดตข้อมูลที่บันทึกกลับสู่หน้าสนทนาทันที โดยไม่ต้องรอปิดหน้าติดแท็ก',
    'คงการแก้ปัญหาผลการส่งข้อความและการป้องกันการส่งซ้ำจากเวอร์ชัน 1.1.23'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 44;
