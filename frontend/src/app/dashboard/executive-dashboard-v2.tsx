"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardAnalyticsResponse } from "@/types/api";
import { DateRangePicker } from "@/app/follower-insights/date-range-picker";
import { getBangkokIsoDate, rangeForPreset, shiftIsoDate, type DashboardDateRange } from "./dashboard-date-range";

type Language = "th" | "en" | "zh";
type Period = "today" | "7d" | "30d";
type WatchIssue = "reach" | "block" | "inactive";

type StoreHealthRow = {
  storeId: string;
  storeName: string;
  partner: string;
  followers: number;
  start: number;
  growth: number;
  growthPct: number | null;
  reach: number | null;
  reachPct: number | null;
  blocks: number | null;
  blockPct: number | null;
  issues: WatchIssue[];
};

type ExecutiveStoreHealth = {
  stores: StoreHealthRow[];
  followerTrend: Array<{ date: string; followers: number }>;
  connectedStoreCount: number;
  totalStoreCount: number;
};

type ReplyBucket = {
  label: string;
  count: number;
  percent: number | null;
  tone: "good" | "mid" | "bad";
};

interface ExecutiveDashboardV2Props {
  language: Language;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  lastUpdatedAt: Date | null;
}

export function calcBucketPercent(bucketCount: number, totalReplied: number): number | null {
  if (totalReplied === 0) return null;
  return Math.round((bucketCount / totalReplied) * 100);
}

function formatDuration(minutes: number, hasData: boolean): string {
  if (!hasData) return "—";
  if (minutes < 60) return `${minutes} นาที`;
  const hours = minutes / 60;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} ชม.`;
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatUpdatedAt(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(value);
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function FollowerTrend({ data }: { data: ExecutiveStoreHealth["followerTrend"] }) {
  const width = 680;
  const height = 150;
  const padding = 10;
  const values = data.map((item) => item.followers);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const range = Math.max(1, max - min);
  const points = data.map((item, index) => {
    const x = padding + (index / Math.max(1, data.length - 1)) * (width - padding * 2);
    const y = padding + ((max - item.followers) / range) * (height - padding * 2 - 18);
    return { x, y, item };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length > 0
    ? `${points[0].x},${height - 18} ${polyline} ${points[points.length - 1].x},${height - 18}`
    : "";

  return (
    <div className="mt-5 h-[160px] w-full overflow-hidden">
      {data.length === 0 || values.every((value) => value === 0) ? (
        <div className="flex h-full items-center justify-center text-xs text-[var(--dash-text-tertiary)]">
          ยังไม่มีข้อมูลแนวโน้มผู้ติดตามในช่วงนี้
        </div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="แนวโน้มผู้ติดตาม 7 วัน">
          <defs>
            <linearGradient id="followerArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--app-accent, #00A651)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--app-accent, #00A651)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#followerArea)" />
          <polyline points={polyline} fill="none" stroke="var(--app-accent, #00A651)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={point.item.date}>
              <circle cx={point.x} cy={point.y} r="3" fill="var(--app-accent, #00A651)">
                <title>{`${formatDateLabel(point.item.date)}: ${point.item.followers.toLocaleString()} คน`}</title>
              </circle>
              {(index % Math.max(1, Math.ceil(points.length / 7)) === 0 || index === points.length - 1) && (
                <text x={point.x} y={height - 3} textAnchor="middle" fontSize="10" fill="#A1A1A6">
                  {formatDateLabel(point.item.date)}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function ReplyDonut({ replied, notified, pending }: { replied: number; notified: number; pending: number }) {
  const total = replied + notified + pending;
  const repliedPct = percent(replied, total);
  const notifiedPct = percent(notified, total);
  const repliedEnd = repliedPct;
  const notifiedEnd = repliedPct + notifiedPct;
  const background = total > 0
    ? `conic-gradient(var(--dash-green) 0 ${repliedEnd}%, var(--dash-purple) ${repliedEnd}% ${notifiedEnd}%, var(--dash-border) ${notifiedEnd}% 100%)`
    : "var(--dash-border)";

  return (
    <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background }} aria-label={`ทั้งหมด ${total} ข้อความ`}>
      <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-[var(--dash-card)]">
        <span className="text-xl font-bold leading-none">{total.toLocaleString()}</span>
        <span className="mt-1 text-[10px] text-[var(--dash-text-tertiary)]">ข้อความ</span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.05em] text-[var(--dash-text-tertiary)] first:mt-0">
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[18px] border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </section>
  );
}

export function ExecutiveDashboardV2({
  language,
  getStoreDisplayName,
  onOpenStore,
  lastUpdatedAt,
}: ExecutiveDashboardV2Props) {
  const [period, setPeriod] = useState<Period>("7d");
  const [dateRange, setDateRange] = useState<DashboardDateRange>(() => rangeForPreset("7d"));
  const [customRangeActive, setCustomRangeActive] = useState(false);
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [health, setHealth] = useState<ExecutiveStoreHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const load = useCallback(async (nextPeriod: Period, nextRange: DashboardDateRange) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period: nextPeriod,
        dateFrom: nextRange.dateFrom,
        dateTo: nextRange.dateTo,
      });
      const [analyticsResponse, healthResponse] = await Promise.all([
        fetch(`/api-backend/dashboard/analytics?${params.toString()}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api-backend/dashboard/executive-store-health?${params.toString()}`, { credentials: "include", cache: "no-store" }),
      ]);
      if (!analyticsResponse.ok) throw new Error(`Dashboard analytics request failed (${analyticsResponse.status})`);
      if (!healthResponse.ok) throw new Error(`Executive store health request failed (${healthResponse.status})`);
      const analyticsData = (await analyticsResponse.json()) as DashboardAnalyticsResponse;
      const healthData = (await healthResponse.json()) as ExecutiveStoreHealth;
      setAnalytics(analyticsData);
      setHealth(healthData);
      setLastFetchAt(new Date());
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(period, dateRange), 0);
    const interval = window.setInterval(() => void load(period, dateRange), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [load, period, dateRange]);

  const applyPreset = useCallback((nextPeriod: Period) => {
    setPeriod(nextPeriod);
    setDateRange(rangeForPreset(nextPeriod));
    setCustomRangeActive(false);
  }, []);

  const applyCustomRange = useCallback((dateFrom: string, dateTo: string) => {
    setDateRange({ dateFrom, dateTo });
    setCustomRangeActive(true);
  }, []);

  const applyQuickDays = useCallback((days: number) => {
    const today = getBangkokIsoDate();
    const nextRange = { dateFrom: shiftIsoDate(today, -(days - 1)), dateTo: today };
    setDateRange(nextRange);
    if (days === 7) {
      setPeriod("7d");
      setCustomRangeActive(false);
    } else if (days === 30) {
      setPeriod("30d");
      setCustomRangeActive(false);
    } else {
      setPeriod("30d");
      setCustomRangeActive(true);
    }
  }, []);

  const replyBuckets = useMemo<ReplyBucket[]>(() => {
    if (!analytics) return [];
    const source = analytics.responseAnalytics.buckets;
    const totalReplied = source.under4h + source.between4and12h + source.between12and24h + source.over24h;
    return [
      { label: "< 4 ชั่วโมง", count: source.under4h, percent: calcBucketPercent(source.under4h, totalReplied), tone: "good" },
      { label: "4 - 12 ชั่วโมง", count: source.between4and12h, percent: calcBucketPercent(source.between4and12h, totalReplied), tone: "mid" },
      { label: "12 - 24 ชั่วโมง", count: source.between12and24h, percent: calcBucketPercent(source.between12and24h, totalReplied), tone: "mid" },
      { label: "> 24 ชั่วโมง", count: source.over24h, percent: calcBucketPercent(source.over24h, totalReplied), tone: "bad" },
    ];
  }, [analytics]);

  const totalDurationReplies = replyBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  const topGrowth = useMemo(() => {
    return [...(health?.stores ?? [])]
      .filter((store) => store.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 5);
  }, [health]);

  const partnerSummary = useMemo(() => {
    const map = new Map<string, { stores: number; followers: number }>();
    for (const store of health?.stores ?? []) {
      const current = map.get(store.partner) ?? { stores: 0, followers: 0 };
      current.stores += 1;
      current.followers += store.followers;
      map.set(store.partner, current);
    }
    return [...map.entries()]
      .map(([name, value]) => ({
        name,
        stores: value.stores,
        avg: value.stores > 0 ? Math.round(value.followers / value.stores) : 0,
      }))
      .sort((a, b) => b.stores - a.stores || b.avg - a.avg)
      .slice(0, 8);
  }, [health]);

  if (loading && (!analytics || !health)) {
    return (
      <div className="min-h-screen rounded-2xl bg-[var(--dash-bg)] p-6">
        <div className="mx-auto max-w-[1280px] animate-pulse space-y-4">
          <div className="h-16 rounded-2xl bg-[var(--dash-card)]" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="h-96 rounded-[20px] bg-[var(--dash-card)]" />
            <div className="h-96 rounded-[20px] bg-[var(--dash-card)]" />
          </div>
          <div className="h-72 rounded-[18px] bg-[var(--dash-card)]" />
        </div>
      </div>
    );
  }

  if (!analytics || !health) {
    return (
      <div className="min-h-[420px] rounded-2xl bg-[var(--dash-bg)] p-8">
        <div className="mx-auto max-w-xl rounded-[18px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-6 text-center">
          <h2 className="text-base font-bold text-[var(--dash-text)]">ไม่สามารถโหลดข้อมูลแดชบอร์ดได้</h2>
          <p className="mt-2 text-sm text-[var(--dash-text-secondary)]">ข้อมูลเดิมจะไม่ถูกแทนด้วยค่าจำลอง กรุณาลองโหลดใหม่</p>
          <button type="button" onClick={() => void load(period, dateRange)} className="mt-4 rounded-lg bg-[var(--dash-accent)] px-4 py-2 text-sm font-semibold text-white">
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  const follower = analytics.summaryCards.followerGrowth;
  const messagesTotal = analytics.summaryCards.messagesToday;
  const replied = analytics.summaryCards.repliedCount;
  const notified = analytics.summaryCards.bmNotifiedCount;
  const pending = analytics.summaryCards.pendingCount;
  const topProduct = analytics.topProducts[0] ?? null;
  const top10 = analytics.storeFollowersRanking?.top10 ?? [...health.stores].sort((a, b) => b.followers - a.followers).slice(0, 10);
  const bottom10 = analytics.storeFollowersRanking?.bottom10
    ? [...analytics.storeFollowersRanking.bottom10].sort((a, b) => a.followers - b.followers)
    : [...health.stores].filter((store) => store.followers > 0).sort((a, b) => a.followers - b.followers).slice(0, 10);
  const updatedAt = lastFetchAt ?? lastUpdatedAt;
  const replyRate = messagesTotal > 0 ? Math.round((replied / messagesTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--dash-bg)] pb-14 text-[var(--dash-text)] [font-family:'IBM_Plex_Sans_Thai',-apple-system,BlinkMacSystemFont,sans-serif]">
      <div className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--dash-text-tertiary)]">OPPO LINE OA · ภาพรวมผู้บริหาร</div>
            <h1 className="text-2xl font-bold tracking-[-0.02em]">แดชบอร์ด</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <span className="text-xs text-[var(--dash-text-tertiary)]">อัปเดตล่าสุด {formatUpdatedAt(updatedAt)}</span>
            <div className="flex gap-0.5 rounded-[10px] border border-[var(--dash-border)] bg-[var(--dash-card)] p-[3px]">
              {(["today", "7d", "30d"] as Period[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => applyPreset(item)}
                  className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition ${period === item && !customRangeActive ? "bg-[var(--dash-accent)] font-semibold text-white" : "text-[var(--dash-text-secondary)] hover:bg-[var(--dash-accent-soft)]"}`}
                >
                  {item === "today" ? "วันนี้" : item === "7d" ? "7 วัน" : "30 วัน"}
                </button>
              ))}
            </div>
            <DateRangePicker
              dateFrom={dateRange.dateFrom}
              dateTo={dateRange.dateTo}
              language={language}
              onApply={applyCustomRange}
              onQuickRange={applyQuickDays}
            />
          </div>
        </header>

        {fetchError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--dash-red)]/30 bg-[var(--dash-red-soft)] px-4 py-3 text-xs text-[var(--dash-red)]">
            <span>ข้อมูลบางส่วนอาจยังไม่อัปเดต ระบบจะลองใหม่อัตโนมัติ</span>
            <button type="button" onClick={() => void load(period, dateRange)} className="font-bold underline">โหลดใหม่</button>
          </div>
        )}

        <SectionLabel>ตัวเลขหลัก</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="rounded-[20px] p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-1.5 text-[13.5px] font-semibold text-[var(--dash-text-secondary)]">ผู้ติดตามรวมทั้งหมด</div>
                <div className="text-[44px] font-bold leading-none tracking-[-0.03em]">{follower.totalFriends.toLocaleString()}</div>
                <div className="mt-2 text-[13px] text-[var(--dash-text-secondary)]">{health.totalStoreCount.toLocaleString()} สาขา · เทียบตามช่วงเวลาที่เลือก</div>
              </div>
              <div className={`rounded-[10px] px-3 py-2 text-sm font-bold ${follower.netToday >= 0 ? "bg-[var(--dash-green-soft)] text-[#1E8E3E]" : "bg-[var(--dash-red-soft)] text-[#C62828]"}`}>
                {follower.netToday >= 0 ? "▲" : "▼"} {follower.netToday >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(follower.netToday).toLocaleString()} คน
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3">
                <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">ผู้ติดตามใหม่</div>
                <div className="mt-1 text-[19px] font-bold text-[var(--dash-green)]">+{Math.max(0, follower.addedToday).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3">
                <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">บล็อกเพิ่ม</div>
                <div className="mt-1 text-[19px] font-bold text-[var(--dash-red)]">−{Math.max(0, follower.blockedToday).toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-[var(--dash-bg)] px-3.5 py-3">
                <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">เพิ่มขึ้นสุทธิ</div>
                <div className={`mt-1 text-[19px] font-bold ${follower.netToday >= 0 ? "text-[var(--dash-green)]" : "text-[var(--dash-red)]"}`}>{follower.netToday >= 0 ? "+" : ""}{follower.netToday.toLocaleString()}</div>
              </div>
            </div>
            <FollowerTrend data={health.followerTrend} />
          </Card>

          <Card className="flex rounded-[20px] flex-col p-6">
            <h2 className="text-[15px] font-bold text-[var(--dash-text)]">การตอบกลับลูกค้า</h2>
            <div className="mb-[18px] mt-0.5 text-xs text-[var(--dash-text-tertiary)]">{messagesTotal.toLocaleString()} ข้อความทั้งหมดในช่วงที่เลือก</div>
            <div className="mb-4 flex items-center gap-[18px]">
              <ReplyDonut replied={replied} notified={notified} pending={pending} />
              <div className="flex flex-1 flex-col gap-2 text-[12.5px]">
                {[
                  ["var(--dash-green)", "ตอบแล้ว", replied],
                  ["var(--dash-purple)", "แจ้งเตือนแล้ว", notified],
                  ["var(--dash-text-disabled)", "ยังไม่ตอบ", pending],
                ].map(([color, label, value]) => (
                  <div key={String(label)} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: String(color) }} />
                    <span className="flex-1 text-[var(--dash-text-secondary)]">{label}</span>
                    <span className="font-bold text-[var(--dash-text)]">{Number(value).toLocaleString()} ({percent(Number(value), messagesTotal)}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto flex items-start gap-2 rounded-xl bg-[var(--dash-red-soft)] px-3 py-2.5 text-[12.5px] font-medium leading-5 text-[var(--dash-red)]">
              <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--dash-red)]" />
              <span>มี <b>{pending.toLocaleString()} ข้อความ</b> ที่ยังไม่ได้รับการตอบกลับ — ดูรายละเอียดความเร็วตอบกลับด้านล่าง</span>
            </div>
          </Card>
        </div>

        <SectionLabel>การดำเนินงานตอบกลับลูกค้า</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="p-[22px]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-[var(--dash-text)]">ความเร็วในการตอบกลับในช่วงที่เลือก</h2>
                <div className="mt-1 text-[11.5px] text-[var(--dash-text-tertiary)]">เป้าหมาย: ตอบกลับลูกค้าภายใน 24 ชั่วโมงเสมอ</div>
              </div>
              <div className="flex gap-2">
                <div className="rounded-[10px] bg-[var(--dash-bg)] px-3 py-2 text-center">
                  <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">เฉลี่ย</div>
                  <div className="text-sm font-bold text-[var(--dash-text)]">{formatDuration(analytics.responseAnalytics.avgResponseMinutes, totalDurationReplies > 0)}</div>
                </div>
                <div className="rounded-[10px] bg-[var(--dash-bg)] px-3 py-2 text-center">
                  <div className="text-[10.5px] text-[var(--dash-text-tertiary)]">มัธยฐาน</div>
                  <div className="text-sm font-bold text-[var(--dash-text)]">{formatDuration(analytics.responseAnalytics.medianResponseMinutes, totalDurationReplies > 0)}</div>
                </div>
              </div>
            </div>
            <div className="mt-[18px] grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {replyBuckets.map((bucket) => {
                const toneClass = bucket.tone === "good"
                  ? "border-l-[var(--dash-green)] bg-[var(--dash-green-soft)]"
                  : bucket.tone === "bad"
                    ? "border-l-[var(--dash-red)] bg-[var(--dash-red-soft)]"
                    : "border-l-[var(--dash-amber)] bg-[var(--dash-amber-soft)]";
                const pctClass = bucket.tone === "good" ? "text-[var(--dash-green)]" : bucket.tone === "bad" ? "text-[var(--dash-red)]" : "text-[var(--dash-amber)]";
                return (
                  <div key={bucket.label} className={`rounded-xl border-l-[3px] px-3.5 py-3 ${totalDurationReplies > 0 ? toneClass : "border-l-[var(--dash-border)] bg-[var(--dash-bg)]"}`}>
                    <div className="flex justify-between gap-2 text-[11px] font-semibold text-[var(--dash-text-secondary)]">
                      <span>{bucket.label}</span>
                      <span className={bucket.percent === null ? "text-[var(--dash-text-tertiary)]" : pctClass}>{bucket.percent === null ? "—" : `${bucket.percent}%`}</span>
                    </div>
                    <div className="mt-1.5 text-[22px] font-bold text-[var(--dash-text)]">{bucket.count.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
            {totalDurationReplies === 0 && <div className="mt-2 text-center text-[11.5px] text-[var(--dash-text-tertiary)]">ยังไม่มีข้อความที่ตอบกลับในช่วงที่เลือก</div>}
          </Card>

          <Card className="p-[22px]">
            <h2 className="text-[15px] font-bold text-[var(--dash-text)]">ช่วงเวลาที่ลูกค้าทักเข้ามาสูงสุด</h2>
            <div className="my-4 flex gap-2.5 max-[899px]:flex-col">
              <div className="flex-1 rounded-xl bg-[var(--dash-bg)] px-4 py-3.5">
                <div className="text-[11px] text-[var(--dash-text-secondary)]">ช่วงเวลาหนาแน่นสุด</div>
                <div className="mt-1 text-xl font-bold text-[var(--dash-accent)]">{analytics.peakHourAnalysis.peakWindow}</div>
              </div>
              <div className="flex-1 rounded-xl bg-[var(--dash-bg)] px-4 py-3.5">
                <div className="text-[11px] text-[var(--dash-text-secondary)]">จำนวนข้อความในช่วงพีค</div>
                <div className="mt-1 text-xl font-bold text-[var(--dash-accent)]">{analytics.peakHourAnalysis.peakTrafficCount.toLocaleString()}</div>
              </div>
            </div>
            <div className="mb-2 text-[11.5px] font-semibold text-[var(--dash-text-tertiary)]">สาขาที่ได้รับการติดต่อสูงสุดในช่วงพีค</div>
            <div>
              {analytics.peakHourAnalysis.topStores.length > 0 ? analytics.peakHourAnalysis.topStores.slice(0, 3).map((store, index) => (
                <button key={store.storeId} type="button" onClick={() => onOpenStore(store.storeId)} className="flex w-full items-center justify-between border-b border-[var(--dash-border)] py-2 text-left text-[12.5px] last:border-b-0 hover:text-[var(--dash-accent)]">
                  <span className="min-w-0 truncate"><span className="mr-2 text-[11px] font-bold text-[var(--dash-text-tertiary)]">#{index + 1}</span>{getStoreDisplayName(store.storeName)}</span>
                  <span className="ml-3 shrink-0 font-bold text-[var(--dash-accent)]">{store.count.toLocaleString()} ข้อความ</span>
                </button>
              )) : <div className="py-4 text-center text-xs text-[var(--dash-text-tertiary)]">ยังไม่มีข้อมูลสาขาในช่วงพีค</div>}
            </div>
            <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-[var(--dash-accent-soft)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--dash-accent)]">
              <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--dash-accent)]" />
              <span>ควรเพิ่มกำลังคนดูแลข้อความช่วง <b>{analytics.peakHourAnalysis.peakWindow}</b> เพื่อรองรับปริมาณที่สูงกว่าช่วงอื่น</span>
            </div>
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
          <Card className="p-5">
            <div className="mb-2 inline-flex rounded-full bg-[var(--dash-green-soft)] px-2 py-1 text-[10.5px] font-bold text-[var(--dash-green)]">แนวโน้มดี</div>
            <h3 className="text-sm font-bold text-[var(--dash-text)]">สาขาที่เติบโตเร็วที่สุด</h3>
            <div className="mb-3 mt-1 text-xs text-[var(--dash-text-secondary)]">เทียบตามช่วงเวลาที่เลือก พร้อมพาร์ทเนอร์จากชื่อสาขา</div>
            {topGrowth.length > 0 ? topGrowth.map((store) => (
              <button key={store.storeId} type="button" onClick={() => onOpenStore(store.storeId)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--dash-border)] py-2 text-left text-[12.5px] last:border-b-0 hover:text-[var(--dash-accent)]">
                <span className="min-w-0"><span className="block truncate text-[var(--dash-text)]">{getStoreDisplayName(store.storeName)}</span><span className="block text-[10.5px] text-[var(--dash-text-tertiary)]">พาร์ทเนอร์: {store.partner}</span></span>
                <span className="shrink-0 font-bold text-[var(--dash-green)]">+{store.growth.toLocaleString()}</span>
              </button>
            )) : <div className="py-5 text-center text-xs text-[var(--dash-text-tertiary)]">ยังไม่มีสาขาที่มี growth เป็นบวก</div>}
          </Card>

          <Card className="p-5">
            <div className="mb-2 inline-flex rounded-full bg-[var(--dash-purple)]/15 px-2 py-1 text-[10.5px] font-bold text-[var(--dash-purple)]">สรุปตามพาร์ทเนอร์</div>
            <h3 className="text-sm font-bold text-[var(--dash-text)]">ภาพรวมตามบริษัทตัวแทน</h3>
            <div className="mb-3 mt-1 text-xs text-[var(--dash-text-secondary)]">จำนวนสาขาและผู้ติดตามเฉลี่ยต่อสาขา จาก pattern “By XXX” ในชื่อร้าน</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
                <thead><tr className="border-b border-[var(--dash-border)] text-[10.5px] uppercase tracking-[0.03em] text-[var(--dash-text-tertiary)]"><th className="px-2 py-2 text-left">พาร์ทเนอร์</th><th className="px-2 py-2 text-right">จำนวนสาขา</th><th className="px-2 py-2 text-right">ผู้ติดตามเฉลี่ย/สาขา</th></tr></thead>
                <tbody>{partnerSummary.map((partner) => <tr key={partner.name} className="border-b border-[var(--dash-border)] last:border-b-0"><td className="px-2 py-2.5 font-medium text-[var(--dash-text)]">{partner.name}</td><td className="px-2 py-2.5 text-right tabular-nums text-[var(--dash-text)]">{partner.stores.toLocaleString()}</td><td className="px-2 py-2.5 text-right tabular-nums text-[var(--dash-text)]">{partner.avg.toLocaleString()}</td></tr>)}</tbody>
              </table>
            </div>
          </Card>
        </div>

        <SectionLabel>รายละเอียดระดับสาขา</SectionLabel>
        <Card className="p-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[var(--dash-text)]">Top 10 สาขาผู้ติดตามสูงสุด vs สาขาที่ต้องการการดูแล</h2>
            <span className="text-xs text-[var(--dash-text-tertiary)]">อัปเดต ณ วันที่เลือก</span>
          </div>
          <div className="mb-4 mt-1 text-xs text-[var(--dash-text-secondary)]">เปรียบเทียบสาขาที่มีฐานผู้ติดตามใหญ่สุด กับสาขาที่ยังมีฐานเล็กและต้องการการผลักดัน</div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[{ title: "ผู้ติดตามสูงสุด", rows: top10 }, { title: "สาขาที่ต้องการการดูแล", rows: bottom10 }].map((group) => (
              <div key={group.title}>
                <div className="mb-1 text-xs font-bold text-[var(--dash-text-secondary)]">{group.title}</div>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead><tr className="border-b border-[var(--dash-border)] text-[10.5px] uppercase text-[var(--dash-text-tertiary)]"><th className="px-2 py-2 text-left">#</th><th className="px-2 py-2 text-left">ร้านค้า</th><th className="px-2 py-2 text-right">ผู้ติดตาม</th></tr></thead>
                  <tbody>{group.rows.map((store, index) => (
                    <tr key={store.storeId} className="border-b border-[var(--dash-border)] last:border-b-0 hover:bg-[var(--dash-accent-soft)]">
                      <td className="px-2 py-2.5 text-[var(--dash-text-tertiary)]">{index + 1}</td>
                      <td className="px-2 py-2.5"><button type="button" onClick={() => onOpenStore(store.storeId)} className="text-left text-[var(--dash-text)] hover:text-[var(--dash-accent)]">{getStoreDisplayName(store.storeName)}</button></td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-[var(--dash-text)]">{store.followers.toLocaleString()}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>

        <SectionLabel>ข้อมูลเสริม</SectionLabel>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Card className="rounded-[14px] p-4">
            <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">สินค้าที่ลูกค้าถามถึงมากสุด</div>
            <div className="mt-1 text-[15px] font-bold text-[var(--dash-text)]">{topProduct?.name ?? "ยังไม่มีข้อมูล"}</div>
            <div className="mt-1 text-[11px] text-[var(--dash-text-tertiary)]">{topProduct ? `${topProduct.percentage}% ของบทสนทนาในช่วงนี้` : "—"}</div>
          </Card>
          <Card className="rounded-[14px] p-4">
            <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">สาขาที่เชื่อมต่อระบบแล้ว</div>
            <div className="mt-1 text-lg font-bold text-[var(--dash-text)]">{health.connectedStoreCount.toLocaleString()} <span className="text-xs font-medium text-[var(--dash-text-tertiary)]">/ {health.totalStoreCount.toLocaleString()}</span></div>
            <div className="mt-1 text-[11px] text-[var(--dash-text-tertiary)]">{Math.max(0, health.totalStoreCount - health.connectedStoreCount).toLocaleString()} สาขายังต้องติดตาม</div>
          </Card>
          <Card className="rounded-[14px] p-4">
            <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">อัตราตอบกลับสำเร็จ</div>
            <div className="mt-1 text-lg font-bold text-[var(--dash-text)]">{replyRate}%</div>
            <div className="mt-1 text-[11px] text-[var(--dash-text-tertiary)]">{replied.toLocaleString()} จาก {messagesTotal.toLocaleString()} ข้อความ</div>
          </Card>
          <Card className="rounded-[14px] p-4">
            <div className="text-[11.5px] font-medium text-[var(--dash-text-secondary)]">ความสมบูรณ์ของข้อมูล</div>
            <div className={`mt-1 text-[15px] font-bold ${analytics.dataQuality.status === "Healthy" ? "text-[var(--dash-green)]" : analytics.dataQuality.status === "Critical" ? "text-[var(--dash-red)]" : "text-[var(--dash-amber)]"}`}>{analytics.dataQuality.status === "Healthy" ? "ปกติ (Healthy)" : analytics.dataQuality.status}</div>
            <div className="mt-1 text-[11px] text-[var(--dash-text-tertiary)]">{analytics.dataQuality.storeCount.toLocaleString()} สาขาใน data quality check</div>
          </Card>
        </div>

        <footer className="mt-6 text-center text-xs text-[var(--dash-text-tertiary)]">OPPO LINE OA Monitor · ข้อมูลอัปเดตตามช่วงเวลาที่เลือก</footer>
      </div>
    </div>
  );
}
