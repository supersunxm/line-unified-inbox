"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, PageContainer, PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import {
  api,
  type LineChatOperationsHealth,
  type LineChatOperationsSession,
  type LineChatRecommendedAction,
  type LineChatSafeJobFailure,
} from "@/lib/api";
import type { AuthUser } from "@/lib/authorization";
import { useAppLanguage } from "../../language";
import { getOverallHealth } from "./line-chat-health-status";

type FilterTab = "ALL" | "AUTO_FIXABLE" | "MANUAL_REVIEW" | "AUTHENTICATION" | "SYSTEM_ATTENTION";

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : "—");

const tone = (value: string): "success" | "warning" | "danger" | "neutral" =>
  value === "CONNECTED" || value === "ACTIVE"
    ? "success"
    : value === "UNKNOWN"
      ? "neutral"
      : value === "DEGRADED"
        ? "warning"
        : "danger";

const actionTone = (action: LineChatRecommendedAction): "success" | "warning" | "danger" | "neutral" | "info" => {
  switch (action) {
    case "RETRY_RECOMMENDED":
      return "info";
    case "RETRY_OR_INSPECT":
      return "warning";
    case "RE_LOGIN_REQUIRED":
      return "danger";
    case "MANUAL_REVIEW":
      return "warning";
    case "SYSTEM_ATTENTION":
      return "danger";
    case "INVESTIGATE":
    default:
      return "neutral";
  }
};

const actionLabel = (action: LineChatRecommendedAction): string => {
  switch (action) {
    case "RETRY_RECOMMENDED":
      return "Retry recommended";
    case "RETRY_OR_INSPECT":
      return "Retry or inspect";
    case "RE_LOGIN_REQUIRED":
      return "Re-login required";
    case "MANUAL_REVIEW":
      return "Manual review";
    case "SYSTEM_ATTENTION":
      return "System attention";
    case "INVESTIGATE":
    default:
      return "Investigate";
  }
};

function JobSummary({
  session,
  onFailedClick,
}: {
  session: LineChatOperationsSession;
  onFailedClick?: () => void;
}) {
  const failedCount = session.jobs.failed + session.jobs.failedAuth;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="success">{session.jobs.success} success</Badge>
      <Badge variant={session.jobs.pending + session.jobs.processing ? "info" : "neutral"}>
        {session.jobs.pending} pending · {session.jobs.processing} running
      </Badge>
      {failedCount > 0 && onFailedClick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFailedClick();
          }}
          className="cursor-pointer transition hover:opacity-80 focus:outline-none"
          title="Click to view and manage failed jobs"
        >
          <Badge variant="warning" dot>
            {failedCount} failed
          </Badge>
        </button>
      ) : (
        <Badge variant={failedCount > 0 ? "warning" : "neutral"}>
          {failedCount} failed
        </Badge>
      )}
      <Badge variant="neutral">{session.jobs.superseded} superseded</Badge>
    </div>
  );
}

export function LineChatHealthView() {
  const { language, setLanguage } = useAppLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [report, setReport] = useState<LineChatOperationsHealth | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Legacy single session retry target (for "Retry failed" button in table)
  const [legacyRetryTarget, setLegacyRetryTarget] = useState<LineChatOperationsSession | null>(null);
  const [legacyRetrying, setLegacyRetrying] = useState(false);

  // Detail Modal & Action State
  const [detailSessionKey, setDetailSessionKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [overrideNonRetryable, setOverrideNonRetryable] = useState(false);
  const [fixPreviewOpen, setFixPreviewOpen] = useState(false);
  const [retrySelectedConfirmOpen, setRetrySelectedConfirmOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [authUser, health] = await Promise.all([api.me(), api.lineChatOperationsHealth()]);
      setUser(authUser as AuthUser);
      setReport(health);
      setSelectedKey((current) => current ?? health.sessions[0]?.sessionKey ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load LINE Chat health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = useMemo(
    () => report?.sessions.find((item) => item.sessionKey === selectedKey) ?? null,
    [report, selectedKey],
  );

  const detailSession = useMemo(
    () => report?.sessions.find((item) => item.sessionKey === detailSessionKey) ?? null,
    [report, detailSessionKey],
  );

  const openDetailModal = (session: LineChatOperationsSession) => {
    setDetailSessionKey(session.sessionKey);
    setActiveFilter("ALL");
    // Non-retryable unselected by default; pre-select auto-fixable
    const autoFixableIds = new Set(
      session.recentFailures.filter((f) => f.isAutoFixable).map((f) => f.jobId),
    );
    setSelectedJobIds(autoFixableIds);
    setOverrideNonRetryable(false);
  };

  // Metrics for detail modal
  const failures = useMemo(() => detailSession?.recentFailures ?? [], [detailSession]);
  const metrics = useMemo(() => {
    const total = failures.length;
    const autoFixable = failures.filter((f) => f.isAutoFixable).length;
    const manualReview = failures.filter((f) => f.recommendedAction === "MANUAL_REVIEW").length;
    const systemAttention = failures.filter(
      (f) =>
        f.recommendedAction === "SYSTEM_ATTENTION" ||
        f.recommendedAction === "RE_LOGIN_REQUIRED" ||
        f.recommendedAction === "INVESTIGATE",
    ).length;
    const auth = failures.filter(
      (f) => f.failureCategory === "AUTHENTICATION" || f.recommendedAction === "RE_LOGIN_REQUIRED",
    ).length;
    return { total, autoFixable, manualReview, systemAttention, auth };
  }, [failures]);

  const filteredFailures = useMemo(() => {
    switch (activeFilter) {
      case "AUTO_FIXABLE":
        return failures.filter((f) => f.isAutoFixable);
      case "MANUAL_REVIEW":
        return failures.filter((f) => f.recommendedAction === "MANUAL_REVIEW");
      case "AUTHENTICATION":
        return failures.filter(
          (f) => f.failureCategory === "AUTHENTICATION" || f.recommendedAction === "RE_LOGIN_REQUIRED",
        );
      case "SYSTEM_ATTENTION":
        return failures.filter(
          (f) =>
            f.recommendedAction === "SYSTEM_ATTENTION" ||
            f.recommendedAction === "RE_LOGIN_REQUIRED" ||
            f.recommendedAction === "INVESTIGATE",
        );
      case "ALL":
      default:
        return failures;
    }
  }, [failures, activeFilter]);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      const allFilteredSelected = filteredFailures.length > 0 && filteredFailures.every((f) => next.has(f.jobId));
      if (allFilteredSelected) {
        filteredFailures.forEach((f) => next.delete(f.jobId));
      } else {
        filteredFailures.forEach((f) => next.add(f.jobId));
      }
      return next;
    });
  };

  const selectedFailures = useMemo(
    () => failures.filter((f) => selectedJobIds.has(f.jobId)),
    [failures, selectedJobIds],
  );

  const selectedBreakdown = useMemo(() => {
    const total = selectedFailures.length;
    const retryable = selectedFailures.filter((f) => f.isAutoFixable).length;
    const nonRetryable = total - retryable;
    const categories = [...new Set(selectedFailures.map((f) => f.failureCategory))];
    return { total, retryable, nonRetryable, categories };
  }, [selectedFailures]);

  // Execute Fix Retryable
  const executeFixRetryable = async () => {
    if (!detailSession) return;
    setActionInProgress(true);
    setError(null);
    try {
      const result = await api.fixLineChatRetryableJobs(detailSession.sessionKey);
      setNotice(
        `${result.retriedCount} retryable failures safely re-queued for ${detailSession.sessionKey}. Remaining failures require manual review or re-login.`,
      );
      setFixPreviewOpen(false);
      setDetailSessionKey(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to execute auto-fix.");
    } finally {
      setActionInProgress(false);
    }
  };

  // Execute Retry Selected
  const executeRetrySelected = async () => {
    if (!detailSession || selectedJobIds.size === 0) return;
    setActionInProgress(true);
    setError(null);
    try {
      const result = await api.retryLineChatSelectedJobs(
        detailSession.sessionKey,
        Array.from(selectedJobIds),
        overrideNonRetryable,
      );
      setNotice(
        `${result.retriedCount} selected jobs queued for ${detailSession.sessionKey}. Skipped non-retryable: ${result.skippedNonRetryableCount}.`,
      );
      setRetrySelectedConfirmOpen(false);
      setDetailSessionKey(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to retry selected jobs.");
    } finally {
      setActionInProgress(false);
    }
  };

  // Legacy full session retry
  const retryLegacy = async () => {
    if (!legacyRetryTarget) return;
    setLegacyRetrying(true);
    setError(null);
    try {
      const result = await api.retryLineChatFailedJobs(legacyRetryTarget.sessionKey);
      setNotice(`${result.retriedCount} failed jobs queued for ${legacyRetryTarget.sessionKey}.`);
      setLegacyRetryTarget(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Retry failed.");
    } finally {
      setLegacyRetrying(false);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    window.location.replace("/login");
  };

  return (
    <AppShell
      currentSection="line-chat-health"
      authUser={user}
      language={language}
      changeLanguage={setLanguage}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE Chat operations health" }}
    >
      <PageContainer variant="wide">
        <PageHeader
          title="LINE Chat Operations Health"
          description="Session connectivity and job outcomes are evaluated independently."
          actions={
            <Button onClick={() => void load()} isLoading={loading}>
              Refresh health data
            </Button>
          }
        />
        {error && (
          <div role="alert" className="rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-xl border border-[var(--app-success)]/30 bg-[var(--app-success-soft)] p-3 text-sm text-[var(--app-success)]">
            {notice}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account / session</TableHead>
                    <TableHead>Mapped OAs</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Job summary</TableHead>
                    <TableHead>Last health check</TableHead>
                    <TableHead>Failure stage</TableHead>
                    <TableHead>Active leases</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report?.sessions.map((session) => {
                    const overall = getOverallHealth(session);
                    const totalFailed = session.jobs.failed + session.jobs.failedAuth;
                    return (
                      <TableRow
                        key={session.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedKey(session.sessionKey)}
                      >
                        <TableCell>
                          <div className="font-semibold">{session.displayName}</div>
                          <div className="text-xs text-[var(--app-text-tertiary)]">{session.sessionKey}</div>
                        </TableCell>
                        <TableCell>{session.mappedOaCount}</TableCell>
                        <TableCell>
                          <Badge variant={tone(session.status)} dot>
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tone(session.healthStatus)} dot>
                            {session.healthStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <JobSummary session={session} onFailedClick={() => openDetailModal(session)} />
                        </TableCell>
                        <TableCell>{formatDate(session.healthLastCheckedAt)}</TableCell>
                        <TableCell>{session.healthFailureStage ?? "—"}</TableCell>
                        <TableCell>
                          {session.activeProfileLeases}
                          {session.activeLeaseOperation ? ` · ${session.activeLeaseOperation}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={overall.tone} dot>
                            {overall.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {totalFailed > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDetailModal(session);
                                }}
                              >
                                View failed ({totalFailed})
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setLegacyRetryTarget(session);
                              }}
                              disabled={totalFailed === 0}
                            >
                              Retry failed
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {selected && (
          <section aria-label={`${selected.sessionKey} details`} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="text-lg font-semibold">{selected.displayName}</h2>
                  <p className="text-sm text-[var(--app-text-secondary)]">{selected.sessionKey}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={tone(selected.status)}>{selected.status}</Badge>
                  <Badge variant={tone(selected.healthStatus)}>{selected.healthStatus}</Badge>
                  <Badge variant={getOverallHealth(selected).tone}>{getOverallHealth(selected).label}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[var(--app-text-tertiary)]">Failure stage</dt>
                    <dd>{selected.healthFailureStage ?? "None"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--app-text-tertiary)]">Auth failures</dt>
                    <dd>{selected.consecutiveAuthFailures}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--app-text-tertiary)]">Mapped OAs</dt>
                    <dd>{selected.mappedOaCount}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--app-text-tertiary)]">Active leases</dt>
                    <dd>{selected.activeProfileLeases}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--app-text-tertiary)]">Last health check</dt>
                    <dd>{formatDate(selected.healthLastCheckedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--app-text-tertiary)]">Last healthy</dt>
                    <dd>{formatDate(selected.healthLastHealthyAt)}</dd>
                  </div>
                </dl>
                <JobSummary session={selected} onFailedClick={() => openDetailModal(selected)} />
                <p className="rounded-xl bg-[var(--app-surface-subtle)] p-3 text-xs text-[var(--app-text-secondary)]">
                  <strong>Authentication failures</strong> may require re-login. Transport, execution, validation, and timeout failures can occur while the session remains connected.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Recent safe failure diagnostics</h2>
                  {selected.recentFailures.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => openDetailModal(selected)}>
                      Manage failures ({selected.recentFailures.length})
                    </Button>
                  )}
                </div>
                {selected.recentFailures.length ? (
                  <div className="space-y-2">
                    {selected.recentFailures.slice(0, 5).map((failure) => (
                      <div key={failure.jobId} className="rounded-xl border border-[var(--app-border)] p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-medium">{failure.jobId}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant={failure.failureCategory === "AUTHENTICATION" ? "danger" : "warning"}>
                              {failure.failureCategory}
                            </Badge>
                            <Badge variant={actionTone(failure.recommendedAction)}>
                              {actionLabel(failure.recommendedAction)}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[var(--app-text-secondary)]">
                          <span>OA: {failure.oaName} ({failure.oaId})</span>
                          <span>Stage: {failure.failureStage ?? "—"}</span>
                          <span>Attempts: {failure.attemptCount}</span>
                          <span>Updated: {formatDate(failure.updatedAt)}</span>
                        </div>
                        {failure.conversationId && (
                          <div className="mt-2 pt-2 border-t border-[var(--app-border-subtle)] flex items-center justify-between">
                            <span className="text-[var(--app-text-tertiary)]">Safe conversation reference</span>
                            <a
                              href={`/chats?conversationId=${encodeURIComponent(failure.conversationId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--app-accent)] hover:underline font-medium"
                            >
                              View in Chat &rarr;
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                    {selected.recentFailures.length > 5 && (
                      <div className="text-center pt-2">
                        <Button size="sm" variant="ghost" onClick={() => openDetailModal(selected)}>
                          View all {selected.recentFailures.length} failures &rarr;
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--app-text-secondary)]">No failed jobs for this session.</p>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </PageContainer>

      {/* ========================================================================= */}
      {/* Failed Jobs Detail Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(detailSession)}
        onClose={() => !actionInProgress && setDetailSessionKey(null)}
        title={`Failed Jobs — ${detailSession?.displayName ?? ""}`}
        description={`Session: ${detailSession?.sessionKey ?? ""} · Health: ${detailSession?.healthStatus ?? ""} (Browser session health is evaluated separately)`}
        maxWidth="2xl"
        className="sm:max-w-3xl"
        footer={
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="text-xs text-[var(--app-text-secondary)]">
              Selected: <strong>{selectedJobIds.size}</strong> of {failures.length}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setDetailSessionKey(null)} disabled={actionInProgress}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => setRetrySelectedConfirmOpen(true)}
                disabled={actionInProgress || selectedJobIds.size === 0}
              >
                Retry selected ({selectedJobIds.size})
              </Button>
              <Button
                variant="primary"
                onClick={() => setFixPreviewOpen(true)}
                disabled={actionInProgress || metrics.autoFixable === 0}
              >
                Fix retryable failures ({metrics.autoFixable})
              </Button>
            </div>
          </div>
        }
      >
        {detailSession && (
          <div className="space-y-4">
            {/* Top Summary Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2.5 text-center">
                <div className="text-xs text-[var(--app-text-tertiary)]">Total Failed</div>
                <div className="text-lg font-bold text-[var(--app-text-primary)]">{metrics.total}</div>
              </div>
              <div className="rounded-xl border border-[var(--app-success)]/30 bg-[var(--app-success-soft)] p-2.5 text-center">
                <div className="text-xs text-[var(--app-success)]">Auto-fixable</div>
                <div className="text-lg font-bold text-[var(--app-success)]">{metrics.autoFixable}</div>
              </div>
              <div className="rounded-xl border border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] p-2.5 text-center">
                <div className="text-xs text-[var(--app-warning)]">Manual review</div>
                <div className="text-lg font-bold text-[var(--app-warning)]">{metrics.manualReview}</div>
              </div>
              <div className="rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-2.5 text-center">
                <div className="text-xs text-[var(--app-danger)]">System attention</div>
                <div className="text-lg font-bold text-[var(--app-danger)]">{metrics.systemAttention}</div>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border-subtle)] pb-3">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={activeFilter === "ALL" ? "primary" : "ghost"}
                  onClick={() => setActiveFilter("ALL")}
                >
                  All ({metrics.total})
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === "AUTO_FIXABLE" ? "primary" : "ghost"}
                  onClick={() => setActiveFilter("AUTO_FIXABLE")}
                >
                  Auto-fixable ({metrics.autoFixable})
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === "MANUAL_REVIEW" ? "primary" : "ghost"}
                  onClick={() => setActiveFilter("MANUAL_REVIEW")}
                >
                  Manual review ({metrics.manualReview})
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === "AUTHENTICATION" ? "primary" : "ghost"}
                  onClick={() => setActiveFilter("AUTHENTICATION")}
                >
                  Authentication ({metrics.auth})
                </Button>
                <Button
                  size="sm"
                  variant={activeFilter === "SYSTEM_ATTENTION" ? "primary" : "ghost"}
                  onClick={() => setActiveFilter("SYSTEM_ATTENTION")}
                >
                  System attention ({metrics.systemAttention})
                </Button>
              </div>

              {/* Select All Toggle for current filtered list */}
              {filteredFailures.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="text-xs text-[var(--app-accent)] hover:underline focus:outline-none"
                >
                  {filteredFailures.every((f) => selectedJobIds.has(f.jobId))
                    ? "Deselect view"
                    : "Select view"}
                </button>
              )}
            </div>

            {/* Jobs List */}
            {filteredFailures.length === 0 ? (
              <div className="py-8 text-center text-[var(--app-text-secondary)]">
                No failed jobs match the selected filter.
              </div>
            ) : (
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {filteredFailures.map((failure: LineChatSafeJobFailure) => {
                  const isSelected = selectedJobIds.has(failure.jobId);
                  return (
                    <div
                      key={failure.jobId}
                      className={`rounded-xl border p-3 transition-colors ${
                        isSelected
                          ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5"
                          : "border-[var(--app-border)] bg-[var(--app-surface)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleJobSelection(failure.jobId)}
                          className="mt-1 h-4 w-4 rounded border-[var(--app-border)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                          aria-label={`Select job ${failure.jobId}`}
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-[var(--app-text-primary)]">
                              {failure.jobId}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant={
                                  failure.failureCategory === "AUTHENTICATION" ? "danger" : "warning"
                                }
                              >
                                {failure.failureCategory}
                              </Badge>
                              <Badge variant={actionTone(failure.recommendedAction)}>
                                {actionLabel(failure.recommendedAction)}
                              </Badge>
                              {failure.isAutoFixable && (
                                <Badge variant="success">Auto-fixable</Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--app-text-secondary)] sm:grid-cols-4">
                            <div>
                              <span className="text-[var(--app-text-tertiary)]">OA: </span>
                              {failure.oaName} ({failure.oaId})
                            </div>
                            <div>
                              <span className="text-[var(--app-text-tertiary)]">Stage: </span>
                              {failure.failureStage ?? "—"}
                            </div>
                            <div>
                              <span className="text-[var(--app-text-tertiary)]">Attempts: </span>
                              {failure.attemptCount}
                            </div>
                            <div>
                              <span className="text-[var(--app-text-tertiary)]">Updated: </span>
                              {formatDate(failure.updatedAt)}
                            </div>
                          </div>

                          {failure.conversationId && (
                            <div className="flex items-center justify-between pt-1 text-xs">
                              <span className="text-[var(--app-text-tertiary)] font-mono">
                                Conversation: {failure.conversationId}
                              </span>
                              <a
                                href={`/chats?conversationId=${encodeURIComponent(failure.conversationId)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-[var(--app-accent)] hover:underline"
                              >
                                View in Chat &rarr;
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Fix Retryable Failures Preview Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={fixPreviewOpen}
        onClose={() => !actionInProgress && setFixPreviewOpen(false)}
        title="Fix Retryable Failures"
        description="Preview and confirm automatic re-queueing of safe transient failures."
        footer={
          <>
            <Button onClick={() => setFixPreviewOpen(false)} disabled={actionInProgress}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void executeFixRetryable()}
              isLoading={actionInProgress}
            >
              Confirm & Fix ({metrics.autoFixable} jobs)
            </Button>
          </>
        }
      >
        {detailSession && (
          <div className="space-y-3">
            <p>
              Found <strong>{failures.length}</strong> total failures for session{" "}
              <strong>{detailSession.sessionKey}</strong>:
            </p>
            <div className="space-y-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 text-xs">
              <div className="flex items-center justify-between text-[var(--app-success)]">
                <span>Safe to auto-fix (transport, timeout, initial execution):</span>
                <strong>{metrics.autoFixable} jobs</strong>
              </div>
              <div className="flex items-center justify-between text-[var(--app-warning)]">
                <span>Require manual review (repeated failures, validation):</span>
                <strong>{metrics.manualReview} jobs</strong>
              </div>
              <div className="flex items-center justify-between text-[var(--app-danger)]">
                <span>Require system attention / re-login:</span>
                <strong>{metrics.systemAttention} jobs</strong>
              </div>
            </div>
            <p className="text-xs text-[var(--app-text-secondary)]">
              This action will safely re-queue only the <strong>{metrics.autoFixable}</strong> auto-fixable jobs to{" "}
              <code>PENDING</code>. The server independently re-validates each job before updating. Jobs in{" "}
              <code>PROCESSING</code> or <code>SUPERSEDED</code> states will never be retried.
            </p>
            <p className="text-xs text-[var(--app-text-secondary)]">
              Browser session health (<strong>{detailSession.healthStatus}</strong>) is independent and will not be altered.
            </p>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Retry Selected Confirmation Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={retrySelectedConfirmOpen}
        onClose={() => !actionInProgress && setRetrySelectedConfirmOpen(false)}
        title="Retry Selected Jobs"
        description="Confirm queueing of selected failed jobs."
        footer={
          <>
            <Button onClick={() => setRetrySelectedConfirmOpen(false)} disabled={actionInProgress}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void executeRetrySelected()}
              isLoading={actionInProgress}
            >
              Queue Selected ({selectedBreakdown.total})
            </Button>
          </>
        }
      >
        {detailSession && (
          <div className="space-y-3">
            <p>
              You are about to retry <strong>{selectedBreakdown.total}</strong> selected jobs for{" "}
              <strong>{detailSession.sessionKey}</strong>.
            </p>
            <div className="space-y-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Retryable / Auto-fixable:</span>
                <strong className="text-[var(--app-success)]">{selectedBreakdown.retryable}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Non-retryable / Manual review:</span>
                <strong className={selectedBreakdown.nonRetryable > 0 ? "text-[var(--app-danger)]" : ""}>
                  {selectedBreakdown.nonRetryable}
                </strong>
              </div>
              <div className="pt-2 border-t border-[var(--app-border-subtle)]">
                <span className="text-[var(--app-text-tertiary)]">Categories breakdown:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedBreakdown.categories.map((cat) => (
                    <Badge key={cat} variant={cat === "AUTHENTICATION" ? "danger" : "warning"}>
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {selectedBreakdown.nonRetryable > 0 && (
              <div className="rounded-xl border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] p-3 text-xs text-[var(--app-warning)] space-y-2">
                <p>
                  <strong>Warning:</strong> {selectedBreakdown.nonRetryable} selected jobs are classified as non-retryable (e.g. Authentication, Validation, or Repeated Execution errors). By default, the server rejects non-retryable jobs.
                </p>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={overrideNonRetryable}
                    onChange={(e) => setOverrideNonRetryable(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--app-border)] text-[var(--app-accent)]"
                  />
                  Force retry non-retryable jobs (may fail again if credentials or inputs are invalid)
                </label>
              </div>
            )}

            <p className="text-xs text-[var(--app-text-secondary)]">
              Retrying jobs does not change the browser session health (<strong>{detailSession.healthStatus}</strong>).
            </p>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Legacy Full Session Retry Confirmation Modal */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(legacyRetryTarget)}
        onClose={() => !legacyRetrying && setLegacyRetryTarget(null)}
        title="Retry failed jobs?"
        description="This queues only failed jobs mapped to the selected session."
        footer={
          <>
            <Button onClick={() => setLegacyRetryTarget(null)} disabled={legacyRetrying}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void retryLegacy()} isLoading={legacyRetrying}>
              Queue failed jobs
            </Button>
          </>
        }
      >
        {legacyRetryTarget && (
          <div className="space-y-3">
            <p>
              <strong>{legacyRetryTarget.jobs.failed + legacyRetryTarget.jobs.failedAuth}</strong> jobs will be retried for{" "}
              <strong>{legacyRetryTarget.sessionKey}</strong>.
            </p>
            <p>
              Session health: <Badge variant={tone(legacyRetryTarget.healthStatus)}>{legacyRetryTarget.healthStatus}</Badge>
            </p>
            <p>
              Authentication failures: <strong>{legacyRetryTarget.jobs.failedAuth}</strong>
            </p>
            <div className="flex flex-wrap gap-1">
              {[...new Set(legacyRetryTarget.recentFailures.map((item) => item.failureCategory))].map((category) => (
                <Badge key={category} variant={category === "AUTHENTICATION" ? "danger" : "warning"}>
                  {category}
                </Badge>
              ))}
            </div>
            <p className="text-[var(--app-text-secondary)]">
              Retrying jobs does not prove or change the browser session’s health. Review the health badge separately.
            </p>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
