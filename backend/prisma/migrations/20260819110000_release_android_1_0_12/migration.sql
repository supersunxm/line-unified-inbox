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
    'app-release-android-1-0-12-13',
    'ANDROID',
    '1.0.12',
    13,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.12-production.apk?sha=376a29715cf143b1d92697990d22f8261fb246b7f9e1a80de5b8c621d90da82e',
    '56.9 MB',
    '376a29715cf143b1d92697990d22f8261fb246b7f9e1a80de5b8c621d90da82e',
    ARRAY[
        'Makes the Customer Sales Information header readable on narrow Android screens',
        'Moves Clear all and Save to a second action row when horizontal space is limited',
        'Preserves existing Customer Sales Info tagging and persistence behavior'
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
  AND "buildNumber" < 13;
