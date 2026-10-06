import type {
  LineChatOperationsHealth,
  LineChatOperationsSession,
} from "@/lib/api";
import {
  getLineChatUiHealth,
  getLineChatWorkUiHealth,
  summarizeLineChatUiHealth,
  type LineChatUiHealth,
} from "./line-chat-health-status.ts";

export function buildLineChatOverview(
  report: LineChatOperationsHealth,
  now = Date.now(),
) {
  const sessions = report.sessions.map((session) => ({
    session,
    health: getLineChatUiHealth({ kind: "session", session }, now),
  }));
  const stores = report.fleetReadiness.stores.map((store) => ({
    store,
    health: getLineChatUiHealth(
      {
        kind: "store",
        store,
        session: report.sessions.find(
          (session) => session.sessionKey === store.sessionKey,
        ),
      },
      now,
    ),
  }));
  const issues = report.sessions.flatMap((session) =>
    session.recentFailures.map((failure) => ({ session, failure })),
  );
  const currentIssues = issues.filter(
    ({ failure }) =>
      failure.resolutionState === "ACTIVE" && failure.isActionable === true,
  );
  const historicalIssues = issues.filter(
    ({ failure }) => failure.resolutionState === "HISTORICAL",
  );
  const otherIssues = issues.filter(
    ({ failure }) =>
      failure.resolutionState !== "HISTORICAL" &&
      !(failure.resolutionState === "ACTIVE" && failure.isActionable === true),
  );
  // Aggregate counts may exceed the bounded recent-failure sample. Never infer
  // active failures from historical jobs.failed / jobs.failedAuth counters.
  const activeIssueCount = sessions.reduce(
    (count, { session }) =>
      count +
      Math.max(
        session.activeActionableFailures ?? 0,
        currentIssues.filter(
          (issue) => issue.session.sessionKey === session.sessionKey,
        ).length,
      ),
    0,
  );
  const sessionHealth = summarizeLineChatUiHealth(
    sessions.map((item) => item.health),
  );
  const storeHealth = summarizeLineChatUiHealth(
    stores.map((item) => item.health),
  );
  const mappingHealth = getLineChatWorkUiHealth(
    report.mapping.waitingForMapping,
    0,
  );
  const issueHealth = getLineChatWorkUiHealth(0, activeIssueCount);
  const overall = summarizeLineChatUiHealth([
    sessionHealth,
    storeHealth,
    mappingHealth,
    issueHealth,
  ]);
  const attention: Array<{
    id: string;
    title: string;
    health: LineChatUiHealth;
    target: "session" | "mapping" | "store";
    sessionKey?: string;
  }> = [];
  if (report.mapping.waitingForMapping > 0)
    attention.push({
      id: "mapping",
      title: `${report.mapping.waitingForMapping} jobs waiting for mapping`,
      health: mappingHealth,
      target: "mapping",
    });
  for (const { session, health } of sessions) {
    if (health.status !== "READY" && health.status !== "UNKNOWN")
      attention.push({
        id: session.id,
        title: session.displayName,
        health,
        target: "session",
        sessionKey: session.sessionKey,
      });
  }
  const storeGroups = new Map<
    string,
    { count: number; health: LineChatUiHealth }
  >();
  for (const { health } of stores) {
    if (health.status === "READY" || health.status === "UNKNOWN") continue;
    const group = storeGroups.get(health.status);
    storeGroups.set(health.status, {
      count: (group?.count ?? 0) + 1,
      health: group?.health ?? health,
    });
  }
  for (const [status, group] of storeGroups)
    attention.push({
      id: `stores-${status}`,
      title: `${group.count} ${group.count === 1 ? "store" : "stores"} · ${group.health.label}`,
      health: group.health,
      target: "store",
    });
  if (activeIssueCount > 0)
    attention.push({
      id: "issues",
      title: `${activeIssueCount} current issues to review`,
      health: issueHealth,
      target: "session",
      sessionKey: currentIssues[0]?.session.sessionKey,
    });
  const cards = [
    {
      title: "Overall Status",
      health: overall,
      value: overall.label,
      supporting: [overall.reason],
    },
    {
      title: "Live Mirror",
      health: sessionHealth,
      value: sessionHealth.label,
      supporting: [
        `${report.liveMirrorFleet?.configuredStores ?? "Unconfirmed"} configured stores`,
        !report.liveMirrorFleet
          ? "Fleet observation not confirmed"
          : report.liveMirrorFleet.cycleRunning
            ? "Sync cycle in progress"
            : "Waiting for the next scheduled cycle",
      ],
    },
    {
      title: "LINE Sessions",
      health: sessionHealth,
      value: `${sessions.filter((item) => item.health.status === "READY").length} / ${sessions.length} ready`,
      supporting: [sessionHealth.label],
    },
    {
      title: "Store Readiness",
      health: storeHealth,
      value: `${stores.filter((item) => item.health.status === "READY").length} / ${stores.length} ready`,
      supporting: [storeHealth.label],
    },
    {
      title: "Mapping Backlog",
      health: mappingHealth,
      value: `${report.mapping.waitingForMapping} waiting`,
      supporting: [
        `${report.mapping.mappedReadyPending} mapped and ready`,
        mappingHealth.label,
      ],
    },
    {
      title: "Recent Issues",
      health: issueHealth,
      value: `${activeIssueCount} current`,
      supporting: [
        `${historicalIssues.length} historical in recent records`,
        issueHealth.label,
      ],
    },
  ];
  return {
    cards,
    attention,
    sessions,
    stores,
    overall,
    currentIssues,
    historicalIssues,
    otherIssues,
    activeIssueCount,
    emptyAttentionText:
      overall.status === "READY"
        ? "No attention needed. Connections and current work are healthy."
        : "No actionable items confirmed. Some status checks are still unknown.",
  };
}

export function sessionBrowserLabel(
  session: LineChatOperationsSession,
): string {
  return (
    {
      AVAILABLE: "Available",
      BUSY: "In use",
      RECOVERING: "Recovery in progress",
      UNKNOWN: "Not confirmed",
    }[session.browserState] ?? "Not confirmed"
  );
}
export function sessionWorkLabel(session: LineChatOperationsSession): string {
  if (session.authRecoveryInProgress || session.browserState === "RECOVERING")
    return "Login recovery in progress";
  const operations: Record<string, string> = {
    NICKNAME_UPDATE: "Updating nicknames",
    RECENT_RESOLUTION: "Matching chats",
    HEALTH_SESSION: "Checking session",
    HEALTH_OA: "Checking store access",
    MANUAL_DIAGNOSTIC: "Browser diagnostics",
    MIRROR_SYNC: "Syncing store chats",
  };
  if (session.browserOperationKind || session.activeLeaseOperation)
    return (
      operations[
        session.browserOperationKind ?? session.activeLeaseOperation ?? ""
      ] ?? "Account operation in progress"
    );
  return session.jobs.processing > 0
    ? `${session.jobs.processing} jobs in progress`
    : "No work in progress";
}
