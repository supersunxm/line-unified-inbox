"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, PageContainer, PageHeader } from "@/components/shell";
import { Badge, Button, Card, CardContent, Modal, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "@/components/ui";
import { api, type LineChatOperationsHealth, type LineChatOperationsSession } from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import { useAppLanguage } from "../../language";
import { getOverallHealth } from "./line-chat-health-status";

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const tone = (value: string): "success" | "warning" | "danger" | "neutral" => value === "CONNECTED" || value === "ACTIVE" ? "success" : value === "UNKNOWN" ? "neutral" : value === "DEGRADED" ? "warning" : "danger";

function JobSummary({ session }: { session: LineChatOperationsSession }) {
  return <div className="flex flex-wrap gap-1.5"><Badge variant="success">{session.jobs.success} success</Badge><Badge variant={session.jobs.pending + session.jobs.processing ? "info" : "neutral"}>{session.jobs.pending} pending · {session.jobs.processing} running</Badge><Badge variant={session.jobs.failed + session.jobs.failedAuth ? "warning" : "neutral"}>{session.jobs.failed + session.jobs.failedAuth} failed</Badge><Badge variant="neutral">{session.jobs.superseded} superseded</Badge></div>;
}

export function LineChatHealthView() {
  const { language, setLanguage } = useAppLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [report, setReport] = useState<LineChatOperationsHealth | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<LineChatOperationsSession | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [authUser, health] = await Promise.all([api.me(), api.lineChatOperationsHealth()]);
      setUser(authUser as AuthUser); setReport(health);
      setSelectedKey((current) => current ?? health.sessions[0]?.sessionKey ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load LINE Chat health."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = useMemo(() => report?.sessions.find((item) => item.sessionKey === selectedKey) ?? null, [report, selectedKey]);

  const retry = async () => {
    if (!retryTarget) return;
    setRetrying(true); setError(null);
    try { const result = await api.retryLineChatFailedJobs(retryTarget.sessionKey); setNotice(`${result.retriedCount} failed jobs queued for ${retryTarget.sessionKey}.`); setRetryTarget(null); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Retry failed."); }
    finally { setRetrying(false); }
  };
  const logout = async () => { await api.logout().catch(() => undefined); window.location.replace("/login"); };

  return <AppShell currentSection="line-chat-health" authUser={user} language={language} changeLanguage={setLanguage} searchText="" setSearchText={() => undefined} logout={logout} text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE Chat operations health" }}>
    <PageContainer variant="wide">
      <PageHeader title="LINE Chat Operations Health" description="Session connectivity and job outcomes are evaluated independently." actions={<Button onClick={() => void load()} isLoading={loading}>Refresh health data</Button>} />
      {error && <div role="alert" className="rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-[var(--app-success)]/30 bg-[var(--app-success-soft)] p-3 text-sm text-[var(--app-success)]">{notice}</div>}
      <Card><CardContent className="p-0"><TableContainer><Table>
        <TableHeader><TableRow><TableHead>Account / session</TableHead><TableHead>Mapped OAs</TableHead><TableHead>Session</TableHead><TableHead>Health</TableHead><TableHead>Job summary</TableHead><TableHead>Last health check</TableHead><TableHead>Failure stage</TableHead><TableHead>Active leases</TableHead><TableHead>Overall</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>{report?.sessions.map((session) => { const overall = getOverallHealth(session); return <TableRow key={session.id} className="cursor-pointer" onClick={() => setSelectedKey(session.sessionKey)}><TableCell><div className="font-semibold">{session.displayName}</div><div className="text-xs text-[var(--app-text-tertiary)]">{session.sessionKey}</div></TableCell><TableCell>{session.mappedOaCount}</TableCell><TableCell><Badge variant={tone(session.status)} dot>{session.status}</Badge></TableCell><TableCell><Badge variant={tone(session.healthStatus)} dot>{session.healthStatus}</Badge></TableCell><TableCell><JobSummary session={session} /></TableCell><TableCell>{formatDate(session.healthLastCheckedAt)}</TableCell><TableCell>{session.healthFailureStage ?? "—"}</TableCell><TableCell>{session.activeProfileLeases}{session.activeLeaseOperation ? ` · ${session.activeLeaseOperation}` : ""}</TableCell><TableCell><Badge variant={overall.tone} dot>{overall.label}</Badge></TableCell><TableCell><Button size="sm" onClick={(event) => { event.stopPropagation(); setRetryTarget(session); }} disabled={session.jobs.failed + session.jobs.failedAuth === 0}>Retry failed</Button></TableCell></TableRow>; })}</TableBody>
      </Table></TableContainer></CardContent></Card>
      {selected && <section aria-label={`${selected.sessionKey} details`} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card><CardContent className="space-y-4 p-5"><div><h2 className="text-lg font-semibold">{selected.displayName}</h2><p className="text-sm text-[var(--app-text-secondary)]">{selected.sessionKey}</p></div><div className="flex flex-wrap gap-2"><Badge variant={tone(selected.status)}>{selected.status}</Badge><Badge variant={tone(selected.healthStatus)}>{selected.healthStatus}</Badge><Badge variant={getOverallHealth(selected).tone}>{getOverallHealth(selected).label}</Badge></div><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-[var(--app-text-tertiary)]">Failure stage</dt><dd>{selected.healthFailureStage ?? "None"}</dd></div><div><dt className="text-[var(--app-text-tertiary)]">Auth failures</dt><dd>{selected.consecutiveAuthFailures}</dd></div><div><dt className="text-[var(--app-text-tertiary)]">Mapped OAs</dt><dd>{selected.mappedOaCount}</dd></div><div><dt className="text-[var(--app-text-tertiary)]">Active leases</dt><dd>{selected.activeProfileLeases}</dd></div><div><dt className="text-[var(--app-text-tertiary)]">Last health check</dt><dd>{formatDate(selected.healthLastCheckedAt)}</dd></div><div><dt className="text-[var(--app-text-tertiary)]">Last healthy</dt><dd>{formatDate(selected.healthLastHealthyAt)}</dd></div></dl><JobSummary session={selected} /><p className="rounded-xl bg-[var(--app-surface-subtle)] p-3 text-xs text-[var(--app-text-secondary)]"><strong>Authentication failures</strong> may require re-login. Transport, execution, validation, and timeout failures can occur while the session remains connected.</p></CardContent></Card>
        <Card><CardContent className="p-5"><h2 className="mb-3 text-base font-semibold">Recent safe failure diagnostics</h2>{selected.recentFailures.length ? <div className="space-y-2">{selected.recentFailures.map((failure) => <div key={failure.jobId} className="rounded-xl border border-[var(--app-border)] p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono">{failure.jobId}</span><Badge variant={failure.failureCategory === "AUTHENTICATION" ? "danger" : "warning"}>{failure.failureCategory}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-[var(--app-text-secondary)]"><span>OA: {failure.oaName} ({failure.oaId})</span><span>Stage: {failure.failureStage ?? "—"}</span><span>Attempts: {failure.attemptCount}</span><span>Updated: {formatDate(failure.updatedAt)}</span></div></div>)}</div> : <p className="text-sm text-[var(--app-text-secondary)]">No failed jobs for this session.</p>}</CardContent></Card>
      </section>}
    </PageContainer>
    <Modal isOpen={Boolean(retryTarget)} onClose={() => !retrying && setRetryTarget(null)} title="Retry failed jobs?" description="This queues only failed jobs mapped to the selected session." footer={<><Button onClick={() => setRetryTarget(null)} disabled={retrying}>Cancel</Button><Button variant="danger" onClick={() => void retry()} isLoading={retrying}>Queue failed jobs</Button></>}>
      {retryTarget && <div className="space-y-3"><p><strong>{retryTarget.jobs.failed + retryTarget.jobs.failedAuth}</strong> jobs will be retried for <strong>{retryTarget.sessionKey}</strong>.</p><p>Session health: <Badge variant={tone(retryTarget.healthStatus)}>{retryTarget.healthStatus}</Badge></p><p>Authentication failures: <strong>{retryTarget.jobs.failedAuth}</strong></p><div className="flex flex-wrap gap-1">{[...new Set(retryTarget.recentFailures.map((item) => item.failureCategory))].map((category) => <Badge key={category} variant={category === "AUTHENTICATION" ? "danger" : "warning"}>{category}</Badge>)}</div><p className="text-[var(--app-text-secondary)]">Retrying jobs does not prove or change the browser session’s health. Review the health badge separately.</p></div>}
    </Modal>
  </AppShell>;
}

