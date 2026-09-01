"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageContainer, PageHeader, FilterBar } from "@/components/shell";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LoadingState,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { api } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import { DateRangePicker } from "../../follower-insights/date-range-picker";
import { getBkkDateStr } from "../../follower-insights/follower-insights-utils";
import { pickLanguageText, useAppLanguage, type AppLanguage } from "../../language";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type HourBucket = { hour: number; count: number };
type StoreTrafficRow = {
  rank: number;
  storeId: string;
  storeName: string;
  externalStoreId: string | null;
  inboundMessages: number;
  distinctConversations: number;
  messagesPerConversation: number;
  peakHour: { hour: number; count: number; window: string };
};
type MessageTrafficResponse = {
  period: "today" | "7d" | "30d" | "custom";
  customRange: { from: string; to: string } | null;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  totalInboundMessages: number;
  totalConversations: number;
  messagesPerConversation: number;
  overallPeakHour: { hour: number; count: number; window: string };
  hourlyDistribution: HourBucket[];
  dayOfWeekDistribution: Array<{ dayOfWeek: number; day: string; count: number }>;
  topStores: StoreTrafficRow[];
};

function localeFor(language: AppLanguage) {
  return language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-US";
}

function dayLabel(dayOfWeek: number, language: AppLanguage) {
  const labels = {
    th: ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    zh: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
  } as const;
  return labels[language][dayOfWeek] ?? "—";
}

function quickRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: getBkkDateStr(start), to: getBkkDateStr(end) };
}

async function fetchTraffic(from: string, to: string, failureText: string): Promise<MessageTrafficResponse> {
  const query = new URLSearchParams({ from, to });
  const response = await fetch(`/api-backend/dashboard/message-traffic?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
  if (!response.ok) {
    let message = `${failureText} (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<MessageTrafficResponse>;
}

function HourlyBars({ items, formatter }: { items: HourBucket[]; formatter: Intl.NumberFormat }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.hour} className="grid grid-cols-[46px_1fr_64px] items-center gap-3 text-xs">
          <span className="font-tabular text-[var(--app-text-secondary)]">{String(item.hour).padStart(2, "0")}:00</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]"><div className="h-full rounded-full bg-[var(--app-accent)]" style={{ width: `${Math.max(item.count > 0 ? 2 : 0, (item.count / max) * 100)}%` }} /></div>
          <span className="text-right font-tabular font-medium">{formatter.format(item.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function MessageTrafficView() {
  const { language, setLanguage } = useAppLanguage();
  const locale = localeFor(language);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }), [locale]);
  const text = pickLanguageText(language, {
    th: {
      apiError: "โหลดข้อมูลไม่สำเร็จ", loadError: "ไม่สามารถโหลด Message Traffic ได้", loading: "กำลังโหลด…", authRequired: "ต้องเข้าสู่ระบบ", signIn: "กรุณาเข้าสู่ระบบเพื่อดูข้อมูล Message Traffic", appDescription: "ติดตาม LINE OA", language: "ภาษา", retry: "ลองอีกครั้ง", dataError: "เกิดข้อผิดพลาดจากบริการข้อมูล", tag: "Analytics · Customer Message Traffic", title: "Message Traffic Analytics", description: "วิเคราะห์ข้อความ LINE จากลูกค้า แยกตามร้าน ช่วงเวลา และจำนวนบทสนทนา · เขตเวลา Asia/Bangkok", refresh: "รีเฟรช", loadingTraffic: "กำลังโหลด Message Traffic…", inbound: "ข้อความจากลูกค้า", conversations: "บทสนทนา", inboundDetail: "บทสนทนาที่มีข้อความเข้า", perConversation: "ข้อความ / บทสนทนา", intensity: "ความเข้มข้นของบทสนทนา", peakHour: "ช่วงพีค", messagesPeak: "ข้อความในช่วงพีค", busiestDay: "วันที่คึกคักสุด", messages: "ข้อความ", noTraffic: "ไม่มี Traffic", hourly: "ข้อความเข้าแยกตามชั่วโมง", weekday: "Traffic แยกตามวันในสัปดาห์", ranking: "อันดับร้านค้า", rankingDesc: "จัดอันดับจากจำนวนข้อความจากลูกค้าจริง ไม่ใช่จำนวนห้องที่ถูกสร้าง", rank: "อันดับ", store: "ร้านค้า", inboundColumn: "ข้อความเข้า", conversationsColumn: "บทสนทนา", msgConv: "ข้อความ / ห้อง", peakVolume: "จำนวนช่วงพีค", noInbound: "ไม่มีข้อความจากลูกค้าในช่วงเวลานี้",
    },
    en: {
      apiError: "API request failed", loadError: "Unable to load message traffic analytics.", loading: "Loading…", authRequired: "Authentication required", signIn: "Please sign in to view message traffic analytics.", appDescription: "LINE OA monitoring", language: "Language", retry: "Retry", dataError: "Data service error", tag: "Analytics · Customer Message Traffic", title: "Message Traffic Analytics", description: "Inbound LINE messages by store, time of day, and conversation volume. Timezone: Asia/Bangkok.", refresh: "Refresh", loadingTraffic: "Loading message traffic…", inbound: "Inbound Messages", conversations: "Conversations", inboundDetail: "Distinct conversations with inbound traffic", perConversation: "Messages / Conversation", intensity: "Conversation intensity", peakHour: "Peak Hour", messagesPeak: "messages in peak hour", busiestDay: "Busiest Day", messages: "messages", noTraffic: "No traffic", hourly: "Hourly inbound traffic", weekday: "Traffic by day of week", ranking: "Store ranking", rankingDesc: "Ranked by actual inbound message count, not conversation creation count.", rank: "Rank", store: "Store", inboundColumn: "Inbound", conversationsColumn: "Conversations", msgConv: "Msg / Conv.", peakVolume: "Peak Volume", noInbound: "No inbound messages in this period.",
    },
    zh: {
      apiError: "API 请求失败", loadError: "无法加载消息流量分析。", loading: "加载中…", authRequired: "需要登录", signIn: "请登录后查看消息流量分析。", appDescription: "LINE OA 监控", language: "语言", retry: "重试", dataError: "数据服务错误", tag: "分析 · 客户消息流量", title: "消息流量分析", description: "按门店、时段和会话量分析客户发来的 LINE 消息。时区：Asia/Bangkok。", refresh: "刷新", loadingTraffic: "正在加载消息流量…", inbound: "客户消息", conversations: "会话", inboundDetail: "有客户消息的独立会话", perConversation: "消息 / 会话", intensity: "会话强度", peakHour: "高峰时段", messagesPeak: "条高峰消息", busiestDay: "最繁忙日期", messages: "条消息", noTraffic: "暂无流量", hourly: "按小时统计客户消息", weekday: "按星期统计流量", ranking: "门店排名", rankingDesc: "按实际客户消息数量排名，而不是按新建会话数量排名。", rank: "排名", store: "门店", inboundColumn: "客户消息", conversationsColumn: "会话", msgConv: "消息 / 会话", peakVolume: "高峰消息量", noInbound: "此时段没有客户消息。",
    },
  });

  const initialRange = useMemo(() => quickRange(30), []);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [quickDays, setQuickDays] = useState<number | null>(30);
  const [data, setData] = useState<MessageTrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRange = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try { setData(await fetchTraffic(from, to, text.apiError)); }
    catch (err) { setError(err instanceof Error ? err.message : text.loadError); }
    finally { setLoading(false); }
  }, [text.apiError, text.loadError]);

  const applyQuickRange = useCallback((days: number) => {
    const range = quickRange(days);
    setDateFrom(range.from);
    setDateTo(range.to);
    setQuickDays(days);
    void loadRange(range.from, range.to);
  }, [loadRange]);

  const applyCalendarRange = useCallback((start: string, end: string) => {
    setDateFrom(start);
    setDateTo(end);
    setQuickDays(null);
    void loadRange(start, end);
  }, [loadRange]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.me();
        setAuthUser(user);
        await loadRange(initialRange.from, initialRange.to);
      } catch {
        setAuthUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    void checkAuth();
    const handleUnauthorized = () => setAuthUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [initialRange.from, initialRange.to, loadRange]);

  const busiestDay = useMemo(() => data?.dayOfWeekDistribution.length ? [...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count)[0] : null, [data]);
  const activeRangeLabel = useMemo(() => data ? `${dateLabel.format(new Date(data.rangeStart))} – ${dateLabel.format(new Date(data.rangeEnd))}` : "", [data, dateLabel]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]"><LoadingState message={text.loading} /></main>;
  if (!authUser) return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6"><Card className="max-w-md text-center"><h1 className="text-xl font-bold">{text.authRequired}</h1><p className="mt-2 text-xs text-[var(--app-text-secondary)]">{text.signIn}</p></Card></main>;

  return (
    <AppShell
      currentSection="dashboard"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: text.appDescription, language: text.language, loadingData: text.loading, retry: text.retry, apiError: text.dataError }}
      language={language}
      changeLanguage={setLanguage}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      <PageContainer variant="wide">
        <div className="space-y-6">
          <PageHeader tag={text.tag} title={text.title} description={text.description} actions={<Button variant="secondary" size="sm" onClick={() => void loadRange(dateFrom, dateTo)} disabled={loading}>{text.refresh}</Button>} />

          <FilterBar>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-sm">
                {[7, 14, 30].map((days) => <button key={days} type="button" onClick={() => applyQuickRange(days)} disabled={loading} className={`min-w-14 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${quickDays === days ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"}`}>{days}D</button>)}
              </div>
              <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} language={language} onApply={applyCalendarRange} onQuickRange={applyQuickRange} />
            </div>
          </FilterBar>

          {error && <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-4 text-xs text-[var(--app-danger)]">{error}</div>}

          {loading && !data ? <LoadingState message={text.loadingTraffic} /> : data && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label={text.inbound} value={number.format(data.totalInboundMessages)} subtext={activeRangeLabel} tone="accent" />
                <MetricCard label={text.conversations} value={number.format(data.totalConversations)} subtext={text.inboundDetail} />
                <MetricCard label={text.perConversation} value={data.messagesPerConversation.toFixed(2)} subtext={text.intensity} />
                <MetricCard label={text.peakHour} value={data.overallPeakHour.window} subtext={`${number.format(data.overallPeakHour.count)} ${text.messagesPeak}`} tone="info" />
                <MetricCard label={text.busiestDay} value={busiestDay ? dayLabel(busiestDay.dayOfWeek, language) : "—"} subtext={busiestDay ? `${number.format(busiestDay.count)} ${text.messages}` : text.noTraffic} />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <Card><CardHeader><CardTitle>{text.hourly}</CardTitle></CardHeader><CardContent><HourlyBars items={data.hourlyDistribution} formatter={number} /></CardContent></Card>
                <Card><CardHeader><CardTitle>{text.weekday}</CardTitle></CardHeader><CardContent><div className="space-y-3">{[...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count).map((item, index) => <div key={item.dayOfWeek} className="flex items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] pb-2 last:border-0"><div className="flex items-center gap-2"><span className="w-5 text-xs font-tabular text-[var(--app-text-tertiary)]">{index + 1}.</span><span className="text-xs font-medium">{dayLabel(item.dayOfWeek, language)}</span></div><span className="text-xs font-tabular font-semibold">{number.format(item.count)}</span></div>)}</div></CardContent></Card>
              </section>

              <section>
                <div className="mb-3"><h2 className="text-base font-semibold">{text.ranking}</h2><p className="mt-1 text-xs text-[var(--app-text-secondary)]">{text.rankingDesc}</p></div>
                <TableContainer>
                  <Table>
                    <TableHeader><tr><TableHead>{text.rank}</TableHead><TableHead>{text.store}</TableHead><TableHead align="right">{text.inboundColumn}</TableHead><TableHead align="right">{text.conversationsColumn}</TableHead><TableHead align="right">{text.msgConv}</TableHead><TableHead>{text.peakHour}</TableHead><TableHead align="right">{text.peakVolume}</TableHead></tr></TableHeader>
                    <TableBody>
                      {data.topStores.length === 0 ? <TableEmptyState colSpan={7} message={text.noInbound} /> : data.topStores.map((store) => (
                        <TableRow key={store.storeId}>
                          <TableCell numeric>{store.rank}</TableCell>
                          <TableCell><div className="font-medium">{store.storeName}</div>{store.externalStoreId && <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{store.externalStoreId}</div>}</TableCell>
                          <TableCell align="right" numeric className="font-semibold">{number.format(store.inboundMessages)}</TableCell>
                          <TableCell align="right" numeric>{number.format(store.distinctConversations)}</TableCell>
                          <TableCell align="right" numeric>{store.messagesPerConversation.toFixed(2)}</TableCell>
                          <TableCell>{store.peakHour.window}</TableCell>
                          <TableCell align="right" numeric>{number.format(store.peakHour.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </section>
            </>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
