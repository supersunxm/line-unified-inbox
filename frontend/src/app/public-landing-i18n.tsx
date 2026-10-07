"use client";

import type { ReactNode } from "react";
import { LegacyI18nBoundary, type LegacyI18nPhrase, type LegacyI18nTemplate } from "./legacy-i18n-boundary";

export const publicLandingPhrases: LegacyI18nPhrase[] = [
  { th: "ค้นหาสาขา & ช่องทางติดต่อ", en: "Find stores & contact details", zh: "查找门店和联系方式" },
  { th: "ค้นหาร้าน", en: "Find a store", zh: "查找门店" },
  { th: "สำหรับพนักงาน", en: "Staff", zh: "员工入口" },
  { th: "เข้าสู่ระบบสำหรับพนักงาน", en: "Staff sign in", zh: "员工登录" },
  { th: "ค้นหาข้อมูลสาขาและช่องทางติดต่อ", en: "Find store information and contact details", zh: "查找门店信息和联系方式" },
  { th: "ค้นหา OPPO Brand Shop ใกล้คุณ", en: "Find an OPPO Brand Shop near you", zh: "查找您附近的 OPPO Brand Shop" },
  { th: "ค้นหาสาขา ช่องทางติดต่อ LINE OA, TikTok และข้อมูลร้าน OPPO Brand Shop ทั่วประเทศไทย", en: "Find OPPO Brand Shop locations across Thailand, with LINE OA, TikTok and store details", zh: "查找泰国各地的 OPPO Brand Shop 门店、LINE OA、TikTok 和门店信息" },
  { th: "พิมพ์ชื่อสาขา, ห้างสรรพสินค้า หรือจังหวัด เช่น สยามพารากอน, เชียงใหม่...", en: "Enter a store, shopping mall, or province, such as Siam Paragon or Chiang Mai...", zh: "输入门店、购物中心或府名，例如暹罗百丽宫或清迈……" },
  { th: "ค้นหาชื่อสาขาหรือจังหวัด", en: "Search by store or province", zh: "按门店或府搜索" },
  { th: "ดูสาขาทั้งหมด →", en: "View all stores →", zh: "查看全部门店 →" },
  { th: "ค้นหาตามภูมิภาค:", en: "Browse by region:", zh: "按地区查找：" },
  { th: "ภาคกลาง", en: "Central", zh: "中部" },
  { th: "ภาคเหนือ", en: "Northern", zh: "北部" },
  { th: "ภาคตะวันออกเฉียงเหนือ", en: "Northeastern", zh: "东北部" },
  { th: "ภาคใต้", en: "Southern", zh: "南部" },
  { th: "ภาคตะวันออก", en: "Eastern", zh: "东部" },
  { th: "ภาคตะวันตก", en: "Western", zh: "西部" },
  { th: "กรุงเทพมหานคร", en: "Bangkok", zh: "曼谷" },
  { th: "บริการสำหรับลูกค้า OPPO", en: "OPPO customer services", zh: "OPPO 客户服务" },
  { th: "รวมทุกช่องทางการติดต่อและข้อมูลของ OPPO Brand Shop ไว้ในที่เดียว", en: "All OPPO Brand Shop contact channels and information in one place", zh: "在一个页面汇集 OPPO Brand Shop 的联系方式和信息" },
  { th: "ค้นหาสาขาใกล้คุณ", en: "Find a store near you", zh: "查找附近门店" },
  { th: "ค้นหา OPPO Brand Shop ตามชื่อห้างสรรพสินค้า จังหวัด หรือภูมิภาคได้อย่างรวดเร็ว", en: "Quickly find an OPPO Brand Shop by shopping mall, province, or region", zh: "按购物中心、府或地区快速查找 OPPO Brand Shop" },
  { th: "ติดต่อร้านผ่าน LINE", en: "Contact a store on LINE", zh: "通过 LINE 联系门店" },
  { th: "เชื่อมต่อกับ LINE Official Account ของสาขาโดยตรงเพื่อสอบถามสินค้า โปรโมชั่น และสต็อก", en: "Contact a store’s LINE Official Account directly about products, promotions, and stock", zh: "直接联系门店的 LINE Official Account，咨询商品、促销和库存" },
  { th: "ดู TikTok ของสาขา", en: "View store TikTok", zh: "查看门店 TikTok" },
  { th: "ติดตามคลิปแกะกล่อง โปรโมชั่นประจำสาขา และรีวิวฟังก์ชันมือถือจากผู้เชี่ยวชาญ", en: "Watch unboxing videos, store promotions, and expert reviews of phone features", zh: "观看开箱视频、门店促销信息和手机功能评测" },
  { th: "เปิดเส้นทาง Google Maps", en: "Get directions on Google Maps", zh: "在 Google 地图中导航" },
  { th: "กดดูแผนที่เพื่อนำทางไปยังหน้าร้านจริงได้อย่างสะดวก พร้อมตำแหน่งและชั้นที่ตั้ง", en: "Open the map for directions to the store, including its location and floor", zh: "打开地图前往门店，并查看位置和楼层信息" },
  { th: "สำรวจ OPPO Brand Shop", en: "Explore OPPO Brand Shop", zh: "探索 OPPO Brand Shop" },
  { th: "ดูข้อมูลสาขาและช่องทางติดต่อ", en: "View store details and contact options", zh: "查看门店信息和联系方式" },
  { th: "ดูทั้งหมด →", en: "View all →", zh: "查看全部 →" },
  { th: "ดูข้อมูลร้าน →", en: "View store details →", zh: "查看门店详情 →" },
  { th: "ค้นหา OPPO Brand Shop | Store Directory", en: "Find an OPPO Brand Shop | Store Directory", zh: "查找 OPPO Brand Shop | 门店目录" },
  { th: "ค้นหาร้าน", en: "Find a store", zh: "查找门店" },
  { th: "TikTok Integration", en: "TikTok Integration", zh: "TikTok 集成" },
  { th: "Privacy Policy", en: "Privacy Policy", zh: "隐私政策" },
  { th: "Terms", en: "Terms", zh: "服务条款" },
  { th: "Footer navigation", en: "Footer navigation", zh: "页脚导航" },
  { th: "Customer Navigation", en: "Customer Navigation", zh: "客户导航" },
  { th: "หน้าแรก OPPO Brand Shop", en: "OPPO Brand Shop Home", zh: "OPPO Brand Shop 首页" },
  { th: "ทำเนียบสาขา OPPO Brand Shop", en: "OPPO Brand Shop Store Directory", zh: "OPPO Brand Shop 门店目录" },
  { th: "ทำเนียบสาขา OPPO Brand Shop", en: "OPPO Brand Shop Directory", zh: "OPPO Brand Shop 门店目录" },
  { th: "ค้นหาข้อมูลสาขาและช่องทางติดต่อ OPPO Brand Shop ทั่วประเทศไทย", en: "Find OPPO Brand Shop locations and contact details across Thailand", zh: "查找泰国各地 OPPO Brand Shop 门店和联系方式" },
];

export const publicLandingTemplates: LegacyI18nTemplate[] = [
  { th: "ดูสาขาทั้งหมด {{value}} สาขา →", en: "View all {{value}} stores →", zh: "查看全部 {{value}} 家门店 →" },
  { th: "© {{value}} ทำเนียบสาขา OPPO Brand Shop · lineoppo.click", en: "© {{value}} OPPO Brand Shop Directory · lineoppo.click", zh: "© {{value}} OPPO Brand Shop 门店目录 · lineoppo.click" },
];

export function PublicLandingI18nBoundary({ children }: { children: ReactNode }) {
  return <LegacyI18nBoundary phrases={publicLandingPhrases} templates={publicLandingTemplates} showControl={false}>{children}</LegacyI18nBoundary>;
}
