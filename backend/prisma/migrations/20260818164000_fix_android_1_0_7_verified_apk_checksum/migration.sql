UPDATE "AppRelease"
SET
  "apkUrl" = 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.7-production.apk',
  "apkSize" = '56.9 MB',
  "sha256" = 'f1231c418aa999e4118451e47ab61ed53710dc386443debbd4ee389ec5bfaf17'
WHERE "platform" = 'ANDROID'
  AND "version" = '1.0.7'
  AND "buildNumber" = 8;
