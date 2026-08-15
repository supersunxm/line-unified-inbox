import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLanguage {
  thai('th', 'ไทย', Locale('th')),
  english('en', 'English', Locale('en')),
  simplifiedChinese('zh_CN', '简体中文', Locale('zh', 'CN'));

  const AppLanguage(this.storageValue, this.nativeName, this.locale);

  final String storageValue;
  final String nativeName;
  final Locale locale;

  static AppLanguage? fromStorage(String? value) {
    for (final language in values) {
      if (language.storageValue == value ||
          (language == AppLanguage.simplifiedChinese && value == 'zh')) {
        return language;
      }
    }
    return null;
  }

  static AppLanguage fromSystemLocale(Locale locale) {
    if (locale.languageCode == 'th') return AppLanguage.thai;
    if (locale.languageCode == 'zh') return AppLanguage.simplifiedChinese;
    if (locale.languageCode == 'en') return AppLanguage.english;
    return AppLanguage.english;
  }
}

class AppLanguageController extends ChangeNotifier {
  static const _preferenceKey = 'app_language';

  AppLanguageController({Locale? systemLocale})
      : _systemLocale = systemLocale ?? PlatformDispatcher.instance.locale;

  final Locale _systemLocale;
  AppLanguage _language = AppLanguage.english;

  AppLanguage get language => _language;
  Locale get locale => _language.locale;

  Future<void> load() async {
    final preferences = await SharedPreferences.getInstance();
    final saved =
        AppLanguage.fromStorage(preferences.getString(_preferenceKey));
    final next = saved ?? AppLanguage.fromSystemLocale(_systemLocale);
    if (next == _language) return;
    _language = next;
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage language) async {
    if (_language == language) return;
    _language = language;
    notifyListeners();
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_preferenceKey, language.storageValue);
  }
}
