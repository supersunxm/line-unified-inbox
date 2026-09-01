"use client";

import Link from "next/link";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../language";
import type { AndroidRelease } from "./releases";

function localeFor(language: "th" | "en" | "zh") {
  return language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-US";
}

function translatedNotes(release: AndroidRelease, language: "th" | "en" | "zh") {
  if (language === "th") return release.notes;
  const known: Record<string, { en: string[]; zh: string[] }> = {
    "1.1.15": {
      en: ["Improved Android product model and capacity display by automatically fixing abnormal spacing, such as OPPO A 6 → OPPO A6 and 1 2 8 → 128GB, without changing source data."],
      zh: ["改进 Android 商品型号和容量显示，可自动修正异常空格，例如 OPPO A 6 → OPPO A6、1 2 8 → 128GB，且不会修改源数据。"],
    },
    "1.1.14": {
      en: ["Fixed product model names in the Android chat list when numbers or 5G were incorrectly spaced."],
      zh: ["修复 Android 聊天列表中数字或 5G 被错误分隔时的商品型号显示。"],
    },
    "1.1.13": {
      en: ["Fixed product model display in the app when numbers or 5G contained incorrect spacing."],
      zh: ["修复应用中数字或 5G 含异常空格时的商品型号显示。"],
    },
    "1.1.12": {
      en: ["Added full-screen video playback from chat messages.", "Added saving videos to the device from the video viewer.", "Improved normalization of incorrectly spaced product model names."],
      zh: ["支持从聊天消息全屏播放视频。", "支持从视频查看器将视频保存到设备。", "改进商品型号异常空格的自动修正。"],
    },
    "1.1.11": {
      en: ["Added sending videos from the app to customers through LINE OA.", "Supports choosing MP4 videos from the gallery or camera with preview before sending.", "Improved video uploads while preserving reply status, ownership, and realtime behavior."],
      zh: ["支持通过 LINE OA 从应用向客户发送视频。", "支持从相册选择或拍摄 MP4 视频，并在发送前预览。", "改进视频上传，同时保留回复状态、负责人和实时同步逻辑。"],
    },
    "1.1.10": {
      en: ["Grouped product selection by Smartphone, Tablet, Watch, Audio, and IoT.", "Added Find, Reno, and A Series filters with instant search for smartphones.", "Improved full-row product selection while preserving specifications, quantity, and save behavior."],
      zh: ["商品选择按 Smartphone、Tablet、Watch、Audio 和 IoT 分类。", "为手机新增 Find、Reno 和 A Series 筛选及即时搜索。", "改进整行商品选择，同时保留规格、数量和保存逻辑。"],
    },
    "1.1.9": {
      en: ["Made the Inbox more compact.", "Simplified status filters to All, Waiting, and Replied, with BM notified included in Waiting.", "Started counting owners only for conversations with customer messages from 30 Aug 2026 onward."],
      zh: ["优化 Inbox 密度，可在一屏显示更多聊天。", "状态筛选简化为全部、待回复、已回复，并将已通知 BM 归入待回复。", "从 2026 年 8 月 30 日起，仅统计有客户消息的会话负责人。"],
    },
    "1.1.8": {
      en: ["Reduced duplicate store labels for single-store users while keeping store context for multi-store, HQ, and Admin users."],
      zh: ["减少单门店用户界面中的重复门店信息，同时为多门店、HQ 和 Admin 用户保留门店上下文。"],
    },
    "1.1.7": {
      en: ["Added conversation ownership, staff handling summaries, reply share, and clearer separation between bot and staff replies."],
      zh: ["新增会话负责人、员工处理汇总、回复占比，并更清楚地区分机器人与员工回复。"],
    },
    "1.1.6": {
      en: ["Improved LINE sticker display, sticker text/keywords, and chat-list previews."],
      zh: ["改进 LINE 贴图显示、贴图文字/关键词以及聊天列表预览。"],
    },
    "1.1.5": {
      en: ["Improved opening bare domains and subdomains from chat messages using the device browser or default app."],
      zh: ["改进聊天消息中无 http/https 的域名和子域名打开方式，使用设备浏览器或默认应用。"],
    },
    "1.1.4": {
      en: ["Added tagged sales/product data and customer profile images to chat views, improved long product names and sales controls, and added link opening and image saving."],
      zh: ["聊天界面新增销售/商品标签与客户头像，改进长商品名和销售操作，并支持打开链接及保存图片。"],
    },
    "1.0.16": {
      en: ["Removed Normal/Urgent badges from mobile conversation cards for readability while preserving internal priority and reply status."],
      zh: ["移除移动端会话卡片上的 Normal/Urgent 标签以提升可读性，同时保留系统内部优先级和回复状态。"],
    },
    "1.0.15": {
      en: ["Expanded HQ multi-store inbox access and context, added HQ conversation actions, unread counts and status filters, plus pull-to-refresh and reconciliation."],
      zh: ["扩展 HQ 多门店 Inbox 与门店上下文，新增 HQ 会话操作、未读数量和状态筛选，并加入下拉刷新与数据校准。"],
    },
    "1.0.14": {
      en: ["Enabled HQ users without store membership to sign in and aligned app-shell permissions for HQ, Store, and Main OA workspaces."],
      zh: ["支持没有门店成员关系的 HQ 用户登录，并统一 HQ、Store 和 Main OA 工作区的权限逻辑。"],
    },
    "1.0.13": {
      en: ["Resolved Android package conflicts, moved to the dedicated click.lineoppo.chat package, and adopted a persistent production signing key."],
      zh: ["解决 Android 安装包冲突，改用专用 click.lineoppo.chat 包名，并采用长期 production 签名。"],
    },
    "1.0.12": {
      en: ["Improved app screens and sales-data consistency."],
      zh: ["改进应用界面和销售数据一致性。"],
    },
    "1.0.11": {
      en: ["Improved sales-status consistency and Android release metadata."],
      zh: ["改进销售状态一致性和 Android 发布元数据。"],
    },
  };
  return known[release.version]?.[language] ?? [language === "zh" ? "此版本包含应用体验、稳定性或业务流程方面的改进与修复。" : "This release includes app experience, stability, or workflow improvements and fixes."];
}

export function DownloadContent({ release }: { release: AndroidRelease }) {
  const { language } = useAppLanguage();
  const locale = localeFor(language);
  const apkDownloadUrl = `/downloads/${release.fileName}?sha=${release.sha256}`;
  const released = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${release.releasedAt}T00:00:00Z`));
  const text = pickLanguageText(language, {
    th: { audience: "สำหรับ HQ / BM / PC", latest: "ล่าสุด", version: "เวอร์ชัน", build: "Build", updated: "อัปเดตล่าสุด", whatsNew: "มีอะไรใหม่ในเวอร์ชัน", download: "ดาวน์โหลด APK เวอร์ชันล่าสุด", history: "ดูประวัติเวอร์ชัน", install: "ขั้นตอนการติดตั้งบนมือถือ / แท็บเล็ต", step1: "หากเคยติดตั้งแอปเวอร์ชัน 1.0.12 หรือต่ำกว่า ให้ถอนการติดตั้งเวอร์ชันเดิมก่อน เนื่องจากเวอร์ชัน 1.0.13 เปลี่ยนเป็น Android package ใหม่", step2a: "กดปุ่ม", step2b: "และรอจนดาวน์โหลดเสร็จ", step3a: "เปิดไฟล์ที่ดาวน์โหลดมา หากขึ้นเตือนความปลอดภัย ให้เปิดอนุญาต", unknown: "ติดตั้งแอปจากแหล่งที่ไม่รู้จัก", step4a: "กด", installWord: "ติดตั้ง", step4b: "แล้วเปิดแอปเพื่อเข้าสู่ระบบหรือสมัครบัญชี", help: "พบปัญหาการติดตั้ง? ติดต่อผู้ดูแลระบบฝ่ายปฏิบัติการ OPPO" },
    en: { audience: "For HQ / BM / PC", latest: "Latest", version: "Version", build: "Build", updated: "Last updated", whatsNew: "What's new in version", download: "Download latest APK", history: "View version history", install: "Install on phone / tablet", step1: "If version 1.0.12 or earlier is installed, uninstall it first because version 1.0.13 moved to a new Android package.", step2a: "Tap", step2b: "and wait for the download to finish.", step3a: "Open the downloaded file. If Android shows a security warning, allow", unknown: "Install unknown apps", step4a: "Tap", installWord: "Install", step4b: "then open the app to sign in or register.", help: "Installation issue? Contact the OPPO Operations system administrator." },
    zh: { audience: "适用于 HQ / BM / PC", latest: "最新", version: "版本", build: "Build", updated: "最近更新", whatsNew: "此版本更新内容", download: "下载最新版 APK", history: "查看版本历史", install: "手机 / 平板安装步骤", step1: "如果已安装 1.0.12 或更早版本，请先卸载旧版本，因为 1.0.13 起改用了新的 Android 包名。", step2a: "点击", step2b: "并等待下载完成。", step3a: "打开下载的文件。如果 Android 显示安全提示，请允许", unknown: "安装未知应用", step4a: "点击", installWord: "安装", step4b: "然后打开应用登录或注册。", help: "安装遇到问题？请联系 OPPO Operations 系统管理员。" },
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-sm text-white shadow-xs dark:bg-emerald-500">O</span><span className="font-semibold text-base tracking-tight">OPPO LINE OA Chat</span></div><LanguageControl /></div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-black p-2 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800"><img src="/images/LOGO_OBS.png" alt="OPPO Brand Shop" className="h-full w-full object-contain" /></div>
          <div className="mt-5 text-center"><h1 className="font-bold text-xl tracking-tight sm:text-2xl dark:text-white">OPPO LINE OA Chat</h1><p className="mt-1 font-medium text-slate-500 text-xs dark:text-slate-400">{text.audience}</p><div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 text-xs dark:bg-emerald-950/60 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{text.latest} · {text.version} {release.version} · {text.build} {release.build} · {release.size}</div><p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{text.updated}: {released}</p></div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-xs dark:border-slate-800/80 dark:bg-slate-900/40"><h3 className="font-semibold text-slate-800 dark:text-slate-200">{text.whatsNew} {release.version}</h3><ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">{translatedNotes(release, language).map((note) => <li key={note} className="flex items-start gap-1.5"><span className="font-bold text-emerald-500">•</span><span>{note}</span></li>)}</ul></div>
          <div className="mt-6 space-y-2.5"><a href={apkDownloadUrl} download={release.fileName} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-sm text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400"><span>↓</span><span>{text.download}</span></a><Link href="/download/history" className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">{text.history}</Link></div>
          <div className="mt-4 rounded-lg bg-slate-50 p-2.5 text-center text-[10px] text-slate-400 dark:bg-slate-900/60 dark:text-slate-500"><span className="font-semibold uppercase tracking-wider">SHA-256 Checksum:</span><div className="mt-0.5 truncate font-mono">{release.sha256}</div></div>
          <div className="mt-6 border-slate-100 border-t pt-5 dark:border-slate-800/60"><h2 className="font-semibold text-xs uppercase tracking-wider dark:text-slate-200">{text.install}</h2><ol className="mt-3 space-y-3 text-slate-600 text-xs leading-relaxed dark:text-slate-300"><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px]">1</span><span>{text.step1}</span></li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px]">2</span><span>{text.step2a} <strong>{text.download}</strong> {text.step2b}</span></li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px]">3</span><span>{text.step3a} <strong>{text.unknown}</strong></span></li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px]">4</span><span>{text.step4a} <strong>{text.installWord}</strong> {text.step4b}</span></li></ol></div>
        </div>
        <div className="text-center text-slate-400 text-xs dark:text-slate-500">{text.help}</div>
      </div>
    </main>
  );
}

export { translatedNotes, localeFor };
