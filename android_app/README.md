# LINE OA Chat Hub Android MVP

## Setup

1. Install Flutter with Android SDK support.
2. Add `android/local.properties` with `flutter.sdk=/absolute/path/to/flutter`.
3. Configure Firebase for application ID `com.oppo.lineoahub` and place the Firebase Android configuration at `android/app/google-services.json`. This file is deliberately ignored.
4. Fetch packages: `flutter pub get`.
5. Build: `flutter build apk --debug --dart-define=API_BASE_URL=https://your-backend.example`.

`API_BASE_URL` must be the backend origin (not the web application origin). FCM service-account credentials are backend-only and never belong in this project.

## Contract coverage

- OTP bearer login and secure token storage
- Session restore / automatic login
- Waiting-approval state based on active memberships
- Mobile inbox, conversation detail, reply, and pull-to-refresh
- FCM device registration plus conversation deep links
- Profile and logout
