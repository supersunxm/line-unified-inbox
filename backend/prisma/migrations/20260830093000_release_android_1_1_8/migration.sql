INSERT INTO "AppRelease" (
  "id", "platform", "version", "buildNumber",
  "minimumSupportedVersion", "minimumSupportedBuildNumber",
  "forceUpdate", "apkUrl", "apkSize", "sha256",
  "releaseNotes", "isActive", "downloadCount", "createdAt", "updatedAt"
) VALUES (
  'app-release-android-1-1-8-28', 'ANDROID', '1.1.8', 28,
  '1.0.3', 4, false,
  'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.1.8-production.apk?sha=1978d21471d5a514c44af4bbb5da04c26a7deb86411fc4f50bfca5ffcfaaa059',
  '59.9 MB', '1978d21471d5a514c44af4bbb5da04c26a7deb86411fc4f50bfca5ffcfaaa059',
  ARRAY[
    'ซ่อนชื่อร้านที่ซ้ำซ้อนใน Inbox สำหรับผู้ใช้ที่ดูแลเพียงร้านเดียว',
    'ซ่อนชื่อและรหัสร้านในหน้าแชทสำหรับผู้ใช้ร้านเดียว เพื่อเพิ่มพื้นที่สนทนา',
    'ผู้ใช้หลายร้าน, HQ และ Admin ยังคงเห็นข้อมูลร้านเพื่อแยกบริบทได้ชัดเจน'
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
WHERE "platform" = 'ANDROID' AND "buildNumber" < 28;
