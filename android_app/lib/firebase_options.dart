import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return android;
    }
    throw UnsupportedError('Firebase options are configured for Android only.');
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDekcZGAE7pQbW1wOy6vBgwZYrHj6wfHiE',
    appId: '1:1085831667678:android:280661139a514e4bf3474f',
    messagingSenderId: '1085831667678',
    projectId: 'line-oa-chat-hub-ai',
    storageBucket: 'line-oa-chat-hub-ai.firebasestorage.app',
  );
}
