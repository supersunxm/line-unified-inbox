import type { AppLanguage } from "../../language";

export type TikTokDashboardText = {
  opening: string;
  monitorTag: string;
  performanceDashboard: string;
  performanceDescription: string;
  storesOverview: string;
  connectTikTok: string;
  noDataTitle: string;
  noDataDescription: string;
  storePerformanceDashboard: string;
  store: string;
  storeFallback: string;
  storeNotLinked: string;
  connected: string;
  verifiedAccount: string;
  viewOnTikTok: string;
  followers: string;
  following: string;
  accounts: string;
  totalLikes: string;
  totalVideos: string;
  totalVideoViews: string;
  avgViewsPerVideo: string;
  likes: string;
  videos: string;
  views: string;
  comments: string;
  shares: string;
  today: string;
  sevenDays: string;
  thirtyDays: string;
  topVideoByViews: string;
  topVideoByLikes: string;
  noVideosRecorded: string;
  totalEngagement: string;
  engagementBreakdown: string;
  avgEngagementPerPost: string;
  perPublishedVideo: string;
  performanceHighlights: string;
  recentVideos: string;
  noVideosFound: string;
  noVideosDescription: string;
  video: string;
  published: string;
  duration: string;
  action: string;
  untitledVideo: string;
  videoThumbnail: string;
  watch: string;
  overview: string;
  growth: string;
  allStores: string;
  growthHistoryMissing: string;
  growthHistoryMissingDescription: string;
  openVideo: string;
  followerGrowthHistory: string;
  demoMode: string;
  dailySnapshotsDescription: string;
  collectingSnapshots: string;
  firstSnapshotDescription: string;
  twoSnapshotsDescription: string;
  versusPreviousDay: string;
  videosSynced: (count: number) => string;
  videosSyncedFromApi: (count: number) => string;
  likesCount: (count: string) => string;
  viewsCount: (count: string) => string;
  perVideo: (count: string) => string;
};

const texts: Record<AppLanguage, TikTokDashboardText> = {
  th: {
    opening: "กำลังเปิด TikTok Dashboard...",
    monitorTag: "OPPO Retail TikTok Monitor",
    performanceDashboard: "แดชบอร์ดประสิทธิภาพ TikTok",
    performanceDescription: "วิเคราะห์ประสิทธิภาพบัญชี TikTok ร้านค้า การเติบโตของผู้ติดตาม และการมีส่วนร่วมกับวิดีโอ",
    storesOverview: "ภาพรวมร้านค้า",
    connectTikTok: "เชื่อมต่อ TikTok",
    noDataTitle: "ยังไม่มีข้อมูล TikTok",
    noDataDescription: "เชื่อมต่อบัญชี TikTok ร้านค้าที่ได้รับอนุญาตเพื่อเริ่มดูประสิทธิภาพวิดีโอ",
    storePerformanceDashboard: "แดชบอร์ดประสิทธิภาพร้านค้า",
    store: "ร้านค้า",
    storeFallback: "ร้านค้า",
    storeNotLinked: "ยังไม่ได้ผูกร้านค้า",
    connected: "เชื่อมต่อแล้ว",
    verifiedAccount: "บัญชีที่ยืนยันแล้ว",
    viewOnTikTok: "ดูบน TikTok",
    followers: "ผู้ติดตาม",
    following: "กำลังติดตาม",
    accounts: "บัญชี",
    totalLikes: "ไลก์รวม",
    totalVideos: "วิดีโอทั้งหมด",
    totalVideoViews: "ยอดดูวิดีโอรวม",
    avgViewsPerVideo: "ยอดดูเฉลี่ย / วิดีโอ",
    likes: "ไลก์",
    videos: "วิดีโอ",
    views: "ยอดดู",
    comments: "ความคิดเห็น",
    shares: "แชร์",
    today: "วันนี้",
    sevenDays: "7 วัน",
    thirtyDays: "30 วัน",
    topVideoByViews: "วิดีโอยอดดูสูงสุด",
    topVideoByLikes: "วิดีโอไลก์สูงสุด",
    noVideosRecorded: "ยังไม่มีวิดีโอที่บันทึก",
    totalEngagement: "การมีส่วนร่วมรวม",
    engagementBreakdown: "ไลก์ + ความคิดเห็น + แชร์",
    avgEngagementPerPost: "การมีส่วนร่วมเฉลี่ย / โพสต์",
    perPublishedVideo: "ต่อวิดีโอที่เผยแพร่",
    performanceHighlights: "ไฮไลต์ประสิทธิภาพ",
    recentVideos: "วิดีโอล่าสุด",
    noVideosFound: "ไม่พบวิดีโอ",
    noVideosDescription: "บัญชีนี้ยังไม่มีวิดีโอที่ซิงก์เข้าระบบ",
    video: "วิดีโอ",
    published: "เผยแพร่",
    duration: "ความยาว",
    action: "ดำเนินการ",
    untitledVideo: "วิดีโอไม่มีชื่อ",
    videoThumbnail: "ภาพตัวอย่างวิดีโอ",
    watch: "ดูวิดีโอ",
    overview: "ภาพรวม",
    growth: "การเติบโต",
    allStores: "ร้านทั้งหมด",
    growthHistoryMissing: "ยังไม่มีประวัติการเติบโต",
    growthHistoryMissingDescription: "ต้องมีข้อมูลรายวันอย่างน้อย 2 snapshot เพื่อแสดงแนวโน้ม",
    openVideo: "เปิดวิดีโอ",
    followerGrowthHistory: "ประวัติการเติบโตของผู้ติดตาม (30 วัน)",
    demoMode: "โหมดตัวอย่าง",
    dailySnapshotsDescription: "Snapshot รายวันที่บันทึกตามขอบเขตวันของ Asia/Bangkok",
    collectingSnapshots: "กำลังเก็บ Snapshot รายวัน",
    firstSnapshotDescription: "บันทึก Snapshot แรกแล้ว กราฟแนวโน้มและการเปรียบเทียบจะพร้อมหลังการเก็บข้อมูลอัตโนมัติในวันถัดไป",
    twoSnapshotsDescription: "ต้องมี Snapshot รายวันอย่างน้อย 2 รายการเพื่อแสดงเส้นแนวโน้มการเติบโต",
    versusPreviousDay: "เทียบวันก่อนหน้า",
    videosSynced: (count) => `ซิงก์แล้ว ${count} วิดีโอ`,
    videosSyncedFromApi: (count) => `${count} วิดีโอซิงก์จาก TikTok API อย่างเป็นทางการ`,
    likesCount: (count) => `${count} ไลก์`,
    viewsCount: (count) => `${count} ยอดดู`,
    perVideo: (count) => `${count} / วิดีโอ`,
  },
  en: {
    opening: "Opening TikTok Dashboard...",
    monitorTag: "OPPO Retail TikTok Monitor",
    performanceDashboard: "TikTok Performance Dashboard",
    performanceDescription: "Real-time retail TikTok store performance analytics, audience growth metrics, and video engagement insights.",
    storesOverview: "Stores Overview",
    connectTikTok: "Connect TikTok",
    noDataTitle: "No TikTok Data Available",
    noDataDescription: "Connect an authorized TikTok retail store account to inspect video performance.",
    storePerformanceDashboard: "Store Performance Dashboard",
    store: "Store",
    storeFallback: "Store",
    storeNotLinked: "Store not linked yet",
    connected: "Connected",
    verifiedAccount: "Verified Account",
    viewOnTikTok: "View on TikTok",
    followers: "Followers",
    following: "Following",
    accounts: "Accounts",
    totalLikes: "Total Likes",
    totalVideos: "Total Videos",
    totalVideoViews: "Total Video Views",
    avgViewsPerVideo: "Avg Views / Video",
    likes: "Likes",
    videos: "Videos",
    views: "Views",
    comments: "Comments",
    shares: "Shares",
    today: "Today",
    sevenDays: "7 Days",
    thirtyDays: "30 Days",
    topVideoByViews: "Top Video by Views",
    topVideoByLikes: "Top Video by Likes",
    noVideosRecorded: "No videos recorded",
    totalEngagement: "Total Engagement",
    engagementBreakdown: "Likes + comments + shares",
    avgEngagementPerPost: "Avg Engagement / Post",
    perPublishedVideo: "Per published video",
    performanceHighlights: "Performance Highlights",
    recentVideos: "Recent Videos",
    noVideosFound: "No videos found",
    noVideosDescription: "No videos synced for this account yet.",
    video: "Video",
    published: "Published",
    duration: "Duration",
    action: "Action",
    untitledVideo: "Untitled Video",
    videoThumbnail: "Video thumbnail",
    watch: "Watch",
    overview: "Overview",
    growth: "Growth",
    allStores: "All stores",
    growthHistoryMissing: "No Growth History Yet",
    growthHistoryMissingDescription: "At least 2 daily snapshots are required to display the trend.",
    openVideo: "Open video",
    followerGrowthHistory: "Follower Growth History (30 Days)",
    demoMode: "DEMO MODE",
    dailySnapshotsDescription: "Daily snapshots recorded at Asia/Bangkok calendar boundaries",
    collectingSnapshots: "Collecting Daily Snapshots",
    firstSnapshotDescription: "First daily snapshot recorded. Growth trend and comparison chart will become available after tomorrow's automatic daily collection.",
    twoSnapshotsDescription: "At least 2 daily snapshots are required to display the growth trend line.",
    versusPreviousDay: "vs prev day",
    videosSynced: (count) => `${count} videos synced`,
    videosSyncedFromApi: (count) => `${count} videos synced from official TikTok API`,
    likesCount: (count) => `${count} likes`,
    viewsCount: (count) => `${count} views`,
    perVideo: (count) => `${count} / video`,
  },
  zh: {
    opening: "正在打开 TikTok 仪表板...",
    monitorTag: "OPPO Retail TikTok Monitor",
    performanceDashboard: "TikTok 表现仪表板",
    performanceDescription: "分析零售门店 TikTok 账户表现、受众增长指标及视频互动数据。",
    storesOverview: "门店概览",
    connectTikTok: "连接 TikTok",
    noDataTitle: "暂无 TikTok 数据",
    noDataDescription: "连接经授权的 TikTok 零售门店账户以查看视频表现。",
    storePerformanceDashboard: "门店表现仪表板",
    store: "门店",
    storeFallback: "门店",
    storeNotLinked: "尚未绑定门店",
    connected: "已连接",
    verifiedAccount: "已认证账户",
    viewOnTikTok: "在 TikTok 查看",
    followers: "关注者",
    following: "正在关注",
    accounts: "账户",
    totalLikes: "总点赞数",
    totalVideos: "视频总数",
    totalVideoViews: "视频总播放量",
    avgViewsPerVideo: "平均播放量 / 视频",
    likes: "点赞",
    videos: "视频",
    views: "播放量",
    comments: "评论",
    shares: "分享",
    today: "今天",
    sevenDays: "7 天",
    thirtyDays: "30 天",
    topVideoByViews: "播放量最高的视频",
    topVideoByLikes: "点赞最高的视频",
    noVideosRecorded: "暂无已记录视频",
    totalEngagement: "总互动量",
    engagementBreakdown: "点赞 + 评论 + 分享",
    avgEngagementPerPost: "平均互动 / 帖子",
    perPublishedVideo: "每个已发布视频",
    performanceHighlights: "表现亮点",
    recentVideos: "最新视频",
    noVideosFound: "未找到视频",
    noVideosDescription: "此账户尚未同步视频。",
    video: "视频",
    published: "发布时间",
    duration: "时长",
    action: "操作",
    untitledVideo: "无标题视频",
    videoThumbnail: "视频缩略图",
    watch: "观看",
    overview: "概览",
    growth: "增长",
    allStores: "全部门店",
    growthHistoryMissing: "暂无增长历史",
    growthHistoryMissingDescription: "至少需要 2 个每日 Snapshot 才能显示趋势。",
    openVideo: "打开视频",
    followerGrowthHistory: "关注者增长历史（30 天）",
    demoMode: "演示模式",
    dailySnapshotsDescription: "按 Asia/Bangkok 日历边界记录的每日 Snapshot",
    collectingSnapshots: "正在收集每日 Snapshot",
    firstSnapshotDescription: "已记录第一个每日 Snapshot。明天自动采集后即可查看增长趋势和对比图。",
    twoSnapshotsDescription: "至少需要 2 个每日 Snapshot 才能显示增长趋势线。",
    versusPreviousDay: "较前一天",
    videosSynced: (count) => `已同步 ${count} 个视频`,
    videosSyncedFromApi: (count) => `${count} 个视频已从官方 TikTok API 同步`,
    likesCount: (count) => `${count} 个点赞`,
    viewsCount: (count) => `${count} 次播放`,
    perVideo: (count) => `${count} / 视频`,
  },
};

export function getTikTokDashboardText(language: AppLanguage): TikTokDashboardText {
  return texts[language];
}
