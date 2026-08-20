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

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type Period = "today" | "7d" | "30d";
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
  period: Period;
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

const number = new Intl.NumberFormat("en-US");

async function fetchTraffic(period: Period): Promise<MessageTrafficResponse> {
  const response = await fetch(`/api-backend/dashboard/message-traffic?period=${period}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<MessageTrafficResponse>;
}

function HourlyBars({ items }: { items: HourBucket[] }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.hour} className="grid grid-cols-[46px_1fr_64px] items-center gap-3 text-xs">
          <span className="font-tabular text-[var(--app-text-secondary)]">{String(item.hour).padStart(2, "0")}:00</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--app-accent)]"
              style={{ width: `${Math.max(item.count > 0 ? 2 : 0, (item.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-right font-tabular font-medium">{number.format(item.count)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MessageTrafficPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<MessageTrafficResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selectedPeriod: Period = period) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTraffic(selectedPeriod));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load message traffic analytics.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.me();
        setAuthUser(user);
        await load("30d");
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
  }, []);

  const busiestDay = useMemo(() => {
    if (!data?.dayOfWeekDistribution.length) return null;
    return [...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count)[0];
  }, [data]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  if (!authChecked) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]"><LoadingState message="Loading…" /></main>;
  }

  if (!authUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6">
        <Card className="max-w-md text-center">
          <h1 className="text-xl font-bold">Authentication required</h1>
          <p className="mt-2 text-xs text-[var(--app-text-secondary)]">Please sign in to view message traffic analytics.</p>
        </Card>
      </main>
    );
  }

  return (
    <AppShell
      currentSection="dashboard"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE OA monitoring", language: "Language", loadingData: "Loading…", retry: "Retry", apiError: "Data service error" }}
      language="en"
      changeLanguage={() => undefined}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      <PageContainer variant="wide">
        <div className="space-y-6">
          <PageHeader
            tag="Analytics · Customer Message Traffic"
            title="Message Traffic Analytics"
            description="Inbound LINE messages by store, time of day, and conversation volume. Timezone: Asia/Bangkok."
            actions={<Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>Refresh</Button>}
          />

          <FilterBar>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--app-text-secondary)]">Period</span>
              {(["today", "7d", "30d"] as Period[]).map((value) => (
                <Button
                  key={value}
                  variant={period === value ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => { setPeriod(value); void load(value); }}
                  disabled={loading}
                >
                  {value === "today" ? "Today" : value === "7d" ? "Last 7 days" : "Last 30 days"}
                </Button>
              ))}
            </div>
          </FilterBar>

          {error && <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-4 text-xs text-[var(--app-danger)]">{error}</div>}

          {loading && !data ? <LoadingState message="Loading message traffic…" /> : data && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Inbound Messages" value={number.format(data.totalInboundMessages)} subtext={data.period === "today" ? "Today" : `Last ${data.period.replace("d", "")} days`} tone="accent" />
                <MetricCard label="Conversations" value={number.format(data.totalConversations)} subtext="Distinct conversations with inbound traffic" />
                <MetricCard label="Messages / Conversation" value={data.messagesPerConversation.toFixed(2)} subtext="Conversation intensity" />
                <MetricCard label="Peak Hour" value={data.overallPeakHour.window} subtext={`${number.format(data.overallPeakHour.count)} messages in peak hour`} tone="info" />
                <MetricCard label="Busiest Day" value={busiestDay?.day ?? "—"} subtext={busiestDay ? `${number.format(busiestDay.count)} messages` : "No traffic"} />
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <Card>
                  <CardHeader><CardTitle>Hourly inbound traffic</CardTitle></CardHeader>
                  <CardContent><HourlyBars items={data.hourlyDistribution} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Traffic by day of week</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[...data.dayOfWeekDistribution].sort((a, b) => b.count - a.count).map((item, index) => (
                        <div key={item.day} className="flex items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] pb-2 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-xs font-tabular text-[var(--app-text-tertiary)]">{index + 1}.</span>
                            <span className="text-xs font-medium">{item.day}</span>
                          </div>
                          <span className="text-xs font-tabular font-semibold">{number.format(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section>
                <div className="mb-3">
                  <h2 className="text-base font-semibold">Store ranking</h2>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">Ranked by actual inbound message count, not conversation creation count.</p>
                </div>
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead>Rank</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead align="right">Inbound</TableHead>
                        <TableHead align="right">Conversations</TableHead>
                        <TableHead align="right">Msg / Conv.</TableHead>
                        <TableHead>Peak Hour</TableHead>
                        <TableHead align="right">Peak Volume</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {data.topStores.length === 0 ? <TableEmptyState colSpan={7} message="No inbound messages in this period." /> : data.topStores.map((store) => (
                        <TableRow key={store.storeId}>
                          <TableCell numeric>{store.rank}</TableCell>
                          <TableCell>
                            <div className="font-medium">{store.storeName}</div>
                            {store.externalStoreId && <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{store.externalStoreId}</div>}
                          </TableCell>
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
