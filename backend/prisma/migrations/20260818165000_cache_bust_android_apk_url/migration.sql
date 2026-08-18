UPDATE "AppRelease"
SET "apkUrl" = 'https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.7-production.apk?sha=f1231c418aa999e4118451e47ab61ed53710dc386443debbd4ee389ec5bfaf17',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "platform" = 'ANDROID'
  AND "buildNumber" = 8;
