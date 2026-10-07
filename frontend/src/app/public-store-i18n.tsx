"use client";

import type { ReactNode } from "react";
import { LegacyI18nBoundary, type LegacyI18nPhrase, type LegacyI18nTemplate } from "./legacy-i18n-boundary";

export const publicStorePhrases: LegacyI18nPhrase[] = [
  { th: "ค้นหาสาขา & ช่องทางติดต่อ", en: "Find stores & contact details", zh: "查找门店和联系方式" },
  { th: "หน้าแรก OPPO Brand Shop", en: "OPPO Brand Shop Home", zh: "OPPO Brand Shop 首页" },
  { th: "เมนูหลัก", en: "Main Navigation", zh: "主导航" },
  { th: "หน้าแรก", en: "Home", zh: "首页" },
  { th: "ค้นหา OPPO Brand Shop | ทำเนียบสาขา", en: "Find an OPPO Brand Shop | Store Directory", zh: "查找 OPPO Brand Shop | 门店目录" },
  { th: "ค้นหาสาขาใกล้บ้านคุณ", en: "Find a store near you", zh: "查找附近门店" },
  { th: "ค้นหา OPPO Brand Shop", en: "Find an OPPO Brand Shop", zh: "查找 OPPO Brand Shop" },
  { th: "ค้นหาร้านและช่องทางติดต่อของสาขาใกล้คุณ ติดต่อผ่าน LINE OA หรือดู TikTok ทางการ", en: "Find nearby stores and contact them through LINE OA or their official TikTok account", zh: "查找附近门店，并通过 LINE OA 联系门店或查看官方 TikTok" },
  { th: "ค้นหาชื่อร้าน, ห้างสรรพสินค้า, สาขา หรือจังหวัด...", en: "Search by store, shopping mall, branch, or province...", zh: "搜索门店、购物中心、分店或府名……" },
  { th: "ค้นหาชื่อร้านหรือจังหวัด", en: "Search by store or province", zh: "按门店或府搜索" },
  { th: "ล้างการค้นหา", en: "Clear search", zh: "清除搜索" },
  { th: "ทุกภูมิภาค", en: "All regions", zh: "全部地区" },
  { th: "เลือกจังหวัด", en: "Select province", zh: "选择府" },
  { th: "เลือกจังหวัด (ทั้งหมด)", en: "Province (all)", zh: "府（全部）" },
  { th: "รายชื่อสาขา OPPO Brand Shop", en: "OPPO Brand Shop locations", zh: "OPPO Brand Shop 门店列表" },
  { th: "กำลังโหลดข้อมูล...", en: "Loading store data...", zh: "正在加载门店信息……" },
  { th: "เกิดข้อผิดพลาดในการโหลดข้อมูลร้านค้า", en: "Unable to load store information", zh: "无法加载门店信息" },
  { th: "ลองใหม่อีกครั้ง", en: "Try again", zh: "重试" },
  { th: "ไม่พบสาขาที่ตรงกับเงื่อนไขการค้นหา", en: "No stores match your search", zh: "没有符合搜索条件的门店" },
  { th: "ลองตรวจสอบตัวสะกด หรือปรับเปลี่ยนเงื่อนไขภูมิภาค/จังหวัด", en: "Check the spelling or change the region or province filters", zh: "请检查拼写，或调整地区和府筛选条件" },
  { th: "ล้างเงื่อนไขการค้นหา", en: "Clear search filters", zh: "清除搜索条件" },
  { th: "ดูรายละเอียดร้าน →", en: "View store details →", zh: "查看门店详情 →" },
  { th: "ทำเนียบสาขา OPPO Brand Shop", en: "OPPO Brand Shop Directory", zh: "OPPO Brand Shop 门店目录" },
  { th: "การเชื่อมต่อ TikTok", en: "TikTok integration", zh: "TikTok 集成" },
  { th: "นโยบายความเป็นส่วนตัว", en: "Privacy policy", zh: "隐私政策" },
  { th: "ข้อกำหนดการใช้งาน", en: "Terms of use", zh: "使用条款" },
  { th: "สำหรับพนักงาน", en: "Staff", zh: "员工入口" },
  { th: "เข้าสู่ระบบสำหรับพนักงาน", en: "Staff sign in", zh: "员工登录" },
  { th: "← สาขาทั้งหมด", en: "← All stores", zh: "← 全部门店" },
  { th: "ไม่พบข้อมูลร้านค้าที่ระบุ", en: "Store not found", zh: "未找到该门店" },
  { th: "สาขาที่คุณกำลังค้นหาอาจมีการปรับปรุงข้อมูล หรือไม่เปิดให้บริการในระบบขณะนี้", en: "This store may have updated its information or may not be available in the directory right now.", zh: "该门店可能已更新信息，或暂时未在目录中提供。" },
  { th: "← กลับไปยังหน้ารวมร้านค้า", en: "← Back to all stores", zh: "← 返回门店列表" },
  { th: "ที่อยู่ / ทำเล:", en: "Address / location:", zh: "地址 / 位置：" },
  { th: "สอบถามข้อมูล ซื้อสินค้า ปรึกษาพนักงาน", en: "Ask questions, shop, or talk with store staff", zh: "咨询信息、购买商品或联系店员" },
  { th: "คัดลอกแล้ว ✓", en: "Copied ✓", zh: "已复制 ✓" },
  { th: "คัดลอก", en: "Copy", zh: "复制" },
  { th: "ติดต่อร้านผ่าน LINE", en: "Contact this store on LINE", zh: "通过 LINE 联系门店" },
  { th: "ยังไม่มีช่องทาง LINE ในขณะนี้", en: "LINE contact is not available right now", zh: "目前没有 LINE 联系方式" },
  { th: "ชมคลิปโปรโมชั่น รีวิวมือถือรุ่นใหม่", en: "Watch promotions and reviews of new phones", zh: "观看促销视频和新款手机评测" },
  { th: "บัญชีทางการ", en: "Official account", zh: "官方账号" },
  { th: "เปิด TikTok Profile", en: "Open TikTok profile", zh: "打开 TikTok 主页" },
  { th: "ยังไม่มีช่องทาง TikTok ในขณะนี้", en: "TikTok is not available right now", zh: "目前没有 TikTok 账号" },
  { th: "แผนที่ Google Maps", en: "Google Maps", zh: "Google 地图" },
  { th: "เปิดแผนที่เพื่อดูเส้นทางและนำทางไปยังสาขา", en: "Open the map to view directions to this store", zh: "打开地图查看前往门店的路线" },
  { th: "เปิดใน Google Maps ↗", en: "Open in Google Maps ↗", zh: "在 Google 地图中打开 ↗" },
  { th: "เปิดแผนที่ Google Maps", en: "Open Google Maps", zh: "打开 Google 地图" },
  { th: "หน้ารวมร้านค้า", en: "All stores", zh: "门店列表" },
];

export const publicStoreTemplates: LegacyI18nTemplate[] = [
  { th: "พบ {{value}} สาขา", en: "{{value}} stores found", zh: "找到 {{value}} 家门店" },
  { th: "© {{value}} ทำเนียบสาขา OPPO Brand Shop · ประเทศไทย", en: "© {{value}} OPPO Brand Shop Directory · Thailand", zh: "© {{value}} OPPO Brand Shop 门店目录 · 泰国" },
  { th: "แอด LINE {{value}}", en: "Add {{value}} on LINE", zh: "在 LINE 添加 {{value}}" },
  { th: "เปิด TikTok {{value}}", en: "Open TikTok for {{value}}", zh: "打开 {{value}} 的 TikTok" },
  { th: "เปิดแผนที่ Google Maps {{value}}", en: "Open Google Maps for {{value}}", zh: "打开 {{value}} 的 Google 地图" },
];

export function PublicStoreI18nBoundary({ children }: { children: ReactNode }) {
  return <LegacyI18nBoundary phrases={publicStorePhrases} templates={publicStoreTemplates} showControl={false}>{children}</LegacyI18nBoundary>;
}
