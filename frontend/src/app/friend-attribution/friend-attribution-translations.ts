export type FriendAttributionLocale = "th" | "en" | "zh";

export type FriendAttributionTranslationKeys = {
  pageTitle: string;
  consentTitle: string;
  consentMessage: string;
  consentAgree: string;
  consentDecline: string;
  identifying: string;
  checkingFriendship: string;
  alreadyFriendTitle: string;
  alreadyFriendDesc: string;
  promptAddFriendTitle: string;
  promptAddFriendDesc: string;
  addFriendBtn: string;
  waitingFollow: string;
  confirmedTitle: string;
  confirmedDesc: string;
  liffConfigError: string;
  invalidSessionError: string;
  customerErrorMessage: string;
  fallbackBtn: string;
  retryAddFriendBtn: string;
  loading: string;
};

export const FRIEND_ATTRIBUTION_TRANSLATIONS: Record<FriendAttributionLocale, FriendAttributionTranslationKeys> = {
  th: {
    pageTitle: "เพิ่มเพื่อน LINE Official Account",
    consentTitle: "นโยบายความเป็นส่วนตัว",
    consentMessage: "ยินยอมให้เชื่อมโยงการเยี่ยมชมเพื่อรับข่าวสาร โปรโมชัน และบริการจากร้านค้า",
    consentAgree: "ยินยอมและดำเนินการต่อ",
    consentDecline: "ไม่อยินยอม",
    identifying: "กำลังดาวน์โหลดและยืนยันข้อมูล...",
    checkingFriendship: "กำลังตรวจสอบข้อมูล...",
    alreadyFriendTitle: "คุณเป็นเพื่อนกับเราแล้ว",
    alreadyFriendDesc: "กำลังเปิดหน้า LINE Official Account...",
    promptAddFriendTitle: "เพิ่มเพื่อน LINE Official Account",
    promptAddFriendDesc: "เพิ่มเพื่อนเพื่อรับข่าวสาร โปรโมชัน และบริการจากร้าน",
    addFriendBtn: "เพิ่มเพื่อน LINE OA",
    waitingFollow: "กำลังตรวจสอบการเพิ่มเพื่อน...",
    confirmedTitle: "เพิ่มเพื่อนสำเร็จ",
    confirmedDesc: "กำลังเปิดหน้า LINE Official Account...",
    liffConfigError: "ระบบยังไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง",
    invalidSessionError: "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
    customerErrorMessage: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    fallbackBtn: "เปิด LINE Official Account",
    retryAddFriendBtn: "ลองเพิ่มเพื่อนอีกครั้ง",
    loading: "กำลังโหลด...",
  },
  en: {
    pageTitle: "Add LINE Official Account",
    consentTitle: "Privacy Policy",
    consentMessage: "Agree to connect your visit to receive news, promotions, and store services.",
    consentAgree: "Agree & Continue",
    consentDecline: "Decline",
    identifying: "Loading...",
    checkingFriendship: "Verifying...",
    alreadyFriendTitle: "You are already our friend",
    alreadyFriendDesc: "Opening LINE Official Account...",
    promptAddFriendTitle: "Add LINE Official Account",
    promptAddFriendDesc: "Add us as a friend to receive news, promotions, and store services.",
    addFriendBtn: "Add LINE Official Account",
    waitingFollow: "Verifying friend addition...",
    confirmedTitle: "Friend Added Successfully",
    confirmedDesc: "Opening LINE Official Account...",
    liffConfigError: "System is currently unavailable. Please try again.",
    invalidSessionError: "Link has expired or is invalid. Please try again.",
    customerErrorMessage: "An error occurred. Please try again.",
    fallbackBtn: "Open LINE Official Account",
    retryAddFriendBtn: "Try Again",
    loading: "Loading...",
  },
  zh: {
    pageTitle: "添加 LINE 官方账号",
    consentTitle: "隐私政策",
    consentMessage: "同意关联本次访问以获取门店最新动态、优惠活动及服务。",
    consentAgree: "同意并继续",
    consentDecline: "拒绝",
    identifying: "加载中...",
    checkingFriendship: "验证中...",
    alreadyFriendTitle: "您已经是我们的好友",
    alreadyFriendDesc: "正在打开 LINE 官方账号...",
    promptAddFriendTitle: "添加 LINE 官方账号",
    promptAddFriendDesc: "添加好友以获取门店最新动态、优惠活动及服务。",
    addFriendBtn: "添加 LINE 官方账号",
    waitingFollow: "正在确认好友状态...",
    confirmedTitle: "好友添加成功",
    confirmedDesc: "正在打开 LINE 官方账号...",
    liffConfigError: "系统暂不可用，请重试。",
    invalidSessionError: "链接已过期或无效，请重试。",
    customerErrorMessage: "发生错误，请重试。",
    fallbackBtn: "打开 LINE 官方账号",
    retryAddFriendBtn: "重试",
    loading: "加载中...",
  },
};
