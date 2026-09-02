"use client";

import Link from "next/link";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../language";

export default function WelcomePage() {
  const { language } = useAppLanguage();
  const text = pickLanguageText(language, {
    th: {
      badge: "OPPO Retail Operations", title: "จัดการ LINE OA ทุกสาขาในที่เดียว", description: "ติดตามบทสนทนา ลูกค้า ผู้ติดตาม แคมเปญ และประสิทธิภาพของแต่ละสาขาจากระบบกลางของ OPPO", signIn: "เข้าสู่ระบบ", download: "ดาวน์โหลด Android App", chat: "LINE OA Chat Hub", chatDesc: "รวมบทสนทนาจากสาขาที่ได้รับสิทธิ์ พร้อมสถานะการตอบและเครื่องมือสำหรับ BM / HQ", insight: "Social Listening & Insights", insightDesc: "ติดตามผู้ติดตาม Message Traffic และข้อมูลสำคัญของแต่ละบัญชีในมุมมองเดียว", tiktok: "TikTok Monitor", tiktokDesc: "ติดตามบัญชี TikTok ของร้าน วิเคราะห์ performance และดูแนวโน้มจากข้อมูลจริง", privacy: "นโยบายความเป็นส่วนตัว", terms: "ข้อกำหนดการใช้งาน", internal: "ระบบภายในสำหรับ OPPO Retail Operations" },
    en: {
      badge: "OPPO Retail Operations", title: "Manage every LINE OA in one place", description: "Monitor conversations, customers, followers, campaigns, and store performance from OPPO's central operations workspace.", signIn: "Sign in", download: "Download Android App", chat: "LINE OA Chat Hub", chatDesc: "Bring authorized store conversations together with reply status and tools for BM / HQ teams.", insight: "Social Listening & Insights", insightDesc: "Track followers, Message Traffic, and key account signals in one consolidated view.", tiktok: "TikTok Monitor", tiktokDesc: "Monitor store TikTok accounts, analyze performance, and follow trends from real data.", privacy: "Privacy Policy", terms: "Terms of Use", internal: "Internal system for OPPO Retail Operations" },
    zh: {
      badge: "OPPO Retail Operations", title: "在一个平台管理所有 LINE OA", description: "通过 OPPO 中央运营工作区统一查看会话、客户、关注者、活动以及各门店表现。", signIn: "登录", download: "下载 Android 应用", chat: "LINE OA 聊天中心", chatDesc: "集中查看已授权门店会话、回复状态，以及 BM / HQ 团队所需的运营工具。", insight: "社交监听与数据洞察", insightDesc: "统一查看关注者、消息流量和各账户的重要指标。", tiktok: "TikTok 监控", tiktokDesc: "监控门店 TikTok 账户、分析表现，并从真实数据中了解趋势。", privacy: "隐私政策", terms: "使用条款", internal: "OPPO Retail Operations 内部系统" },
  });

  const features = [
    { title: text.chat, description: text.chatDesc, mark: "OA" },
    { title: text.insight, description: text.insightDesc, mark: "BI" },
    { title: text.tiktok, description: text.tiktokDesc, mark: "TT" },
  ];

  return (
    <main className="min-h-screen bg-[var(--app-bg,#f8fafc)] text-[var(--app-text-primary,#0f172a)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-accent,#111827)] text-sm font-black text-white">O</div><div><div className="text-sm font-bold tracking-tight">OPPO LINE OA Monitor</div><div className="text-[11px] text-[var(--app-text-tertiary,#64748b)]">{text.internal}</div></div></div>
          <LanguageControl />
        </header>

        <section className="flex flex-1 items-center py-14 sm:py-20">
          <div className="w-full">
            <div className="max-w-3xl"><div className="inline-flex rounded-full border border-[var(--app-border,#e2e8f0)] bg-[var(--app-surface,#fff)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-secondary,#475569)]">{text.badge}</div><h1 className="mt-5 text-4xl font-black leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl">{text.title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-[var(--app-text-secondary,#475569)] sm:text-lg">{text.description}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--app-accent,#111827)] px-5 text-sm font-bold text-white shadow-sm">{text.signIn}</Link><Link href="/download" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--app-border,#e2e8f0)] bg-[var(--app-surface,#fff)] px-5 text-sm font-bold">{text.download}</Link></div></div>

            <div className="mt-12 grid gap-3 md:grid-cols-3">
              {features.map((feature) => <article key={feature.title} className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-[var(--app-surface,#fff)] p-5 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-surface-subtle,#f1f5f9)] text-xs font-black text-[var(--app-accent,#111827)]">{feature.mark}</div><h2 className="mt-4 text-base font-bold">{feature.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--app-text-secondary,#475569)]">{feature.description}</p></article>)}
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border,#e2e8f0)] py-5 text-xs text-[var(--app-text-tertiary,#64748b)]"><span>© 2026 OPPO Retail Operations</span><div className="flex gap-4"><Link href="/privacy" className="hover:text-[var(--app-text-primary,#0f172a)]">{text.privacy}</Link><Link href="/terms" className="hover:text-[var(--app-text-primary,#0f172a)]">{text.terms}</Link></div></footer>
      </div>
    </main>
  );
}
