# LINE OA Chat Hub Android MVP

## Setup

1. Install Flutter with Android SDK support.
2. Add `android/local.properties` with `flutter.sdk=/absolute/path/to/flutter`.
3. Configure the Firebase Android app for application ID `click.lineoppo.chat`. The non-secret native identifiers are checked in at `android/app/src/main/res/values/firebase_options.xml` and must match `lib/firebase_options.dart`; a downloaded `google-services.json` is optional for local tooling and remains ignored.
4. Fetch packages: `flutter pub get`.
5. Local Android emulator run: `flutter run --dart-define=APP_ENV=development`. Development defaults to `http://10.0.2.2:3001` (the host machine from the Android emulator). For a physical device, pass a reachable LAN URL explicitly with `--dart-define=API_BASE_URL=http://<host-lan-ip>:3001`.
6. Production build: `flutter build apk --release --dart-define=APP_ENV=production --dart-define=API_BASE_URL=https://your-backend.example`.

`API_BASE_URL` must be the backend origin (not the web application origin). Production builds require it explicitly; no production URL or secret is embedded in the app. FCM service-account credentials are backend-only and never belong in this project.

## Android package identity

The production Android application ID is `click.lineoppo.chat`. Do not change this ID after rollout unless intentionally shipping a separate Android app. Firebase Android configuration must be registered for exactly this application ID.

## Production signing

Release builds must use the permanent LINEOPPO signing key. The Gradle configuration intentionally refuses to build a release APK when `android/key.properties` is missing, so release builds can never silently fall back to the Android debug certificate.

1. Keep the permanent keystore outside Git. A recommended local path is `android/lineoppo-release.jks`.
2. Copy `android/key.properties.example` to `android/key.properties`.
3. Fill in `storePassword`, `keyPassword`, and `keyAlias`. Keep `storeFile=../lineoppo-release.jks` when using the recommended path.
4. Back up the keystore and passwords securely. Every future update of `click.lineoppo.chat` must be signed with this same key.
5. Never commit `key.properties`, `.jks`, `.keystore`, or `google-services.json`.

Before distributing a release, verify the installed package and certificate from the final APK with Android build tools, then test an in-place upgrade from the previous production version on at least one device.

## Contract coverage

- OTP bearer login and secure token storage
- Session restore / automatic login
- Waiting-approval state based on active memberships
- Mobile inbox, conversation detail, reply, and pull-to-refresh
- FCM device registration plus conversation deep links
- Profile and logout

## Production hardening

- API requests preflight connectivity and expose retryable offline/transport failures without logging user messages, OTPs, or tokens.
- The app clears secure storage on `SESSION_EXPIRED`, checks the account again when resumed, and accepts FCM open events from foreground/background launches.
- Inbox uses the existing page/total contract for incremental loading. The conversation model accepts a future `nextCursor`; the current backend detail endpoint returns the latest 50 messages and does not yet publish a cursor.
- Outbound replies retain a stable idempotency key while sending. Failed sends remain visible and can be retried.
