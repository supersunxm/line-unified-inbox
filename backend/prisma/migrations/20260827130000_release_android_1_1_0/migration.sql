INSERT INTO "AppRelease" (
    "id",
    "platform",
    "version",
    "buildNumber",
    "minimumSupportedVersion",
    "minimumSupportedBuildNumber",
    "forceUpdate",
    "apkUrl",
    "apkSize",
    "sha256",
    "releaseNotes",
    "isActive",
    "downloadCount",
    "createdAt",
    "updatedAt"
) VALUES (
    'app-release-android-1-1-0-20',
    'ANDROID',
    '1.1.0',
    20,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.0-production.apk?sha=9b4351e1a7b998ff63f2ac7acfd906d0e8324d432f41382ad773f627b77f2f98',
    '59.5 MB',
    '9b4351e1a7b998ff63f2ac7acfd906d0e8324d432f41382ad773f627b77f2f98',
    ARRAY[
        'Stable milestone release v1.1',
        'รองรับวิดีโอจากลูกค้าใน LINE',
        'ปรับปรุงความเสถียรของการเข้าสู่ระบบและ session',
        'ปรับปรุงระบบอัปเดตแอปภายในแอป',
        'ปรับปรุง Push Notification',
        'แจ้งเตือนแสดงชื่อลูกค้า ร้าน และตัวอย่างข้อความ'
    ]::TEXT[],
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
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
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "platform" = 'ANDROID'
  AND "buildNumber" < 20;
