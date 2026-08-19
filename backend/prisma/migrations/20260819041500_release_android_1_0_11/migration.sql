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
    'app-release-android-1-0-11-12',
    'ANDROID',
    '1.0.11',
    12,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.11-production.apk?sha=38b0e53d7ddb34b15fb2f1bae223048155a268d85ff0df5a0bc179c0f296f4ab',
    '56.8 MB',
    '38b0e53d7ddb34b15fb2f1bae223048155a268d85ff0df5a0bc179c0f296f4ab',
    ARRAY[
        'Customer status can now remain unset when neither Interested nor Purchased applies',
        'Removing interest level, purchase channel, and payment method now persists correctly',
        'Product quantity changes and Clear all now persist to the backend',
        'Keeps Customer Sales Info consistent after close, Android Back, and reopen'
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
  AND "buildNumber" < 12;
