# LINE OA Chat Hub Android MVP

## Setup

1. Install Flutter with Android SDK support.
2. Add `android/local.properties` with `flutter.sdk=/absolute/path/to/flutter`.
3. Configure Firebase for application ID `com.oppo.lineoahub` and place the Firebase Android configuration at `android/app/google-services.json`. This file is deliberately ignored.
4. Fetch packages: `flutter pub get`.
5. Local Android emulator run: `flutter run --dart-define=APP_ENV=development`. Development defaults to `http://10.0.2.2:3001` (the host machine from the Android emulator). For a physical device, pass a reachable LAN URL explicitly with `--dart-define=API_BASE_URL=http://<host-lan-ip>:3001`.
6. Production build: `flutter build apk --release --dart-define=APP_ENV=production --dart-define=API_BASE_URL=https://your-backend.example`.

`API_BASE_URL` must be the backend origin (not the web application origin). Production builds require it explicitly; no production URL or secret is embedded in the app. FCM service-account credentials are backend-only and never belong in this project.

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
