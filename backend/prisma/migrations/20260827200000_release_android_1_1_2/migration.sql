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
    'app-release-android-1-1-2-22',
    'ANDROID',
    '1.1.2',
    22,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.2-production.apk?sha=151b0b074d3b6beb8171d62385c485e5fb4a0481c2cd9a530041e8937e441c50',
    '59.6 MB',
    '151b0b074d3b6beb8171d62385c485e5fb4a0481c2cd9a530041e8937e441c50',
    ARRAY[
        'ปรับการตรวจสอบอัปเดตให้ทำงานเฉพาะเมื่อผู้ใช้กดตรวจสอบ',
        'แก้ปัญหาแอปค้างระหว่างเริ่มต้นใช้งาน',
        'เพิ่ม timeout และการกู้คืนเมื่อเครือข่ายหรือบริการภายนอกมีปัญหา',
        'ปรับปรุงความเสถียรของระบบอัปเดตและ session'
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
  AND "buildNumber" < 22;
