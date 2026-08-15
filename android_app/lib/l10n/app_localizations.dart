import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_th.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('th'),
    Locale('zh'),
    Locale('zh', 'CN')
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'LINE OA Chat Hub'**
  String get appName;

  /// No description provided for @customer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get customer;

  /// No description provided for @sent.
  ///
  /// In en, this message translates to:
  /// **'Sent'**
  String get sent;

  /// No description provided for @interest.
  ///
  /// In en, this message translates to:
  /// **'Interest'**
  String get interest;

  /// No description provided for @unableToLoadProducts.
  ///
  /// In en, this message translates to:
  /// **'Unable to load products'**
  String get unableToLoadProducts;

  /// No description provided for @unableToLoadConfigurations.
  ///
  /// In en, this message translates to:
  /// **'Unable to load configurations'**
  String get unableToLoadConfigurations;

  /// No description provided for @unableToSaveTags.
  ///
  /// In en, this message translates to:
  /// **'Unable to save conversation tags'**
  String get unableToSaveTags;

  /// No description provided for @inbox.
  ///
  /// In en, this message translates to:
  /// **'Inbox'**
  String get inbox;

  /// No description provided for @all.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get all;

  /// No description provided for @summary.
  ///
  /// In en, this message translates to:
  /// **'Summary'**
  String get summary;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @conversationsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} conversations'**
  String conversationsCount(Object count);

  /// No description provided for @todayAtAGlance.
  ///
  /// In en, this message translates to:
  /// **'Today at a glance'**
  String get todayAtAGlance;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @needReply.
  ///
  /// In en, this message translates to:
  /// **'Need Reply'**
  String get needReply;

  /// No description provided for @completed.
  ///
  /// In en, this message translates to:
  /// **'Completed'**
  String get completed;

  /// No description provided for @searchConversations.
  ///
  /// In en, this message translates to:
  /// **'Search conversations'**
  String get searchConversations;

  /// No description provided for @clearSearch.
  ///
  /// In en, this message translates to:
  /// **'Clear search'**
  String get clearSearch;

  /// No description provided for @noConversationsYet.
  ///
  /// In en, this message translates to:
  /// **'No conversations yet'**
  String get noConversationsYet;

  /// No description provided for @noMatchingConversations.
  ///
  /// In en, this message translates to:
  /// **'No matching conversations'**
  String get noMatchingConversations;

  /// No description provided for @noMessagesYet.
  ///
  /// In en, this message translates to:
  /// **'No messages yet'**
  String get noMessagesYet;

  /// No description provided for @sentAnImage.
  ///
  /// In en, this message translates to:
  /// **'Sent an image'**
  String get sentAnImage;

  /// No description provided for @newCustomerMessage.
  ///
  /// In en, this message translates to:
  /// **'New customer message'**
  String get newCustomerMessage;

  /// No description provided for @newMessages.
  ///
  /// In en, this message translates to:
  /// **'{count} new messages'**
  String newMessages(Object count);

  /// No description provided for @you.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get you;

  /// No description provided for @store.
  ///
  /// In en, this message translates to:
  /// **'Store'**
  String get store;

  /// No description provided for @online.
  ///
  /// In en, this message translates to:
  /// **'Online'**
  String get online;

  /// No description provided for @installment.
  ///
  /// In en, this message translates to:
  /// **'Installment'**
  String get installment;

  /// No description provided for @profileTooltip.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTooltip;

  /// No description provided for @supportQueue.
  ///
  /// In en, this message translates to:
  /// **'Support queue'**
  String get supportQueue;

  /// No description provided for @previousMonth.
  ///
  /// In en, this message translates to:
  /// **'Previous month'**
  String get previousMonth;

  /// No description provided for @nextMonth.
  ///
  /// In en, this message translates to:
  /// **'Next month'**
  String get nextMonth;

  /// No description provided for @monthlyActivity.
  ///
  /// In en, this message translates to:
  /// **'Monthly activity'**
  String get monthlyActivity;

  /// No description provided for @loadingMonthlySummary.
  ///
  /// In en, this message translates to:
  /// **'Loading monthly summary…'**
  String get loadingMonthlySummary;

  /// No description provided for @unableToLoadSummary.
  ///
  /// In en, this message translates to:
  /// **'Unable to load summary. Please try again.'**
  String get unableToLoadSummary;

  /// No description provided for @summaryUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Summary data is unavailable.'**
  String get summaryUnavailable;

  /// No description provided for @noActivity.
  ///
  /// In en, this message translates to:
  /// **'No activity'**
  String get noActivity;

  /// No description provided for @noActivityThisMonth.
  ///
  /// In en, this message translates to:
  /// **'There is no customer activity for this month.'**
  String get noActivityThisMonth;

  /// No description provided for @dataQuality.
  ///
  /// In en, this message translates to:
  /// **'Data quality'**
  String get dataQuality;

  /// No description provided for @qaExcluded.
  ///
  /// In en, this message translates to:
  /// **'QA conversations are excluded from business analytics.'**
  String get qaExcluded;

  /// No description provided for @analyticsQualityUnknown.
  ///
  /// In en, this message translates to:
  /// **'Analytics quality could not be confirmed.'**
  String get analyticsQualityUnknown;

  /// No description provided for @incomingMessages.
  ///
  /// In en, this message translates to:
  /// **'Incoming Messages'**
  String get incomingMessages;

  /// No description provided for @customerConversations.
  ///
  /// In en, this message translates to:
  /// **'Customer Conversations'**
  String get customerConversations;

  /// No description provided for @responsePerformance.
  ///
  /// In en, this message translates to:
  /// **'Response performance'**
  String get responsePerformance;

  /// No description provided for @collectingResponseData.
  ///
  /// In en, this message translates to:
  /// **'Collecting response data'**
  String get collectingResponseData;

  /// No description provided for @responseDataAfterReplies.
  ///
  /// In en, this message translates to:
  /// **'Response metrics will appear after enough verified BM replies are recorded.'**
  String get responseDataAfterReplies;

  /// No description provided for @verifiedResponses.
  ///
  /// In en, this message translates to:
  /// **'Verified responses {count} / {minimum} required'**
  String verifiedResponses(Object count, Object minimum);

  /// No description provided for @responseRate.
  ///
  /// In en, this message translates to:
  /// **'Response rate'**
  String get responseRate;

  /// No description provided for @medianResponseTime.
  ///
  /// In en, this message translates to:
  /// **'Median response time'**
  String get medianResponseTime;

  /// No description provided for @averageResponseTime.
  ///
  /// In en, this message translates to:
  /// **'Average response time'**
  String get averageResponseTime;

  /// No description provided for @responses.
  ///
  /// In en, this message translates to:
  /// **'responses'**
  String get responses;

  /// No description provided for @previousPeriodUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Previous-period comparison unavailable'**
  String get previousPeriodUnavailable;

  /// No description provided for @comparedPreviousPeriod.
  ///
  /// In en, this message translates to:
  /// **'Compared with the previous period'**
  String get comparedPreviousPeriod;

  /// No description provided for @hoursMinutes.
  ///
  /// In en, this message translates to:
  /// **'{hours}h {minutes}m'**
  String hoursMinutes(Object hours, Object minutes);

  /// No description provided for @minutes.
  ///
  /// In en, this message translates to:
  /// **'{minutes}m'**
  String minutes(Object minutes);

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @customerProfile.
  ///
  /// In en, this message translates to:
  /// **'Customer profile'**
  String get customerProfile;

  /// No description provided for @moreActions.
  ///
  /// In en, this message translates to:
  /// **'More actions'**
  String get moreActions;

  /// No description provided for @storeContext.
  ///
  /// In en, this message translates to:
  /// **'Store context'**
  String get storeContext;

  /// No description provided for @storeUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Store unavailable'**
  String get storeUnavailable;

  /// No description provided for @storeCode.
  ///
  /// In en, this message translates to:
  /// **'Store code: {code}'**
  String storeCode(Object code);

  /// No description provided for @conversationContext.
  ///
  /// In en, this message translates to:
  /// **'Conversation context'**
  String get conversationContext;

  /// No description provided for @replyStatus.
  ///
  /// In en, this message translates to:
  /// **'Reply status'**
  String get replyStatus;

  /// No description provided for @unreadMessages.
  ///
  /// In en, this message translates to:
  /// **'Unread messages'**
  String get unreadMessages;

  /// No description provided for @messagesInView.
  ///
  /// In en, this message translates to:
  /// **'Messages in view'**
  String get messagesInView;

  /// No description provided for @latestActivity.
  ///
  /// In en, this message translates to:
  /// **'Latest activity'**
  String get latestActivity;

  /// No description provided for @openImage.
  ///
  /// In en, this message translates to:
  /// **'Open image'**
  String get openImage;

  /// No description provided for @imageProcessing.
  ///
  /// In en, this message translates to:
  /// **'Image processing…'**
  String get imageProcessing;

  /// No description provided for @loadingImage.
  ///
  /// In en, this message translates to:
  /// **'Loading image…'**
  String get loadingImage;

  /// No description provided for @imageUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Image unavailable'**
  String get imageUnavailable;

  /// No description provided for @sendImageQuestion.
  ///
  /// In en, this message translates to:
  /// **'Send image?'**
  String get sendImageQuestion;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @send.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get send;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @sending.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get sending;

  /// No description provided for @failedRetry.
  ///
  /// In en, this message translates to:
  /// **'Failed · Retry'**
  String get failedRetry;

  /// No description provided for @attachImage.
  ///
  /// In en, this message translates to:
  /// **'Attach image'**
  String get attachImage;

  /// No description provided for @replyToCustomer.
  ///
  /// In en, this message translates to:
  /// **'Reply to customer'**
  String get replyToCustomer;

  /// No description provided for @sendReply.
  ///
  /// In en, this message translates to:
  /// **'Send reply'**
  String get sendReply;

  /// No description provided for @conversationTags.
  ///
  /// In en, this message translates to:
  /// **'Conversation Tags'**
  String get conversationTags;

  /// No description provided for @addTags.
  ///
  /// In en, this message translates to:
  /// **'+ Add tags'**
  String get addTags;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @clear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get clear;

  /// No description provided for @clearAll.
  ///
  /// In en, this message translates to:
  /// **'Clear all'**
  String get clearAll;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @customerSource.
  ///
  /// In en, this message translates to:
  /// **'Customer source'**
  String get customerSource;

  /// No description provided for @product.
  ///
  /// In en, this message translates to:
  /// **'Product'**
  String get product;

  /// No description provided for @searchProduct.
  ///
  /// In en, this message translates to:
  /// **'Search product...'**
  String get searchProduct;

  /// No description provided for @noMatchingProducts.
  ///
  /// In en, this message translates to:
  /// **'No matching products'**
  String get noMatchingProducts;

  /// No description provided for @configuration.
  ///
  /// In en, this message translates to:
  /// **'Configuration'**
  String get configuration;

  /// No description provided for @loadingConfigurations.
  ///
  /// In en, this message translates to:
  /// **'Loading configurations...'**
  String get loadingConfigurations;

  /// No description provided for @noVariantsAvailable.
  ///
  /// In en, this message translates to:
  /// **'No variants available for this product'**
  String get noVariantsAvailable;

  /// No description provided for @clearVariant.
  ///
  /// In en, this message translates to:
  /// **'Clear variant'**
  String get clearVariant;

  /// No description provided for @change.
  ///
  /// In en, this message translates to:
  /// **'Change'**
  String get change;

  /// No description provided for @ram.
  ///
  /// In en, this message translates to:
  /// **'RAM'**
  String get ram;

  /// No description provided for @rom.
  ///
  /// In en, this message translates to:
  /// **'ROM'**
  String get rom;

  /// No description provided for @color.
  ///
  /// In en, this message translates to:
  /// **'Color'**
  String get color;

  /// No description provided for @login.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get login;

  /// No description provided for @signInApproved.
  ///
  /// In en, this message translates to:
  /// **'Sign in with your approved account.'**
  String get signInApproved;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @createBmAccount.
  ///
  /// In en, this message translates to:
  /// **'Create BM account'**
  String get createBmAccount;

  /// No description provided for @name.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get name;

  /// No description provided for @employeeId.
  ///
  /// In en, this message translates to:
  /// **'Employee ID'**
  String get employeeId;

  /// No description provided for @role.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get role;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get confirmPassword;

  /// No description provided for @passwordRequirement.
  ///
  /// In en, this message translates to:
  /// **'Password (12+ characters)'**
  String get passwordRequirement;

  /// No description provided for @submitRegistration.
  ///
  /// In en, this message translates to:
  /// **'Submit registration'**
  String get submitRegistration;

  /// No description provided for @staff.
  ///
  /// In en, this message translates to:
  /// **'Staff'**
  String get staff;

  /// No description provided for @storeManager.
  ///
  /// In en, this message translates to:
  /// **'Store manager'**
  String get storeManager;

  /// No description provided for @pendingApproval.
  ///
  /// In en, this message translates to:
  /// **'Pending approval'**
  String get pendingApproval;

  /// No description provided for @pendingApprovalMessage.
  ///
  /// In en, this message translates to:
  /// **'Your account has been submitted and is waiting for administrator approval.'**
  String get pendingApprovalMessage;

  /// No description provided for @backToLogin.
  ///
  /// In en, this message translates to:
  /// **'Back to login'**
  String get backToLogin;

  /// No description provided for @waitingForApproval.
  ///
  /// In en, this message translates to:
  /// **'Waiting for approval'**
  String get waitingForApproval;

  /// No description provided for @waitingApprovalMessage.
  ///
  /// In en, this message translates to:
  /// **'Your store manager or HQ must approve your account before you can access conversations.'**
  String get waitingApprovalMessage;

  /// No description provided for @checkAgain.
  ///
  /// In en, this message translates to:
  /// **'Check again'**
  String get checkAgain;

  /// No description provided for @noPendingRegistrations.
  ///
  /// In en, this message translates to:
  /// **'No pending registrations.'**
  String get noPendingRegistrations;

  /// No description provided for @pendingBmRegistrations.
  ///
  /// In en, this message translates to:
  /// **'Pending BM registrations'**
  String get pendingBmRegistrations;

  /// No description provided for @reject.
  ///
  /// In en, this message translates to:
  /// **'Reject'**
  String get reject;

  /// No description provided for @approve.
  ///
  /// In en, this message translates to:
  /// **'Approve'**
  String get approve;

  /// No description provided for @employeeIdValue.
  ///
  /// In en, this message translates to:
  /// **'Employee ID: {value}'**
  String employeeIdValue(Object value);

  /// No description provided for @notSet.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get notSet;

  /// No description provided for @account.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get account;

  /// No description provided for @platformRole.
  ///
  /// In en, this message translates to:
  /// **'Platform role'**
  String get platformRole;

  /// No description provided for @assignedStores.
  ///
  /// In en, this message translates to:
  /// **'Assigned stores'**
  String get assignedStores;

  /// No description provided for @noMemberships.
  ///
  /// In en, this message translates to:
  /// **'No store memberships assigned.'**
  String get noMemberships;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @personalInformation.
  ///
  /// In en, this message translates to:
  /// **'Personal Information'**
  String get personalInformation;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @accountSecurity.
  ///
  /// In en, this message translates to:
  /// **'Account & Security'**
  String get accountSecurity;

  /// No description provided for @managedByOrganization.
  ///
  /// In en, this message translates to:
  /// **'Managed by your organization'**
  String get managedByOrganization;

  /// No description provided for @about.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get about;

  /// No description provided for @comingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get comingSoon;

  /// No description provided for @adminTools.
  ///
  /// In en, this message translates to:
  /// **'Admin tools'**
  String get adminTools;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @adminApprovals.
  ///
  /// In en, this message translates to:
  /// **'Pending BM registrations'**
  String get adminApprovals;

  /// No description provided for @languageTitle.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageTitle;

  /// No description provided for @thaiLanguage.
  ///
  /// In en, this message translates to:
  /// **'ไทย'**
  String get thaiLanguage;

  /// No description provided for @englishLanguage.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get englishLanguage;

  /// No description provided for @simplifiedChineseLanguage.
  ///
  /// In en, this message translates to:
  /// **'简体中文'**
  String get simplifiedChineseLanguage;

  /// No description provided for @roleAdmin.
  ///
  /// In en, this message translates to:
  /// **'Admin'**
  String get roleAdmin;

  /// No description provided for @roleViewer.
  ///
  /// In en, this message translates to:
  /// **'Viewer'**
  String get roleViewer;

  /// No description provided for @roleStoreManager.
  ///
  /// In en, this message translates to:
  /// **'Store manager'**
  String get roleStoreManager;

  /// No description provided for @roleStaff.
  ///
  /// In en, this message translates to:
  /// **'Staff'**
  String get roleStaff;

  /// No description provided for @nameRequired.
  ///
  /// In en, this message translates to:
  /// **'Name is required.'**
  String get nameRequired;

  /// No description provided for @employeeIdRequired.
  ///
  /// In en, this message translates to:
  /// **'Employee ID is required.'**
  String get employeeIdRequired;

  /// No description provided for @selectStore.
  ///
  /// In en, this message translates to:
  /// **'Select a store.'**
  String get selectStore;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get passwordsDoNotMatch;

  /// No description provided for @invalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid email or password.'**
  String get invalidCredentials;

  /// No description provided for @accountPendingMessage.
  ///
  /// In en, this message translates to:
  /// **'Your account is waiting for administrator approval.'**
  String get accountPendingMessage;

  /// No description provided for @accountRejectedMessage.
  ///
  /// In en, this message translates to:
  /// **'This account was rejected. Please contact an administrator.'**
  String get accountRejectedMessage;

  /// No description provided for @unableToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Unable to sign in. Please try again.'**
  String get unableToSignIn;

  /// No description provided for @cannotReachBackend.
  ///
  /// In en, this message translates to:
  /// **'Cannot reach the backend. Check the API URL and network connection.'**
  String get cannotReachBackend;

  /// No description provided for @unexpectedStoreError.
  ///
  /// In en, this message translates to:
  /// **'Unexpected error while loading stores.'**
  String get unexpectedStoreError;

  /// No description provided for @unableToSubmitRegistration.
  ///
  /// In en, this message translates to:
  /// **'Unable to submit registration.'**
  String get unableToSubmitRegistration;

  /// No description provided for @employeeIdAlreadyRegistered.
  ///
  /// In en, this message translates to:
  /// **'Employee ID is already registered.'**
  String get employeeIdAlreadyRegistered;

  /// No description provided for @verifyOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP'**
  String get verifyOtp;

  /// No description provided for @codeSentTo.
  ///
  /// In en, this message translates to:
  /// **'Code sent to {phone}'**
  String codeSentTo(Object phone);

  /// No description provided for @sixDigitOtp.
  ///
  /// In en, this message translates to:
  /// **'6-digit OTP'**
  String get sixDigitOtp;

  /// No description provided for @verify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get verify;

  /// No description provided for @january.
  ///
  /// In en, this message translates to:
  /// **'January'**
  String get january;

  /// No description provided for @february.
  ///
  /// In en, this message translates to:
  /// **'February'**
  String get february;

  /// No description provided for @march.
  ///
  /// In en, this message translates to:
  /// **'March'**
  String get march;

  /// No description provided for @april.
  ///
  /// In en, this message translates to:
  /// **'April'**
  String get april;

  /// No description provided for @may.
  ///
  /// In en, this message translates to:
  /// **'May'**
  String get may;

  /// No description provided for @june.
  ///
  /// In en, this message translates to:
  /// **'June'**
  String get june;

  /// No description provided for @july.
  ///
  /// In en, this message translates to:
  /// **'July'**
  String get july;

  /// No description provided for @august.
  ///
  /// In en, this message translates to:
  /// **'August'**
  String get august;

  /// No description provided for @september.
  ///
  /// In en, this message translates to:
  /// **'September'**
  String get september;

  /// No description provided for @october.
  ///
  /// In en, this message translates to:
  /// **'October'**
  String get october;

  /// No description provided for @november.
  ///
  /// In en, this message translates to:
  /// **'November'**
  String get november;

  /// No description provided for @december.
  ///
  /// In en, this message translates to:
  /// **'December'**
  String get december;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'th', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+country codes are specified.
  switch (locale.languageCode) {
    case 'zh':
      {
        switch (locale.countryCode) {
          case 'CN':
            return AppLocalizationsZhCn();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'th':
      return AppLocalizationsTh();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
