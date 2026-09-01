"use client";

import Link from "next/link";
import { LanguageControl, useAppLanguage } from "../../../language";

type ErrorReason = "authorization_denied" | "store_not_found" | "duplicate_store_mapping" | "invalid_state" | "oauth_failed";

type ErrorText = { badge: string; title: string; description: string };

const translations = {
  th: {
    retry: "ลองใหม่อีกครั้ง",
    support: "ติดต่อฝ่ายปฏิบัติการค้าปลีกหากต้องการความช่วยเหลือ",
    errors: {
      authorization_denied: { badge: "ยกเลิกการอนุญาต", title: "การอนุญาตถูกยกเลิก", description: "การอนุญาตเชื่อมต่อบัญชี TikTok ถูกยกเลิกหรือปฏิเสธ หากต้องการเชื่อมต่อกรุณาลองใหม่อีกครั้ง" },
      store_not_found: { badge: "ไม่พบร้านค้า", title: "ไม่พบบัญชีร้านค้าในระบบ", description: "ไม่พบข้อมูลร้านค้า OPPO ที่ตรงกับบัญชี TikTok นี้ กรุณาตรวจสอบว่าใช้บัญชี TikTok ที่ลงทะเบียนไว้กับร้าน หรือติดต่อ Retail Operations" },
      duplicate_store_mapping: { badge: "ข้อมูลร้านค้าซ้ำ", title: "พบข้อมูลร้านค้าซ้ำซ้อน", description: "พบข้อมูลร้านค้าหลายรายการที่ตรงกับบัญชี TikTok นี้ กรุณาติดต่อ Retail Operations เพื่อตรวจสอบการเชื่อมโยงร้านค้า" },
      invalid_state: { badge: "เซสชันหมดอายุ", title: "เซสชันหมดอายุหรือไม่ถูกต้อง", description: "เซสชันการเชื่อมต่อหมดอายุหรือไม่ถูกต้องเพื่อความปลอดภัย กรุณาเริ่มกระบวนการเชื่อมต่อใหม่อีกครั้ง" },
      oauth_failed: { badge: "เกิดข้อผิดพลาด", title: "ไม่สามารถเชื่อมต่อ TikTok ได้", description: "เกิดข้อผิดพลาดระหว่างเชื่อมต่อบัญชี TikTok กรุณาลองใหม่อีกครั้ง หรือติดต่อ Retail Operations" },
    } satisfies Record<ErrorReason, ErrorText>,
  },
  en: {
    retry: "Try Again",
    support: "Contact Retail Operations if you need assistance.",
    errors: {
      authorization_denied: { badge: "Authorization Cancelled", title: "Authorization Denied or Cancelled", description: "Authorization was cancelled or denied. Please try again if you wish to connect your store account." },
      store_not_found: { badge: "Store Not Found", title: "Store Account Not Found", description: "We could not match this TikTok account with an OPPO store. Please confirm that you are using the registered TikTok account for your store or contact Retail Operations." },
      duplicate_store_mapping: { badge: "Duplicate Mapping", title: "Duplicate Store Mapping", description: "Multiple store records match this TikTok account. Please contact Retail Operations to resolve the store mapping." },
      invalid_state: { badge: "Session Expired", title: "Invalid or Expired Session", description: "The authorization session expired or was invalid. Please restart the connection process." },
      oauth_failed: { badge: "Connection Error", title: "Unable to Connect TikTok", description: "An error occurred while connecting your TikTok account. Please try again later or contact Retail Operations." },
    } satisfies Record<ErrorReason, ErrorText>,
  },
  zh: {
    retry: "重试",
    support: "如需帮助，请联系 Retail Operations。",
    errors: {
      authorization_denied: { badge: "授权已取消", title: "授权被拒绝或取消", description: "TikTok 账户连接授权已被取消或拒绝。如需连接门店账户，请重新尝试。" },
      store_not_found: { badge: "未找到门店", title: "未找到门店账户", description: "系统无法将此 TikTok 账户匹配到 OPPO 门店。请确认使用的是门店已登记的 TikTok 账户，或联系 Retail Operations。" },
      duplicate_store_mapping: { badge: "门店映射重复", title: "发现重复的门店映射", description: "有多个门店记录与此 TikTok 账户匹配。请联系 Retail Operations 处理门店映射。" },
      invalid_state: { badge: "会话已过期", title: "会话无效或已过期", description: "为确保安全，授权会话已过期或无效。请重新开始连接流程。" },
      oauth_failed: { badge: "连接错误", title: "无法连接 TikTok", description: "连接 TikTok 账户时发生错误。请稍后重试或联系 Retail Operations。" },
    } satisfies Record<ErrorReason, ErrorText>,
  },
};

function normalizeReason(reason?: string): ErrorReason {
  if (reason === "authorization_denied" || reason === "store_not_found" || reason === "duplicate_store_mapping" || reason === "invalid_state") return reason;
  return "oauth_failed";
}

export function TikTokConnectErrorContent({ reason }: { reason?: string }) {
  const { language } = useAppLanguage();
  const t = translations[language];
  const error = t.errors[normalizeReason(reason)];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="absolute right-4 top-4"><LanguageControl /></div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white shadow-xs dark:bg-emerald-500">O</span><span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">OPPO Retail TikTok</span></div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-950/20"><svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
          <div className="mt-6 text-center"><h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{error.title}</h1><p className="mt-1 text-xs font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">{error.badge}</p></div>
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center text-sm leading-relaxed text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-300"><p>{error.description}</p></div>
          <div className="mt-8"><Link href="/tiktok/connect" className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/50 dark:bg-emerald-500 dark:hover:bg-emerald-400"><span>{t.retry}</span><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></Link></div>
          <div className="mt-6 border-t border-slate-100 pt-4 text-center dark:border-slate-800/60"><span className="text-xs font-medium text-slate-400 dark:text-slate-500">{t.support}</span></div>
        </div>
      </div>
    </main>
  );
}
