"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../../../language";
import type { TikTokStoreOwnerAnalyticsData, TikTokStoreOwnerStore } from "../../../tiktok/tiktok-types";

type Props = {
  data: TikTokStoreOwnerAnalyticsData | null;
  sessionState: "VALID" | "EXPIRED";
};

type ConnectedAnalyticsData = TikTokStoreOwnerAnalyticsData & {
  status: "CONNECTED";
  account: NonNullable<TikTokStoreOwnerAnalyticsData["account"]>;
  metrics: NonNullable<TikTokStoreOwnerAnalyticsData["metrics"]>;
};

const copy = {
  th: {
    title: "ข้อมูล TikTok ของร้าน",
    subtitle: "ข้อมูลจากบัญชี TikTok ที่คุณเชื่อมต่อกับ OPPO Brand Shop",
    readOnly: "ข้อมูลนี้มาจากบัญชี TikTok ที่คุณอนุญาตให้เชื่อมต่อ ระบบเป็นแบบอ่านอย่างเดียว และจะไม่โพสต์ แก้ไข หรือลบคอนเทนต์บน TikTok",
    directory: "ดูไดเรกทอรีสาขา",
    connected: "เชื่อมต่อแล้ว",
    followers: "ผู้ติดตาม",
    following: "กำลังติดตาม",
    likes: "ยอดถูกใจทั้งหมด",
    videos: "จำนวนวิดีโอ",
    today: "วันนี้",
    sevenDays: "7 วัน",
    thirtyDays: "30 วัน",
    growth: "การเติบโตของผู้ติดตาม",
    history: "ประวัติรายวัน",
    noHistory: "ยังไม่มีข้อมูลประวัติรายวัน ระบบจะแสดงข้อมูลเมื่อมีการบันทึกสถิติอย่างน้อย 2 วัน",
    updated: "อัปเดตล่าสุด",
    storeId: "Store ID",
    province: "จังหวัด",
    selectedStore: "สาขาที่เลือก",
    expired: "เซสชันหมดอายุ กรุณาเชื่อมต่อ TikTok ใหม่เพื่อดูข้อมูลร้านของคุณ",
    reconnect: "เชื่อมต่อ TikTok ใหม่",
    pendingTitle: "รอ HQ ตรวจสอบ",
    pendingDescription: "คำขอเชื่อมต่อสาขานี้อยู่ระหว่างการตรวจสอบ ข้อมูลของสาขาอื่นจะไม่ถูกแสดง",
    finishAssociation: "กลับไปยืนยันการเชื่อมต่อร้าน",
    needsConfirmation: "กรุณายืนยันสาขาก่อนดูข้อมูล TikTok ของร้าน",
    unavailable: "ไม่สามารถโหลดข้อมูล TikTok ได้ กรุณาเชื่อมต่อบัญชีใหม่",
  },
  en: {
    title: "Your store TikTok analytics",
    subtitle: "Data from the TikTok account you connected to OPPO Brand Shop",
    readOnly: "This data comes from the TikTok account you authorized. The connection is read-only and will not post, edit, or delete TikTok content.",
    directory: "Store directory",
    connected: "Connected",
    followers: "Followers",
    following: "Following",
    likes: "Total Likes",
    videos: "Video Count",
    today: "Today",
    sevenDays: "7 days",
    thirtyDays: "30 days",
    growth: "Follower growth",
    history: "Daily history",
    noHistory: "Daily history will appear after at least two official snapshots are available.",
    updated: "Last updated",
    storeId: "Store ID",
    province: "Province",
    selectedStore: "Selected store",
    expired: "Your session has expired. Please reconnect TikTok to view your store data.",
    reconnect: "Reconnect TikTok",
    pendingTitle: "Waiting for HQ review",
    pendingDescription: "This store connection is being reviewed. Analytics for another store will not be shown.",
    finishAssociation: "Return to store association",
    needsConfirmation: "Confirm your store association before viewing TikTok analytics.",
    unavailable: "TikTok data is unavailable. Please reconnect the account.",
  },
  zh: {
    title: "门店 TikTok 数据",
    subtitle: "来自您连接到 OPPO Brand Shop 的 TikTok 账户",
    readOnly: "这些数据来自您授权连接的 TikTok 账户。此连接仅供读取，不会在 TikTok 上发布、编辑或删除内容。",
    directory: "门店目录",
    connected: "已连接",
    followers: "关注者",
    following: "正在关注",
    likes: "总点赞",
    videos: "视频数量",
    today: "今天",
    sevenDays: "7 天",
    thirtyDays: "30 天",
    growth: "关注者增长",
    history: "每日历史",
    noHistory: "至少有两天官方快照后，这里才会显示每日历史数据。",
    updated: "最后更新",
    storeId: "门店 ID",
    province: "省份",
    selectedStore: "已选门店",
    expired: "会话已过期。请重新连接 TikTok 以查看门店数据。",
    reconnect: "重新连接 TikTok",
    pendingTitle: "等待 HQ 审核",
    pendingDescription: "此门店关联正在审核中，不会显示其他门店的数据。",
    finishAssociation: "返回门店关联",
    needsConfirmation: "请先确认门店关联，再查看 TikTok 数据。",
    unavailable: "TikTok 数据不可用。请重新连接账户。",
  },
};

function formatNumber(value: number | null | undefined, locale: string) {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

function formatDelta(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined) return "—";
  const formatted = formatNumber(Math.abs(value), locale);
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : "0";
}

function StoreSummary({ store, t }: { store: TikTokStoreOwnerStore; t: (typeof copy)["th"] }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      {store.externalStoreId && <span>{t.storeId}: {store.externalStoreId}</span>}
      {store.province && <span>{t.province}: {store.province}</span>}
      {store.region && <span>{store.region}</span>}
    </div>
  );
}

function StatusPanel({
  title,
  description,
  action,
  href,
  store,
  storeLabel,
  t,
  tone = "amber",
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  store?: TikTokStoreOwnerStore;
  storeLabel?: string;
  t?: (typeof copy)["th"];
  tone?: "amber" | "rose";
}) {
  const colors = tone === "rose"
    ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200"
    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200";
  return (
    <section className={`rounded-3xl border p-6 ${colors}`}>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
      {store && t && <div className="mt-4 rounded-2xl bg-white/60 p-4 dark:bg-black/10"><p className="text-xs font-bold uppercase tracking-[0.1em] opacity-60">{storeLabel}</p><p className="mt-1 text-sm font-semibold">{store.storeName}</p><StoreSummary store={store} t={t} /></div>}
      <Link href={href} className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
        {action}
      </Link>
    </section>
  );
}

export function StoreOwnerAnalytics({ data, sessionState }: Props) {
  const { language } = useAppLanguage();
  const t = pickLanguageText(language, copy);
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const connectedData: ConnectedAnalyticsData | null = data?.status === "CONNECTED" && data.account && data.metrics
    ? { ...data, status: "CONNECTED", account: data.account, metrics: data.metrics }
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="fixed right-4 top-4 z-10"><LanguageControl /></div>
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
        <header className="flex flex-wrap items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2">
            <Image src="/images/LOGO_OBS.png" alt="OPPO Brand Shop" width={36} height={36} className="rounded-lg" priority />
            <div>
              <p className="text-sm font-semibold">OPPO Brand Shop · TikTok Integration</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <Link href="/stores" className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">{t.directory} →</Link>
        </header>

        {sessionState === "EXPIRED" ? (
          <StatusPanel title={t.expired} description={t.subtitle} action={t.reconnect} href="/connect/tiktok" tone="amber" />
        ) : data?.status === "PENDING" ? (
          <StatusPanel title={t.pendingTitle} description={t.pendingDescription} action={t.finishAssociation} href="/connect/tiktok/success" store={data.pendingStore} storeLabel={t.selectedStore} t={t} />
        ) : data?.status === "NEEDS_STORE_CONFIRMATION" ? (
          <StatusPanel title={t.needsConfirmation} description={t.subtitle} action={t.finishAssociation} href="/connect/tiktok/success" store={data.store} storeLabel={t.selectedStore} t={t} />
        ) : !connectedData ? (
          <StatusPanel title={t.unavailable} description={t.subtitle} action={t.reconnect} href="/connect/tiktok" tone="rose" />
        ) : (
          <ConnectedAnalytics data={connectedData} locale={locale} t={t} />
        )}
      </div>
    </main>
  );
}

function ConnectedAnalytics({
  data,
  locale,
  t,
}: {
  data: ConnectedAnalyticsData;
  locale: string;
  t: (typeof copy)["th"];
}) {
  const { account, metrics } = data;
  const avatar = account.avatarLargeUrl || account.avatarUrl100 || account.avatarUrl;
  const growthItems = [
    [t.today, metrics.summary.dailyFollowerGrowth],
    [t.sevenDays, metrics.summary.sevenDayFollowerGrowth],
    [t.thirtyDays, metrics.summary.thirtyDayFollowerGrowth],
  ] as const;

  return (
    <>
      <section className="overflow-hidden rounded-[32px] bg-slate-950 p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.14)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {avatar ? <Image src={avatar} alt={account.displayName || "TikTok"} width={80} height={80} unoptimized className="h-20 w-20 shrink-0 rounded-3xl object-cover ring-2 ring-white/20" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/10 text-3xl font-black">T</div>}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">{account.displayName || "TikTok Account"}</h1>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">✓ {t.connected}</span>
              </div>
              {account.username && <p className="mt-1 font-mono text-sm text-emerald-300">@{account.username.replace(/^@+/, "")}</p>}
              <p className="mt-3 truncate text-sm font-semibold text-white/80">{account.store.storeName}</p>
              <StoreSummary store={account.store} t={t} />
            </div>
          </div>
          <p className="shrink-0 text-xs text-white/45">{t.updated}: {new Date(account.lastSyncedAt).toLocaleString(locale)}</p>
        </div>
        <p className="mt-5 max-w-4xl text-xs leading-5 text-white/65">{t.readOnly}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t.followers, account.followerCount],
          [t.following, account.followingCount],
          [t.likes, account.likesCount],
          [t.videos, account.videoCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{formatNumber(Number(value), locale)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-900 sm:p-6">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">{t.growth}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {growthItems.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs text-slate-400">{label}</p>
              <p className={`mt-2 text-2xl font-black ${value === null ? "text-slate-400" : value < 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>{formatDelta(value, locale)}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.history}</h3>
          {metrics.history.length > 0 && <span className="text-[11px] text-slate-400">{metrics.history[0].metricDate} → {metrics.history[metrics.history.length - 1].metricDate}</span>}
        </div>
        {metrics.history.length < 2 ? <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:bg-slate-950 dark:text-slate-400">{t.noHistory}</p> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-[11px] text-slate-400">{t.followers}</span><strong className="mt-1 block text-sm">{formatNumber(metrics.history[metrics.history.length - 1].followerCount, locale)}</strong></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-[11px] text-slate-400">{t.following}</span><strong className="mt-1 block text-sm">{formatNumber(metrics.history[metrics.history.length - 1].followingCount, locale)}</strong></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-[11px] text-slate-400">{t.likes}</span><strong className="mt-1 block text-sm">{formatNumber(metrics.history[metrics.history.length - 1].likesCount, locale)}</strong></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><span className="text-[11px] text-slate-400">{t.videos}</span><strong className="mt-1 block text-sm">{formatNumber(metrics.history[metrics.history.length - 1].videoCount, locale)}</strong></div></div>}
      </section>

    </>
  );
}
