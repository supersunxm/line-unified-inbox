"use client";

import { LanguageControl, pickLanguageText, useAppLanguage } from "../../../language";

const translations = {
  th: {
    title: "เชื่อมต่อ TikTok สำเร็จ",
    status: "เชื่อมต่อบัญชี TikTok แล้ว",
    displayName: "ชื่อบัญชี TikTok",
    linkedStore: "สาขาร้านค้าที่เชื่อมโยง",
    description: "บัญชี TikTok ของร้านได้รับการเชื่อมต่อกับระบบ OPPO Retail Operations เรียบร้อยแล้ว",
    close: "คุณสามารถปิดหน้านี้ได้",
  },
  en: {
    title: "TikTok Connected Successfully",
    status: "TikTok Account Connected",
    displayName: "TikTok Display Name",
    linkedStore: "Linked Store",
    description: "Your TikTok account has been successfully connected to OPPO Retail Operations.",
    close: "You may now close this page.",
  },
  zh: {
    title: "TikTok 连接成功",
    status: "TikTok 账户已连接",
    displayName: "TikTok 显示名称",
    linkedStore: "已关联门店",
    description: "您的门店 TikTok 账户已成功连接到 OPPO Retail Operations。",
    close: "您现在可以关闭此页面。",
  },
};

export function TikTokConnectSuccessContent({ displayName, username, storeName }: { displayName: string; username: string; storeName: string }) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, translations);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="absolute right-4 top-4"><LanguageControl /></div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white shadow-xs dark:bg-emerald-500">O</span><span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">OPPO Retail TikTok</span></div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-950/20">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="mt-6 text-center"><h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{t.title}</h1><p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{t.status}</p></div>
          {(displayName || username || storeName) && <div className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/50">
            {(displayName || username) && <div><span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">{t.displayName}</span><div className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{displayName && <span>{displayName}</span>}{username && <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">@{username}</span>}</div></div>}
            {storeName && <div className="border-t border-slate-200/60 pt-2.5 dark:border-slate-800/60"><span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">{t.linkedStore}</span><span className="mt-0.5 block text-sm font-semibold text-slate-900 dark:text-slate-100">{storeName}</span></div>}
          </div>}
          <div className="mt-6 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300"><p>{t.description}</p></div>
          <div className="mt-8 border-t border-slate-100 pt-4 text-center dark:border-slate-800/60"><span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"><svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{t.close}</span></div>
        </div>
      </div>
    </main>
  );
}
