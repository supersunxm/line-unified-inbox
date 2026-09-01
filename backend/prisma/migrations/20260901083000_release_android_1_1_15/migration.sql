INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-15-35', 'ANDROID', '1.1.15', 35,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.15-production.apk?sha=8b2f6d5aef45af909e95fc9e15f116d5517b35c54e87f51837a3123a154f52b2',
  '60.1 MB', '8b2f6d5aef45af909e95fc9e15f116d5517b35c54e87f51837a3123a154f52b2',
  ARRAY[
    'ปรับการแสดงชื่อรุ่นและความจุสินค้าใน Android ให้แก้ช่องว่างผิดปกติแบบอัตโนมัติครอบคลุมทุกรุ่น เช่น OPPO A 6 เป็น OPPO A6 และ 1 2 8 เป็น 128GB โดยไม่เปลี่ยนข้อมูลต้นทาง'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 35;
