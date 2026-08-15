import 'package:flutter/widgets.dart';

import '../../l10n/app_localizations.dart';
import '../../l10n/app_localizations_en.dart';

export '../../l10n/app_localizations.dart';
export '../../l10n/app_localizations_en.dart';
export 'app_language.dart';
export 'localization_scope.dart';

AppLocalizations appLocalizations(BuildContext context) =>
    AppLocalizations.of(context) ?? AppLocalizationsEn();
