"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { api, ApiError } from "@/lib/api";
import { canAccessPrimarySection, defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { useAppLanguage } from "../language";
import { getBkkDateStr } from "../follower-insights/follower-insights-utils";
import { downloadDailyFollowerGrowthWorkbook } from "../follower-insights/daily-follower-growth-export";

const copy = {
  th: {
    title: "Download Center",
    description: "รวมไฟล์ดาวน์โหลดจากระบบไว้ในที่เดียว พร้อมอธิบายว่าแต่ละไฟล์มีข้อมูลอะไรและเหมาะกับงานแบบไหน",
    catalog: "ชุดข้อมูลที่ดาวน์โหลดได้",
    lineTitle: "LINE OA Daily Follower Growth",
    lineDesc: "จำนวนผู้ติดตาม LINE OA ที่เพิ่มหรือลดในแต่ละวัน แยกรายสาขา",
    linePurpose: "ใช้กรอก Social KPI, ทำรายงานรายวัน/รายสัปดาห์ และติดตามการเติบโตของแต่ละสาขา",
    lineOutput: "Excel (.xlsx) · 1 แถว = 1 สาขา · 1 คอลัมน์ = 1 วัน",
    storeTitle: "LINE OA Account Master",
    storeDesc: "รายชื่อบัญชี LINE OA ที่เชื่อมต่อกับระบบ พร้อมสถานะและข้อมูลสาขา",
    storePurpose: "ใช้ตรวจสอบความครบถ้วนของบัญชี, audit การเชื่อมต่อ และทำ Store Master reconciliation",
    storeOutput: "CSV · บัญชี LINE OA / สาขา / สถานะการเชื่อมต่อ",
    followerTitle: "Follower Insights Summary",
    followerDesc: "Followers, Reach, Blocks และ Growth ของแต่ละสาขาตามช่วงวันที่",
    followerPurpose: "ใช้วิเคราะห์ performance และเปรียบเทียบสาขา",
    purchaseTitle: "Purchase Intelligence",
    purchaseDesc: "ข้อมูลการซื้อ รุ่นสินค้า ช่องทางซื้อ และวิธีชำระเงินที่บันทึกจากแชท",
    purchasePurpose: "ใช้วิเคราะห์ demand, product mix และพฤติกรรมการซื้อ",
    reviewTitle: "Google Review KPI",
    reviewDesc: "ข้อมูล KPI รีวิว Google ของแต่ละสาขา",
    reviewPurpose: "ใช้ติดตาม Store KPI และคุณภาพรีวิว",
    friendTitle: "Friend Source Links",
    friendDesc: "ข้อมูลลิงก์เพิ่มเพื่อนและแหล่งที่มาของลูกค้า",
    friendPurpose: "ใช้วิเคราะห์ attribution ของ campaign และสาขา",
    purpose: "เป้าหมายของข้อมูล",
    output: "รูปแบบไฟล์",
    download: "ดาวน์โหลด",
    openSource: "เปิดหน้าต้นทาง",
    from: "วันที่เริ่มต้น",
    to: "วันที่สิ้นสุด",
    preparing: "กำลังสร้างไฟล์...",
    exporting: "กำลังดาวน์โหลด...",
    allStoresNote: "ดาวน์โหลดจากหน้านี้เป็นทุกสาขา หากต้องการเลือกเฉพาะบางสาขา ให้เปิด Follower Insights",
    error: "ไม่สามารถดาวน์โหลดไฟล์ได้",
  },
  en: {
    title: "Download Center",
    description: "A single place for system exports, with a clear explanation of what each file contains and what it is for.",
    catalog: "Available datasets",
    lineTitle: "LINE OA Daily Follower Growth",
    lineDesc: "Daily LINE OA follower increase/decrease by store.",
    linePurpose: "Use for Social KPI entry, daily/weekly reports, and store growth tracking.",
    lineOutput: "Excel (.xlsx) · 1 row = 1 store · 1 column = 1 day",
    storeTitle: "LINE OA Account Master",
    storeDesc: "Connected LINE OA accounts with store and connection status data.",
    storePurpose: "Use for account completeness checks, connection audits, and Store Master reconciliation.",
    storeOutput: "CSV · LINE OA / store / connection status",
    followerTitle: "Follower Insights Summary",
    followerDesc: "Followers, reach, blocks, and growth by store for a selected period.",
    followerPurpose: "Use for performance analysis and store comparison.",
    purchaseTitle: "Purchase Intelligence",
    purchaseDesc: "Purchase records, products, channels, and payment methods captured from chats.",
    purchasePurpose: "Use for demand, product mix, and purchase-behavior analysis.",
    reviewTitle: "Google Review KPI",
    reviewDesc: "Google review KPI data by store.",
    reviewPurpose: "Use for Store KPI and review-quality tracking.",
    friendTitle: "Friend Source Links",
    friendDesc: "Friend-source links and customer attribution data.",
    friendPurpose: "Use for campaign and store attribution analysis.",
    purpose: "Purpose",
    output: "File format",
    download: "Download",
    openSource: "Open source page",
    from: "From",
    to: "To",
    preparing: "Preparing file...",
    exporting: "Downloading...",
    allStoresNote: "Downloads from this page include all stores. To select specific stores, open Follower Insights.",
    error: "Unable to download file",
  },
  zh: {
    title: "Download Center",
    description: "集中管理系统导出文件，并说明每个文件包含什么数据及其用途。",
    catalog: "可下载数据集",
    lineTitle: "LINE OA 每日关注者增长",
    lineDesc: "按门店查看 LINE OA 每日关注者增减。",
    linePurpose: "用于 Social KPI、日报/周报以及门店增长追踪。",
    lineOutput: "Excel (.xlsx) · 每行一个门店 · 每列一天",
    storeTitle: "LINE OA 账户主数据",
    storeDesc: "已连接的 LINE OA 账户、门店与连接状态。",
    storePurpose: "用于账户完整性检查、连接审计和 Store Master 对账。",
    storeOutput: "CSV · LINE OA / 门店 / 连接状态",
    followerTitle: "Follower Insights Summary",
    followerDesc: "按门店和时间段查看 Followers、Reach、Blocks 与 Growth。",
    followerPurpose: "用于绩效分析与门店比较。",
    purchaseTitle: "Purchase Intelligence",
    purchaseDesc: "从聊天记录中保存的购买、产品、渠道与支付方式数据。",
    purchasePurpose: "用于需求、产品组合和购买行为分析。",
    reviewTitle: "Google Review KPI",
    reviewDesc: "各门店 Google Review KPI 数据。",
    reviewPurpose: "用于门店 KPI 与评论质量追踪。",
    friendTitle: "Friend Source Links",
    friendDesc: "加好友来源链接与客户归因数据。",
    friendPurpose: "用于活动与门店归因分析。",
    purpose: "数据用途",
    output: "文件格式",
    download: "下载",
    openSource: "打开来源页面",
    from: "开始日期",
    to: "结束日期",
    preparing: "正在生成文件...",
    exporting: "正在下载...",
    allStoresNote: "从此页面下载时包含所有门店。如需选择部分门店，请打开 Follower Insights。",
    error: "无法下载文件",
  },
} as const;

type DatasetLabels = { purpose: string; output: string; openSource: string };
type DatasetCardProps = { title: string; description: string; purpose: string; output?: string; href: string; children?: ReactNode; labels: DatasetLabels };

function DatasetCard({ title, description, purpose, output, href, children, labels }: DatasetCardProps) {
  return <article className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-base font-semibold text-[var(--app-text-primary)]">{title}</h2><p className="mt-1.5 text-sm leading-6 text-[var(--app-text-secondary)]">{description}</p></div><span className="shrink-0 rounded-lg bg-[var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-accent)]">Export</span></div>
    <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">{labels.purpose}</dt><dd className="mt-1 text-[var(--app-text-secondary)]">{purpose}</dd></div>{output && <div><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-tertiary)]">{labels.output}</dt><dd className="mt-1 text-[var(--app-text-secondary)]">{output}</dd></div>}</dl>
    {children}
    <div className="mt-5 flex flex-wrap items-center gap-2"><Link href={href} className="inline-flex h-9 items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs font-semibold text-[var(--app-text-primary)] transition-colors hover:bg-[var(--app-surface-hover)]">{labels.openSource} →</Link></div>
  </article>;
}

export default function DownloadCenterPage() {
  const { language, setLanguage } = useAppLanguage();
  const t = copy[language];
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineDownloading, setLineDownloading] = useState(false);
  const [storeDownloading, setStoreDownloading] = useState(false);
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() - 6); return getBkkDateStr(d); }, [today]);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(getBkkDateStr(today));

  useEffect(() => {
    let cancelled = false;
    api.me().then((raw) => {
      if (cancelled) return;
      const user = raw as AuthUser;
      if (!canAccessPrimarySection(user, "follower-insights")) { window.location.replace(defaultRouteForUser(user)); return; }
      setAuthUser(user);
    }).catch((reason) => {
      if (cancelled) return;
      if (reason instanceof ApiError && reason.status === 401) window.location.replace("/login"); else setError(reason instanceof Error ? reason.message : t.error);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [t.error]);

  const logout = async () => { await api.logout(); window.location.assign("/login"); };
  const downloadLine = async () => {
    setLineDownloading(true); setError(null);
    try { await downloadDailyFollowerGrowthWorkbook({ dateFrom, dateTo, selectedLineOaIds: [], language }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t.error); }
    finally { setLineDownloading(false); }
  };
  const downloadStoreMaster = async () => {
    setStoreDownloading(true); setError(null);
    try {
      const { blob, filename } = await api.exportLineOfficialAccounts({});
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.error); }
    finally { setStoreDownloading(false); }
  };

  return <AppShell currentSection="follower-insights" authUser={authUser} text={{ appName: "OPPO LINE OA Monitor", searchPlaceholder: "Search customers, stores, or messages" }} language={language} changeLanguage={setLanguage} searchText={searchText} setSearchText={setSearchText} logout={logout} isLoading={loading} apiError={error}>
    <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2 border-b border-[var(--app-border-subtle)] pb-5"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-tertiary)]">OPPO LINE OA · Reports & Data Export</div><h1 className="text-2xl font-bold tracking-tight text-[var(--app-text-primary)]">{t.title}</h1><p className="max-w-3xl text-sm leading-6 text-[var(--app-text-secondary)]">{t.description}</p></div>
      {error && <div className="mt-4 rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] px-4 py-3 text-sm text-[var(--app-danger)]">{error}</div>}
      <section className="mt-6"><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{t.catalog}</h2><div className="grid gap-4 lg:grid-cols-2">
        <DatasetCard title={t.lineTitle} description={t.lineDesc} purpose={t.linePurpose} output={t.lineOutput} href="/follower-insights" labels={t}><div className="mt-4 rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] p-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-[var(--app-text-secondary)]"><span className="mb-1 block">{t.from}</span><input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" /></label><label className="text-xs font-medium text-[var(--app-text-secondary)]"><span className="mb-1 block">{t.to}</span><input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" /></label></div><p className="mt-2 text-[11px] text-[var(--app-text-tertiary)]">{t.allStoresNote}</p><button type="button" disabled={lineDownloading || !dateFrom || !dateTo || dateTo < dateFrom} onClick={() => void downloadLine()} className="mt-3 inline-flex h-9 items-center rounded-xl bg-[var(--app-accent)] px-3 text-xs font-semibold text-white disabled:opacity-50">↓ {lineDownloading ? t.preparing : t.download}</button></div></DatasetCard>
        <DatasetCard title={t.storeTitle} description={t.storeDesc} purpose={t.storePurpose} output={t.storeOutput} href="/stores" labels={t}><button type="button" disabled={storeDownloading} onClick={() => void downloadStoreMaster()} className="mt-4 inline-flex h-9 items-center rounded-xl bg-[var(--app-accent)] px-3 text-xs font-semibold text-white disabled:opacity-50">↓ {storeDownloading ? t.exporting : t.download}</button></DatasetCard>
        <DatasetCard title={t.followerTitle} description={t.followerDesc} purpose={t.followerPurpose} href="/follower-insights" labels={t} />
        <DatasetCard title={t.purchaseTitle} description={t.purchaseDesc} purpose={t.purchasePurpose} href="/admin/purchase-analytics" labels={t} />
        <DatasetCard title={t.reviewTitle} description={t.reviewDesc} purpose={t.reviewPurpose} href="/google-review-kpi" labels={t} />
        <DatasetCard title={t.friendTitle} description={t.friendDesc} purpose={t.friendPurpose} href="/friend-source-links" labels={t} />
      </div></section>
    </div></main>
  </AppShell>;
}
