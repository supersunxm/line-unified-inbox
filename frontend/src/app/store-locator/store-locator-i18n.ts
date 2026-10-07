import type { LegacyI18nPhrase, LegacyI18nTemplate } from "../legacy-i18n-boundary";

export const storeLocatorStepLabels = {
  th: ["ภูมิภาค", "จังหวัด", "สาขา"],
  en: ["Region", "Province", "Stores"],
  zh: ["区域", "府", "门店"],
} as const;

export const storeLocatorPhrases: LegacyI18nPhrase[] = [
  { th: "หน้าแรก OPPO Brand Shop", en: "OPPO Brand Shop Home", zh: "OPPO Brand Shop 首页" },
  { th: "ขั้นตอนค้นหาสาขา", en: "Store search steps", zh: "门店搜索步骤" },
  { th: "กำลังโหลดข้อมูลสาขา", en: "Loading store data", zh: "正在加载门店数据" },
  { th: "ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง", en: "Unable to load store data. Please try again.", zh: "无法加载门店数据，请重试。" },
  { th: "แชทกับสาขานี้ใน LINE", en: "Chat with this store on LINE", zh: "在 LINE 上联系此门店" },
  { th: "ยังไม่มีช่องทาง LINE ของสาขานี้", en: "This store has no LINE contact yet", zh: "此门店暂未提供 LINE 联系方式" },
  { th: "ดูแผนที่สาขา", en: "View store map", zh: "查看门店地图" },
  { th: "ค้นหาสาขาใกล้คุณ", en: "Find a store near you", zh: "查找附近门店" },
  { th: "เปลี่ยนภูมิภาค", en: "Change region", zh: "更改区域" },
  { th: "LINE Official Account ของ OPPO Main", en: "OPPO Main LINE Official Account", zh: "OPPO Main LINE 官方账号" },
  { th: "ค้นหาสาขา OPPO", en: "Find an OPPO store", zh: "查找 OPPO 门店" },
  { th: "เลือกสาขาที่ต้องการ แล้วแชทกับสาขานั้นได้ทันที", en: "Choose a store and chat with it right away", zh: "选择门店后即可立即开始聊天" },
  { th: "ค้นหาสาขา", en: "Search stores", zh: "搜索门店" },
  { th: "ค้นหาจังหวัด ชื่อร้าน หรือชื่อห้าง", en: "Search by province, store, or mall name", zh: "按府名、门店名称或商场名称搜索" },
  { th: "ล้างคำค้นหา", en: "Clear search", zh: "清除搜索" },
  { th: "ค้นหาได้จากจังหวัด ชื่อสาขา หรือชื่อห้าง/ทำเลที่อยู่ในชื่อสาขา", en: "Search by province, store name, or a mall or location included in the store name", zh: "可按府名、门店名称或门店名称中的商场和地点搜索" },
  { th: "ภูมิภาคทั้งหมด", en: "All regions", zh: "全部区域" },
  { th: "ลองใหม่", en: "Try again", zh: "重试" },
  { th: "ยังไม่มีข้อมูลสาขา", en: "No store data yet", zh: "暂无门店数据" },
  { th: "ขณะนี้ยังไม่มีข้อมูลสาขาที่พร้อมให้บริการ กรุณาลองใหม่ภายหลัง", en: "No stores are available right now. Please try again later.", zh: "目前没有可用的门店数据，请稍后重试。" },
  { th: "เลือกภูมิภาค", en: "Choose a region", zh: "选择区域" },
  { th: "เลือกพื้นที่เพื่อดูจังหวัดที่มีสาขา", en: "Choose an area to see provinces with stores", zh: "选择区域以查看有门店的府" },
  { th: "ยังไม่มีสาขา", en: "No stores", zh: "暂无门店" },
  { th: "เลือกจังหวัด", en: "Choose a province", zh: "选择府" },
  { th: "จังหวัดที่มีสาขาใน", en: "Provinces with stores in ", zh: "有门店的府：" },
  { th: "จังหวัดที่มีสาขาใน{{value}}", en: "Provinces with stores in {{value}}", zh: "{{value}}有门店的府" },
  { th: "สาขา", en: "stores", zh: "家门店" },
  { th: "เปลี่ยนจังหวัด", en: "Change province", zh: "更改府" },
  { th: "ผลการค้นหา", en: "Search results", zh: "搜索结果" },
  { th: "เลือกสาขา", en: "Choose a store", zh: "选择门店" },
  { th: "ไม่พบสาขาที่ค้นหา", en: "No matching stores found", zh: "未找到匹配的门店" },
  { th: "ลองค้นหาด้วยชื่อจังหวัด ชื่อร้าน หรือชื่อห้างอื่น", en: "Try another province, store, or mall name", zh: "请尝试其他府名、门店名称或商场名称" },
  { th: "ยังไม่มีจังหวัดที่พร้อมแสดง", en: "No provinces to show yet", zh: "暂无可显示的府" },
  { th: "ขณะนี้ยังไม่มีจังหวัดที่มีข้อมูลพร้อมแสดงในภูมิภาคนี้", en: "There are no provinces with available store data in this region yet", zh: "此区域目前没有可显示门店数据的府" },
];

export const storeLocatorTemplates: LegacyI18nTemplate[] = [
  { th: "{{value}} สาขา", en: "{{value}} stores", zh: "{{value}} 家门店" },
  { th: "แชทกับ {{value}} ใน LINE", en: "Chat with {{value}} on LINE", zh: "在 LINE 上联系 {{value}}" },
];
