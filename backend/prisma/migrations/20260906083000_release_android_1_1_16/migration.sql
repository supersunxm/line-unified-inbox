INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-16-36', 'ANDROID', '1.1.16', 36,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.16-production.apk?sha=4566aa2d446bb85840b96bf49cbad967de34a904d245e4ce02e49a4747dbd04e',
  '60.1 MB', '4566aa2d446bb85840b96bf49cbad967de34a904d245e4ce02e49a4747dbd04e',
  ARRAY[
    'ปรับหน้า Inbox บน Android ให้กระชับขึ้น เพื่อแสดงลูกค้าได้มากขึ้นต่อหน้าจอ',
    'ย้ายสถานะลูกค้าและสถานะการตอบกลับไปด้านขวาใต้เวลาให้อ่านง่ายขึ้น',
    'เปลี่ยนการค้นหาเป็นปุ่ม Search แบบเต็มหน้าจอ พร้อมคงตัวกรองเดิมเมื่อกลับจากการค้นหา',
    'ปรับ Bottom Navigation ให้เตี้ยลงและใช้ไอคอนอย่างเดียว'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 36;
