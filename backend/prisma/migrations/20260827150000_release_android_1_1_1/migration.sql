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
    'app-release-android-1-1-1-21',
    'ANDROID',
    '1.1.1',
    21,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.1-production.apk?sha=c4942a9ca1bc9b15bff9bc7408e8b2d535726d7a4946e2d4218df17cb6dc69e5',
    '59.5 MB',
    'c4942a9ca1bc9b15bff9bc7408e8b2d535726d7a4946e2d4218df17cb6dc69e5',
    ARRAY[
        'แก้ไขระบบอัปเดตแอปภายในแอป',
        'แก้ไขการแสดงเวอร์ชันของแอปให้ตรงกับเวอร์ชันที่ติดตั้ง',
        'ปรับปรุงความเสถียรของกระบวนการดาวน์โหลดและติดตั้งอัปเดต'
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
  AND "buildNumber" < 21;
