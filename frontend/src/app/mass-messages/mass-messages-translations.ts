export type Language = "th" | "en" | "zh";

export type MassMessagesText = {
  pageTitle: string;
  pageSubtitle: string;
  adminOnlyBadge: string;
  accessRestrictedTitle: string;
  accessRestrictedDesc: string;
  
  // Section 1: Stores
  sectionStoresTitle: string;
  storeModeAll: string;
  storeModeAllDesc: string;
  storeModeSelected: string;
  searchStoresPlaceholder: string;
  selectAllStores: string;
  deselectAllStores: string;
  selectedStoresCount: (count: number, total: number) => string;
  noStoresFound: string;

  // Section 2: Audience
  sectionAudienceTitle: string;
  audienceAllKnown: string;
  audienceAllKnownDesc: string;
  audienceNotReplied: string;
  audienceNotRepliedDesc: string;
  audienceNotifiedBm: string;
  audienceNotifiedBmDesc: string;
  audienceReplied: string;
  audienceRepliedDesc: string;

  // Section 3: Message
  sectionMessageTitle: string;
  messagePlaceholder: string;
  characterCount: (current: number, max: number) => string;
  messagePreviewTitle: string;
  messagePreviewSubtitle: string;

  // Section 4: Preview & Summary
  sectionSummaryTitle: string;
  storeCountLabel: string;
  eligibleStoresLabel: string;
  skippedStoresLabel: string;
  estimatedRecipientsLabel: string;
  calculatingPreview: string;
  previewError: string;
  retryPreview: string;
  
  // Skipped stores
  skippedStoresSummary: (count: number) => string;
  skipReasonMissingToken: string;
  skipReasonNoRecipients: string;
  skipReasonInactive: string;
  skipReasonUnauthorized: string;
  skipReasonUnknown: string;

  // Zero-safety alerts
  zeroRecipientsAlert: string;
  zeroEligibleStoresAlert: string;
  emptyMessageAlert: string;

  // Review & Confirm
  reviewAndSendButton: string;
  confirmModalTitle: string;
  confirmModalDesc: (recipients: number, stores: number) => string;
  confirmModalQuotaWarning: string;
  confirmModalConfirmButton: string;
  confirmModalCancelButton: string;
  sendingInProgress: string;

  // Progress View
  campaignProgressTitle: string;
  campaignStatusPending: string;
  campaignStatusRunning: string;
  campaignStatusCompleted: string;
  campaignStatusPartial: string;
  campaignStatusFailed: string;
  campaignStatusCancelled: string;

  statusBannerCompletedTitle: string;
  statusBannerCompletedDesc: string;
  statusBannerPartialTitle: string;
  statusBannerPartialDesc: string;
  statusBannerFailedTitle: string;
  statusBannerFailedDesc: string;

  metricProcessed: string;
  metricAccepted: string;
  metricFailed: string;
  metricSkipped: string;
  
  storeDeliveryTableTitle: string;
  storeNameCol: string;
  recipientsCol: string;
  statusCol: string;
  detailCol: string;

  deliveryStatusSuccess: string;
  deliveryStatusRunning: string;
  deliveryStatusPending: string;
  deliveryStatusFailed: string;
  deliveryStatusSkipped: string;

  createNewCampaignButton: string;
  viewHistoryButton: string;
  historyTitle: string;
  noCampaignHistory: string;
};

export const translations: Record<Language, MassMessagesText> = {
  th: {
    pageTitle: "ส่งข้อความ",
    pageSubtitle: "ส่งข้อความเดียวกันไปยังลูกค้าที่เคยติดต่อผ่าน LINE OA ของร้านค้าที่เลือก",
    adminOnlyBadge: "เฉพาะผู้ดูแลระบบ (ADMIN)",
    accessRestrictedTitle: "ไม่มีสิทธิ์เข้าถึง",
    accessRestrictedDesc: "หน้านี้สงวนไว้สำหรับผู้ดูแลระบบ (ADMIN) เท่านั้น",

    sectionStoresTitle: "1. ร้านค้าที่ต้องการส่ง",
    storeModeAll: "ร้านค้าทั้งหมดที่พร้อมใช้งาน",
    storeModeAllDesc: "ระบบจะตรวจสอบร้านค้าที่เชื่อมต่อ LINE OA และมีโทเคนถูกต้องโดยอัตโนมัติ",
    storeModeSelected: "เลือกร้านค้า",
    searchStoresPlaceholder: "ค้นหาร้านค้าด้วยชื่อหรือรหัส...",
    selectAllStores: "เลือกทั้งหมด",
    deselectAllStores: "ยกเลิกทั้งหมด",
    selectedStoresCount: (count, total) => `เลือกแล้ว ${count} จาก ${total} ร้าน`,
    noStoresFound: "ไม่พบร้านค้าที่ตรงกับคำค้นหา",

    sectionAudienceTitle: "2. กลุ่มลูกค้าเป้าหมาย",
    audienceAllKnown: "ลูกค้าทั้งหมดในระบบ",
    audienceAllKnownDesc: "เฉพาะลูกค้าที่เคยมีข้อมูลเข้ามาในระบบผ่าน LINE OA (ไม่ใช่เพื่อน LINE ทั้งหมด)",
    audienceNotReplied: "ยังไม่ตอบ",
    audienceNotRepliedDesc: "ลูกค้าที่มีสถานะ BM ยังไม่ได้ตอบกลับ",
    audienceNotifiedBm: "แจ้ง BM แล้ว",
    audienceNotifiedBmDesc: "ลูกค้าที่มีการแจ้งเตือน BM แล้ว",
    audienceReplied: "ตอบแล้ว",
    audienceRepliedDesc: "ลูกค้าที่มีการตอบกลับข้อความแล้ว",

    sectionMessageTitle: "3. ข้อความที่ต้องการส่ง",
    messagePlaceholder: "พิมพ์ข้อความที่ต้องการส่งถึงลูกค้า...",
    characterCount: (current, max) => `${current.toLocaleString()} / ${max.toLocaleString()} ตัวอักษร`,
    messagePreviewTitle: "ตัวอย่างข้อความ",
    messagePreviewSubtitle: "มุมมองลูกค้าในแอป LINE",

    sectionSummaryTitle: "4. ตรวจสอบข้อมูลก่อนส่ง",
    storeCountLabel: "ร้านค้าทั้งหมดที่ประเมิน",
    eligibleStoresLabel: "ร้านค้าพร้อมส่ง",
    skippedStoresLabel: "ร้านค้าที่ถูกข้าม",
    estimatedRecipientsLabel: "ผู้รับโดยประมาณ",
    calculatingPreview: "กำลังคำนวณจำนวนผู้รับ...",
    previewError: "ไม่สามารถคำนวณจำนวนผู้รับได้",
    retryPreview: "ลองใหม่",

    skippedStoresSummary: (count) => `${count} ร้านไม่สามารถส่งได้ (จะถูกข้าม)`,
    skipReasonMissingToken: "ไม่มี Channel Access Token หรือโทเคนไม่ถูกต้อง",
    skipReasonNoRecipients: "ไม่มีลูกค้าในระบบตามเงื่อนไขที่เลือก",
    skipReasonInactive: "ร้านค้าหรือ LINE OA ปิดใช้งาน",
    skipReasonUnauthorized: "ไม่มีสิทธิ์เข้าถึงร้านนี้",
    skipReasonUnknown: "ไม่ผ่านเกณฑ์การส่ง",

    zeroRecipientsAlert: "ไม่มีลูกค้าในกลุ่มเป้าหมายที่เลือก ไม่สามารถส่งข้อความได้",
    zeroEligibleStoresAlert: "ไม่มีร้านค้าที่พร้อมส่งข้อความ โปรดตรวจสอบการเชื่อมต่อ LINE OA",
    emptyMessageAlert: "โปรดกรอกข้อความก่อนดำเนินการส่ง",

    reviewAndSendButton: "ตรวจสอบและส่งข้อความ",
    confirmModalTitle: "ยืนยันการส่งข้อความ?",
    confirmModalDesc: (recipients, stores) =>
      `ข้อความนี้จะถูกส่งไปยังลูกค้าประมาณ ${recipients.toLocaleString()} คน จาก LINE OA จำนวน ${stores.toLocaleString()} ร้าน`,
    confirmModalQuotaWarning:
      "การส่งแบบหลายคนอาจใช้ Messaging API quota ของแต่ละ LINE OA และไม่สามารถเรียกคืนข้อความที่ส่งไปแล้วได้",
    confirmModalConfirmButton: "ยืนยันและส่งข้อความ",
    confirmModalCancelButton: "ยกเลิก",
    sendingInProgress: "กำลังสร้างและส่งแคมเปญ...",

    campaignProgressTitle: "สถานะการส่งข้อความ",
    campaignStatusPending: "รอดำเนินการ",
    campaignStatusRunning: "กำลังส่งข้อความ",
    campaignStatusCompleted: "ส่งคำขอเรียบร้อย",
    campaignStatusPartial: "ส่งสำเร็จบางส่วน",
    campaignStatusFailed: "เกิดข้อผิดพลาดในการส่ง",
    campaignStatusCancelled: "ยกเลิกแล้ว",

    statusBannerCompletedTitle: "LINE รับคำขอทั้งหมดเรียบร้อยแล้ว",
    statusBannerCompletedDesc: "ระบบได้ส่งคำขอ Multicast ไปยัง LINE Messaging API ครบทุกกลุ่มร้านค้าแล้ว",
    statusBannerPartialTitle: "การส่งคำขอเสร็จสิ้นบางส่วน",
    statusBannerPartialDesc: "มีบางร้านค้าหรือกลุ่มผู้รับที่ LINE ปฏิเสธหรือส่งไม่สำเร็จ โปรดตรวจสอบรายละเอียดด้านล่าง",
    statusBannerFailedTitle: "ไม่สามารถดำเนินการส่งข้อความได้",
    statusBannerFailedDesc: "เกิดข้อผิดพลาดร้ายแรงในการส่งคำขอไปยัง LINE API",

    metricProcessed: "ประมวลผลแล้ว",
    metricAccepted: "LINE รับคำขอแล้ว",
    metricFailed: "คำขอล้มเหลว",
    metricSkipped: "ร้านค้าที่ข้าม",

    storeDeliveryTableTitle: "รายละเอียดการส่งตามรายร้าน",
    storeNameCol: "ร้านค้า",
    recipientsCol: "จำนวนผู้รับ",
    statusCol: "สถานะ",
    detailCol: "หมายเหตุ / สาเหตุ",

    deliveryStatusSuccess: "LINE รับคำขอแล้ว",
    deliveryStatusRunning: "กำลังส่ง",
    deliveryStatusPending: "รอดำเนินการ",
    deliveryStatusFailed: "ส่งไม่สำเร็จ",
    deliveryStatusSkipped: "ข้าม",

    createNewCampaignButton: "สร้างแคมเปญใหม่",
    viewHistoryButton: "ประวัติการส่ง",
    historyTitle: "ประวัติการส่งข้อความ",
    noCampaignHistory: "ยังไม่มีประวัติการส่งข้อความ",
  },
  en: {
    pageTitle: "Mass Message",
    pageSubtitle: "Send the same message to known customers from selected LINE Official Accounts",
    adminOnlyBadge: "ADMIN Only",
    accessRestrictedTitle: "Access Restricted",
    accessRestrictedDesc: "This workspace is restricted to ADMIN users only.",

    sectionStoresTitle: "1. Target Stores",
    storeModeAll: "All Eligible Stores",
    storeModeAllDesc: "Automatically includes all stores with active, valid LINE OA connections",
    storeModeSelected: "Selected Stores",
    searchStoresPlaceholder: "Search stores by name or code...",
    selectAllStores: "Select All",
    deselectAllStores: "Deselect All",
    selectedStoresCount: (count, total) => `${count} of ${total} stores selected`,
    noStoresFound: "No stores match your search query",

    sectionAudienceTitle: "2. Target Customer Audience",
    audienceAllKnown: "All Known Customers",
    audienceAllKnownDesc: "Only customers already stored in our system from LINE OA conversations (not all LINE friends)",
    audienceNotReplied: "Not Replied",
    audienceNotRepliedDesc: "Customers with pending reply status",
    audienceNotifiedBm: "Notified BM",
    audienceNotifiedBmDesc: "Customers whose branch manager was notified",
    audienceReplied: "Replied",
    audienceRepliedDesc: "Customers who have received replies",

    sectionMessageTitle: "3. Message Content",
    messagePlaceholder: "Type your broadcast message...",
    characterCount: (current, max) => `${current.toLocaleString()} / ${max.toLocaleString()} characters`,
    messagePreviewTitle: "Message Preview",
    messagePreviewSubtitle: "Customer view in LINE app",

    sectionSummaryTitle: "4. Review & Confirm Scope",
    storeCountLabel: "Total Stores Evaluated",
    eligibleStoresLabel: "Ready Stores",
    skippedStoresLabel: "Skipped Stores",
    estimatedRecipientsLabel: "Estimated Recipients",
    calculatingPreview: "Calculating recipient estimates...",
    previewError: "Failed to calculate recipient preview",
    retryPreview: "Retry",

    skippedStoresSummary: (count) => `${count} stores cannot receive messages (will be skipped)`,
    skipReasonMissingToken: "Missing or invalid Channel Access Token",
    skipReasonNoRecipients: "No customers matching criteria in this store",
    skipReasonInactive: "Store or LINE OA is inactive",
    skipReasonUnauthorized: "Unauthorized for this store",
    skipReasonUnknown: "Ineligible for send",

    zeroRecipientsAlert: "No recipients match the selected criteria. Cannot send message.",
    zeroEligibleStoresAlert: "No stores are ready to send messages. Please verify LINE OA connections.",
    emptyMessageAlert: "Please enter a message before sending.",

    reviewAndSendButton: "Review and Send",
    confirmModalTitle: "Confirm Mass Message Send?",
    confirmModalDesc: (recipients, stores) =>
      `This message will be dispatched to approximately ${recipients.toLocaleString()} customers across ${stores.toLocaleString()} LINE Official Accounts.`,
    confirmModalQuotaWarning:
      "Multicast messaging consumes Messaging API quota for each LINE OA and sent messages cannot be revoked.",
    confirmModalConfirmButton: "Confirm & Send Campaign",
    confirmModalCancelButton: "Cancel",
    sendingInProgress: "Creating and dispatching campaign...",

    campaignProgressTitle: "Campaign Delivery Progress",
    campaignStatusPending: "Pending",
    campaignStatusRunning: "Sending",
    campaignStatusCompleted: "Completed",
    campaignStatusPartial: "Partially Completed",
    campaignStatusFailed: "Failed",
    campaignStatusCancelled: "Cancelled",

    statusBannerCompletedTitle: "All Requests Accepted by LINE",
    statusBannerCompletedDesc: "Multicast requests were successfully dispatched to the LINE Messaging API for all eligible stores.",
    statusBannerPartialTitle: "Partial Dispatch Complete",
    statusBannerPartialDesc: "Some stores or batches failed during LINE dispatch. Check store details below.",
    statusBannerFailedTitle: "Campaign Failed",
    statusBannerFailedDesc: "A critical error occurred while communicating with the LINE API.",

    metricProcessed: "Processed",
    metricAccepted: "LINE Accepted",
    metricFailed: "Request Failures",
    metricSkipped: "Skipped Stores",

    storeDeliveryTableTitle: "Per-Store Delivery Status",
    storeNameCol: "Store",
    recipientsCol: "Recipients",
    statusCol: "Status",
    detailCol: "Notes / Skip Reason",

    deliveryStatusSuccess: "LINE Accepted",
    deliveryStatusRunning: "Sending",
    deliveryStatusPending: "Pending",
    deliveryStatusFailed: "Failed",
    deliveryStatusSkipped: "Skipped",

    createNewCampaignButton: "New Campaign",
    viewHistoryButton: "Campaign History",
    historyTitle: "Campaign History",
    noCampaignHistory: "No campaign history found",
  },
  zh: {
    pageTitle: "群发消息",
    pageSubtitle: "向所选门店 LINE 官方账号中已有的客户群发相同消息",
    adminOnlyBadge: "仅限管理员 (ADMIN)",
    accessRestrictedTitle: "权限受限",
    accessRestrictedDesc: "此工作区仅供 ADMIN 管理员访问。",

    sectionStoresTitle: "1. 目标门店",
    storeModeAll: "所有符合条件的门店",
    storeModeAllDesc: "自动包含所有已连接有效 LINE OA 的门店",
    storeModeSelected: "选择指定门店",
    searchStoresPlaceholder: "搜索门店名称或代码...",
    selectAllStores: "全选",
    deselectAllStores: "取消全选",
    selectedStoresCount: (count, total) => `已选择 ${count} / ${total} 家门店`,
    noStoresFound: "未找到符合条件的门店",

    sectionAudienceTitle: "2. 目标客户群体",
    audienceAllKnown: "系统中所有已知客户",
    audienceAllKnownDesc: "仅限系统中已有聊天记录的客户（非 LINE 全部好友）",
    audienceNotReplied: "未回复",
    audienceNotRepliedDesc: "处于未回复状态的客户",
    audienceNotifiedBm: "已通知 BM",
    audienceNotifiedBmDesc: "已通知店长跟进的客户",
    audienceReplied: "已回复",
    audienceRepliedDesc: "已完成回复的客户",

    sectionMessageTitle: "3. 消息内容",
    messagePlaceholder: "输入要群发的消息内容...",
    characterCount: (current, max) => `${current.toLocaleString()} / ${max.toLocaleString()} 字符`,
    messagePreviewTitle: "消息预览",
    messagePreviewSubtitle: "LINE 客户端接收视图",

    sectionSummaryTitle: "4. 发送前核对",
    storeCountLabel: "评估门店总数",
    eligibleStoresLabel: "可发送门店",
    skippedStoresLabel: "已跳过门店",
    estimatedRecipientsLabel: "预估接收人数",
    calculatingPreview: "正在计算接收人数...",
    previewError: "无法计算预估接收人数",
    retryPreview: "重试",

    skippedStoresSummary: (count) => `${count} 家门店无法发送（将自动跳过）`,
    skipReasonMissingToken: "缺少或无效的 Channel Access Token",
    skipReasonNoRecipients: "该门店没有符合条件的客户",
    skipReasonInactive: "门店或 LINE OA 已停用",
    skipReasonUnauthorized: "无权访问此门店",
    skipReasonUnknown: "不符合发送条件",

    zeroRecipientsAlert: "所选条件无匹配客户，无法发送。",
    zeroEligibleStoresAlert: "没有可发送消息的门店，请检查 LINE OA 连接。",
    emptyMessageAlert: "请先输入消息内容。",

    reviewAndSendButton: "核对并发送",
    confirmModalTitle: "确认发送群发消息？",
    confirmModalDesc: (recipients, stores) =>
      `此消息将发送给 ${stores.toLocaleString()} 个 LINE OA 的约 ${recipients.toLocaleString()} 名客户。`,
    confirmModalQuotaWarning:
      "多播群发会消耗各 LINE OA 的 Messaging API 额度，发送后无法撤回。",
    confirmModalConfirmButton: "确认并发送",
    confirmModalCancelButton: "取消",
    sendingInProgress: "正在创建并分发任务...",

    campaignProgressTitle: "发送进度监控",
    campaignStatusPending: "等待中",
    campaignStatusRunning: "发送中",
    campaignStatusCompleted: "已完成",
    campaignStatusPartial: "部分完成",
    campaignStatusFailed: "失败",
    campaignStatusCancelled: "已取消",

    statusBannerCompletedTitle: "LINE 已接收全部发送请求",
    statusBannerCompletedDesc: "多播请求已成功提交至 LINE Messaging API。",
    statusBannerPartialTitle: "部分请求发送完成",
    statusBannerPartialDesc: "部分门店或批次在向 LINE 提交时遇到错误，请查看下方明细。",
    statusBannerFailedTitle: "发送失败",
    statusBannerFailedDesc: "与 LINE API 通信时发生错误。",

    metricProcessed: "已处理",
    metricAccepted: "LINE 已接收",
    metricFailed: "请求失败",
    metricSkipped: "已跳过门店",

    storeDeliveryTableTitle: "各门店发送明细",
    storeNameCol: "门店",
    recipientsCol: "接收人数",
    statusCol: "状态",
    detailCol: "备注 / 原因",

    deliveryStatusSuccess: "LINE 已接收",
    deliveryStatusRunning: "发送中",
    deliveryStatusPending: "等待中",
    deliveryStatusFailed: "失败",
    deliveryStatusSkipped: "已跳过",

    createNewCampaignButton: "新建群发",
    viewHistoryButton: "发送历史",
    historyTitle: "群发历史记录",
    noCampaignHistory: "暂无群发历史记录",
  },
};

export function getMassMessagesText(language: Language = "en"): MassMessagesText {
  return translations[language] || translations.en;
}
