# Android release identity

## Production package

- Application ID: `click.lineoppo.chat`
- Release key alias: `lineoppo-release`

## Permanent release certificate

Keep the corresponding keystore and passwords outside Git and back them up securely. Every future APK update for `click.lineoppo.chat` must use the same release key.

- SHA-1: `B3:15:E6:C3:40:8F:33:80:6E:FC:CC:A2:CC:DF:5B:E5:C4:3E:D6:54`
- SHA-256: `E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14`

## Firebase

Register a Firebase Android app whose package name is exactly `click.lineoppo.chat`. The native FCM receiver uses the checked-in non-secret identifiers in `android/app/src/main/res/values/firebase_options.xml`, which must match `lib/firebase_options.dart`; an optional downloaded `google-services.json` remains ignored. If Firebase requires Android certificate fingerprints, use the values above.
