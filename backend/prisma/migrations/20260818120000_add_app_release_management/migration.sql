-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL DEFAULT 'ANDROID',
    "version" TEXT NOT NULL,
    "buildNumber" INTEGER NOT NULL,
    "minimumSupportedVersion" TEXT NOT NULL DEFAULT '1.0.3',
    "minimumSupportedBuildNumber" INTEGER NOT NULL DEFAULT 4,
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "apkUrl" TEXT NOT NULL,
    "apkSize" TEXT,
    "sha256" TEXT,
    "releaseNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppRelease_platform_buildNumber_key" ON "AppRelease"("platform", "buildNumber");

-- CreateIndex
CREATE INDEX "AppRelease_platform_isActive_idx" ON "AppRelease"("platform", "isActive");

-- CreateIndex
CREATE INDEX "AppRelease_platform_buildNumber_idx" ON "AppRelease"("platform", "buildNumber");

-- Seed Initial Active Release for Android v1.0.5+6
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
    'app-release-android-1-0-5-6',
    'ANDROID',
    '1.0.5',
    6,
    '1.0.3',
    4,
    false,
    'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.5-production.apk',
    '56.9 MB',
    'a59f8903b9f7ad5f39173612017054f30dc00cdeafb2525e970fbe4495001bd8',
    ARRAY[
        'Interested → Purchased conversion workflow',
        'Customer Sales CRM improvement',
        'Multi-product tagging',
        'CRM confirmation flow',
        'In-app update check'
    ]::TEXT[],
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;
