INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-11-31', 'ANDROID', '1.1.11', 31,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.11-production.apk?sha=698ff099e26079d87d8e496b4c0928cb01c6a2f8f9b849302beb4282ed9eb5c2',
  '60.0 MB', '698ff099e26079d87d8e496b4c0928cb01c6a2f8f9b849302beb4282ed9eb5c2',
  ARRAY[
    'เพิ่มการส่งวิดีโอจากแอปไปยังลูกค้าผ่าน LINE OA',
    'รองรับเลือกวิดีโอ MP4 จากแกลเลอรีหรือถ่ายจากกล้อง พร้อมหน้าพรีวิวก่อนส่ง',
    'ปรับการอัปโหลดวิดีโอให้ส่ง Content-Type video/mp4 และคงสถานะการตอบ ผู้ดูแล และ realtime เดิม'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 31;
