export const secretarySettingsText = {
  th: {
    title: "ตั้งค่า LINE เลขาซันน์", close: "ปิด", loading: "กำลังโหลดสถานะ…", unknown: "ยังไม่ทราบ", configured: "ตั้งค่าแล้ว", missing: "ยังไม่ตั้งค่า",
    channelId: "Channel ID", channelSecret: "Channel Secret", accessToken: "Channel Access Token", botUserId: "Bot User ID",
    preserve: "เว้นว่างเพื่อเก็บค่าเดิม ระบบจะไม่แสดง Secret หรือ Token ที่บันทึกไว้", show: "แสดง", hide: "ซ่อน", save: "บันทึกอย่างปลอดภัย", saving: "กำลังบันทึก…", saved: "บันทึกข้อมูลแบบเข้ารหัสแล้ว",
    test: "ทดสอบ Token และตัวตนบอต", testing: "กำลังทดสอบ…", validated: "Token และตัวตนบอตผ่านการตรวจสอบ", notValidated: "ยังไม่ได้ตรวจสอบ Token และตัวตนบอต", failed: "การตรวจสอบไม่ผ่าน กรุณาตรวจค่าและลองใหม่",
    disabled: "Webhook ปิดอยู่ ต้องปิด Use webhook ใน LINE Developers ไว้ด้วย การบันทึกหรือทดสอบจะไม่เปิดบอตและไม่ส่งข้อความ",
    enabled: "Webhook flag เปิดอยู่: ต้องปิดก่อนเริ่ม pilot", limited: "การทดสอบนี้ไม่ยืนยัน Channel ID, Channel Secret, สิทธิ์กลุ่ม, การป้องกันเหตุการณ์ซ้ำ หรือความพร้อมตอบข้อความ",
    unauthorized: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", forbidden: "เฉพาะเจ้าของบัญชี HQ ที่กำหนดไว้เท่านั้นที่เข้าถึงได้", error: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่", invalid: "กรุณาตรวจรูปแบบข้อมูลและกรอกครบทั้งสี่ช่องสำหรับการตั้งค่าครั้งแรก", rateLimited: "คำขอถี่เกินไป กรุณารอสักครู่", webhook: "Webhook URL", verifiedAt: "ตรวจสอบล่าสุด", refresh: "โหลดสถานะใหม่",
  },
  en: {
    title: "Sunn Secretary LINE settings", close: "Close", loading: "Loading status…", unknown: "Unknown", configured: "Configured", missing: "Not configured",
    channelId: "Channel ID", channelSecret: "Channel Secret", accessToken: "Channel Access Token", botUserId: "Bot User ID",
    preserve: "Leave fields blank to preserve existing values. Saved secrets and tokens are never displayed.", show: "Show", hide: "Hide", save: "Save securely", saving: "Saving…", saved: "Encrypted credentials persisted",
    test: "Test token and bot identity", testing: "Testing…", validated: "Token and bot identity validated", notValidated: "Token and bot identity not validated", failed: "Validation failed. Check the values and try again.",
    disabled: "Webhook is disabled. Keep Use webhook disabled in LINE Developers too. Saving or testing does not activate the bot or send messages.", enabled: "Webhook flag is enabled: disable it before any pilot.",
    limited: "This test does not validate the Channel ID, Channel Secret, group authorization, event deduplication, or reply readiness.",
    unauthorized: "Your session expired. Sign in again.", forbidden: "Only the configured HQ owner can access these settings.", error: "The operation could not be completed. Try again.", invalid: "Check the values and provide all four fields for initial setup.", rateLimited: "Too many requests. Please wait.", webhook: "Webhook URL", verifiedAt: "Last validated", refresh: "Reload status",
  },
  zh: {
    title: "Sunn Secretary LINE 设置", close: "关闭", loading: "正在加载状态…", unknown: "未知", configured: "已配置", missing: "未配置",
    channelId: "Channel ID", channelSecret: "Channel Secret", accessToken: "Channel Access Token", botUserId: "Bot User ID",
    preserve: "留空可保留现有值。已保存的密钥和令牌不会显示。", show: "显示", hide: "隐藏", save: "安全保存", saving: "正在保存…", saved: "加密凭据已持久保存",
    test: "测试令牌和机器人身份", testing: "正在测试…", validated: "令牌和机器人身份已验证", notValidated: "令牌和机器人身份尚未验证", failed: "验证失败，请检查设置后重试。",
    disabled: "Webhook 已禁用。请同时保持 LINE Developers 中的 Use webhook 禁用。保存或测试不会启用机器人或发送消息。", enabled: "Webhook 标志已启用：试点前必须禁用。",
    limited: "此测试不验证 Channel ID、Channel Secret、群组授权、事件去重或回复就绪状态。",
    unauthorized: "会话已过期，请重新登录。", forbidden: "仅指定的 HQ 所有者可访问这些设置。", error: "操作未完成，请重试。", invalid: "请检查格式；首次设置需填写全部四个字段。", rateLimited: "请求过于频繁，请稍后重试。", webhook: "Webhook URL", verifiedAt: "最后验证时间", refresh: "重新加载状态",
  },
} as const;
