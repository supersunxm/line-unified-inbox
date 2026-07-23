export type Language = "th" | "en" | "zh";

export type FollowerInsightsTranslations = {
  followerInsightsTitle: string;
  partialDataAvailable: string;
  dataCoverage: string;
  lastRefreshed: string;
  syncMissingDates: string;
  totalFollowers: string;
  dailyIncrease: string;
  targetedReach: string;
  blocks: string;
  accountsReady: string;
  trendAnalysis: string;
  availableData: string;
  noData: string;
  dailySummary: string;
  storeBreakdown: string;
  followers: string;
  startFollowers: string;
  periodIncrease: string;
  lastFetched: string;
  ready: string;
  partial: string;
  missing: string;
  missingBaseline: string;
  searchStoresPlaceholder: string;
  exportCsv: string;
  previous: string;
  next: string;
  selectDateRange: string;
  cancel: string;
  apply: string;
  confirmSync: string;
  selectedRange: string;
  exactMissingDays: string;
  targetAccounts: string;
  estimatedMaxCalls: string;

  // Formatters & templates
  dataCoverageText: (usable: number, total: number, percent: number) => string;
  snapshotForDate: (date: string) => string;
  noDataForDate: (date: string) => string;
  accountsMissingText: (count: number) => string;
  allAccountsReady: string;
  noSnapshot: string;
  oneDayComparison: string;
  missingPreviousDate: string;
  showingDaysText: (start: number, end: number, total: number) => string;
  showingStoresText: (start: number, end: number, total: number) => string;
  totalDaysCount: (total: number) => string;
  snapshotTargetDate: (date: string) => string;
  noStoresFound: (query: string) => string;
  noDailySummaryData: string;
  noStoreBreakdownData: string;
  errorLoadingSummary: string;
  errorLoadingStore: string;
  retrySummary: string;
  retryStore: string;
  endpointWarning: string;
  rangeMax90Days: string;
  rangeEndDateEarlier: string;
  syncMissingModalDesc: string;
  estimatedCallsDetail: (days: number, accounts: number) => string;
  syncComplete: string;
  syncSummaryResult: (requested: number, succeeded: number, unready: number, failed: number, skipped: number) => string;
  syncingBtn: string;
  syncMissingBtnWithCount: (count: number) => string;
  contiguousMissingRanges: string;
  dayUnit: (count: number) => string;
  accountUnit: (count: number) => string;

  // Date picker
  prevMonth: string;
  nextMonth: string;
  weekdays: [string, string, string, string, string, string, string];
  quickRange7: string;
  quickRange30: string;
  quickRange90: string;
  max90DaysNote: string;

  // Trend chart & Store filter
  trendSubheader: string;
  noChartData: string;
  metricViewFollowers: string;
  metricViewTargetedReach: string;
  metricViewBlocks: string;
  allStores: string;
  searchStoresOrLineOas: string;
  selectedStore: string;
  noDataForStoreInRange: string;
  failedToLoadStoreTrend: string;
  clearStoreFilter: string;
};

export const followerInsightsTranslations: Record<Language, FollowerInsightsTranslations> = {
  th: {
    followerInsightsTitle: "ข้อมูลผู้ติดตาม",
    partialDataAvailable: "มีข้อมูลเพียงบางส่วน",
    dataCoverage: "ความครอบคลุมของข้อมูล",
    lastRefreshed: "อัปเดตล่าสุด",
    syncMissingDates: "ดึงข้อมูลวันที่ขาด",
    totalFollowers: "ผู้ติดตามทั้งหมด",
    dailyIncrease: "เพิ่มขึ้นรายวัน",
    targetedReach: "ผู้รับข้อความที่เข้าถึงได้",
    blocks: "จำนวนบล็อก",
    accountsReady: "บัญชีที่พร้อม",
    trendAnalysis: "แนวโน้มผู้ติดตาม",
    availableData: "มีข้อมูล",
    noData: "ไม่มีข้อมูล",
    dailySummary: "สรุปรายวัน",
    storeBreakdown: "รายละเอียดรายร้าน",
    followers: "ผู้ติดตาม",
    startFollowers: "ผู้ติดตามวันเริ่มต้น",
    periodIncrease: "เพิ่มขึ้นในช่วงเวลา",
    lastFetched: "ดึงข้อมูลล่าสุด",
    ready: "พร้อม",
    partial: "ข้อมูลบางส่วน",
    missing: "ไม่มีข้อมูล",
    missingBaseline: "ไม่มีข้อมูลวันเริ่มต้น",
    searchStoresPlaceholder: "ค้นหาร้านค้าหรือ LINE OA",
    exportCsv: "ส่งออก CSV",
    previous: "ก่อนหน้า",
    next: "ถัดไป",
    selectDateRange: "เลือกช่วงวันที่",
    cancel: "ยกเลิก",
    apply: "นำไปใช้",
    confirmSync: "ยืนยันการดึงข้อมูล",
    selectedRange: "ช่วงวันที่เลือก",
    exactMissingDays: "จำนวนวันที่ขาด",
    targetAccounts: "จำนวนบัญชีเป้าหมาย",
    estimatedMaxCalls: "จำนวนการเรียก LINE API สูงสุดโดยประมาณ",

    dataCoverageText: (usable, total, percent) =>
      `ความครอบคลุมของข้อมูล: ${usable} จาก ${total} วัน (${percent}%)`,
    snapshotForDate: (date) => `ข้อมูล ณ วันที่ ${date}`,
    noDataForDate: (date) => `ไม่มีข้อมูล ณ วันที่ ${date}`,
    accountsMissingText: (count) => `ขาดอีก ${count} บัญชี`,
    allAccountsReady: "บัญชีพร้อมทั้งหมด",
    noSnapshot: "ไม่มีภาพรวมข้อมูล",
    oneDayComparison: "เปรียบเทียบ 1 วัน",
    missingPreviousDate: "ไม่มีข้อมูลวันก่อนหน้า",
    showingDaysText: (start, end, total) => `แสดงวันที่ ${start} ถึง ${end} จากทั้งหมด ${total} วัน`,
    showingStoresText: (start, end, total) => `แสดงร้านที่ ${start} ถึง ${end} จากทั้งหมด ${total} ร้าน`,
    totalDaysCount: (total) => `ทั้งหมด ${total} วัน`,
    snapshotTargetDate: (date) => `ข้อมูล ณ วันสิ้นสุดช่วงเวลา: ${date}`,
    noStoresFound: (query) => `ไม่พบร้านค้าที่ตรงกับ "${query}"`,
    noDailySummaryData: "ไม่มีข้อมูลสรุปรายวัน",
    noStoreBreakdownData: "ไม่มีข้อมูลรายละเอียดรายร้าน",
    errorLoadingSummary: "เกิดข้อผิดพลาดในการโหลดสรุปรายวัน",
    errorLoadingStore: "เกิดข้อผิดพลาดในการโหลดรายละเอียดรายร้าน",
    retrySummary: "ลองใหม่ข้อมูลสรุป",
    retryStore: "ลองใหม่ข้อมูลร้านค้า",
    endpointWarning: "คำเตือน: ข้อมูลวันเริ่มต้นหรือวันสิ้นสุดช่วงเวลาไม่สมบูรณ์ ไม่สามารถคำนวณการเพิ่มขึ้นในช่วงเวลาได้อย่างแม่นยำ",
    rangeMax90Days: "ช่วงวันที่ต้องไม่เกิน 90 วัน",
    rangeEndDateEarlier: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น",
    syncMissingModalDesc: "การดำเนินการนี้จะเรียก LINE API เพื่อดึงข้อมูลประวัติผู้ติดตามสำหรับวันที่ขาดหายในช่วงเวลาที่เลือก",
    estimatedCallsDetail: (days, accounts) =>
      `~${(days * accounts).toLocaleString()} ครั้ง (${days} วัน × ${accounts} บัญชี)`,
    syncComplete: "ดึงข้อมูลเสร็จสิ้น",
    syncSummaryResult: (requested, succeeded, unready, failed, skipped) =>
      `คำขอ: ${requested} | สำเร็จ: ${succeeded} | ยังไม่พร้อม: ${unready} | ล้มเหลว: ${failed} | ข้าม: ${skipped}`,
    syncingBtn: "กำลังดึงข้อมูล...",
    syncMissingBtnWithCount: (count) => `ดึงข้อมูลวันที่ขาด (${count})`,
    contiguousMissingRanges: "ช่วงวันที่ขาดหายต่อเนื่อง",
    dayUnit: (count) => `${count} วัน`,
    accountUnit: (count) => `${count} บัญชี`,

    prevMonth: "เดือนก่อนหน้า",
    nextMonth: "เดือนถัดไป",
    weekdays: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
    quickRange7: "7 วันที่ผ่านมา",
    quickRange30: "30 วันที่ผ่านมา",
    quickRange90: "90 วันที่ผ่านมา",
    max90DaysNote: "เลือกช่วงวันที่ได้สูงสุด 90 วัน",

    trendSubheader: "ข้อมูลประวัติตามปฏิทิน (ช่วงที่เว้นว่างคือวันที่ไม่มีข้อมูล)",
    noChartData: "ไม่มีข้อมูลแผนภูมิในช่วงเวลาที่เลือก",
    metricViewFollowers: "ดูตัวเลขผู้ติดตาม",
    metricViewTargetedReach: "ดูตัวเลขผู้รับข้อความที่เข้าถึงได้",
    metricViewBlocks: "ดูตัวเลขการบล็อก",
    allStores: "ทุกร้าน",
    searchStoresOrLineOas: "ค้นหาร้านค้าหรือ LINE OA...",
    selectedStore: "ร้านค้าที่เลือก",
    noDataForStoreInRange: "ไม่มีข้อมูลสำหรับร้านนี้ในช่วงวันที่เลือก",
    failedToLoadStoreTrend: "โหลดข้อมูลแนวโน้มของร้านค้าไม่สำเร็จ",
    clearStoreFilter: "ล้างตัวกรองร้านค้า",
  },
  en: {
    followerInsightsTitle: "Follower Insights",
    partialDataAvailable: "Partial data available",
    dataCoverage: "Data coverage",
    lastRefreshed: "Last refreshed",
    syncMissingDates: "Sync Missing Dates",
    totalFollowers: "Total Followers",
    dailyIncrease: "Daily Increase",
    targetedReach: "Targeted Reach",
    blocks: "Blocks",
    accountsReady: "Accounts Ready",
    trendAnalysis: "Trend Analysis",
    availableData: "Available data",
    noData: "No data",
    dailySummary: "Daily Summary",
    storeBreakdown: "Store Breakdown",
    followers: "Followers",
    startFollowers: "Start Followers",
    periodIncrease: "Period Increase",
    lastFetched: "Last Fetched",
    ready: "Ready",
    partial: "Partial",
    missing: "Missing",
    missingBaseline: "Missing baseline",
    searchStoresPlaceholder: "Search stores or LINE OAs...",
    exportCsv: "Export CSV",
    previous: "Previous",
    next: "Next",
    selectDateRange: "Select date range",
    cancel: "Cancel",
    apply: "Apply",
    confirmSync: "Confirm Sync",
    selectedRange: "Selected Range",
    exactMissingDays: "Exact Missing Days",
    targetAccounts: "Target Accounts",
    estimatedMaxCalls: "Estimated Maximum LINE API Calls",

    dataCoverageText: (usable, total, percent) =>
      `Data coverage: ${usable} of ${total} days (${percent}%)`,
    snapshotForDate: (date) => `Snapshot for ${date}`,
    noDataForDate: (date) => `No data for ${date}`,
    accountsMissingText: (count) => `${count} missing`,
    allAccountsReady: "All accounts ready",
    noSnapshot: "No snapshot",
    oneDayComparison: "1-day comparison",
    missingPreviousDate: "Missing previous date",
    showingDaysText: (start, end, total) => `Showing ${start} to ${end} of ${total} days`,
    showingStoresText: (start, end, total) => `Showing ${start} to ${end} of ${total} stores`,
    totalDaysCount: (total) => `${total} total days`,
    snapshotTargetDate: (date) => `Snapshot target date: ${date}`,
    noStoresFound: (query) => `No stores found matching "${query}"`,
    noDailySummaryData: "No daily summary data",
    noStoreBreakdownData: "No store breakdown data",
    errorLoadingSummary: "Error loading daily summary",
    errorLoadingStore: "Error loading store breakdown data",
    retrySummary: "Retry Summary",
    retryStore: "Retry Store Data",
    endpointWarning: "Warning: Selected range endpoints contain missing or partial data. Period Increase cannot be calculated accurately.",
    rangeMax90Days: "Date range cannot exceed 90 days.",
    rangeEndDateEarlier: "End date cannot be earlier than start date.",
    syncMissingModalDesc: "This action will request LINE APIs to fetch historical follower insights for missing dates within your selected range.",
    estimatedCallsDetail: (days, accounts) =>
      `~${(days * accounts).toLocaleString()} requests (${days} days × ${accounts} accounts)`,
    syncComplete: "Sync complete",
    syncSummaryResult: (requested, succeeded, unready, failed, skipped) =>
      `Requested: ${requested} | Succeeded: ${succeeded} | Unready: ${unready} | Failed: ${failed} | Skipped: ${skipped}`,
    syncingBtn: "Syncing...",
    syncMissingBtnWithCount: (count) => `Sync Missing Dates (${count})`,
    contiguousMissingRanges: "Contiguous Missing Ranges",
    dayUnit: (count) => `${count} day${count === 1 ? "" : "s"}`,
    accountUnit: (count) => `${count} account${count === 1 ? "" : "s"}`,

    prevMonth: "Previous month",
    nextMonth: "Next month",
    weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    quickRange7: "Last 7 days",
    quickRange30: "Last 30 days",
    quickRange90: "Last 90 days",
    max90DaysNote: "Max 90 calendar days range.",

    trendSubheader: "Historical metrics preserving all calendar dates (gaps indicate unpopulated dates)",
    noChartData: "No chart data available for the selected period",
    metricViewFollowers: "View Followers metric",
    metricViewTargetedReach: "View Targeted Reach metric",
    metricViewBlocks: "View Blocks metric",
    allStores: "All stores",
    searchStoresOrLineOas: "Search stores or LINE OAs...",
    selectedStore: "Selected store",
    noDataForStoreInRange: "No data for this store in the selected range",
    failedToLoadStoreTrend: "Failed to load store trend",
    clearStoreFilter: "Clear store filter",
  },
  zh: {
    followerInsightsTitle: "关注者洞察",
    partialDataAvailable: "部分数据可用",
    dataCoverage: "数据覆盖率",
    lastRefreshed: "最新刷新",
    syncMissingDates: "同步缺失日期",
    totalFollowers: "总关注者",
    dailyIncrease: "每日增加",
    targetedReach: "目标覆盖人数",
    blocks: "屏蔽数",
    accountsReady: "准备就绪的账号",
    trendAnalysis: "趋势分析",
    availableData: "有数据",
    noData: "无数据",
    dailySummary: "每日汇总",
    storeBreakdown: "门店明细",
    followers: "关注者",
    startFollowers: "起始关注者",
    periodIncrease: "期间增加",
    lastFetched: "最新拉取",
    ready: "就绪",
    partial: "部分",
    missing: "缺失",
    missingBaseline: "缺少基线数据",
    searchStoresPlaceholder: "搜索门店或 LINE OA...",
    exportCsv: "导出 CSV",
    previous: "上一页",
    next: "下一页",
    selectDateRange: "选择日期范围",
    cancel: "取消",
    apply: "应用",
    confirmSync: "确认同步",
    selectedRange: "选定范围",
    exactMissingDays: "确切缺失天数",
    targetAccounts: "目标账号数",
    estimatedMaxCalls: "预估最大 LINE API 调用次数",

    dataCoverageText: (usable, total, percent) =>
      `数据覆盖率: ${total} 天中的 ${usable} 天 (${percent}%)`,
    snapshotForDate: (date) => `${date} 快照`,
    noDataForDate: (date) => `${date} 无数据`,
    accountsMissingText: (count) => `缺失 ${count} 个账号`,
    allAccountsReady: "所有账号就绪",
    noSnapshot: "无快照",
    oneDayComparison: "1 天对比",
    missingPreviousDate: "缺少前一日数据",
    showingDaysText: (start, end, total) => `显示第 ${start} 至 ${end} 天，共 ${total} 天`,
    showingStoresText: (start, end, total) => `显示第 ${start} 至 ${end} 家门店，共 ${total} 家`,
    totalDaysCount: (total) => `共 ${total} 天`,
    snapshotTargetDate: (date) => `目标日期快照: ${date}`,
    noStoresFound: (query) => `未找到匹配 "${query}" 的门店`,
    noDailySummaryData: "无每日汇总数据",
    noStoreBreakdownData: "无门店明细数据",
    errorLoadingSummary: "加载每日汇总出错",
    errorLoadingStore: "加载门店明细出错",
    retrySummary: "重试汇总",
    retryStore: "重试门店",
    endpointWarning: "警告：所选范围的端点包含缺失或部分数据。无法准确计算期间增加量。",
    rangeMax90Days: "日期范围不能超过 90 天。",
    rangeEndDateEarlier: "结束日期不能早于开始日期。",
    syncMissingModalDesc: "此操作将调用 LINE API 以获取所选范围内缺失日期的历史关注者洞察。",
    estimatedCallsDetail: (days, accounts) =>
      `~${(days * accounts).toLocaleString()} 次请求 (${days} 天 × ${accounts} 个账号)`,
    syncComplete: "同步完成",
    syncSummaryResult: (requested, succeeded, unready, failed, skipped) =>
      `请求: ${requested} | 成功: ${succeeded} | 未就绪: ${unready} | 失败: ${failed} | 跳过: ${skipped}`,
    syncingBtn: "同步中...",
    syncMissingBtnWithCount: (count) => `同步缺失日期 (${count})`,
    contiguousMissingRanges: "连续缺失范围",
    dayUnit: (count) => `${count} 天`,
    accountUnit: (count) => `${count} 个账号`,

    prevMonth: "上一月",
    nextMonth: "下一月",
    weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    quickRange7: "最近 7 天",
    quickRange30: "最近 30 天",
    quickRange90: "最近 90 天",
    max90DaysNote: "日期范围最多 90 天。",

    trendSubheader: "按日历日期的历史指标（空白处表示无数据）",
    noChartData: "所选期间无图表数据",
    metricViewFollowers: "查看关注者指标",
    metricViewTargetedReach: "查看目标覆盖指标",
    metricViewBlocks: "查看屏蔽指标",
    allStores: "全部门店",
    searchStoresOrLineOas: "搜索门店或 LINE OA...",
    selectedStore: "已选门店",
    noDataForStoreInRange: "所选范围内该门店无数据",
    failedToLoadStoreTrend: "加载门店趋势数据失败",
    clearStoreFilter: "清除门店筛选",
  },
};

export function getFollowerInsightsText(language: Language = "en"): FollowerInsightsTranslations {
  if (language === "th") return followerInsightsTranslations.th;
  if (language === "zh") return followerInsightsTranslations.zh;
  return followerInsightsTranslations.en;
}
