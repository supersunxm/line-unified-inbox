# GitHub Android CI retirement

Production Android retirement is complete. This commit changes CI and focused documentation only. Railway, database history, application source, Mirror/worker implementation and Manager profiles are outside this commit.

## Workflow inventory

| Workflow | Classification | Reason |
| --- | --- | --- |
| `adaptive-auth-ci.yml` | MODIFY | Remove Flutter job; preserve web/backend validation |
| `android-package-check.yml` | DELETE | Android-only package/signing/APK publication |
| `android-production-release.yml` | DELETE | Android-only package/signing/APK publication |
| `android-signed-qa.yml` | DELETE | Android-only package/signing/APK publication |
| `backend-ci.yml` | MODIFY | Remove Flutter job; preserve web/backend validation |
| `publish-android-1-1-10.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-11.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-12.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-13.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-14.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-15.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-16.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-17.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-18.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-19.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-20.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-21.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-22.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-23.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-24.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-25.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-26.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-28.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-29.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-30.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-31.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-32.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-33.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-4.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-5.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-6.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-7.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-8.yml` | DELETE | Android-only package/signing/APK publication |
| `publish-android-1-1-9.yml` | DELETE | Android-only package/signing/APK publication |
| `tiktok-public-profile-poc.yml` | KEEP | Current TikTok diagnostic preserved |
| `unified-auth-ci.yml` | MODIFY | Remove app-only auth scope and Android path filter |

32 workflows deleted; three modified; 34 Android-only jobs removed (32 deleted workflows plus two Flutter jobs). Four current workflows remain: Application CI, Adaptive Auth CI, Unified Auth CI and TikTok public profile PoC. CI Gate still requires Backend and Frontend success. Current responsive web/mobile sales and media validation remains intact.

## Validation

All four remaining workflows pass actionlint 1.7.12. Structural comparisons confirm unchanged Backend, Frontend, web adaptive, registration and TikTok job definitions, valid needs dependencies and unchanged non-Android path filters. Unified auth removes only mobile-auth DTO/service/login-test scope. No Android reusable-workflow, workflow_call or artifact consumer remains. No active workflow contains Flutter, APK/AAB, Gradle, Android signing, keystore or Android signing-secret references. Existing legacy application source, immutable migrations and engineering history may retain archival references; this CI change does not execute or alter them.

## Publish and signing secrets

Branch: `chore/retire-android-ci`. Merge only after PR CI passes. Remove obsolete signing-secret names only after the default branch contains these workflow deletions and a fresh scan verifies zero consumers. Secret values are never retrieved. Repository/environment/organization secret visibility limitations are reported separately.

Archival cleanup targets: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD. These names are documentation, not active workflow inputs.
