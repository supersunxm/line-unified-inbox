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
    'app-release-android-1-0-18-19',
    'ANDROID',
    '1.0.18',
    19,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.18-production.apk?sha=8a238d1a41cffc94ee2704f51e37c76362cd086f52bf64719077ed2271516a78',
    '59.5 MB',
    '8a238d1a41cffc94ee2704f51e37c76362cd086f52bf64719077ed2271516a78',
    ARRAY[
        'ปรับปรุงระบบอัปเดตแอป ดาวน์โหลด ตรวจสอบ SHA-256 และเปิดตัวติดตั้งได้จากในแอป',
        'ปรับปรุงความเสถียรของ Push Notification สำหรับข้อความลูกค้า',
        'รองรับการแจ้งเตือนสำหรับ BM / HQ / PC ตามสิทธิ์การเข้าถึง'
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
  AND "buildNumber" < 19;
