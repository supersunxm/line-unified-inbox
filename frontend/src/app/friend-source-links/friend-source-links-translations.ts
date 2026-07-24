export type Language = "th" | "en" | "zh";

export type FriendSourceLinksTranslations = {
  pageTitle: string;
  pageDescription: string;
  pilotNote: string;

  // KPI
  totalLinks: string;
  activeLinks: string;
  totalClicks: string;
  storesConfigured: string;

  // Source names
  sourceStoreQr: string;
  sourceTikTok: string;
  sourceFacebook: string;
  sourceInstagram: string;

  // Generator
  generatorTitle: string;
  generatorDescription: string;
  searchPlaceholder: string;
  selectedCount: (count: number, max: number) => string;
  generatorPreview: (stores: number, sources: number, links: number) => string;
  generateButton: string;
  generating: string;
  generateSuccess: (created: number, existing: number) => string;
  generateIdempotentNote: string;
  minOneRequired: string;
  maxFiveAllowed: string;
  noDuplicates: string;
  eligibleOnly: string;
  noEligibleAccounts: string;

  // Table
  tableStore: string;
  tableLineOa: string;
  tableSource: string;
  tableShortLink: string;
  tableClicks: string;
  tableIdentifiedVisits: string;
  tableConfirmedAdds: string;
  tableConversionRate: string;
  tableStatus: string;
  tableActions: string;

  // Tooltips
  tooltipIdentified: string;
  tooltipConfirmed: string;
  tooltipConversion: string;

  // KPI
  kpiTotalClicks: string;
  kpiIdentifiedVisits: string;
  kpiConfirmedAdds: string;
  kpiOverallConversion: string;
  copyLink: string;
  openLink: string;
  activate: string;
  deactivate: string;
  qrDownloadSoon: string;
  statusActive: string;
  statusInactive: string;
  copiedToast: string;
  copyFailedToast: string;
  confirmDeactivate: (shortUrl: string) => string;
  deactivateConfirmYes: string;
  deactivateConfirmNo: string;
  toggleSaving: string;

  // Filters
  filterSearch: string;
  filterStore: string;
  filterSource: string;
  filterStatus: string;
  filterStatusAll: string;
  filterStatusActive: string;
  filterStatusInactive: string;
  clearFilters: string;

  // Excel Export
  exportExcel: string;
  exportAll: string;
  exportCurrent: string;
  exportRunning: string;
  exportSuccess: (filename: string) => string;
  exportError: (msg: string) => string;
  exportNoData: string;

  // Excel Sheet Headers & Content
  excelStoreName: string;
  excelStoreCode: string;
  excelLineOaName: string;
  excelBasicId: string;
  excelStoreQrLink: string;
  excelTikTokLink: string;
  excelFacebookLink: string;
  excelInstagramLink: string;
  excelActiveSources: string;
  excelTotalClicks: string;
  excelIdentifiedVisits: string;
  excelConfirmedAdds: string;
  excelConversionRate: string;
  excelGeneratedAt: string;
  excelSource: string;
  excelShortLink: string;
  excelClicks: string;
  excelStatus: string;
  excelCreatedAt: string;
  excelUpdatedAt: string;

  // Excel Instructions Sheet Content
  excelInstTitle: string;
  excelInstQrTitle: string;
  excelInstQrDesc: string;
  excelInstTiktokTitle: string;
  excelInstTiktokDesc: string;
  excelInstFbTitle: string;
  excelInstFbDesc: string;
  excelInstIgTitle: string;
  excelInstIgDesc: string;
  excelInstRuleTitle: string;
  excelInstRuleDesc: string;
  excelInstNoMixTitle: string;
  excelInstNoMixDesc: string;
  excelInstTrackingTitle: string;
  excelInstTrackingDesc: string;
  excelInstLiffTitle: string;
  excelInstLiffDesc: string;

  // States
  loading: string;
  emptyState: string;
  emptyStateDescription: string;
  noResults: string;
  noResultsDescription: string;
  errorState: string;
  retry: string;
  error403: string;
  error403Description: string;
};

export const friendSourceLinksTranslations: Record<Language, FriendSourceLinksTranslations> = {
  th: {
    pageTitle: "ลิงก์เพิ่มเพื่อน",
    pageDescription: "แต่ละร้านที่เลือกจะได้รับลิงก์ถาวรสำหรับ QR หน้าร้าน, TikTok, Facebook และ Instagram — สามารถติดตามจำนวนคลิกได้ทันที โดยไม่ต้องรอ LIFF integration",
    pilotNote: "การยืนยันการเพิ่มเพื่อนจะใช้งานได้เต็มรูปแบบเมื่อ LIFF integration พร้อม",

    totalLinks: "ลิงก์ทั้งหมด",
    activeLinks: "ลิงก์ที่ใช้งาน",
    totalClicks: "คลิกทั้งหมด",
    storesConfigured: "ร้านค้าที่ตั้งค่าแล้ว",

    sourceStoreQr: "QR หน้าร้าน",
    sourceTikTok: "TikTok",
    sourceFacebook: "Facebook",
    sourceInstagram: "Instagram",

    generatorTitle: "สร้างลิงก์ Pilot (สูงสุด 5 ร้าน)",
    generatorDescription: "เลือก LINE OA ที่ต้องการสร้างลิงก์ (ใช้ได้เฉพาะบัญชีที่เชื่อมต่อแล้วและมี Basic ID)",
    searchPlaceholder: "ค้นหาร้านค้า, ชื่อ LINE OA หรือ Basic ID",
    selectedCount: (count, max) => `เลือกแล้ว ${count}/${max}`,
    generatorPreview: (stores, sources, links) => `${stores} ร้าน × ${sources} แหล่ง = ${links} ลิงก์`,
    generateButton: "สร้างลิงก์",
    generating: "กำลังสร้าง...",
    generateSuccess: (created, existing) => `สร้างลิงก์ใหม่ ${created} ลิงก์ · มีอยู่แล้ว ${existing} ลิงก์ (สร้างซ้ำได้)`,
    generateIdempotentNote: "การสร้างซ้ำจะไม่ทำให้ลิงก์เดิมถูกลบหรือเปลี่ยน",
    minOneRequired: "กรุณาเลือกอย่างน้อย 1 LINE OA",
    maxFiveAllowed: "เลือกได้สูงสุด 5 LINE OA",
    noDuplicates: "ไม่สามารถเลือก LINE OA ซ้ำกันได้",
    eligibleOnly: "แสดงเฉพาะ LINE OA ที่เชื่อมต่อแล้ว ใช้งานอยู่ และมี Basic ID",
    noEligibleAccounts: "ไม่พบ LINE OA ที่มีคุณสมบัติเหมาะสม",

    tableStore: "ร้านค้า",
    tableLineOa: "LINE OA",
    tableSource: "แหล่ง",
    tableShortLink: "ลิงก์สั้น",
    tableClicks: "คลิก",
    tableIdentifiedVisits: "ยืนยันตัวตน",
    tableConfirmedAdds: "เพิ่มเพื่อนสำเร็จ",
    tableConversionRate: "Conversion",
    tableStatus: "สถานะ",
    tableActions: "ดำเนินการ",

    tooltipIdentified: "ผู้ใช้ยืนยันตัวตนผ่าน LIFF เรียบร้อยแล้ว",
    tooltipConfirmed: "ยืนยันการเพิ่มเพื่อนจาก LINE Webhook เรียบร้อยแล้ว",
    tooltipConversion: "อัตราส่วนการเพิ่มเพื่อนสำเร็จต่อจำนวนคลิกทั้งหมด",

    kpiTotalClicks: "คลิกทั้งหมด",
    kpiIdentifiedVisits: "ยืนยันตัวตนทั้งหมด",
    kpiConfirmedAdds: "เพิ่มเพื่อนสำเร็จทั้งหมด",
    kpiOverallConversion: "Conversion ภาพรวม",
    copyLink: "คัดลอก",
    openLink: "เปิดลิงก์",
    activate: "เปิดใช้งาน",
    deactivate: "ปิดใช้งาน",
    qrDownloadSoon: "ดาวน์โหลด QR (เร็วๆ นี้)",
    statusActive: "ใช้งาน",
    statusInactive: "ปิด",
    copiedToast: "คัดลอกลิงก์แล้ว",
    copyFailedToast: "ไม่สามารถคัดลอกได้ กรุณาคัดลอกด้วยตนเอง",
    confirmDeactivate: (shortUrl) => `ปิดใช้งานลิงก์ ${shortUrl} หรือไม่? ลิงก์นี้จะหยุดใช้งานทันที`,
    deactivateConfirmYes: "ปิดใช้งาน",
    deactivateConfirmNo: "ยกเลิก",
    toggleSaving: "กำลังบันทึก...",

    filterSearch: "ค้นหา",
    filterStore: "ร้านค้า",
    filterSource: "แหล่ง",
    filterStatus: "สถานะ",
    filterStatusAll: "ทั้งหมด",
    filterStatusActive: "ใช้งาน",
    filterStatusInactive: "ปิด",
    clearFilters: "ล้างตัวกรอง",

    exportExcel: "ดาวน์โหลด Excel",
    exportAll: "ส่งออกทุกร้านค้า",
    exportCurrent: "ส่งออกผลลัพธ์ปัจจุบัน",
    exportRunning: "กำลังสร้างไฟล์ Excel...",
    exportSuccess: (filename) => `ส่งออกไฟล์ ${filename} สำเร็จ`,
    exportError: (msg) => `ส่งออกไม่สำเร็จ: ${msg}`,
    exportNoData: "ไม่มีข้อมูลสำหรับส่งออก",

    excelStoreName: "ชื่อร้านค้า",
    excelStoreCode: "รหัสร้านค้า",
    excelLineOaName: "ชื่อ LINE OA",
    excelBasicId: "LINE Basic ID",
    excelStoreQrLink: "Store QR Link",
    excelTikTokLink: "TikTok Link",
    excelFacebookLink: "Facebook Link",
    excelInstagramLink: "Instagram Link",
    excelActiveSources: "ช่องทางที่เปิดใช้งาน",
    excelTotalClicks: "คลิกทั้งหมด",
    excelIdentifiedVisits: "ยืนยันตัวตนแล้ว",
    excelConfirmedAdds: "เพิ่มเพื่อนสำเร็จ",
    excelConversionRate: "อัตราแปลงเป็นเพื่อน %",
    excelGeneratedAt: "วันที่สร้างลิงก์",
    excelSource: "ช่องทาง",
    excelShortLink: "ลิงก์สั้น",
    excelClicks: "คลิก",
    excelStatus: "สถานะ",
    excelCreatedAt: "สร้างเมื่อ",
    excelUpdatedAt: "อัปเดตเมื่อ",

    excelInstTitle: "คำแนะนำการใช้งานลิงก์ติดตามการเพิ่มเพื่อน (Friend Source Links)",
    excelInstQrTitle: "1. Store QR Link",
    excelInstQrDesc: "ใช้สำหรับพิมพ์สื่อหน้าร้าน ป้ายตั้งโต๊ะ หรือ QR Code ที่วางในร้านค้า",
    excelInstTiktokTitle: "2. TikTok Link",
    excelInstTiktokDesc: "ใช้ใส่ในโปรไฟล์ TikTok, แคปชันวิดีโอ, คอมเมนต์ หรือแชท TikTok",
    excelInstFbTitle: "3. Facebook Link",
    excelInstFbDesc: "ใช้ใส่ในเพจ Facebook ของร้านค้า, โพสต์ หรือข้อความ Messenger",
    excelInstIgTitle: "4. Instagram Link",
    excelInstIgDesc: "ใช้ใส่ใน Bio ของ Instagram, สตอรี่ หรือข้อความ Direct Message",
    excelInstRuleTitle: "5. กฎการแยกช่องทาง",
    excelInstRuleDesc: "ลิงก์แต่ละช่องทางถูกออกแบบให้ติดตามแยกกันโดยเฉพาะ ห้ามนำลิงก์ผิดช่องทางไปใช้",
    excelInstNoMixTitle: "6. ห้ามคัดลอกข้ามช่องทาง",
    excelInstNoMixDesc: "ห้ามนำ TikTok Link ไปโพสต์บน Facebook เพราะจะทำให้สถิติการระบุแหล่งที่มาผิดพลาด",
    excelInstTrackingTitle: "7. ระบบบันทึกจำนวนคลิก",
    excelInstTrackingDesc: "ระบบปัจจุบันบันทึกจำนวนคลิกเข้าชมลิงก์ทันทีแบบเรียลไทม์",
    excelInstLiffTitle: "8. การยืนยันการเพิ่มเพื่อน",
    excelInstLiffDesc: "ระบบยืนยันการกดเพิ่มเพื่อนจริง (Confirmed Add Friend) จะพร้อมใช้งานหลังเชื่อมต่อ LIFF",

    loading: "กำลังโหลด...",
    emptyState: "ยังไม่มีลิงก์",
    emptyStateDescription: "เลือก LINE OA และคลิก 'สร้างลิงก์' เพื่อเริ่มต้น",
    noResults: "ไม่พบผลลัพธ์",
    noResultsDescription: "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง",
    errorState: "ไม่สามารถโหลดข้อมูลได้",
    retry: "ลองอีกครั้ง",
    error403: "ไม่มีสิทธิ์เข้าถึง",
    error403Description: "หน้านี้ใช้ได้เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้น",
  },

  en: {
    pageTitle: "Friend Source Links",
    pageDescription: "Each selected store receives permanent links for Store QR, TikTok, Facebook, and Instagram — click tracking is available immediately without waiting for LIFF integration.",
    pilotNote: "Confirmed Add Friend attribution will be available when LIFF integration is ready.",

    totalLinks: "Total Links",
    activeLinks: "Active Links",
    totalClicks: "Total Clicks",
    storesConfigured: "Stores Configured",

    sourceStoreQr: "Store QR",
    sourceTikTok: "TikTok",
    sourceFacebook: "Facebook",
    sourceInstagram: "Instagram",

    generatorTitle: "Generate Pilot Links (up to 5 stores)",
    generatorDescription: "Select LINE OAs to generate links. Only connected accounts with a Basic ID are eligible.",
    searchPlaceholder: "Search store name, LINE OA name, or Basic ID",
    selectedCount: (count, max) => `${count}/${max} selected`,
    generatorPreview: (stores, sources, links) => `${stores} stores × ${sources} sources = ${links} links`,
    generateButton: "Generate Links",
    generating: "Generating...",
    generateSuccess: (created, existing) => `${created} new link(s) created · ${existing} already existed (idempotent)`,
    generateIdempotentNote: "Re-generating is safe — existing links are preserved and not replaced.",
    minOneRequired: "Select at least 1 LINE OA",
    maxFiveAllowed: "Maximum 5 LINE OAs allowed",
    noDuplicates: "Duplicate LINE OA IDs are not allowed",
    eligibleOnly: "Only connected, active LINE OAs with a Basic ID are shown",
    noEligibleAccounts: "No eligible LINE OA accounts found",

    tableStore: "Store",
    tableLineOa: "LINE OA",
    tableSource: "Source",
    tableShortLink: "Short Link",
    tableClicks: "Clicks",
    tableIdentifiedVisits: "Identified",
    tableConfirmedAdds: "Confirmed Adds",
    tableConversionRate: "Conversion",
    tableStatus: "Status",
    tableActions: "Actions",

    tooltipIdentified: "User completed LIFF identity verification",
    tooltipConfirmed: "Valid LINE follow webhook matched to the source link",
    tooltipConversion: "Confirmed adds divided by clicks",

    kpiTotalClicks: "Total Clicks",
    kpiIdentifiedVisits: "Total Identified Visits",
    kpiConfirmedAdds: "Total Confirmed Adds",
    kpiOverallConversion: "Overall Conversion Rate",
    copyLink: "Copy",
    openLink: "Open",
    activate: "Activate",
    deactivate: "Deactivate",
    qrDownloadSoon: "QR Download (coming soon)",
    statusActive: "Active",
    statusInactive: "Inactive",
    copiedToast: "Link copied!",
    copyFailedToast: "Copy failed. Please copy manually.",
    confirmDeactivate: (shortUrl) => `Deactivate ${shortUrl}? This link will stop working immediately.`,
    deactivateConfirmYes: "Deactivate",
    deactivateConfirmNo: "Cancel",
    toggleSaving: "Saving...",

    filterSearch: "Search",
    filterStore: "Store",
    filterSource: "Source",
    filterStatus: "Status",
    filterStatusAll: "All",
    filterStatusActive: "Active",
    filterStatusInactive: "Inactive",
    clearFilters: "Clear Filters",

    exportExcel: "Export Excel",
    exportAll: "Export all stores",
    exportCurrent: "Export current results",
    exportRunning: "Exporting Excel...",
    exportSuccess: (filename) => `Successfully exported ${filename}`,
    exportError: (msg) => `Export failed: ${msg}`,
    exportNoData: "No data available to export",

    excelStoreName: "Store Name",
    excelStoreCode: "Store Code",
    excelLineOaName: "LINE OA Name",
    excelBasicId: "LINE Basic ID",
    excelStoreQrLink: "Store QR Link",
    excelTikTokLink: "TikTok Link",
    excelFacebookLink: "Facebook Link",
    excelInstagramLink: "Instagram Link",
    excelActiveSources: "Active Channels",
    excelTotalClicks: "Total Clicks",
    excelIdentifiedVisits: "Identified Visits",
    excelConfirmedAdds: "Confirmed Adds",
    excelConversionRate: "Conversion Rate %",
    excelGeneratedAt: "Created At",
    excelSource: "Channel",
    excelShortLink: "Short Link",
    excelClicks: "Clicks",
    excelStatus: "Status",
    excelCreatedAt: "Created At",
    excelUpdatedAt: "Updated At",

    excelInstTitle: "Friend Source Links Usage & Distribution Guidelines",
    excelInstQrTitle: "1. Store QR Link",
    excelInstQrDesc: "Use for printed materials or QR placement inside the physical store.",
    excelInstTiktokTitle: "2. TikTok Link",
    excelInstTiktokDesc: "Use in TikTok profile bio, video captions, comments, or direct messages.",
    excelInstFbTitle: "3. Facebook Link",
    excelInstFbDesc: "Use on the store's Facebook page, posts, or Messenger replies.",
    excelInstIgTitle: "4. Instagram Link",
    excelInstIgDesc: "Use in Instagram bio, stories, or direct messages.",
    excelInstRuleTitle: "5. Channel Isolation Rule",
    excelInstRuleDesc: "Each source link must only be used in its assigned channel to preserve accurate tracking.",
    excelInstNoMixTitle: "6. Do Not Mix Links",
    excelInstNoMixDesc: "Do not copy the TikTok link for use on Facebook; attribution would become incorrect.",
    excelInstTrackingTitle: "7. Real-Time Click Tracking",
    excelInstTrackingDesc: "The system currently tracks link clicks in real time.",
    excelInstLiffTitle: "8. Confirmed Add Friend",
    excelInstLiffDesc: "Confirmed Add Friend attribution is verified securely via LIFF ID token verification and follow webhooks.",

    loading: "Loading...",
    emptyState: "No links yet",
    emptyStateDescription: "Select LINE OAs and click 'Generate Links' to get started.",
    noResults: "No results found",
    noResultsDescription: "Try changing your search or clearing filters.",
    errorState: "Failed to load data",
    retry: "Retry",
    error403: "Access Denied",
    error403Description: "This page is only accessible to ADMIN users.",
  },

  zh: {
    pageTitle: "加好友来源链接",
    pageDescription: "每个选定的门店将获得门店二维码、TikTok、Facebook 和 Instagram 的永久链接 — 立即可以追踪点击次数，无需等待 LIFF 集成。",
    pilotNote: "确认加好友归因将在 LIFF 集成完成后启用。",

    totalLinks: "链接总数",
    activeLinks: "活跃链接",
    totalClicks: "总点击次数",
    storesConfigured: "已配置门店",

    sourceStoreQr: "门店二维码",
    sourceTikTok: "TikTok",
    sourceFacebook: "Facebook",
    sourceInstagram: "Instagram",

    generatorTitle: "生成试点链接（最多 5 家门店）",
    generatorDescription: "选择要生成链接的 LINE OA（仅限已连接且具有 Basic ID 的账户）",
    searchPlaceholder: "搜索门店名、LINE OA 名或 Basic ID",
    selectedCount: (count, max) => `已选 ${count}/${max}`,
    generatorPreview: (stores, sources, links) => `${stores} 家门店 × ${sources} 个来源 = ${links} 个链接`,
    generateButton: "生成链接",
    generating: "生成中...",
    generateSuccess: (created, existing) => `已创建 ${created} 个新链接 · ${existing} 个已存在（幂等操作）`,
    generateIdempotentNote: "重复生成是安全的 — 现有链接将被保留，不会被替换。",
    minOneRequired: "请至少选择 1 个 LINE OA",
    maxFiveAllowed: "最多允许选择 5 个 LINE OA",
    noDuplicates: "不允许选择重复的 LINE OA",
    eligibleOnly: "仅显示已连接、活跃且有 Basic ID 的 LINE OA",
    noEligibleAccounts: "未找到符合条件的 LINE OA 账户",

    tableStore: "门店",
    tableLineOa: "LINE OA",
    tableSource: "来源",
    tableShortLink: "短链接",
    tableClicks: "点击",
    tableIdentifiedVisits: "已识别",
    tableConfirmedAdds: "成功加好友",
    tableConversionRate: "转化率",
    tableStatus: "状态",
    tableActions: "操作",

    tooltipIdentified: "用户已完成 LIFF 身份验证",
    tooltipConfirmed: "LINE 关注 Webhook 已成功匹配至来源链接",
    tooltipConversion: "成功加好友数除以总点击数",

    kpiTotalClicks: "总点击次数",
    kpiIdentifiedVisits: "总识别次数",
    kpiConfirmedAdds: "总成功加好友数",
    kpiOverallConversion: "整体转化率",
    copyLink: "复制",
    openLink: "打开",
    activate: "启用",
    deactivate: "禁用",
    qrDownloadSoon: "二维码下载（即将推出）",
    statusActive: "活跃",
    statusInactive: "已禁用",
    copiedToast: "链接已复制！",
    copyFailedToast: "复制失败，请手动复制。",
    confirmDeactivate: (shortUrl) => `禁用 ${shortUrl}？此链接将立即停止工作。`,
    deactivateConfirmYes: "禁用",
    deactivateConfirmNo: "取消",
    toggleSaving: "保存中...",

    filterSearch: "搜索",
    filterStore: "门店",
    filterSource: "来源",
    filterStatus: "状态",
    filterStatusAll: "全部",
    filterStatusActive: "活跃",
    filterStatusInactive: "已禁用",
    clearFilters: "清除筛选",

    exportExcel: "导出 Excel",
    exportAll: "导出所有门店",
    exportCurrent: "导出当前筛选结果",
    exportRunning: "正在导出 Excel...",
    exportSuccess: (filename) => `成功导出 ${filename}`,
    exportError: (msg) => `导出失败: ${msg}`,
    exportNoData: "没有可导出的数据",

    excelStoreName: "门店名称",
    excelStoreCode: "门店代码",
    excelLineOaName: "LINE OA 名称",
    excelBasicId: "LINE Basic ID",
    excelStoreQrLink: "门店二维码链接",
    excelTikTokLink: "TikTok 链接",
    excelFacebookLink: "Facebook 链接",
    excelInstagramLink: "Instagram 链接",
    excelActiveSources: "活跃渠道数",
    excelTotalClicks: "总点击量",
    excelIdentifiedVisits: "已身份识别",
    excelConfirmedAdds: "已确认添加好友",
    excelConversionRate: "转化率 %",
    excelGeneratedAt: "生成时间",
    excelSource: "来源",
    excelShortLink: "短链接",
    excelClicks: "点击量",
    excelStatus: "状态",
    excelCreatedAt: "创建时间",
    excelUpdatedAt: "更新时间",

    excelInstTitle: "加好友来源链接使用与分发指南",
    excelInstQrTitle: "1. 门店二维码链接",
    excelInstQrDesc: "用于印刷宣传品或门店内的二维码摆牌。",
    excelInstTiktokTitle: "2. TikTok 链接",
    excelInstTiktokDesc: "用于 TikTok 个人主页 Bio、视频文案、评论或私信。",
    excelInstFbTitle: "3. Facebook 链接",
    excelInstFbDesc: "用于门店 Facebook 主页、帖子或 Messenger 自动回复。",
    excelInstIgTitle: "4. Instagram 链接",
    excelInstIgDesc: "用于 Instagram 个人主页 Bio、Story 或私信。",
    excelInstRuleTitle: "5. 渠道隔离规则",
    excelInstRuleDesc: "每个渠道链接仅限在其指定的渠道中使用，以确保数据追踪准确。",
    excelInstNoMixTitle: "6. 禁止跨渠道混用",
    excelInstNoMixDesc: "切勿将 TikTok 链接复制发布到 Facebook，否则归因数据将失真。",
    excelInstTrackingTitle: "7. 实时点击追踪",
    excelInstTrackingDesc: "系统目前实时记录链接点击量。",
    excelInstLiffTitle: "8. 确认加好友归因",
    excelInstLiffDesc: "确认加好友归因功能将在 LIFF 集成完成后启用。",

    loading: "加载中...",
    emptyState: "暂无链接",
    emptyStateDescription: "选择 LINE OA 并点击「生成链接」开始使用。",
    noResults: "未找到结果",
    noResultsDescription: "请尝试修改搜索词或清除筛选条件。",
    errorState: "加载数据失败",
    retry: "重试",
    error403: "访问被拒绝",
    error403Description: "此页面仅限 ADMIN 用户访问。",
  },
};

export function getFriendSourceLinksText(language: Language): FriendSourceLinksTranslations {
  return friendSourceLinksTranslations[language];
}
