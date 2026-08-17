// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Thai (`th`).
class AppLocalizationsTh extends AppLocalizations {
  AppLocalizationsTh([String locale = 'th']) : super(locale);

  @override
  String get appName => 'LINE OA Chat Hub';

  @override
  String get customer => 'ลูกค้า';

  @override
  String get sent => 'ส่งแล้ว';

  @override
  String get interest => 'ความสนใจ';

  @override
  String get unableToLoadProducts => 'โหลดสินค้าไม่ได้';

  @override
  String get unableToLoadConfigurations => 'โหลดตัวเลือกไม่ได้';

  @override
  String get unableToSaveTags => 'บันทึกแท็กบทสนทนาไม่ได้';

  @override
  String get inbox => 'ข้อความ';

  @override
  String get all => 'ทั้งหมด';

  @override
  String get summary => 'สรุป';

  @override
  String get profile => 'โปรไฟล์';

  @override
  String conversationsCount(Object count) {
    return '$count บทสนทนา';
  }

  @override
  String get todayAtAGlance => 'ภาพรวมวันนี้';

  @override
  String get total => 'ทั้งหมด';

  @override
  String get needReply => 'รอตอบ';

  @override
  String get completed => 'ตอบแล้ว';

  @override
  String get searchConversations => 'ค้นหาบทสนทนา';

  @override
  String get clearSearch => 'ล้างการค้นหา';

  @override
  String get noConversationsYet => 'ยังไม่มีบทสนทนา';

  @override
  String get noMatchingConversations => 'ไม่พบบทสนทนาที่ตรงกัน';

  @override
  String get noMessagesYet => 'ยังไม่มีข้อความ';

  @override
  String get sentAnImage => 'ส่งรูปภาพ';

  @override
  String get newCustomerMessage => 'ข้อความใหม่จากลูกค้า';

  @override
  String newMessages(Object count) {
    return '$count ข้อความใหม่';
  }

  @override
  String get you => 'คุณ';

  @override
  String get store => 'ร้านค้า';

  @override
  String get online => 'ออนไลน์';

  @override
  String get installment => 'ผ่อน';

  @override
  String get profileTooltip => 'โปรไฟล์';

  @override
  String get supportQueue => 'คิวบริการลูกค้า';

  @override
  String get previousMonth => 'เดือนก่อน';

  @override
  String get nextMonth => 'เดือนถัดไป';

  @override
  String get monthlyActivity => 'กิจกรรมรายเดือน';

  @override
  String get loadingMonthlySummary => 'กำลังโหลดสรุปรายเดือน…';

  @override
  String get unableToLoadSummary => 'โหลดสรุปไม่ได้ กรุณาลองอีกครั้ง';

  @override
  String get summaryUnavailable => 'ไม่มีข้อมูลสรุป';

  @override
  String get noActivity => 'ไม่มีกิจกรรม';

  @override
  String get noActivityThisMonth => 'เดือนนี้ยังไม่มีกิจกรรมจากลูกค้า';

  @override
  String get dataQuality => 'คุณภาพข้อมูล';

  @override
  String get qaExcluded => 'ไม่รวมบทสนทนา QA ในการวิเคราะห์ธุรกิจ';

  @override
  String get analyticsQualityUnknown => 'ยังยืนยันคุณภาพการวิเคราะห์ไม่ได้';

  @override
  String get incomingMessages => 'ข้อความเข้า';

  @override
  String get customerConversations => 'บทสนทนาลูกค้า';

  @override
  String get responsePerformance => 'ประสิทธิภาพการตอบ';

  @override
  String get collectingResponseData => 'กำลังรวบรวมข้อมูลการตอบ';

  @override
  String get responseDataAfterReplies =>
      'จะแสดงผลหลังมีการตอบโดย BM ที่ยืนยันเพียงพอ';

  @override
  String verifiedResponses(Object count, Object minimum) {
    return 'การตอบที่ยืนยันแล้ว $count / ต้องการ $minimum';
  }

  @override
  String get responseRate => 'อัตราการตอบ';

  @override
  String get medianResponseTime => 'เวลาตอบค่ามัธยฐาน';

  @override
  String get averageResponseTime => 'เวลาตอบเฉลี่ย';

  @override
  String get responses => 'คำตอบ';

  @override
  String get previousPeriodUnavailable => 'ไม่มีข้อมูลเปรียบเทียบช่วงก่อนหน้า';

  @override
  String get comparedPreviousPeriod => 'เปรียบเทียบกับช่วงก่อนหน้า';

  @override
  String hoursMinutes(Object hours, Object minutes) {
    return '$hours ชม. $minutes นาที';
  }

  @override
  String minutes(Object minutes) {
    return '$minutes นาที';
  }

  @override
  String get back => 'ย้อนกลับ';

  @override
  String get customerProfile => 'โปรไฟล์ลูกค้า';

  @override
  String get moreActions => 'การดำเนินการเพิ่มเติม';

  @override
  String get storeContext => 'ข้อมูลร้าน';

  @override
  String get storeUnavailable => 'ไม่มีข้อมูลร้าน';

  @override
  String storeCode(Object code) {
    return 'รหัสร้าน: $code';
  }

  @override
  String get conversationContext => 'ข้อมูลบทสนทนา';

  @override
  String get replyStatus => 'สถานะการตอบ';

  @override
  String get unreadMessages => 'ข้อความที่ยังไม่อ่าน';

  @override
  String get messagesInView => 'ข้อความที่แสดง';

  @override
  String get latestActivity => 'กิจกรรมล่าสุด';

  @override
  String get openImage => 'เปิดรูปภาพ';

  @override
  String get imageProcessing => 'กำลังประมวลผลรูปภาพ…';

  @override
  String get loadingImage => 'กำลังโหลดรูปภาพ…';

  @override
  String get imageUnavailable => 'ไม่สามารถใช้รูปภาพได้';

  @override
  String get sendImageQuestion => 'ส่งรูปภาพหรือไม่';

  @override
  String get cancel => 'ยกเลิก';

  @override
  String get send => 'ส่ง';

  @override
  String get retry => 'ลองอีกครั้ง';

  @override
  String get sending => 'กำลังส่ง…';

  @override
  String get failedRetry => 'ล้มเหลว · ลองอีกครั้ง';

  @override
  String get attachImage => 'แนบรูปภาพ';

  @override
  String get replyToCustomer => 'ตอบลูกค้า';

  @override
  String get sendReply => 'ส่งคำตอบ';

  @override
  String get conversationTags => 'แท็กบทสนทนา';

  @override
  String get addTags => '+ เพิ่มแท็ก';

  @override
  String get close => 'ปิด';

  @override
  String get clear => 'ล้าง';

  @override
  String get clearAll => 'ล้างทั้งหมด';

  @override
  String get save => 'บันทึก';

  @override
  String get customerSource => 'แหล่งที่มาของลูกค้า';

  @override
  String get product => 'สินค้า';

  @override
  String get searchProduct => 'ค้นหาสินค้า...';

  @override
  String get noMatchingProducts => 'ไม่พบสินค้าที่ตรงกัน';

  @override
  String get configuration => 'การกำหนดค่า';

  @override
  String get loadingConfigurations => 'กำลังโหลดการกำหนดค่า...';

  @override
  String get noVariantsAvailable => 'ไม่มีตัวเลือกสำหรับสินค้านี้';

  @override
  String get clearVariant => 'ล้างตัวเลือก';

  @override
  String get change => 'เปลี่ยน';

  @override
  String get ram => 'RAM';

  @override
  String get rom => 'ROM';

  @override
  String get color => 'สี';

  @override
  String get login => 'เข้าสู่ระบบ';

  @override
  String get signInApproved => 'เข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ';

  @override
  String get email => 'อีเมล';

  @override
  String get password => 'รหัสผ่าน';

  @override
  String get createBmAccount => 'สมัครสมาชิก';

  @override
  String get name => 'ชื่อ-สกุล ภาษาอังกฤษเท่านั้น';

  @override
  String get employeeId => 'รหัสพนักงาน';

  @override
  String get role => 'ตำแหน่ง';

  @override
  String get confirmPassword => 'ยืนยันรหัสผ่าน';

  @override
  String get passwordRequirement => 'รหัสผ่าน';

  @override
  String get passwordConditionsTitle => 'เงื่อนไขรหัสผ่าน';

  @override
  String get passwordConditions =>
      '✓ ความยาวอย่างน้อย 12 ตัวอักษร\n✓ มีตัวอักษรภาษาอังกฤษตัวใหญ่ (A-Z) อย่างน้อย 1 ตัว\n✓ มีตัวอักษรภาษาอังกฤษตัวเล็ก (a-z) อย่างน้อย 1 ตัว\n✓ มีตัวเลข (0-9) อย่างน้อย 1 ตัว\n✓ มีอักขระพิเศษ (@#\$%^&*...) อย่างน้อย 1 ตัว';

  @override
  String get submitRegistration => 'ยืนยันการสมัครสมาชิก';

  @override
  String get staff => 'PC';

  @override
  String get storeManager => 'BM';

  @override
  String get pendingApproval => 'อยู่ในขั้นตอนการอนุมัติ';

  @override
  String get pendingApprovalMessage =>
      'บัญชีของคุณอยู่ในช่วงรอการอนุมัติ\n\nใช้เวลาไม่เกิน 1 วัน\n\nหากต้องการให้อนุมัติเร็วที่สุด\nติดต่อ LINE ID:\n\nsunny_typee\n\nหรือ Scan QR Code';

  @override
  String get backToLogin => 'กลับไปหน้าเข้าสู่ระบบ';

  @override
  String get waitingForApproval => 'รอการอนุมัติ';

  @override
  String get waitingApprovalMessage =>
      'ผู้จัดการร้านหรือสำนักงานใหญ่ต้องอนุมัติบัญชีก่อนจึงจะเข้าถึงบทสนทนาได้';

  @override
  String get checkAgain => 'ตรวจสอบอีกครั้ง';

  @override
  String get noPendingRegistrations => 'ไม่มีคำขอที่รออนุมัติ';

  @override
  String get pendingBmRegistrations => 'คำขอ BM ที่รออนุมัติ';

  @override
  String get reject => 'ปฏิเสธ';

  @override
  String get approve => 'อนุมัติ';

  @override
  String employeeIdValue(Object value) {
    return 'รหัสพนักงาน: $value';
  }

  @override
  String get notSet => 'ยังไม่ได้ระบุ';

  @override
  String get account => 'บัญชี';

  @override
  String get platformRole => 'สิทธิ์แพลตฟอร์ม';

  @override
  String get assignedStores => 'ร้านที่รับผิดชอบ';

  @override
  String get noMemberships => 'ยังไม่มีร้านที่ได้รับมอบหมาย';

  @override
  String get settings => 'การตั้งค่า';

  @override
  String get personalInformation => 'ข้อมูลส่วนตัว';

  @override
  String get language => 'ภาษา';

  @override
  String get notifications => 'การแจ้งเตือน';

  @override
  String get appearance => 'การแสดงผล';

  @override
  String get accountSecurity => 'บัญชีและความปลอดภัย';

  @override
  String get managedByOrganization => 'จัดการโดยองค์กรของคุณ';

  @override
  String get about => 'เกี่ยวกับ';

  @override
  String get comingSoon => 'เร็ว ๆ นี้';

  @override
  String get adminTools => 'เครื่องมือผู้ดูแล';

  @override
  String get signOut => 'ออกจากระบบ';

  @override
  String get adminApprovals => 'คำขอ BM ที่รออนุมัติ';

  @override
  String get languageTitle => 'ภาษา';

  @override
  String get thaiLanguage => 'ไทย';

  @override
  String get englishLanguage => 'English';

  @override
  String get simplifiedChineseLanguage => '简体中文';

  @override
  String get roleAdmin => 'ผู้ดูแล';

  @override
  String get roleViewer => 'ผู้ดู';

  @override
  String get roleStoreManager => 'ผู้จัดการร้าน';

  @override
  String get roleStaff => 'พนักงาน';

  @override
  String get nameRequired => 'กรุณาระบุชื่อ';

  @override
  String get employeeIdRequired => 'กรุณาระบุรหัสพนักงาน';

  @override
  String get selectStore => 'กรุณาเลือกร้าน';

  @override
  String get passwordsDoNotMatch => 'รหัสผ่านไม่ตรงกัน';

  @override
  String get invalidCredentials => 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';

  @override
  String get accountPendingMessage => 'บัญชีของคุณกำลังรอผู้ดูแลอนุมัติ';

  @override
  String get accountRejectedMessage => 'บัญชีนี้ถูกปฏิเสธ กรุณาติดต่อผู้ดูแล';

  @override
  String get unableToSignIn => 'เข้าสู่ระบบไม่ได้ กรุณาลองอีกครั้ง';

  @override
  String get cannotReachBackend =>
      'เชื่อมต่อระบบไม่ได้ ตรวจสอบ URL และเครือข่าย';

  @override
  String get unexpectedStoreError => 'เกิดข้อผิดพลาดขณะโหลดร้านค้า';

  @override
  String get unableToSubmitRegistration => 'ส่งคำขอลงทะเบียนไม่ได้';

  @override
  String get employeeIdAlreadyRegistered => 'รหัสพนักงานนี้ถูกลงทะเบียนแล้ว';

  @override
  String get verifyOtp => 'ยืนยัน OTP';

  @override
  String codeSentTo(Object phone) {
    return 'รหัสถูกส่งไปที่ $phone';
  }

  @override
  String get sixDigitOtp => 'OTP 6 หลัก';

  @override
  String get verify => 'ยืนยัน';

  @override
  String get january => 'มกราคม';

  @override
  String get february => 'กุมภาพันธ์';

  @override
  String get march => 'มีนาคม';

  @override
  String get april => 'เมษายน';

  @override
  String get may => 'พฤษภาคม';

  @override
  String get june => 'มิถุนายน';

  @override
  String get july => 'กรกฎาคม';

  @override
  String get august => 'สิงหาคม';

  @override
  String get september => 'กันยายน';

  @override
  String get october => 'ตุลาคม';

  @override
  String get november => 'พฤศจิกายน';

  @override
  String get december => 'ธันวาคม';

  @override
  String get customerInsights => 'ข้อมูลเชิงลูกค้า';

  @override
  String get tagCoverage => 'ความครอบคลุมของแท็ก';

  @override
  String get eligibleConversations => 'บทสนทนาที่เข้าเกณฑ์';

  @override
  String get taggedConversations => 'บทสนทนาที่มีแท็ก';

  @override
  String get coverageQuality => 'คุณภาพความครอบคลุม';

  @override
  String get coverageLow => 'ความครอบคลุมต่ำ';

  @override
  String get coveragePartial => 'ความครอบคลุมบางส่วน';

  @override
  String get coverageModerate => 'ความครอบคลุมปานกลาง';

  @override
  String get coverageStrong => 'ความครอบคลุมสูง';

  @override
  String get tagCoverageWarning =>
      'เพิ่มแท็กให้บทสนทนาเพื่อให้ข้อมูลเชิงลูกค้ามีความแม่นยำมากขึ้น';

  @override
  String get sourceStoreOnly => 'หน้าร้านเท่านั้น';

  @override
  String get sourceOnlineOnly => 'ออนไลน์เท่านั้น';

  @override
  String get sourceStoreAndOnline => 'หน้าร้าน + ออนไลน์';

  @override
  String get sourceUntagged => 'ยังไม่แท็ก';

  @override
  String get installmentInterest => 'ความสนใจผ่อนชำระ';

  @override
  String get taggedInstallment => 'แท็กความสนใจผ่อนชำระ';

  @override
  String get eligibleRate => 'จากบทสนทนาที่เข้าเกณฑ์';

  @override
  String get taggedRate => 'จากบทสนทนาที่มีแท็ก';

  @override
  String get topProducts => 'สินค้ายอดนิยม';

  @override
  String get topConfigurations => 'การกำหนดยอดนิยม';

  @override
  String get noTaggedData => 'ยังไม่มีข้อมูลแท็กแบบแมนนวลในช่วงเวลานี้';

  @override
  String get currentTagSnapshot => 'อ้างอิงจากแท็กปัจจุบัน';

  @override
  String get faster => 'เร็วขึ้น';

  @override
  String get slower => 'ช้าลง';

  @override
  String get percentagePoints => 'จุดเปอร์เซ็นต์';

  @override
  String get volumeComparison => 'กิจกรรมเทียบกับช่วงก่อนหน้า';

  @override
  String get responseComparison => 'การตอบเทียบกับช่วงก่อนหน้า';

  @override
  String get comparisonUnavailable => 'ไม่มีข้อมูลเปรียบเทียบสำหรับช่วงเวลานี้';

  @override
  String get underFourHours => '< 4 ชม.';

  @override
  String get fourToTwelveHours => '4–12 ชม.';

  @override
  String get twelveToTwentyFourHours => '12–24 ชม.';

  @override
  String get overTwentyFourHours => '≥ 24 ชม.';
}
