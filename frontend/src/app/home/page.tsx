"use client";

// หน้าหลัก: always the current month. Four KPIs with their comparison, the stores to check, one
// data-health line and three shortcuts. Every number comes from the metrics layer (the same
// functions as the Dashboard, Store 360, /chats and the sidebar badge; docs/metrics-registry.md).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/app/language";
import { languageLocale, type AppLanguage } from "@/app/language-utils";
import { TargetText } from "@/components/metrics/kpi-ui";
import { DeltaValue, StateValue } from "@/components/metrics/value-ui";
import { AppShell } from "@/components/shell";
import { useChatsUnrepliedBadge } from "@/components/shell/chats-unreplied-badge";
import { api } from "@/lib/api";
import { KPI_TARGETS, RATE24_TARGET } from "@/lib/metrics/kpi";
import { chatsHref, DASHBOARD_STORES_HREF, kpiReportHref, store360Href } from "@/lib/metrics/links";
import { currentMonth, monthLongLabel, periodDaysLabel, periodLabel } from "@/lib/metrics/month";
import { storesToWatch } from "@/lib/metrics/store-model";
import { storeScopeText } from "@/lib/metrics/store-scope";
import { systemProblems } from "@/lib/metrics/system-health";
import { v2Text } from "@/lib/metrics/translations";
import { useMonthlyFollowers, type FollowerGrowth } from "@/lib/metrics/use-monthly-followers";
import { useMonthlyMetrics, type Source } from "@/lib/metrics/use-monthly-metrics";
import { countState, deltaState, MIN_RATE_SAMPLE, type ValueState } from "@/lib/metrics/value-state";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "ASSISTANT" | "VIEWER" };
type SystemStatus = Awaited<ReturnType<typeof api.systemStatus>>;

function dateTime(iso: string, language: AppLanguage): string {
  return new Intl.DateTimeFormat(`${languageLocale(language)}-u-ca-gregory`, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

/** A follower growth source as value states (net and its change). */
function followerStates(current: Source<FollowerGrowth>, previous: Source<FollowerGrowth>, available: boolean): { net: ValueState; delta: ValueState } {
  const state = (source: Source<FollowerGrowth>): ValueState => (!available ? { kind: "not-collected" } : countState(source.data?.net ?? null, { loading: source.loading && !source.data, error: source.data ? null : source.error }));
  const net = state(current);
  return { net, delta: deltaState(net, state(previous)) };
}

function KpiTile({ label, href, children, footer }: { label: string; href: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Link href={href} data-home-kpi className="flex min-w-0 flex-col gap-1 rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] transition hover:border-[var(--app-accent)]/40 hover:bg-[var(--app-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40">
      <span className="text-xs font-medium text-[var(--app-text-secondary)]">{label}</span>
      <span className="text-2xl font-semibold tracking-[-0.02em] text-[var(--app-text-primary)] sm:text-[28px]">{children}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-text-secondary)]">{footer}</span>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
  const t = v2Text(language);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const month = useMemo(() => currentMonth(), []);
  const data = useMonthlyMetrics(month, { enabled: Boolean(authUser) });
  const followers = useMonthlyFollowers({ current: data.frame.current, previous: data.frame.previousCollected ? data.frame.previous : null, nonce: data.nonce, now: data.now, parts: { growth: Boolean(authUser), previous: Boolean(authUser) } });
  // The sidebar badge's number: the same cached request and the same unrepliedCount function.
  const badge = useChatsUnrepliedBadge(Boolean(authUser));

  const loadStatus = useCallback(async (user: AuthUser) => {
    try {
      setSystemStatus(await api.systemStatus());
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
    if (user.role !== "ADMIN") return;
    // The latest chat sync (ADMIN only, as on LINE Chat Health).
    try {
      const response = await fetch("/api-backend/operations/line-chat-nickname/mirror-status", { credentials: "include", cache: "no-store" });
      if (!response.ok) return;
      const rows = ((await response.json()) as { stores: Array<{ lastSuccessfulSyncAt: string | null }> }).stores;
      const latest = rows.map((row) => row.lastSuccessfulSyncAt).filter((value): value is string => Boolean(value)).sort().pop() ?? null;
      setLastSync(latest);
    } catch { /* the line falls back to the last message received */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.me()
      .then((user) => {
        if (cancelled) return;
        setAuthUser(user);
        void loadStatus(user);
      })
      .catch(() => { if (!cancelled) router.replace("/login"); });
    return () => { cancelled = true; };
  }, [loadStatus, router]);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { router.replace("/login"); }
  }, [router]);

  if (!authUser) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">{t("homeLoading")}</main>;
  }

  const locale = languageLocale(language);
  const previousLabel = periodLabel(data.frame.previous, language);
  const problems = systemStatus ? systemProblems(systemStatus) : [];
  const follower = followerStates(followers.growth, followers.previousGrowth, followers.days !== null);
  const watch = storesToWatch(data.storeRows);
  const syncText = lastSync ? t("dataHealthSync", { time: dateTime(lastSync, language) }) : systemStatus?.lastValidWebhookReceived ? t("dataHealthWebhook", { time: dateTime(systemStatus.lastValidWebhookReceived, language) }) : null;
  const versus = <span>{t("versusPeriod", { period: previousLabel })}</span>;

  return (
    <AppShell
      currentSection="home"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", retry: t("refresh") }}
      language={language}
      changeLanguage={setLanguage}
      searchText={searchText}
      setSearchText={setSearchText}
      pilotMode={systemStatus?.pilotMode}
      lastUpdatedAt={new Date(data.now)}
      logout={logout}
      isLoading={data.coreLoading}
      apiError={data.current.error}
      loadApplicationData={() => { data.refresh(); void loadStatus(authUser); }}
    >
      <main data-home className="min-w-0 flex-1 bg-[var(--app-bg)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px] space-y-6">
          {problems.length > 0 && (
            <div role="alert" data-home-system-banner className="rounded-[var(--app-radius-lg)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--app-danger)]">
              {t("systemProblemBanner", { parts: problems.map((part) => t(part === "backend" ? "systemPartBackend" : part === "database" ? "systemPartDatabase" : "systemPartWebhook")).join(" · ") })}
              {" "}<Link href="/operations/line-chat-health" className="underline">{t("dataHealthLink")}</Link>
            </div>
          )}

          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--app-text-primary)] sm:text-[30px]">{t("homeTitle", { month: `${monthLongLabel(month, language)} · ${periodDaysLabel(data.frame.current, language)}` })}</h1>
              <p className="mt-1.5 text-sm text-[var(--app-text-secondary)]">{t("homeDescription", { previous: previousLabel })}</p>
            </div>
            <nav aria-label={t("shortcutsLabel")} data-home-shortcuts className="flex flex-wrap gap-2">
              <Link href={`/chats?month=${encodeURIComponent(month)}`} className="inline-flex h-10 items-center gap-2 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-sm)] hover:bg-[var(--app-surface-hover)]">
                {t("shortcutChats")}
                {badge !== null && badge > 0 && <span data-home-chats-badge aria-label={t("unrepliedBadgeLabel", { count: badge.toLocaleString(locale) })} className="rounded-full bg-[var(--app-danger-soft)] px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--app-danger)]">{badge.toLocaleString(locale)}</span>}
              </Link>
              <Link href={kpiReportHref(month)} className="inline-flex h-10 items-center rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-sm)] hover:bg-[var(--app-surface-hover)]">{t("shortcutKpiReport")}</Link>
              <Link href="/dashboard" className="inline-flex h-10 items-center rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] shadow-[var(--app-shadow-sm)] hover:bg-[var(--app-surface-hover)]">{t("shortcutDashboard")}</Link>
            </nav>
          </header>

          <section aria-label={t("homeKpis")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label={t("repliedRate")} href="/dashboard" footer={<>{versus}<DeltaValue state={data.network.replyRateDelta} kind="points" worseWhen="down" /><TargetText kpi="replied" value={data.network.replyRate} /></>}>
              <StateValue state={data.network.replyRate} format="percent" target={KPI_TARGETS.replied ?? undefined} showN />
            </KpiTile>
            <KpiTile label={t("rate24")} href="/dashboard" footer={<>{versus}<DeltaValue state={data.network.rate24Delta} kind="points" worseWhen="down" /><TargetText kpi="rate24" value={data.network.rate24} /></>}>
              <StateValue state={data.network.rate24} format="percent" target={RATE24_TARGET ?? undefined} showN />
            </KpiTile>
            <KpiTile label={t("unrepliedThisMonth")} href={`/chats?month=${encodeURIComponent(month)}`} footer={<>{versus}<DeltaValue state={data.network.unrepliedDelta} kind="count" worseWhen="up" />{data.network.chats.kind === "value" && <span>{t("chatsInMonth", { count: data.network.chats.value.toLocaleString(locale) })}</span>}</>}>
              <span data-home-unreplied><StateValue state={data.network.unreplied} /></span>
            </KpiTile>
            <KpiTile label={t("followersNetThisMonth")} href="/dashboard" footer={followers.days ? <>{versus}<DeltaValue state={follower.delta} kind="count" worseWhen="down" /></> : <span>{t("followersNoSnapshot")}</span>}>
              <span data-home-followers-net><StateValue state={follower.net} signed /></span>
            </KpiTile>
          </section>

          <section aria-labelledby="home-stores-to-watch" data-home-stores-to-watch className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)] sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="home-stores-to-watch" className="text-base font-bold text-[var(--app-text-primary)]">{t("storesToWatch")}</h2>
              <Link href={DASHBOARD_STORES_HREF} className="text-sm font-semibold text-[var(--app-accent)] hover:underline">{t("allStoresLink")}</Link>
            </div>
            <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t("storesToWatchNote", { min: MIN_RATE_SAMPLE })}</p>
            {data.coreLoading ? (
              <p className="mt-3 text-sm text-[var(--app-text-secondary)]">{t("loadingEllipsis")}</p>
            ) : watch.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--app-text-secondary)]">{data.current.error ? t("chatCountLabelError", { error: data.current.error }) : t("storesToWatchEmpty")}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[11px] text-[var(--app-text-secondary)]">
                    <tr className="border-b border-[var(--app-border)]">
                      <th scope="col" className="px-2 py-2 font-medium">{t("storeName")}</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{t("unanswered")}</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{t("rate24")} (n)</th>
                      <th scope="col" className="px-2 py-2 text-right font-medium">{t("rate24DeltaColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {watch.map((row) => (
                      <tr key={row.storeId} data-home-watch-row={row.storeId}>
                        <th scope="row" className="max-w-[20rem] px-2 py-2.5 text-left font-medium">
                          <Link href={store360Href(row.storeId, month)} className="block truncate text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline" title={row.storeName}>{row.storeName}</Link>
                        </th>
                        <td className="px-2 py-2.5 text-right">
                          <Link href={chatsHref({ storeId: row.storeId, month, unrepliedOnly: true })} className="font-semibold text-[var(--app-text-primary)] hover:underline"><StateValue state={row.unreplied} /></Link>
                        </td>
                        <td className="px-2 py-2.5 text-right"><StateValue state={row.rate24} format="percent" target={RATE24_TARGET ?? undefined} showN /></td>
                        <td className="px-2 py-2.5 text-right"><DeltaValue state={row.rate24Delta} kind="points" worseWhen="down" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p data-home-data-health className="text-xs text-[var(--app-text-secondary)]">
            <Link href="/operations/line-chat-health" className="hover:text-[var(--app-text-primary)] hover:underline">
              {[
                data.stores.data && data.current.data ? storeScopeText(data.coverage, language) : null,
                syncText,
                systemStatus ? (problems.length === 0 ? t("systemNormal") : null) : statusError ? t("systemStatusUnknown") : null,
              ].filter(Boolean).join(" · ")}
            </Link>
          </p>
        </div>
      </main>
    </AppShell>
  );
}
