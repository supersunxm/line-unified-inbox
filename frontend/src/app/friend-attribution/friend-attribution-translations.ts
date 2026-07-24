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
    pageTitle: "ติดตามการเพิ่มเพื่อน LINE OA",
    consentTitle: "นโยบายความเป็นส่วนตัวและเงื่อนไข",
    consentMessage: "ยินยอมให้ระบบเชื่อมโยงการเยี่ยมชมกับบัญชี LINE ของคุณเพื่อบันทึกการเพิ่มเพื่อนและนำเสนอสิทธิประโยชน์ที่เหมาะสม",
    consentAgree: "ยินยอมและดำเนินการต่อ",
    consentDecline: "ไม่อยินยอม",
    identifying: "กำลังยืนยันตัวตนผ่าน LINE Login...",
    checkingFriendship: "กำลังตรวจสอบสถานะการเป็นเพื่อน...",
    alreadyFriendTitle: "คุณเป็นเพื่อนกับเราเรียบร้อยแล้ว",
    alreadyFriendDesc: "ขอบคุณที่เป็นเพื่อนกับ OPPO BS RBS Chonburi คุณสามารถติดต่อและรับบริการผ่าน LINE ได้ทันที",
    promptAddFriendTitle: "เพิ่มเพื่อนเพื่อรับข่าวสารและบริการพิเศษ",
    promptAddFriendDesc: "กดปุ่มด้านล่างเพื่อเพิ่มเพื่อนกับบัญชี LINE Official Account ของสาขา",
    addFriendBtn: "+ เพิ่มเพื่อนใน LINE",
    waitingFollow: "กำลังรอยืนยันการเพิ่มเพื่อนจากระบบ LINE...",
    confirmedTitle: "เพิ่มเพื่อนสำเร็จเรียบร้อยแล้ว!",
    confirmedDesc: "ขอบคุณที่เพิ่มเพื่อนกับเรา บันทึกข้อมูลการเพิ่มเพื่อนเรียบร้อยแล้ว",
    liffConfigError: "ระบบยังไม่ได้ตั้งค่า LIFF ID กรุณาติดต่อผู้ดูแลระบบ",
    invalidSessionError: "ลิงก์ติดตามหมดอายุหรือไม่อยู่ในระบบ กรุณาสแกน QR Code หรือคลิกลิงก์ใหม่อีกครั้ง",
    customerErrorMessage: "ไม่สามารถยืนยันข้อมูลได้ กรุณาปิดหน้านี้แล้วเปิดลิงก์ใหม่อีกครั้ง",
    fallbackBtn: "เปิดหน้า LINE Official Account",
    retryAddFriendBtn: "ลองเพิ่มเพื่อนอีกครั้ง",
    loading: "กำลังโหลด...",
  },
  en: {
    pageTitle: "LINE OA Friend Attribution",
    consentTitle: "Privacy Policy & Terms",
    consentMessage: "Agree to link this visit with your LINE account to measure store friend attribution and receive tailored services.",
    consentAgree: "Consent & Continue",
    consentDecline: "Decline",
    identifying: "Verifying identity with LINE Login...",
    checkingFriendship: "Checking friendship status...",
    alreadyFriendTitle: "You are already friends with us!",
    alreadyFriendDesc: "Thank you for connecting with OPPO BS RBS Chonburi. You can chat and receive services on LINE.",
    promptAddFriendTitle: "Add Friend for News & Exclusive Offers",
    promptAddFriendDesc: "Click the button below to add our official store account on LINE.",
    addFriendBtn: "+ Add Friend on LINE",
    waitingFollow: "Waiting for LINE follow confirmation...",
    confirmedTitle: "Friend Added Successfully!",
    confirmedDesc: "Thank you for adding us as a friend. Your attribution has been verified.",
    liffConfigError: "LIFF ID is not configured. Please contact the administrator.",
    invalidSessionError: "The attribution tracking link has expired or is invalid. Please rescan the QR code.",
    customerErrorMessage: "Verification failed. Please close this window and open the link again.",
    fallbackBtn: "Open LINE Official Account",
    retryAddFriendBtn: "Retry Add Friend",
    loading: "Loading...",
  },
  zh: {
    pageTitle: "LINE 官方账号添加好友追踪",
    consentTitle: "隐私政策与条款",
    consentMessage: "同意将本次访问与您的 LINE 账号关联，用于统计门店好友添加情况并提供专属服务。",
    consentAgree: "同意并继续",
    consentDecline: "拒绝",
    identifying: "正在通过 LINE Login 验证身份...",
    checkingFriendship: "正在检查好友状态...",
    alreadyFriendTitle: "您已经是我们的好友！",
    alreadyFriendDesc: "感谢关注 OPPO BS RBS Chonburi，您可以随时通过 LINE 联系我们。",
    promptAddFriendTitle: "添加好友获取最新资讯与优惠",
    promptAddFriendDesc: "点击下方按钮添加门店官方 LINE 账号。",
    addFriendBtn: "+ 在 LINE 上添加好友",
    waitingFollow: "等待 LINE 关注确认...",
    confirmedTitle: "好友添加成功！",
    confirmedDesc: "感谢添加好友，已为您记录关注来源。",
    liffConfigError: "系统未配置 LIFF ID，请联系管理员。",
    invalidSessionError: "追踪链接已失效或不存在，请重新扫描二维码。",
    customerErrorMessage: "验证失败，请关闭此页面并重新打开链接。",
    fallbackBtn: "直接打开 LINE 官方账号",
    retryAddFriendBtn: "重试添加好友",
    loading: "加载中...",
  },
};
