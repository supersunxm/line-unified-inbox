INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-10-30', 'ANDROID', '1.1.10', 30,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.10-production.apk?sha=fb1ccb726852806c0a2403b4b0eb617c0e72eee88b281e8517c9248868d7c232',
  '60.0 MB', 'fb1ccb726852806c0a2403b4b0eb617c0e72eee88b281e8517c9248868d7c232',
  ARRAY[
    'ปรับตัวเลือกสินค้าให้แบ่งตามหมวด Smartphone, Tablet, Watch, Audio และ IoT เพื่อค้นหาได้เร็วขึ้น',
    'เพิ่มตัวกรองซีรีส์ Find, Reno และ A Series สำหรับ Smartphone พร้อมค้นหาแบบทันที',
    'เลือกสินค้าได้ทั้งแถวและแสดงสถานะที่เลือกชัดเจน โดยยังคงการเลือกสเปก จำนวน และการบันทึกเดิมครบถ้วน'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 30;
