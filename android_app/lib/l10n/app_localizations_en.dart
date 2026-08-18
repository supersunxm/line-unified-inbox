// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'OPPO LINE OA Chat';

  @override
  String get customer => 'Customer';

  @override
  String get sent => 'Sent';

  @override
  String get customerStatus => 'Customer Status';

  @override
  String get unableToLoadProducts => 'Unable to load products';

  @override
  String get unableToLoadConfigurations => 'Unable to load configurations';

  @override
  String get unableToSaveTags => 'Unable to save conversation tags';

  @override
  String get inbox => 'Inbox';

  @override
  String get all => 'All';

  @override
  String get summary => 'Summary';

  @override
  String get profile => 'Profile';

  @override
  String conversationsCount(Object count) {
    return '$count conversations';
  }

  @override
  String get todayAtAGlance => 'Today at a glance';

  @override
  String get total => 'Total';

  @override
  String get priority => 'Priority';

  @override
  String get urgent => 'Urgent';

  @override
  String get attention => 'Attention';

  @override
  String get normal => 'Normal';

  @override
  String waitingFor(Object duration) {
    return 'Waiting $duration';
  }

  @override
  String get needReply => 'Need Reply';

  @override
  String get completed => 'Completed';

  @override
  String get searchConversations => 'Search conversations';

  @override
  String get clearSearch => 'Clear search';

  @override
  String get noConversationsYet => 'No conversations yet';

  @override
  String get noMatchingConversations => 'No matching conversations';

  @override
  String get noMessagesYet => 'No messages yet';

  @override
  String get sentAnImage => 'Sent an image';

  @override
  String get newCustomerMessage => 'New customer message';

  @override
  String newMessages(Object count) {
    return '$count new messages';
  }

  @override
  String get you => 'You';

  @override
  String get store => 'Store';

  @override
  String get online => 'Online';

  @override
  String get installment => 'Installment';

  @override
  String get profileTooltip => 'Profile';

  @override
  String get supportQueue => 'Support queue';

  @override
  String get previousMonth => 'Previous month';

  @override
  String get nextMonth => 'Next month';

  @override
  String get monthlyActivity => 'Monthly activity';

  @override
  String get loadingMonthlySummary => 'Loading monthly summary…';

  @override
  String get unableToLoadSummary => 'Unable to load summary. Please try again.';

  @override
  String get summaryUnavailable => 'Summary data is unavailable.';

  @override
  String get noActivity => 'No activity';

  @override
  String get noActivityThisMonth =>
      'There is no customer activity for this month.';

  @override
  String get dataQuality => 'Data quality';

  @override
  String get qaExcluded =>
      'QA conversations are excluded from business analytics.';

  @override
  String get analyticsQualityUnknown =>
      'Analytics quality could not be confirmed.';

  @override
  String get incomingMessages => 'Incoming Messages';

  @override
  String get customerConversations => 'Customer Conversations';

  @override
  String get responsePerformance => 'Response performance';

  @override
  String get collectingResponseData => 'Collecting response data';

  @override
  String get responseDataAfterReplies =>
      'Response metrics will appear after enough verified BM replies are recorded.';

  @override
  String verifiedResponses(Object count, Object minimum) {
    return 'Verified responses $count / $minimum required';
  }

  @override
  String get responseRate => 'Response rate';

  @override
  String get medianResponseTime => 'Median response time';

  @override
  String get averageResponseTime => 'Average response time';

  @override
  String get responses => 'responses';

  @override
  String get previousPeriodUnavailable =>
      'Previous-period comparison unavailable';

  @override
  String get comparedPreviousPeriod => 'Compared with the previous period';

  @override
  String hoursMinutes(Object hours, Object minutes) {
    return '${hours}h ${minutes}m';
  }

  @override
  String minutes(Object minutes) {
    return '${minutes}m';
  }

  @override
  String get back => 'Back';

  @override
  String get customerProfile => 'Customer profile';

  @override
  String get moreActions => 'More actions';

  @override
  String get storeContext => 'Store context';

  @override
  String get storeUnavailable => 'Store unavailable';

  @override
  String storeCode(Object code) {
    return 'Store code: $code';
  }

  @override
  String get conversationContext => 'Conversation context';

  @override
  String get replyStatus => 'Reply status';

  @override
  String get unreadMessages => 'Unread messages';

  @override
  String get messagesInView => 'Messages in view';

  @override
  String get latestActivity => 'Latest activity';

  @override
  String get openImage => 'Open image';

  @override
  String get imageProcessing => 'Image processing…';

  @override
  String get loadingImage => 'Loading image…';

  @override
  String get imageUnavailable => 'Image unavailable';

  @override
  String get sendImageQuestion => 'Send image?';

  @override
  String get cancel => 'Cancel';

  @override
  String get send => 'Send';

  @override
  String get retry => 'Retry';

  @override
  String get sending => 'Sending…';

  @override
  String get failedRetry => 'Failed · Retry';

  @override
  String get attachImage => 'Attach image';

  @override
  String get takePhoto => 'Take Photo';

  @override
  String get chooseFromGallery => 'Gallery';

  @override
  String get cameraPermissionRequired =>
      'Camera permission is required to take photos';

  @override
  String get replyToCustomer => 'Reply to customer';

  @override
  String get sendReply => 'Send reply';

  @override
  String get conversationTags => 'Customer Tags';

  @override
  String get customerTags => 'Customer Tags';

  @override
  String get purchaseInformation => 'Purchase Information';

  @override
  String get customerSalesInformation => 'Customer Sales Info';

  @override
  String get statusInterested => 'Interested';

  @override
  String get statusPurchased => 'Purchased';

  @override
  String get interestLevel => 'Interest Level';

  @override
  String get interestHot => 'Hot';

  @override
  String get interestWarm => 'Warm';

  @override
  String get interestCold => 'Cold';

  @override
  String get interestNotSpecified => 'Not specified';

  @override
  String get confirmCustomerInfo => 'Confirm Customer Information';

  @override
  String get confirmSave => 'Confirm Save';

  @override
  String get confirmPurchase => 'Confirm Purchase';

  @override
  String get convertToPurchased => 'Convert to Purchased';

  @override
  String get customerInfoSaved => 'Customer sales information saved';

  @override
  String get convertedToPurchasedNotice => 'Customer converted to Purchased';

  @override
  String get conversionTime => 'Conversion Time';

  @override
  String get productsInterested => 'Products Interested In';

  @override
  String get productsPurchased => 'Products Purchased';

  @override
  String get addProduct => '+ Add Product';

  @override
  String get quantity => 'Qty';

  @override
  String get paymentCash => 'Cash';

  @override
  String get paymentCreditCard => 'Credit Card';

  @override
  String get paymentOther => 'Other';

  @override
  String get noCustomerSalesInfo => 'No sales information recorded';

  @override
  String get purchaseChannel => 'Purchase Channel';

  @override
  String get paymentMethod => 'Payment Method';

  @override
  String get recordedBy => 'Recorded by';

  @override
  String get recordedAt => 'Recorded at';

  @override
  String get aiInsight => 'AI Insight';

  @override
  String get noPurchaseInformation => 'No verified purchase information';

  @override
  String get editPurchaseInformation => 'Edit Sales Information';

  @override
  String get addTags => '+ Add tags';

  @override
  String get close => 'Close';

  @override
  String get clear => 'Clear';

  @override
  String get clearAll => 'Clear all';

  @override
  String get save => 'Save';

  @override
  String get customerSource => 'Customer source';

  @override
  String get product => 'Product';

  @override
  String get searchProduct => 'Search product...';

  @override
  String get noMatchingProducts => 'No matching products';

  @override
  String get configuration => 'Configuration';

  @override
  String get loadingConfigurations => 'Loading configurations...';

  @override
  String get noVariantsAvailable => 'No variants available for this product';

  @override
  String get clearVariant => 'Clear variant';

  @override
  String get change => 'Change';

  @override
  String get ram => 'RAM';

  @override
  String get rom => 'ROM';

  @override
  String get color => 'Color';

  @override
  String get login => 'Sign in';

  @override
  String get signInApproved => 'Sign in with your approved account.';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get createBmAccount => 'Create account';

  @override
  String get name => 'Name (English only)';

  @override
  String get employeeId => 'Employee ID';

  @override
  String get role => 'Role';

  @override
  String get confirmPassword => 'Confirm password';

  @override
  String get passwordRequirement => 'Password';

  @override
  String get passwordConditionsTitle => 'Password requirements';

  @override
  String get passwordConditions =>
      '✓ At least 12 characters\n✓ At least 1 uppercase letter (A-Z)\n✓ At least 1 lowercase letter (a-z)\n✓ At least 1 number (0-9)\n✓ At least 1 special character (@#\$%^&*...)';

  @override
  String get submitRegistration => 'Create account';

  @override
  String get staff => 'PC';

  @override
  String get storeManager => 'BM';

  @override
  String get pendingApproval => 'Pending approval';

  @override
  String get pendingApprovalMessage =>
      'Your account is waiting for approval.\n\nThis usually takes up to one day.\n\nFor faster approval, contact LINE ID:\n\nsunny_typee\n\nOr scan the QR code.';

  @override
  String get backToLogin => 'Back to login';

  @override
  String get waitingForApproval => 'Waiting for approval';

  @override
  String get waitingApprovalMessage =>
      'Your store manager or HQ must approve your account before you can access conversations.';

  @override
  String get checkAgain => 'Check again';

  @override
  String get noPendingRegistrations => 'No pending registrations.';

  @override
  String get pendingBmRegistrations => 'Pending BM registrations';

  @override
  String get reject => 'Reject';

  @override
  String get approve => 'Approve';

  @override
  String employeeIdValue(Object value) {
    return 'Employee ID: $value';
  }

  @override
  String get notSet => 'Not set';

  @override
  String get account => 'Account';

  @override
  String get platformRole => 'Platform role';

  @override
  String get assignedStores => 'Assigned stores';

  @override
  String get noMemberships => 'No store memberships assigned.';

  @override
  String get settings => 'Settings';

  @override
  String get personalInformation => 'Personal Information';

  @override
  String get language => 'Language';

  @override
  String get notifications => 'Notifications';

  @override
  String get appearance => 'Appearance';

  @override
  String get accountSecurity => 'Account & Security';

  @override
  String get managedByOrganization => 'Managed by your organization';

  @override
  String get about => 'About';

  @override
  String get comingSoon => 'Coming soon';

  @override
  String get adminTools => 'Admin tools';

  @override
  String get signOut => 'Sign out';

  @override
  String get adminApprovals => 'Pending BM registrations';

  @override
  String get languageTitle => 'Language';

  @override
  String get thaiLanguage => 'ไทย';

  @override
  String get englishLanguage => 'English';

  @override
  String get simplifiedChineseLanguage => '简体中文';

  @override
  String get roleAdmin => 'Admin';

  @override
  String get roleViewer => 'Viewer';

  @override
  String get roleStoreManager => 'Store manager';

  @override
  String get roleStaff => 'Staff';

  @override
  String get nameRequired => 'Name is required.';

  @override
  String get employeeIdRequired => 'Employee ID is required.';

  @override
  String get selectStore => 'Select a store.';

  @override
  String get passwordsDoNotMatch => 'Passwords do not match.';

  @override
  String get invalidCredentials => 'Invalid email or password.';

  @override
  String get accountPendingMessage =>
      'Your account is waiting for administrator approval.';

  @override
  String get accountRejectedMessage =>
      'This account was rejected. Please contact an administrator.';

  @override
  String get unableToSignIn => 'Unable to sign in. Please try again.';

  @override
  String get cannotReachBackend =>
      'Cannot reach the backend. Check the API URL and network connection.';

  @override
  String get unexpectedStoreError => 'Unexpected error while loading stores.';

  @override
  String get unableToSubmitRegistration => 'Unable to submit registration.';

  @override
  String get employeeIdAlreadyRegistered =>
      'Employee ID is already registered.';

  @override
  String get verifyOtp => 'Verify OTP';

  @override
  String codeSentTo(Object phone) {
    return 'Code sent to $phone';
  }

  @override
  String get sixDigitOtp => '6-digit OTP';

  @override
  String get verify => 'Verify';

  @override
  String get january => 'January';

  @override
  String get february => 'February';

  @override
  String get march => 'March';

  @override
  String get april => 'April';

  @override
  String get may => 'May';

  @override
  String get june => 'June';

  @override
  String get july => 'July';

  @override
  String get august => 'August';

  @override
  String get september => 'September';

  @override
  String get october => 'October';

  @override
  String get november => 'November';

  @override
  String get december => 'December';

  @override
  String get customerInsights => 'Customer insights';

  @override
  String get customerTagCoverage => 'Customer Tag Coverage';

  @override
  String get eligibleConversations => 'Eligible conversations';

  @override
  String get taggedConversations => 'Tagged conversations';

  @override
  String get coverageQuality => 'Coverage quality';

  @override
  String get coverageLow => 'Low coverage';

  @override
  String get coveragePartial => 'Partial coverage';

  @override
  String get coverageModerate => 'Moderate coverage';

  @override
  String get coverageStrong => 'Strong coverage';

  @override
  String get tagCoverageWarning =>
      'Tag more conversations to improve customer insight accuracy.';

  @override
  String get sourceStoreOnly => 'Store only';

  @override
  String get sourceOnlineOnly => 'Online only';

  @override
  String get sourceStoreAndOnline => 'Store + Online';

  @override
  String get sourceUntagged => 'Not tagged';

  @override
  String get installmentCustomerAnalytics => 'Installment Customer Analytics';

  @override
  String get installmentCustomers => 'Installment Customers';

  @override
  String installmentEligibleRate(Object percent) {
    return '$percent of eligible conversations have installment customer tags.';
  }

  @override
  String installmentTaggedRate(Object percent) {
    return '$percent of tagged conversations have installment customer status.';
  }

  @override
  String get topProducts => 'Top products';

  @override
  String get topConfigurations => 'Top configurations';

  @override
  String get noTaggedData => 'No manual tag data for this period.';

  @override
  String get currentTagSnapshot => 'Based on current tags';

  @override
  String get faster => 'faster';

  @override
  String get slower => 'slower';

  @override
  String get percentagePoints => 'pp';

  @override
  String get volumeComparison => 'Activity vs previous period';

  @override
  String get comparisonUnavailable => 'Comparison unavailable for this period';

  @override
  String get underFourHours => '< 4h';

  @override
  String get fourToTwelveHours => '4–12h';

  @override
  String get twelveToTwentyFourHours => '12–24h';

  @override
  String get overTwentyFourHours => '≥ 24h';

  @override
  String get newVersionAvailable => 'New Version Available';

  @override
  String get updateRequired => 'Update Required';

  @override
  String get updateNow => 'Update Now';

  @override
  String get later => 'Later';

  @override
  String get whatsNew => 'What\'s new';

  @override
  String get currentVersion => 'Current version';

  @override
  String get latestVersion => 'Latest version';

  @override
  String get checkForUpdates => 'Check for updates';

  @override
  String get alreadyLatestVersion => 'You are using the latest version';

  @override
  String get unableToCheckUpdates => 'Unable to check for updates';

  @override
  String get downloadingApk => 'Opening download page...';
}
