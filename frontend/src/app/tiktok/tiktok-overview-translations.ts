import type { AppLanguage } from "../language";

export type TikTokOverviewText = {
  opening: string;
  monitorTag: string;
  storeAccountsTitle: string;
  storeAccountsDescription: string;
  dashboard: string;
  connectTikTok: string;
  connectTikTokAccount: string;
  noAccountTitle: string;
  noAccountDescription: string;
  overviewTag: string;
  connectedStoreAccounts: string;
  connectedStoreDescription: string;
  openDashboard: string;
  today: string;
  sevenDays: string;
  thirtyDays: string;
  searchPlaceholder: string;
  searchMobilePlaceholder: string;
  allRegions: string;
  allProvinces: string;
  sortStoreName: string;
  sortFollowers: string;
  sortFollowerGrowth: string;
  sortLikes: string;
  sortVideos: string;
  clearFilters: string;
  connectedAccounts: string;
  totalFollowers: string;
  totalLikes: string;
  totalPublicVideos: string;
  followers: string;
  following: string;
  likes: string;
  videos: string;
  storeBinding: string;
  storeNotLinked: string;
  accountOverviewTag: string;
  accountDescription: string;
  tiktokStoreAccount: string;
  viewOnTikTok: string;
  verifiedAccount: string;
  lastSynced: string;
  accountsFollowed: string;
  performanceTitle: string;
  performanceDescription: string;
  openPerformanceDashboard: string;
  stores: string;
  noStores: string;
  noStoresDescription: string;
  followerGrowth: string;
  latestVideos: string;
  views: string;
  comments: string;
  shares: string;
  openInTikTok: string;
  connected: string;
  expired: string;
  accountCount: (count: number) => string;
  storeCount: (count: number) => string;
  followersTotal: (count: string) => string;
  likesTotal: (count: string) => string;
  videosSynced: (count: number) => string;
  growthInSevenDays: (value: string) => string;
};

const texts: Record<AppLanguage, TikTokOverviewText> = {
  th: {
    opening: "กำลังเปิด TikTok Monitor...",
    monitorTag: "OPPO Retail TikTok Monitor",
    storeAccountsTitle: "บัญชี TikTok ของร้านค้า",
    storeAccountsDescription: "โปรไฟล์ ตัวชี้วัด และภาพรวมของบัญชี TikTok ร้านค้าที่ได้รับอนุญาต",
    dashboard: "แดชบอร์ด",
    connectTikTok: "เชื่อมต่อ TikTok",
    connectTikTokAccount: "เชื่อมต่อบัญชี TikTok",
    noAccountTitle: "ยังไม่มีบัญชี TikTok ที่เชื่อมต่อ",
    noAccountDescription: "เชื่อมต่อบัญชี TikTok ร้านค้าที่ได้รับอนุญาตเพื่อดูข้อมูลผู้ติดตาม การมีส่วนร่วม และประสิทธิภาพวิดีโอ",
    overviewTag: "OPPO Retail TikTok Monitor · ภาพรวมบัญชีร้านค้า",
    connectedStoreAccounts: "บัญชีร้านค้าที่เชื่อมต่อแล้ว",
    connectedStoreDescription: "ภาพรวมและการเปรียบเทียบประสิทธิภาพของบัญชี TikTok ร้านค้าที่ได้รับอนุญาต",
    openDashboard: "เปิดแดชบอร์ด",
    today: "วันนี้",
    sevenDays: "7 วัน",
    thirtyDays: "30 วัน",
    searchPlaceholder: "ค้นหาชื่อร้าน username หรือชื่อที่แสดง…",
    searchMobilePlaceholder: "ค้นหาร้าน / username",
    allRegions: "ทุกภูมิภาค",
    allProvinces: "ทุกจังหวัด",
    sortStoreName: "ชื่อร้าน (A-Z)",
    sortFollowers: "ผู้ติดตาม (มากไปน้อย)",
    sortFollowerGrowth: "ผู้ติดตามเพิ่มขึ้น (สูงสุด)",
    sortLikes: "ไลก์รวม (มากไปน้อย)",
    sortVideos: "วิดีโอ (มากไปน้อย)",
    clearFilters: "ล้างตัวกรอง",
    connectedAccounts: "บัญชีที่เชื่อมต่อ",
    totalFollowers: "ผู้ติดตามรวม",
    totalLikes: "ไลก์รวม",
    totalPublicVideos: "วิดีโอสาธารณะรวม",
    followers: "ผู้ติดตาม",
    following: "กำลังติดตาม",
    likes: "ไลก์",
    videos: "วิดีโอ",
    storeBinding: "ร้านค้าที่ผูก",
    storeNotLinked: "ยังไม่ได้ผูกร้านค้า",
    accountOverviewTag: "OPPO Retail TikTok Monitor · ภาพรวมบัญชี",
    accountDescription: "โปรไฟล์และภาพรวมผู้ติดตามของบัญชี TikTok ร้านค้าที่ได้รับอนุญาต",
    tiktokStoreAccount: "บัญชี TikTok ร้านค้า",
    viewOnTikTok: "ดูบน TikTok",
    verifiedAccount: "บัญชีที่ยืนยันแล้ว",
    lastSynced: "ซิงก์ล่าสุด",
    accountsFollowed: "บัญชีที่กำลังติดตาม",
    performanceTitle: "ดูประสิทธิภาพวิดีโอและการมีส่วนร่วมของร้าน",
    performanceDescription: "ดูยอดรับชมวิดีโอ คอนเทนต์ที่ทำผลงานดีที่สุด รายละเอียดความคิดเห็น และสัดส่วนการแชร์",
    openPerformanceDashboard: "เปิดแดชบอร์ดประสิทธิภาพ",
    stores: "ร้านค้า",
    noStores: "ไม่พบร้านค้า",
    noStoresDescription: "ลองเปลี่ยนตัวกรองหรือคำค้นหา",
    followerGrowth: "การเติบโตของผู้ติดตาม",
    latestVideos: "วิดีโอล่าสุด",
    views: "ยอดดู",
    comments: "ความคิดเห็น",
    shares: "แชร์",
    openInTikTok: "เปิดใน TikTok",
    connected: "เชื่อมต่อแล้ว",
    expired: "หมดอายุ",
    accountCount: (count) => `${count} บัญชีที่เชื่อมต่ออยู่`,
    storeCount: (count) => `${count} ร้าน`,
    followersTotal: (count) => `ผู้ติดตามทั้งหมด ${count}`,
    likesTotal: (count) => `ไลก์ทั้งหมด ${count}`,
    videosSynced: (count) => `ซิงก์วิดีโอเข้าฐานข้อมูลแล้ว ${count} รายการ`,
    growthInSevenDays: (value) => `${value} ใน 7 วัน`,
  },
  en: {
    opening: "Opening TikTok Monitor...",
    monitorTag: "OPPO Retail TikTok Monitor",
    storeAccountsTitle: "TikTok Store Accounts",
    storeAccountsDescription: "Authorized TikTok store account profile, metrics, and module overview.",
    dashboard: "Dashboard",
    connectTikTok: "Connect TikTok",
    connectTikTokAccount: "Connect TikTok Account",
    noAccountTitle: "No TikTok Account Connected Yet",
    noAccountDescription: "Connect your authorized TikTok retail account to enable real-time audience metrics, engagement insights, and video performance monitoring.",
    overviewTag: "OPPO Retail TikTok Monitor · Store Accounts Overview",
    connectedStoreAccounts: "Connected Store Accounts",
    connectedStoreDescription: "Overview and comparative performance of authorized TikTok retail store accounts.",
    openDashboard: "Open Dashboard",
    today: "Today",
    sevenDays: "7 Days",
    thirtyDays: "30 Days",
    searchPlaceholder: "Search store name, username, or display name…",
    searchMobilePlaceholder: "Search store / username",
    allRegions: "All Regions",
    allProvinces: "All Provinces",
    sortStoreName: "Store Name (A-Z)",
    sortFollowers: "Followers (High to Low)",
    sortFollowerGrowth: "Follower Growth (Highest)",
    sortLikes: "Total Likes (High to Low)",
    sortVideos: "Videos (High to Low)",
    clearFilters: "Clear filters",
    connectedAccounts: "Connected Accounts",
    totalFollowers: "Total Followers",
    totalLikes: "Total Likes",
    totalPublicVideos: "Total Public Videos",
    followers: "Followers",
    following: "Following",
    likes: "Likes",
    videos: "Videos",
    storeBinding: "Store Binding",
    storeNotLinked: "Store not linked yet",
    accountOverviewTag: "OPPO Retail TikTok Monitor · Account Overview",
    accountDescription: "Authorized TikTok retail store account profile and audience overview.",
    tiktokStoreAccount: "TikTok Store Account",
    viewOnTikTok: "View on TikTok",
    verifiedAccount: "Verified Account",
    lastSynced: "Last synced",
    accountsFollowed: "Accounts followed",
    performanceTitle: "Explore Store Video Performance & Engagement",
    performanceDescription: "View total video views, top performing content, comment breakdown, and share ratios.",
    openPerformanceDashboard: "Open Performance Dashboard",
    stores: "Stores",
    noStores: "No stores found",
    noStoresDescription: "Try changing the filters or search query.",
    followerGrowth: "Follower Growth",
    latestVideos: "Latest videos",
    views: "views",
    comments: "Comments",
    shares: "Shares",
    openInTikTok: "Open in TikTok",
    connected: "Connected",
    expired: "Expired",
    accountCount: (count) => `${count} connected accounts`,
    storeCount: (count) => `${count} stores`,
    followersTotal: (count) => `${count} total followers`,
    likesTotal: (count) => `${count} total likes`,
    videosSynced: (count) => `${count} videos synced to database`,
    growthInSevenDays: (value) => `${value} in 7 days`,
  },
  zh: {
    opening: "正在打开 TikTok Monitor...",
    monitorTag: "OPPO Retail TikTok Monitor",
    storeAccountsTitle: "TikTok 门店账户",
    storeAccountsDescription: "经授权 TikTok 门店账户的资料、指标和模块概览。",
    dashboard: "仪表板",
    connectTikTok: "连接 TikTok",
    connectTikTokAccount: "连接 TikTok 账户",
    noAccountTitle: "尚未连接 TikTok 账户",
    noAccountDescription: "连接经授权的 TikTok 零售账户，以查看实时受众指标、互动洞察和视频表现。",
    overviewTag: "OPPO Retail TikTok Monitor · 门店账户概览",
    connectedStoreAccounts: "已连接的门店账户",
    connectedStoreDescription: "经授权 TikTok 零售门店账户的概览与表现比较。",
    openDashboard: "打开仪表板",
    today: "今天",
    sevenDays: "7 天",
    thirtyDays: "30 天",
    searchPlaceholder: "搜索门店名称、username 或显示名称…",
    searchMobilePlaceholder: "搜索门店 / username",
    allRegions: "所有区域",
    allProvinces: "所有省份",
    sortStoreName: "门店名称 (A-Z)",
    sortFollowers: "关注者（从高到低）",
    sortFollowerGrowth: "关注者增长（最高）",
    sortLikes: "总点赞（从高到低）",
    sortVideos: "视频（从高到低）",
    clearFilters: "清除筛选",
    connectedAccounts: "已连接账户",
    totalFollowers: "关注者总数",
    totalLikes: "总点赞数",
    totalPublicVideos: "公开视频总数",
    followers: "关注者",
    following: "正在关注",
    likes: "点赞",
    videos: "视频",
    storeBinding: "绑定门店",
    storeNotLinked: "尚未绑定门店",
    accountOverviewTag: "OPPO Retail TikTok Monitor · 账户概览",
    accountDescription: "经授权 TikTok 零售门店账户的资料和受众概览。",
    tiktokStoreAccount: "TikTok 门店账户",
    viewOnTikTok: "在 TikTok 查看",
    verifiedAccount: "已认证账户",
    lastSynced: "最后同步",
    accountsFollowed: "正在关注的账户",
    performanceTitle: "查看门店视频表现与互动",
    performanceDescription: "查看视频总播放量、表现最佳内容、评论明细和分享比例。",
    openPerformanceDashboard: "打开表现仪表板",
    stores: "门店",
    noStores: "未找到门店",
    noStoresDescription: "请尝试更改筛选条件或搜索关键词。",
    followerGrowth: "关注者增长",
    latestVideos: "最新视频",
    views: "播放",
    comments: "评论",
    shares: "分享",
    openInTikTok: "在 TikTok 打开",
    connected: "已连接",
    expired: "已过期",
    accountCount: (count) => `${count} 个已连接账户`,
    storeCount: (count) => `${count} 家门店`,
    followersTotal: (count) => `共 ${count} 位关注者`,
    likesTotal: (count) => `共 ${count} 个点赞`,
    videosSynced: (count) => `已同步 ${count} 个视频到数据库`,
    growthInSevenDays: (value) => `${value} / 7 天`,
  },
};

export function getTikTokOverviewText(language: AppLanguage): TikTokOverviewText {
  return texts[language];
}

export function getTikTokLocale(language: AppLanguage): string {
  if (language === "th") return "th-TH";
  if (language === "zh") return "zh-CN";
  return "en-US";
}
