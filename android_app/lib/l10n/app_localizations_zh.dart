// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appName => 'OPPO LINE OA Chat';

  @override
  String get customer => '客户';

  @override
  String get sent => '已发送';

  @override
  String get customerStatus => '客户状态';

  @override
  String get unableToLoadProducts => '无法加载产品';

  @override
  String get unableToLoadConfigurations => '无法加载配置';

  @override
  String get unableToSaveTags => '无法保存会话标签';

  @override
  String get inbox => '消息';

  @override
  String get all => '全部';

  @override
  String get summary => '汇总';

  @override
  String get profile => '个人资料';

  @override
  String conversationsCount(Object count) {
    return '$count 个会话';
  }

  @override
  String get todayAtAGlance => '今日概览';

  @override
  String get total => '全部';

  @override
  String get priority => '优先处理';

  @override
  String get urgent => '紧急';

  @override
  String get attention => '需跟进';

  @override
  String get normal => '正常';

  @override
  String waitingFor(Object duration) {
    return '等待回复 $duration';
  }

  @override
  String get needReply => '待回复';

  @override
  String get completed => '已回复';

  @override
  String get searchConversations => '搜索会话';

  @override
  String get clearSearch => '清除搜索';

  @override
  String get noConversationsYet => '暂无会话';

  @override
  String get noMatchingConversations => '没有匹配的会话';

  @override
  String get noMessagesYet => '暂无消息';

  @override
  String get sentAnImage => '发送了一张图片';

  @override
  String get newCustomerMessage => '新的客户消息';

  @override
  String newMessages(Object count) {
    return '$count 条新消息';
  }

  @override
  String get you => '你';

  @override
  String get store => '门店';

  @override
  String get online => '线上';

  @override
  String get installment => '分期';

  @override
  String get profileTooltip => '个人资料';

  @override
  String get supportQueue => '客服队列';

  @override
  String get previousMonth => '上个月';

  @override
  String get nextMonth => '下个月';

  @override
  String get monthlyActivity => '月度活动';

  @override
  String get loadingMonthlySummary => '正在加载月度汇总…';

  @override
  String get unableToLoadSummary => '无法加载汇总，请重试。';

  @override
  String get summaryUnavailable => '汇总数据不可用。';

  @override
  String get noActivity => '暂无活动';

  @override
  String get noActivityThisMonth => '本月暂无客户活动。';

  @override
  String get dataQuality => '数据质量';

  @override
  String get qaExcluded => 'QA 会话不计入业务分析。';

  @override
  String get analyticsQualityUnknown => '无法确认分析质量。';

  @override
  String get incomingMessages => '收到的消息';

  @override
  String get customerConversations => '客户会话';

  @override
  String get responsePerformance => '回复表现';

  @override
  String get collectingResponseData => '正在收集回复数据';

  @override
  String get responseDataAfterReplies => '收集足够的已验证 BM 回复后将显示回复指标。';

  @override
  String verifiedResponses(Object count, Object minimum) {
    return '已验证回复 $count / 需要 $minimum 条';
  }

  @override
  String get responseRate => '回复率';

  @override
  String get medianResponseTime => '回复时间中位数';

  @override
  String get averageResponseTime => '平均回复时间';

  @override
  String get responses => '条回复';

  @override
  String get previousPeriodUnavailable => '无法比较上一周期';

  @override
  String get comparedPreviousPeriod => '与上一周期比较';

  @override
  String hoursMinutes(Object hours, Object minutes) {
    return '$hours小时$minutes分钟';
  }

  @override
  String minutes(Object minutes) {
    return '$minutes分钟';
  }

  @override
  String get back => '返回';

  @override
  String get customerProfile => '客户资料';

  @override
  String get moreActions => '更多操作';

  @override
  String get storeContext => '门店信息';

  @override
  String get storeUnavailable => '门店信息不可用';

  @override
  String storeCode(Object code) {
    return '门店编号：$code';
  }

  @override
  String get conversationContext => '会话信息';

  @override
  String get replyStatus => '回复状态';

  @override
  String get unreadMessages => '未读消息';

  @override
  String get messagesInView => '当前消息数';

  @override
  String get latestActivity => '最近活动';

  @override
  String get openImage => '打开图片';

  @override
  String get imageProcessing => '正在处理图片…';

  @override
  String get loadingImage => '正在加载图片…';

  @override
  String get imageUnavailable => '图片不可用';

  @override
  String get sendImageQuestion => '发送图片？';

  @override
  String get cancel => '取消';

  @override
  String get send => '发送';

  @override
  String get retry => '重试';

  @override
  String get sending => '发送中…';

  @override
  String get failedRetry => '失败 · 重试';

  @override
  String get attachImage => '添加图片';

  @override
  String get takePhoto => '拍照';

  @override
  String get chooseFromGallery => '相册';

  @override
  String get cameraPermissionRequired => '需要相机权限才能拍照';

  @override
  String get replyToCustomer => '回复客户';

  @override
  String get sendReply => '发送回复';

  @override
  String get conversationTags => '客户标签';

  @override
  String get customerTags => '客户标签';

  @override
  String get purchaseInformation => '购买信息';

  @override
  String get customerSalesInformation => '客户销售信息';

  @override
  String get statusInterested => '有意向';

  @override
  String get statusPurchased => '已购买';

  @override
  String get interestLevel => '意向程度';

  @override
  String get interestHot => '高 (Hot)';

  @override
  String get interestWarm => '中 (Warm)';

  @override
  String get interestCold => '低 (Cold)';

  @override
  String get interestNotSpecified => '未指定';

  @override
  String get confirmCustomerInfo => '确认客户信息';

  @override
  String get confirmSave => '确认保存';

  @override
  String get confirmPurchase => '确认购买';

  @override
  String get convertToPurchased => '转为已购买';

  @override
  String get customerInfoSaved => '客户销售信息已保存';

  @override
  String get convertedToPurchasedNotice => '客户状态已转为已购买';

  @override
  String get conversionTime => '转化耗时';

  @override
  String get productsInterested => '意向商品';

  @override
  String get productsPurchased => '已购商品';

  @override
  String get addProduct => '+ 添加商品';

  @override
  String get quantity => '数量';

  @override
  String get paymentCash => '现金';

  @override
  String get paymentCreditCard => '信用卡';

  @override
  String get paymentOther => '其他';

  @override
  String get noCustomerSalesInfo => '暂无销售记录';

  @override
  String get purchaseChannel => '购买渠道';

  @override
  String get paymentMethod => '支付方式';

  @override
  String get recordedBy => '记录人';

  @override
  String get recordedAt => '记录时间';

  @override
  String get aiInsight => 'AI 洞察';

  @override
  String get noPurchaseInformation => '暂无已验证的购买信息';

  @override
  String get editPurchaseInformation => '编辑销售信息';

  @override
  String get addTags => '+ 添加标签';

  @override
  String get close => '关闭';

  @override
  String get clear => '清除';

  @override
  String get clearAll => '全部清除';

  @override
  String get save => '保存';

  @override
  String get customerSource => '客户来源';

  @override
  String get product => '产品';

  @override
  String get searchProduct => '搜索产品...';

  @override
  String get noMatchingProducts => '没有匹配的产品';

  @override
  String get configuration => '配置';

  @override
  String get loadingConfigurations => '正在加载配置...';

  @override
  String get noVariantsAvailable => '该产品没有可用配置';

  @override
  String get clearVariant => '清除配置';

  @override
  String get change => '更改';

  @override
  String get ram => 'RAM';

  @override
  String get rom => 'ROM';

  @override
  String get color => '颜色';

  @override
  String get login => '登录';

  @override
  String get signInApproved => '使用已批准的账号登录。';

  @override
  String get email => '电子邮箱';

  @override
  String get password => '密码';

  @override
  String get createBmAccount => '注册账号';

  @override
  String get name => '姓名（仅限英文）';

  @override
  String get employeeId => '员工编号';

  @override
  String get role => '角色';

  @override
  String get confirmPassword => '确认密码';

  @override
  String get passwordRequirement => '密码';

  @override
  String get passwordConditionsTitle => '密码要求';

  @override
  String get passwordConditions =>
      '✓ 至少 12 个字符\n✓ 至少 1 个大写英文字母（A-Z）\n✓ 至少 1 个小写英文字母（a-z）\n✓ 至少 1 个数字（0-9）\n✓ 至少 1 个特殊字符（@#\$%^&*...）';

  @override
  String get submitRegistration => '注册账号';

  @override
  String get staff => 'PC';

  @override
  String get storeManager => 'BM';

  @override
  String get pendingApproval => '等待批准';

  @override
  String get pendingApprovalMessage =>
      '您的账号正在等待批准。\n\n通常不超过 1 天。\n\n如需更快批准，请联系 LINE ID：\n\nsunny_typee\n\n或扫描二维码。';

  @override
  String get backToLogin => '返回登录';

  @override
  String get waitingForApproval => '等待批准';

  @override
  String get waitingApprovalMessage => '门店经理或总部批准账号后，才能访问会话。';

  @override
  String get checkAgain => '再次检查';

  @override
  String get noPendingRegistrations => '没有待处理的注册。';

  @override
  String get pendingBmRegistrations => '待批准的 BM 注册';

  @override
  String get reject => '拒绝';

  @override
  String get approve => '批准';

  @override
  String employeeIdValue(Object value) {
    return '员工编号：$value';
  }

  @override
  String get notSet => '未设置';

  @override
  String get account => '账号';

  @override
  String get platformRole => '平台角色';

  @override
  String get assignedStores => '所属门店';

  @override
  String get noMemberships => '尚未分配门店。';

  @override
  String get settings => '设置';

  @override
  String get personalInformation => '个人信息';

  @override
  String get language => '语言';

  @override
  String get notifications => '通知';

  @override
  String get appearance => '外观';

  @override
  String get accountSecurity => '账号与安全';

  @override
  String get managedByOrganization => '由您的组织管理';

  @override
  String get about => '关于';

  @override
  String get comingSoon => '即将推出';

  @override
  String get adminTools => '管理员工具';

  @override
  String get signOut => '退出登录';

  @override
  String get adminApprovals => '待批准的 BM 注册';

  @override
  String get languageTitle => '语言';

  @override
  String get thaiLanguage => 'ไทย';

  @override
  String get englishLanguage => 'English';

  @override
  String get simplifiedChineseLanguage => '简体中文';

  @override
  String get roleAdmin => '管理员';

  @override
  String get roleViewer => '查看者';

  @override
  String get roleStoreManager => '门店经理';

  @override
  String get roleStaff => '员工';

  @override
  String get nameRequired => '请输入姓名。';

  @override
  String get employeeIdRequired => '请输入员工编号。';

  @override
  String get selectStore => '请选择门店。';

  @override
  String get passwordsDoNotMatch => '两次输入的密码不一致。';

  @override
  String get invalidCredentials => '电子邮箱或密码不正确。';

  @override
  String get accountPendingMessage => '您的账号正在等待管理员批准。';

  @override
  String get accountRejectedMessage => '该账号已被拒绝，请联系管理员。';

  @override
  String get unableToSignIn => '无法登录，请重试。';

  @override
  String get cannotReachBackend => '无法连接服务，请检查 API 地址和网络连接。';

  @override
  String get unexpectedStoreError => '加载门店时发生错误。';

  @override
  String get unableToSubmitRegistration => '无法提交注册。';

  @override
  String get employeeIdAlreadyRegistered => '该员工编号已被注册。';

  @override
  String get verifyOtp => '验证 OTP';

  @override
  String codeSentTo(Object phone) {
    return '验证码已发送至 $phone';
  }

  @override
  String get sixDigitOtp => '6 位 OTP';

  @override
  String get verify => '验证';

  @override
  String get january => '一月';

  @override
  String get february => '二月';

  @override
  String get march => '三月';

  @override
  String get april => '四月';

  @override
  String get may => '五月';

  @override
  String get june => '六月';

  @override
  String get july => '七月';

  @override
  String get august => '八月';

  @override
  String get september => '九月';

  @override
  String get october => '十月';

  @override
  String get november => '十一月';

  @override
  String get december => '十二月';

  @override
  String get customerInsights => '客户洞察';

  @override
  String get customerTagCoverage => '客户标签覆盖率';

  @override
  String get eligibleConversations => '符合条件的对话';

  @override
  String get taggedConversations => '已标记对话';

  @override
  String get coverageQuality => '覆盖质量';

  @override
  String get coverageLow => '覆盖率低';

  @override
  String get coveragePartial => '覆盖率部分';

  @override
  String get coverageModerate => '覆盖率中等';

  @override
  String get coverageStrong => '覆盖率高';

  @override
  String get tagCoverageWarning => '为更多对话添加标签，以提高客户洞察的准确性。';

  @override
  String get sourceStoreOnly => '仅门店';

  @override
  String get sourceOnlineOnly => '仅线上';

  @override
  String get sourceStoreAndOnline => '门店 + 线上';

  @override
  String get sourceUntagged => '未标记';

  @override
  String get installmentCustomerAnalytics => '分期购买客户分析';

  @override
  String get installmentCustomers => '分期购买客户';

  @override
  String installmentEligibleRate(Object percent) {
    return '$percent 的符合条件对话具有分期购买客户标签';
  }

  @override
  String installmentTaggedRate(Object percent) {
    return '$percent 的已标记对话具有分期购买客户状态';
  }

  @override
  String get topProducts => '热门产品';

  @override
  String get topConfigurations => '热门配置';

  @override
  String get noTaggedData => '此期间没有手动标签数据。';

  @override
  String get currentTagSnapshot => '基于当前标签';

  @override
  String get faster => '更快';

  @override
  String get slower => '更慢';

  @override
  String get percentagePoints => '个百分点';

  @override
  String get volumeComparison => '与上一期间的活动对比';

  @override
  String get responseComparison => '与上一期间的回复对比';

  @override
  String get comparisonUnavailable => '此期间没有可用的对比数据';

  @override
  String get underFourHours => '< 4小时';

  @override
  String get fourToTwelveHours => '4–12小时';

  @override
  String get twelveToTwentyFourHours => '12–24小时';

  @override
  String get overTwentyFourHours => '≥ 24小时';
}

/// The translations for Chinese, as used in China (`zh_CN`).
class AppLocalizationsZhCn extends AppLocalizationsZh {
  AppLocalizationsZhCn() : super('zh_CN');

  @override
  String get appName => 'OPPO LINE OA Chat';

  @override
  String get customer => '客户';

  @override
  String get sent => '已发送';

  @override
  String get customerStatus => '客户状态';

  @override
  String get unableToLoadProducts => '无法加载产品';

  @override
  String get unableToLoadConfigurations => '无法加载配置';

  @override
  String get unableToSaveTags => '无法保存会话标签';

  @override
  String get inbox => '消息';

  @override
  String get all => '全部';

  @override
  String get summary => '汇总';

  @override
  String get profile => '个人资料';

  @override
  String conversationsCount(Object count) {
    return '$count 个会话';
  }

  @override
  String get todayAtAGlance => '今日概览';

  @override
  String get total => '全部';

  @override
  String get priority => '优先处理';

  @override
  String get urgent => '紧急';

  @override
  String get attention => '需跟进';

  @override
  String get normal => '正常';

  @override
  String waitingFor(Object duration) {
    return '等待回复 $duration';
  }

  @override
  String get needReply => '待回复';

  @override
  String get completed => '已回复';

  @override
  String get searchConversations => '搜索会话';

  @override
  String get clearSearch => '清除搜索';

  @override
  String get noConversationsYet => '暂无会话';

  @override
  String get noMatchingConversations => '没有匹配的会话';

  @override
  String get noMessagesYet => '暂无消息';

  @override
  String get sentAnImage => '发送了一张图片';

  @override
  String get newCustomerMessage => '新的客户消息';

  @override
  String newMessages(Object count) {
    return '$count 条新消息';
  }

  @override
  String get you => '你';

  @override
  String get store => '门店';

  @override
  String get online => '线上';

  @override
  String get installment => '分期';

  @override
  String get profileTooltip => '个人资料';

  @override
  String get supportQueue => '客服队列';

  @override
  String get previousMonth => '上个月';

  @override
  String get nextMonth => '下个月';

  @override
  String get monthlyActivity => '月度活动';

  @override
  String get loadingMonthlySummary => '正在加载月度汇总…';

  @override
  String get unableToLoadSummary => '无法加载汇总，请重试。';

  @override
  String get summaryUnavailable => '汇总数据不可用。';

  @override
  String get noActivity => '暂无活动';

  @override
  String get noActivityThisMonth => '本月暂无客户活动。';

  @override
  String get dataQuality => '数据质量';

  @override
  String get qaExcluded => 'QA 会话不计入业务分析。';

  @override
  String get analyticsQualityUnknown => '无法确认分析质量。';

  @override
  String get incomingMessages => '收到的消息';

  @override
  String get customerConversations => '客户会话';

  @override
  String get responsePerformance => '回复表现';

  @override
  String get collectingResponseData => '正在收集回复数据';

  @override
  String get responseDataAfterReplies => '收集足够的已验证 BM 回复后将显示回复指标。';

  @override
  String verifiedResponses(Object count, Object minimum) {
    return '已验证回复 $count / 需要 $minimum 条';
  }

  @override
  String get responseRate => '回复率';

  @override
  String get medianResponseTime => '回复时间中位数';

  @override
  String get averageResponseTime => '平均回复时间';

  @override
  String get responses => '条回复';

  @override
  String get previousPeriodUnavailable => '无法比较上一周期';

  @override
  String get comparedPreviousPeriod => '与上一周期比较';

  @override
  String hoursMinutes(Object hours, Object minutes) {
    return '$hours小时$minutes分钟';
  }

  @override
  String minutes(Object minutes) {
    return '$minutes分钟';
  }

  @override
  String get back => '返回';

  @override
  String get customerProfile => '客户资料';

  @override
  String get moreActions => '更多操作';

  @override
  String get storeContext => '门店信息';

  @override
  String get storeUnavailable => '门店信息不可用';

  @override
  String storeCode(Object code) {
    return '门店编号：$code';
  }

  @override
  String get conversationContext => '会话信息';

  @override
  String get replyStatus => '回复状态';

  @override
  String get unreadMessages => '未读消息';

  @override
  String get messagesInView => '当前消息数';

  @override
  String get latestActivity => '最近活动';

  @override
  String get openImage => '打开图片';

  @override
  String get imageProcessing => '正在处理图片…';

  @override
  String get loadingImage => '正在加载图片…';

  @override
  String get imageUnavailable => '图片不可用';

  @override
  String get sendImageQuestion => '发送图片？';

  @override
  String get cancel => '取消';

  @override
  String get send => '发送';

  @override
  String get retry => '重试';

  @override
  String get sending => '发送中…';

  @override
  String get failedRetry => '失败 · 重试';

  @override
  String get attachImage => '添加图片';

  @override
  String get takePhoto => '拍照';

  @override
  String get chooseFromGallery => '相册';

  @override
  String get cameraPermissionRequired => '需要相机权限才能拍照';

  @override
  String get replyToCustomer => '回复客户';

  @override
  String get sendReply => '发送回复';

  @override
  String get conversationTags => '客户标签';

  @override
  String get customerTags => '客户标签';

  @override
  String get purchaseInformation => '购买信息';

  @override
  String get customerSalesInformation => '客户销售信息';

  @override
  String get statusInterested => '有意向';

  @override
  String get statusPurchased => '已购买';

  @override
  String get interestLevel => '意向程度';

  @override
  String get interestHot => '高 (Hot)';

  @override
  String get interestWarm => '中 (Warm)';

  @override
  String get interestCold => '低 (Cold)';

  @override
  String get interestNotSpecified => '未指定';

  @override
  String get confirmCustomerInfo => '确认客户信息';

  @override
  String get confirmSave => '确认保存';

  @override
  String get confirmPurchase => '确认购买';

  @override
  String get convertToPurchased => '转为已购买';

  @override
  String get customerInfoSaved => '客户销售信息已保存';

  @override
  String get convertedToPurchasedNotice => '客户状态已转为已购买';

  @override
  String get conversionTime => '转化耗时';

  @override
  String get productsInterested => '意向商品';

  @override
  String get productsPurchased => '已购商品';

  @override
  String get addProduct => '+ 添加商品';

  @override
  String get quantity => '数量';

  @override
  String get paymentCash => '现金';

  @override
  String get paymentCreditCard => '信用卡';

  @override
  String get paymentOther => '其他';

  @override
  String get noCustomerSalesInfo => '暂无销售记录';

  @override
  String get purchaseChannel => '购买渠道';

  @override
  String get paymentMethod => '支付方式';

  @override
  String get recordedBy => '记录人';

  @override
  String get recordedAt => '记录时间';

  @override
  String get aiInsight => 'AI 洞察';

  @override
  String get noPurchaseInformation => '暂无已验证的购买信息';

  @override
  String get editPurchaseInformation => '编辑销售信息';

  @override
  String get addTags => '+ 添加标签';

  @override
  String get close => '关闭';

  @override
  String get clear => '清除';

  @override
  String get clearAll => '全部清除';

  @override
  String get save => '保存';

  @override
  String get customerSource => '客户来源';

  @override
  String get product => '产品';

  @override
  String get searchProduct => '搜索产品...';

  @override
  String get noMatchingProducts => '没有匹配的产品';

  @override
  String get configuration => '配置';

  @override
  String get loadingConfigurations => '正在加载配置...';

  @override
  String get noVariantsAvailable => '该产品没有可用配置';

  @override
  String get clearVariant => '清除配置';

  @override
  String get change => '更改';

  @override
  String get ram => 'RAM';

  @override
  String get rom => 'ROM';

  @override
  String get color => '颜色';

  @override
  String get login => '登录';

  @override
  String get signInApproved => '使用已批准的账号登录。';

  @override
  String get email => '电子邮箱';

  @override
  String get password => '密码';

  @override
  String get createBmAccount => '注册账号';

  @override
  String get name => '姓名（仅限英文）';

  @override
  String get employeeId => '员工编号';

  @override
  String get role => '角色';

  @override
  String get confirmPassword => '确认密码';

  @override
  String get passwordRequirement => '密码';

  @override
  String get passwordConditionsTitle => '密码要求';

  @override
  String get passwordConditions =>
      '✓ 至少 12 个字符\n✓ 至少 1 个大写英文字母（A-Z）\n✓ 至少 1 个小写英文字母（a-z）\n✓ 至少 1 个数字（0-9）\n✓ 至少 1 个特殊字符（@#\$%^&*...）';

  @override
  String get submitRegistration => '注册账号';

  @override
  String get staff => 'PC';

  @override
  String get storeManager => 'BM';

  @override
  String get pendingApproval => '等待批准';

  @override
  String get pendingApprovalMessage =>
      '您的账号正在等待批准。\n\n通常不超过 1 天。\n\n如需更快批准，请联系 LINE ID：\n\nsunny_typee\n\n或扫描二维码。';

  @override
  String get backToLogin => '返回登录';

  @override
  String get waitingForApproval => '等待批准';

  @override
  String get waitingApprovalMessage => '门店经理或总部批准账号后，才能访问会话。';

  @override
  String get checkAgain => '再次检查';

  @override
  String get noPendingRegistrations => '没有待处理的注册。';

  @override
  String get pendingBmRegistrations => '待批准的 BM 注册';

  @override
  String get reject => '拒绝';

  @override
  String get approve => '批准';

  @override
  String employeeIdValue(Object value) {
    return '员工编号：$value';
  }

  @override
  String get notSet => '未设置';

  @override
  String get account => '账号';

  @override
  String get platformRole => '平台角色';

  @override
  String get assignedStores => '所属门店';

  @override
  String get noMemberships => '尚未分配门店。';

  @override
  String get settings => '设置';

  @override
  String get personalInformation => '个人信息';

  @override
  String get language => '语言';

  @override
  String get notifications => '通知';

  @override
  String get appearance => '外观';

  @override
  String get accountSecurity => '账号与安全';

  @override
  String get managedByOrganization => '由您的组织管理';

  @override
  String get about => '关于';

  @override
  String get comingSoon => '即将推出';

  @override
  String get adminTools => '管理员工具';

  @override
  String get signOut => '退出登录';

  @override
  String get adminApprovals => '待批准的 BM 注册';

  @override
  String get languageTitle => '语言';

  @override
  String get thaiLanguage => 'ไทย';

  @override
  String get englishLanguage => 'English';

  @override
  String get simplifiedChineseLanguage => '简体中文';

  @override
  String get roleAdmin => '管理员';

  @override
  String get roleViewer => '查看者';

  @override
  String get roleStoreManager => '门店经理';

  @override
  String get roleStaff => '员工';

  @override
  String get nameRequired => '请输入姓名。';

  @override
  String get employeeIdRequired => '请输入员工编号。';

  @override
  String get selectStore => '请选择门店。';

  @override
  String get passwordsDoNotMatch => '两次输入的密码不一致。';

  @override
  String get invalidCredentials => '电子邮箱或密码不正确。';

  @override
  String get accountPendingMessage => '您的账号正在等待管理员批准。';

  @override
  String get accountRejectedMessage => '该账号已被拒绝，请联系管理员。';

  @override
  String get unableToSignIn => '无法登录，请重试。';

  @override
  String get cannotReachBackend => '无法连接服务，请检查 API 地址和网络连接。';

  @override
  String get unexpectedStoreError => '加载门店时发生错误。';

  @override
  String get unableToSubmitRegistration => '无法提交注册。';

  @override
  String get employeeIdAlreadyRegistered => '该员工编号已被注册。';

  @override
  String get verifyOtp => '验证 OTP';

  @override
  String codeSentTo(Object phone) {
    return '验证码已发送至 $phone';
  }

  @override
  String get sixDigitOtp => '6 位 OTP';

  @override
  String get verify => '验证';

  @override
  String get january => '一月';

  @override
  String get february => '二月';

  @override
  String get march => '三月';

  @override
  String get april => '四月';

  @override
  String get may => '五月';

  @override
  String get june => '六月';

  @override
  String get july => '七月';

  @override
  String get august => '八月';

  @override
  String get september => '九月';

  @override
  String get october => '十月';

  @override
  String get november => '十一月';

  @override
  String get december => '十二月';

  @override
  String get customerInsights => '客户洞察';

  @override
  String get customerTagCoverage => '客户标签覆盖率';

  @override
  String get eligibleConversations => '符合条件的对话';

  @override
  String get taggedConversations => '已标记对话';

  @override
  String get coverageQuality => '覆盖质量';

  @override
  String get coverageLow => '覆盖率低';

  @override
  String get coveragePartial => '覆盖率部分';

  @override
  String get coverageModerate => '覆盖率中等';

  @override
  String get coverageStrong => '覆盖率高';

  @override
  String get tagCoverageWarning => '为更多对话添加标签，以提高客户洞察的准确性。';

  @override
  String get sourceStoreOnly => '仅门店';

  @override
  String get sourceOnlineOnly => '仅线上';

  @override
  String get sourceStoreAndOnline => '门店 + 线上';

  @override
  String get sourceUntagged => '未标记';

  @override
  String get installmentCustomerAnalytics => '分期购买客户分析';

  @override
  String get installmentCustomers => '分期购买客户';

  @override
  String installmentEligibleRate(Object percent) {
    return '$percent 的符合条件对话具有分期购买客户标签';
  }

  @override
  String installmentTaggedRate(Object percent) {
    return '$percent 的已标记对话具有分期购买客户状态';
  }

  @override
  String get topProducts => '热门产品';

  @override
  String get topConfigurations => '热门配置';

  @override
  String get noTaggedData => '此期间没有手动标签数据。';

  @override
  String get currentTagSnapshot => '基于当前标签';

  @override
  String get faster => '更快';

  @override
  String get slower => '更慢';

  @override
  String get percentagePoints => '个百分点';

  @override
  String get volumeComparison => '与上一期间的活动对比';

  @override
  String get responseComparison => '与上一期间的回复对比';

  @override
  String get comparisonUnavailable => '此期间没有可用的对比数据';

  @override
  String get underFourHours => '< 4小时';

  @override
  String get fourToTwelveHours => '4–12小时';

  @override
  String get twelveToTwentyFourHours => '12–24小时';

  @override
  String get overTwentyFourHours => '≥ 24小时';
}
