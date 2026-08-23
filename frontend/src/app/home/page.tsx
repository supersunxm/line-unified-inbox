"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell";
import { api } from "@/lib/api";
import type { BmReplyStatusSummaryResponse, DashboardAnalyticsResponse } from "@/types/api";

type Language = "th" | "en" | "zh";
type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type SystemStatus = Awaited<ReturnType<typeof api.systemStatus>>;
type ExecutiveHealth = { connectedStoreCount: number; totalStoreCount: number };
type Tone = "green" | "red" | "amber" | "purple" | "neutral";
type ModuleIcon = "chat" | "dashboard" | "followers" | "traffic" | "stores" | "purchase" | "broadcast" | "approval" | "coupon" | "tiktok";

const UI_PREFERENCES_STORAGE_KEY = "oppo-line-oa-monitor-ui-preferences";

const copy = {
  th: {
    eyebrow: "OPPO LINE OA · MAIN WORKSPACE",
    title: "ภาพรวมการทำงาน",
    subtitle: "ดูสถานะเครือข่าย งานที่ต้องจัดการ และทางลัดไปยังเครื่องมือสำคัญจากหน้าเดียว",
    updated: "อัปเดตล่าสุด",
    search: "ค้นหาลูกค้า ร้านค้า หรือข้อความ",
    network: "ภาพรวมเครือข่าย",
    totalStores: "ร้านค้าทั้งหมด",
    connected: "เชื่อมต่อแล้ว",
    unreplied: "ยังไม่ตอบ",
    followers: "ผู้ติดตามรวม",
    needsAttention: "ต้องจัดการ",
    needsAttentionHint: "รายการที่ควรตรวจสอบก่อน เพื่อให้การทำงานของเครือข่ายเป็นปกติ",
    openChats: "เปิด Store Chats",
    review: "ตรวจสอบ",
    manage: "จัดการ",
    viewDashboard: "ดู Dashboard",
    noUrgent: "ยังไม่มีรายการเร่งด่วนที่ต้องจัดการ",
    unrepliedMessages: "ข้อความลูกค้ายังไม่ได้รับการตอบกลับ",
    bmPending: "คำขอ BM รอการอนุมัติ",
    oaIssues: "LINE OA มีปัญหาการเชื่อมต่อ",
    dataQuality: "ความสมบูรณ์ของข้อมูล",
    today: "วันนี้",
    messages: "ข้อความเข้า",
    responseRate: "อัตราตอบกลับภายใน 24 ชม.",
    peakTime: "ช่วงเวลาพีค",
    followerNet: "ผู้ติดตามสุทธิ",
    quickAccess: "ทางลัด",
    quickAccessHint: "ไปยังงานหลักของระบบโดยไม่ต้องไล่หาเมนู",
    system: "สถานะระบบ",
    backend: "Backend API",
    database: "Database",
    webhook: "LINE Webhook",
    lineOa: "LINE OA",
    healthy: "ปกติ",
    attention: "ควรตรวจสอบ",
    enabled: "เปิดใช้งาน",
    disabled: "ปิดใช้งาน",
    retry: "ลองใหม่",
    loading: "กำลังโหลดภาพรวม...",
    error: "ไม่สามารถโหลดหน้า Main ได้",
    chats: "Store Chats",
    dashboard: "Dashboard",
    followerInsights: "Follower Insights",
    traffic: "Message Traffic",
    stores: "จัดการร้านค้า",
    purchase: "ข้อมูลการซื้อ",
    mass: "ส่งข้อความ",
    approval: "อนุมัติ BM",
    coupons: "คูปอง",
    tiktok: "TikTok",
  },
  en: {
    eyebrow: "OPPO LINE OA · MAIN WORKSPACE",
    title: "Operations overview",
    subtitle: "See network status, work that needs attention, and shortcuts to key tools from one place.",
    updated: "Last updated",
    search: "Search customers, stores, or messages",
    network: "Network overview",
    totalStores: "Total stores",
    connected: "Connected",
    unreplied: "Unreplied",
    followers: "Total followers",
    needsAttention: "Needs attention",
    needsAttentionHint: "Review these items first to keep network operations healthy.",
    openChats: "Open Store Chats",
    review: "Review",
    manage: "Manage",
    viewDashboard: "View Dashboard",
    noUrgent: "No urgent items need attention right now.",
    unrepliedMessages: "Customer messages are still unreplied",
    bmPending: "BM requests are waiting for approval",
    oaIssues: "LINE OA connections need attention",
    dataQuality: "Data quality",
    today: "Today",
    messages: "Inbound messages",
    responseRate: "24h response rate",
    peakTime: "Peak time",
    followerNet: "Net followers",
    quickAccess: "Quick access",
    quickAccessHint: "Jump directly to the system's main work areas.",
    system: "System status",
    backend: "Backend API",
    database: "Database",
    webhook: "LINE Webhook",
    lineOa: "LINE OA",
    healthy: "Healthy",
    attention: "Attention",
    enabled: "Enabled",
    disabled: "Disabled",
    retry: "Retry",
    loading: "Loading overview...",
    error: "Unable to load Main workspace",
    chats: "Store Chats",
    dashboard: "Dashboard",
    followerInsights: "Follower Insights",
    traffic: "Message Traffic",
    stores: "Store Management",
    purchase: "Purchase Intelligence",
    mass: "Mass Message",
    approval: "BM Approval",
    coupons: "Coupons",
    tiktok: "TikTok",
  },
  zh: {
    eyebrow: "OPPO LINE OA · MAIN WORKSPACE",
    title: "运营总览",
    subtitle: "在一个页面查看网络状态、待处理事项以及主要工具入口。",
    updated: "最后更新",
    search: "搜索客户、门店或消息",
    network: "网络总览",
    totalStores: "门店总数",
    connected: "已连接",
    unreplied: "未回复",
    followers: "总关注者",
    needsAttention: "需要处理",
    needsAttentionHint: "优先检查以下事项，确保门店网络正常运行。",
    openChats: "打开门店聊天",
    review: "检查",
    manage: "管理",
    viewDashboard: "查看仪表盘",
    noUrgent: "目前没有紧急事项需要处理。",
    unrepliedMessages: "客户消息尚未回复",
    bmPending: "BM 申请等待审批",
    oaIssues: "LINE OA 连接需要检查",
    dataQuality: "数据完整性",
    today: "今天",
    messages: "收到消息",
    responseRate: "24 小时回复率",
    peakTime: "高峰时段",
    followerNet: "净增关注者",
    quickAccess: "快捷入口",
    quickAccessHint: "直接进入系统主要工作区域。",
    system: "系统状态",
    backend: "Backend API",
    database: "Database",
    webhook: "LINE Webhook",
    lineOa: "LINE OA",
    healthy: "正常",
    attention: "需检查",
    enabled: "已启用",
    disabled: "已停用",
    retry: "重试",
    loading: "正在加载总览...",
    error: "无法加载主页",
    chats: "门店聊天",
    dashboard: "仪表盘",
    followerInsights: "关注者洞察",
    traffic: "消息流量",
    stores: "门店管理",
    purchase: "购买洞察",
    mass: "群发消息",
    approval: "BM 审批",
    coupons: "优惠券",
    tiktok: "TikTok",
  },
} as const;

function ModuleGlyph({ type }: { type: ModuleIcon }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      {type === "chat" && <><path {...common} d="M4 5h13a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-5 3v-3a3 3 0 0 1-2-3V8a3 3 0 0 1 2-3Z"/><path {...common} d="M7 11h.01M11 11h.01M15 11h.01"/></>}
      {type === "dashboard" && <><rect {...common} x="3" y="3" width="7" height="7" rx="1.5"/><rect {...common} x="14" y="3" width="7" height="7" rx="1.5"/><rect {...common} x="3" y="14" width="7" height="7" rx="1.5"/><rect {...common} x="14" y="14" width="7" height="7" rx="1.5"/></>}
      {type === "followers" && <><circle {...common} cx="9" cy="8" r="3"/><path {...common} d="M3.5 19c.6-4 2.5-6 5.5-6 2 0 3.7.9 4.7 2.7"/><path {...common} d="M17 19v-6m3 6v-9"/></>}
      {type === "traffic" && <><path {...common} d="M2 12c2.2-3.5 4.2-3.5 6.3 0s4.2 3.5 6.4 0 4.2-3.5 7 0"/><path {...common} d="M2 17c2.2-3.5 4.2-3.5 6.3 0s4.2 3.5 6.4 0"/></>}
      {type === "stores" && <><path {...common} d="M4 9h16l-1.5-4h-13L4 9Z"/><path {...common} d="M5 10v9h14v-9M9 19v-5h6v5"/></>}
      {type === "purchase" && <><path {...common} d="M7 8h10l1 12H6L7 8Z"/><path {...common} d="M9 8c0-3 1.2-5 3-5s3 2 3 5M9 15h6"/></>}
      {type === "broadcast" && <><path {...common} d="M3 10v4l11 4V6L3 10Z"/><path {...common} d="m17 8 3-2m-2 6h4m-5 4 3 2"/></>}
      {type === "approval" && <><path {...common} d="M12 3c3 2.5 6 2.7 8 3v5.5c0 4.5-2.7 7.7-8 9.5-5.3-1.8-8-5-8-9.5V6c2-.3 5-.5 8-3Z"/><path {...common} d="m8.5 12 2.2 2.2 4.8-5"/></>}
      {type === "coupon" && <><path {...common} d="M4 6h16v3a2.5 2.5 0 0 0 0 5v4H4v-4a2.5 2.5 0 0 0 0-5V6Z"/><path {...common} d="m16 9-8 7"/></>}
      {type === "tiktok" && <><path {...common} d="M13 4v10a4.5 4.5 0 1 1-4-4.5"/><path {...common} d="M13 4c1.6 2.8 3.7 4 6 4.3"/></>}
    </svg>
  );
}

function toneClasses(tone: Tone) {
  if (tone === "green") return "bg-[var(--app-success-soft)] text-[var(--app-success)]";
  if (tone === "red") return "bg-[var(--app-danger-soft)] text-[var(--app-danger)]";
  if (tone === "amber") return "bg-[var(--app-warning-soft)] text-[var(--app-warning)]";
  if (tone === "purple") return "bg-purple-500/10 text-purple-600 dark:text-purple-300";
  return "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]";
}

function StatCard({ label, value, helper, tone = "neutral" }: { label: string; value: string; helper?: string; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
      <div className="text-xs font-medium text-[var(--app-text-secondary)]">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-bold tracking-[-0.03em] text-[var(--app-text-primary)] sm:text-[28px]">{value}</div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone === "green" ? "bg-[var(--app-success)]" : tone === "red" ? "bg-[var(--app-danger)]" : tone === "amber" ? "bg-[var(--app-warning)]" : tone === "purple" ? "bg-purple-500" : "bg-[var(--app-border-strong)]"}`} />
      </div>
      {helper && <div className="mt-1.5 text-[11px] text-[var(--app-text-tertiary)]">{helper}</div>}
    </div>
  );
}

function AttentionItem({ label, value, href, action, tone }: { label: string; value: string; href: string; action: string; tone: Tone }) {
  return (
    <Link href={href} className="group flex items-center gap-3 border-b border-[var(--app-border-subtle)] px-1 py-3.5 last:border-0 hover:bg-[var(--app-surface-hover)] sm:px-2">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses(tone)}`}><span className="h-2.5 w-2.5 rounded-full bg-current" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--app-text-primary)]">{value}</div>
        <div className="mt-0.5 text-xs text-[var(--app-text-secondary)]">{label}</div>
      </div>
      <span className="shrink-0 text-xs font-semibold text-[var(--app-accent)] group-hover:underline">{action} →</span>
    </Link>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] py-3 last:border-0">
      <span className="text-xs text-[var(--app-text-secondary)]">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ok ? "text-[var(--app-success)]" : "text-[var(--app-danger)]"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />{value}
      </span>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("th");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [bmSummary, setBmSummary] = useState<BmReplyStatusSummaryResponse | null>(null);
  const [health, setHealth] = useState<ExecutiveHealth | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const t = copy[language];

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { language?: Language };
        if (parsed.language === "th" || parsed.language === "en" || parsed.language === "zh") setLanguage(parsed.language);
      }
    } catch { /* keep Thai default */ }
  }, []);

  const load = useCallback(async (user: AuthUser) => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsData, bmData, healthResponse, statusData, approvalData] = await Promise.all([
        api.dashboardAnalytics("today"),
        api.bmReplyStatusSummary(),
        fetch("/api-backend/dashboard/executive-store-health?period=today", { credentials: "include", cache: "no-store" }),
        api.systemStatus(),
        user.role === "ADMIN" ? api.getPendingRegistrations() : Promise.resolve(null),
      ]);
      if (!healthResponse.ok) throw new Error(`Executive health request failed (${healthResponse.status})`);
      setAnalytics(analyticsData);
      setBmSummary(bmData);
      setHealth((await healthResponse.json()) as ExecutiveHealth);
      setSystemStatus(statusData);
      setPendingApprovals(Array.isArray(approvalData) ? approvalData.length : null);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Main workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.me()
      .then((user) => {
        if (cancelled) return;
        setAuthUser(user);
        setAuthChecked(true);
        void load(user);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthChecked(true);
        router.replace("/login");
      });
    return () => { cancelled = true; };
  }, [load, router]);

  const changeLanguage = useCallback((nextLanguage: Language) => {
    setLanguage(nextLanguage);
    try {
      const raw = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
      const current = raw ? JSON.parse(raw) as Record<string, unknown> : {};
      window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...current, language: nextLanguage }));
    } catch {
      window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify({ language: nextLanguage }));
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { router.replace("/login"); }
  }, [router]);

  const connectedRate = health && health.totalStoreCount > 0 ? Math.round((health.connectedStoreCount / health.totalStoreCount) * 100) : 0;
  const unreplied = bmSummary?.overview.notReplied ?? 0;
  const follower = analytics?.summaryCards.followerGrowth;
  const dataHealthy = analytics?.dataQuality.status === "Healthy";
  const urgentCount = unreplied + (pendingApprovals ?? 0) + (systemStatus?.lineOaIssueCount ?? 0) + (dataHealthy === false ? 1 : 0);

  const quickLinks = useMemo(() => {
    const items: Array<{ href: string; label: string; icon: ModuleIcon; adminOnly?: boolean }> = [
      { href: "/chats", label: t.chats, icon: "chat" },
      { href: "/dashboard", label: t.dashboard, icon: "dashboard" },
      { href: "/follower-insights", label: t.followerInsights, icon: "followers" },
      { href: "/dashboard/message-traffic", label: t.traffic, icon: "traffic" },
      { href: "/stores", label: t.stores, icon: "stores" },
      { href: "/admin/purchase-analytics", label: t.purchase, icon: "purchase" },
      { href: "/mass-messages", label: t.mass, icon: "broadcast", adminOnly: true },
      { href: "/admin/registrations", label: t.approval, icon: "approval", adminOnly: true },
      { href: "/coupons", label: t.coupons, icon: "coupon", adminOnly: true },
      { href: "/tiktok", label: t.tiktok, icon: "tiktok", adminOnly: true },
    ];
    return items.filter((item) => !item.adminOnly || authUser?.role === "ADMIN");
  }, [authUser?.role, t]);

  if (!authChecked || !authUser) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t.loading}</main>;
  }

  return (
    <AppShell
      currentSection="home"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: t.subtitle, searchPlaceholder: t.search, lastUpdated: t.updated, loadingData: t.loading, apiError: t.error, retry: t.retry }}
      language={language}
      changeLanguage={changeLanguage}
      searchText={searchText}
      setSearchText={setSearchText}
      pilotMode={systemStatus?.pilotMode}
      lastUpdatedAt={lastUpdatedAt}
      logout={logout}
      isLoading={loading && Boolean(analytics)}
      apiError={error}
      loadApplicationData={() => load(authUser)}
    >
      <main className="min-w-0 flex-1 bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{t.eyebrow}</div>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[var(--app-text-primary)] sm:text-[30px]">{t.title}</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--app-text-secondary)]">{t.subtitle}</p>
            </div>
            <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-sm)] transition hover:bg-[var(--app-surface-hover)]">
              {t.viewDashboard} →
            </Link>
          </div>

          <section aria-labelledby="network-overview">
            <div id="network-overview" className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">{t.network}</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label={t.totalStores} value={(health?.totalStoreCount ?? analytics?.dataQuality.storeCount ?? 0).toLocaleString()} helper={t.network} />
              <StatCard label={t.connected} value={`${(health?.connectedStoreCount ?? 0).toLocaleString()} / ${(health?.totalStoreCount ?? 0).toLocaleString()}`} helper={`${connectedRate}%`} tone={connectedRate >= 90 ? "green" : "amber"} />
              <StatCard label={t.unreplied} value={unreplied.toLocaleString()} helper={t.unrepliedMessages} tone={unreplied > 0 ? "red" : "green"} />
              <StatCard label={t.followers} value={(follower?.totalFriends ?? 0).toLocaleString()} helper={follower ? `${follower.netToday >= 0 ? "+" : ""}${follower.netToday.toLocaleString()} ${t.today}` : undefined} tone="green" />
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.75fr]">
            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.needsAttention}</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{t.needsAttentionHint}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${urgentCount > 0 ? "bg-[var(--app-danger-soft)] text-[var(--app-danger)]" : "bg-[var(--app-success-soft)] text-[var(--app-success)]"}`}>{urgentCount.toLocaleString()}</span>
              </div>
              <div className="mt-3">
                {urgentCount === 0 ? (
                  <div className="flex min-h-28 items-center justify-center rounded-xl bg-[var(--app-success-soft)] px-4 text-center text-sm font-medium text-[var(--app-success)]">{t.noUrgent}</div>
                ) : (
                  <>
                    {unreplied > 0 && <AttentionItem label={t.unrepliedMessages} value={`${unreplied.toLocaleString()} ${t.unreplied}`} href="/chats" action={t.openChats} tone="red" />}
                    {authUser.role === "ADMIN" && (pendingApprovals ?? 0) > 0 && <AttentionItem label={t.bmPending} value={`${pendingApprovals?.toLocaleString()} ${t.approval}`} href="/admin/registrations" action={t.review} tone="amber" />}
                    {(systemStatus?.lineOaIssueCount ?? 0) > 0 && <AttentionItem label={t.oaIssues} value={`${systemStatus?.lineOaIssueCount.toLocaleString()} LINE OA`} href="/stores" action={t.manage} tone="amber" />}
                    {dataHealthy === false && <AttentionItem label={t.dataQuality} value={analytics?.dataQuality.status ?? t.attention} href="/dashboard" action={t.review} tone="purple" />}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
              <h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.system}</h2>
              <div className="mt-3">
                <StatusRow label={t.backend} value={systemStatus?.backendApi ?? "—"} ok={(systemStatus?.backendApi ?? "").toLowerCase().includes("ok") || (systemStatus?.backendApi ?? "").toLowerCase().includes("healthy")} />
                <StatusRow label={t.database} value={systemStatus?.database ?? "—"} ok={(systemStatus?.database ?? "").toLowerCase().includes("ok") || (systemStatus?.database ?? "").toLowerCase().includes("healthy")} />
                <StatusRow label={t.webhook} value={systemStatus?.lineWebhookEnabled ? t.enabled : t.disabled} ok={Boolean(systemStatus?.lineWebhookEnabled)} />
                <StatusRow label={t.lineOa} value={`${systemStatus?.connectedLineOaCount ?? 0} / ${systemStatus?.activeLineOaCount ?? 0}`} ok={(systemStatus?.lineOaIssueCount ?? 0) === 0} />
              </div>
            </section>
          </div>

          <section className="mt-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-tertiary)]">{t.today}</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label={t.messages} value={(analytics?.summaryCards.messagesToday ?? 0).toLocaleString()} helper={analytics ? `${analytics.summaryCards.messagesDiffPct >= 0 ? "+" : ""}${analytics.summaryCards.messagesDiffPct}%` : undefined} tone="green" />
              <StatCard label={t.responseRate} value={`${analytics?.summaryCards.responseRate24h ?? 0}%`} helper={analytics ? `${analytics.summaryCards.repliedCount.toLocaleString()} ${t.unreplied === "Unreplied" ? "replied" : language === "zh" ? "已回复" : "ตอบแล้ว"}` : undefined} tone={(analytics?.summaryCards.responseRate24h ?? 0) >= 80 ? "green" : "amber"} />
              <StatCard label={t.peakTime} value={analytics?.peakHourAnalysis.peakWindow ?? "—"} helper={analytics ? `${analytics.peakHourAnalysis.peakTrafficCount.toLocaleString()} ${t.messages}` : undefined} tone="purple" />
              <StatCard label={t.followerNet} value={follower ? `${follower.netToday >= 0 ? "+" : ""}${follower.netToday.toLocaleString()}` : "—"} helper={follower ? `${follower.addedToday.toLocaleString()} + / ${follower.blockedToday.toLocaleString()} −` : undefined} tone={(follower?.netToday ?? 0) >= 0 ? "green" : "red"} />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5">
            <div>
              <h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.quickAccess}</h2>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.quickAccessHint}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} className="group flex min-h-24 flex-col justify-between rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] p-3.5 transition hover:-translate-y-0.5 hover:border-[var(--app-accent)]/30 hover:bg-[var(--app-accent-soft)]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-accent)] shadow-[var(--app-shadow-sm)]"><ModuleGlyph type={item.icon} /></span>
                  <span className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--app-text-primary)]"><span className="truncate">{item.label}</span><span className="text-[var(--app-text-tertiary)] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-accent)]">→</span></span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
