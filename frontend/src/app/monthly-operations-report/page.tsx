"use client";
import { DownloadAction } from "@/lib/download-permission";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthorizedSection } from "../authorized-workspace";
import { useAppLanguage } from "../language";
import { InternalPageShell } from "@/components/shell/internal-page-shell";

type FollowerCoverage = "complete" | "partial" | "missing";
type ReplyCoverage = "complete" | "partial" | "not_covered";

type ReportStore = {
  storeId: string;
  externalStoreId: string | null;
  storeName: string;
  accountName: string | null;
  lineOaId: string;
  lineBasicId: string | null;
  province: string | null;
  region: string | null;
  amName: null;
  bmName: string | null;
  followers: {
    monthStart: number | null;
    monthStartDate: string | null;
    focusStart: number | null;
    focusStartDate: string | null;
    periodEnd: number | null;
    periodEndDate: string | null;
    monthGrowth: number | null;
    focusGrowth: number | null;
  };
  chat: {
    inboundMessages: number;
    focusInboundMessages: number;
    responseCycles: number;
    repliedWithin24h: number;
    focusResponseCycles: number;
    focusRepliedWithin24h: number;
    replyRateWithin24h: number | null;
    focusReplyRateWithin24h: number | null;
    observedReplyRateWithin24h: number | null;
    observedFocusReplyRateWithin24h: number | null;
    replyCoverage: ReplyCoverage;
    mirrorFallbackReplies: number;
    mirrorFallbackUnmapped: number;
    coveredResponseCycles: number;
    coveredFocusResponseCycles: number;
  };
  dataQuality: {
    followerCoverage: FollowerCoverage;
    chatCoverage: string;
    notes: string[];
  };
};

type ReplyKpiAuditCycle = {
  storeId: string;
  conversationKey: string;
  mergePath: "CANONICAL" | "CROSSWALK" | "SOURCE_ANCHOR" | "DIRECT" | "VIRTUAL";
  firstInboundAt: string;
  firstInboundSource: "CURRENT" | "HISTORICAL";
  replyAt: string | null;
  replySource: "CURRENT" | "HISTORICAL" | null;
  responderKnown: boolean | null;
  responseMinutes: number | null;
  outcome: "WITHIN_24H" | "OVER_24H" | "PENDING";
  structurallyValid: boolean;
};

type ReplyKpiAudit = {
  month: string;
  kpiThrough: string;
  sampleRequested: number;
  storesAudited: number;
  selection: { high: number; mid: number; low: number; zero: number };
  checks: {
    status: "PASS" | "REVIEW";
    aggregateMatches: number;
    sampledCyclesValid: number;
    total: number;
  };
  privacy: {
    rawCustomerTextReturned: boolean;
    customerIdentifiersReturned: boolean;
  };
  stores: Array<{
    storeId: string;
    storeName: string;
    lineBasicId: string | null;
    report: {
      responseCycles: number;
      repliedWithin24h: number;
      replyRateWithin24h: number | null;
    };
    recomputed: {
      responseCycles: number;
      repliedWithin24h: number;
      replyRateWithin24h: number | null;
    };
    checks: {
      aggregateMatches: boolean;
      sampledCyclesValid: boolean;
      sampledCycleCount: number;
    };
    mergePathCounts: Record<string, number>;
    cycles: ReplyKpiAuditCycle[];
  }>;
};

type ZeroRateForensics = {
  month: string;
  kpiThrough: string;
  zeroRateStoresInFleet: number;
  storesAudited: number;
  classificationCounts: Record<string, number>;
  privacy: {
    rawCustomerTextReturned: boolean;
    customerIdentifiersReturned: boolean;
  };
  stores: Array<{
    storeId: string;
    storeName: string;
    lineBasicId: string | null;
    responseCycles: number;
    classification:
      | "NO_ELIGIBLE_CYCLE"
      | "REPLY_OVER_24H"
      | "AUTO_ONLY"
      | "NO_REPLY"
      | "OUTBOUND_OUTSIDE_CYCLE"
      | "UNMAPPED_OR_VIRTUAL"
      | "UNEXPECTED_WITHIN_24H";
    analytics: {
      total: number;
      responded: number;
      within24h: number;
      over24h: number;
      pending: number;
      knownResponderReplies: number;
      unknownResponderReplies: number;
    };
    historicalEvidence: {
      inbound: number;
      autoOutbound: number;
      nonAutoOutbound: number;
      unknownResponderOutbound: number;
    };
    mergeDiagnostics: Record<string, number>;
  }>;
};

type MonthlyOperationsReport = {
  period: {
    month: string;
    timezone: string;
    isCurrentMonth: boolean;
    start: string;
    focusStart: string;
    through: string;
    generatedAt: string;
    replyKpiThrough: string | null;
  };
  scope: {
    stores: number;
    lineAccounts: number;
    followerComplete: number;
    followerPartial: number;
    followerMissing: number;
    replyComplete: number;
    replyPartial: number;
    replyNotCovered: number;
  };
  totals: {
    inboundMessages: number;
    focusInboundMessages: number;
    responseCycles: number;
    repliedWithin24h: number;
    focusResponseCycles: number;
    focusRepliedWithin24h: number;
    monthFollowerGrowth: number;
    focusFollowerGrowth: number;
    replyRateWithin24h: number | null;
    focusReplyRateWithin24h: number | null;
    observedResponseCycles: number;
    observedRepliedWithin24h: number;
    observedFocusResponseCycles: number;
    observedFocusRepliedWithin24h: number;
    observedReplyRateWithin24h: number | null;
    observedFocusReplyRateWithin24h: number | null;
    mirrorFallbackReplies: number;
    mirrorFallbackUnmapped: number;
  };
  stores: ReportStore[];
  dataContract: {
    followerSource: string;
    chatSource: string;
    responseDefinition: string;
    lineChatMirrorRead: boolean;
    historicalTimelineRead: boolean;
    liveMirrorWrite: boolean;
    historicalMirrorWrite: boolean;
  };
};

function currentBangkokMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "09";
  return `${year}-${month}`;
}

function formatNumber(value: number | null, language: "th" | "en" | "zh") {
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  return value === null ? "—" : new Intl.NumberFormat(locale).format(value);
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function CoverageBadge({ value }: { value: FollowerCoverage }) {
  const label = value === "complete" ? "ครบ" : value === "partial" ? "บางส่วน" : "ไม่มีข้อมูล";
  const className = value === "complete"
    ? "bg-emerald-50 text-emerald-700"
    : value === "partial"
      ? "bg-amber-50 text-amber-700"
      : "bg-rose-50 text-rose-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function ReplyCoverageBadge({ value }: { value: ReplyCoverage }) {
  const label = value === "complete" ? "Complete" : value === "partial" ? "Partial" : "Not covered";
  const className = value === "complete"
    ? "bg-emerald-50 text-emerald-700"
    : value === "partial"
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
      <div className="text-xs font-medium text-[var(--app-text-tertiary)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-text-primary)]">{value}</div>
      {detail ? <div className="mt-1 text-xs text-[var(--app-text-secondary)]">{detail}</div> : null}
    </div>
  );
}

function ReportContent() {
  const { language } = useAppLanguage();
  const formatReportNumber = (value: number | null) => formatNumber(value, language);
  const [month, setMonth] = useState(currentBangkokMonth);
  const [report, setReport] = useState<MonthlyOperationsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [audit, setAudit] = useState<ReplyKpiAudit | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [zeroForensics, setZeroForensics] = useState<ZeroRateForensics | null>(null);
  const [zeroForensicsLoading, setZeroForensicsLoading] = useState(false);
  const [zeroForensicsError, setZeroForensicsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api-backend/monthly-operations-report?month=${encodeURIComponent(month)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        let message = `โหลดรายงานไม่สำเร็จ (${response.status})`;
        try {
          const body = await response.json() as { message?: string | string[] };
          if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
        } catch {}
        throw new Error(message);
      }
      setReport(await response.json() as MonthlyOperationsReport);
    } catch (reason) {
      setReport(null);
      setError(reason instanceof Error ? reason.message : "ไม่สามารถโหลดรายงานได้");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const downloadXlsx = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(`/api-backend/monthly-operations-report/export?month=${encodeURIComponent(month)}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        let message = `ดาวน์โหลด Excel ไม่สำเร็จ (${response.status})`;
        try {
          const body = await response.json() as { message?: string | string[] };
          if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
        } catch {}
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `OPPO_LINE_monthly_operations_${month}.xlsx`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ไม่สามารถดาวน์โหลด Excel ได้");
    } finally {
      setDownloading(false);
    }
  }, [month]);

  const runAudit = useCallback(async () => {
    setAuditing(true);
    setAuditError(null);
    setAudit(null);
    requestAnimationFrame(() => {
      document.getElementById("kpi-audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const response = await fetch(
        `/api-backend/monthly-operations-report/audit?month=${encodeURIComponent(month)}&sample=20`,
        { credentials: "include", cache: "no-store" },
      );
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        let message = `Audit ไม่สำเร็จ (${response.status})`;
        try {
          const body = await response.json() as { message?: string | string[] };
          if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
        } catch {}
        throw new Error(message);
      }
      const result = await response.json() as ReplyKpiAudit;
      setAudit(result);
      requestAnimationFrame(() => {
        document.getElementById("kpi-audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (reason) {
      setAudit(null);
      setAuditError(reason instanceof Error ? reason.message : "ไม่สามารถรัน KPI audit ได้");
    } finally {
      setAuditing(false);
    }
  }, [month]);

  const runZeroRateForensics = useCallback(async () => {
    setZeroForensicsLoading(true);
    setZeroForensicsError(null);
    setZeroForensics(null);
    requestAnimationFrame(() => {
      document.getElementById("zero-rate-forensics")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const response = await fetch(
        `/api-backend/monthly-operations-report/zero-rate-forensics?month=${encodeURIComponent(month)}&sample=10`,
        { credentials: "include", cache: "no-store" },
      );
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        let message = `Zero-rate forensics ไม่สำเร็จ (${response.status})`;
        try {
          const body = await response.json() as { message?: string | string[] };
          if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
        } catch {}
        throw new Error(message);
      }
      const result = await response.json() as ZeroRateForensics;
      setZeroForensics(result);
      requestAnimationFrame(() => {
        document.getElementById("zero-rate-forensics")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (reason) {
      setZeroForensics(null);
      setZeroForensicsError(reason instanceof Error ? reason.message : "ไม่สามารถรัน zero-rate forensics ได้");
    } finally {
      setZeroForensicsLoading(false);
    }
  }, [month]);

  const rows = useMemo(() => {
    if (!report) return [];
    const query = search.trim().toLocaleLowerCase("th-TH");
    if (!query) return report.stores;
    return report.stores.filter((store) =>
      [
        store.storeName,
        store.accountName,
        store.lineBasicId,
        store.externalStoreId,
        store.province,
        store.region,
        store.bmName,
      ].some((value) => value?.toLocaleLowerCase("th-TH").includes(query)),
    );
  }, [report, search]);

  return (
    <main className="min-h-full bg-[var(--app-bg)] px-4 py-6 text-[var(--app-text-primary)] md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-4 border-b border-[var(--app-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-accent)]">LINE Operations</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Monthly Operations Report</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--app-text-secondary)]">
              ตรวจสอบข้อมูลรายเดือนจาก Store Master, follower snapshot และข้อความจริงในระบบ ก่อนสร้างไฟล์ XLSX อัตโนมัติ
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-[var(--app-text-secondary)]">
              เดือน
              <input
                type="month"
                value={month}
                max={currentBangkokMonth()}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-1 block h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm text-[var(--app-text-primary)]"
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] disabled:opacity-60"
            >
              {loading ? "กำลังโหลด…" : "รีเฟรช"}
            </button>
            <button
              type="button"
              onClick={() => void runAudit()}
              disabled={auditing || loading || !report}
              className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] disabled:opacity-60"
            >
              {auditing ? "กำลัง Audit…" : audit ? <>Audit: {audit.checks.status}</> : "Run KPI Audit"}
            </button>
            <DownloadAction><button
              type="button"
              onClick={() => void downloadXlsx()}
              disabled={downloading || loading || !report}
              className="h-10 rounded-xl bg-[var(--app-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {downloading ? "กำลังสร้าง Excel…" : "ดาวน์โหลด XLSX"}
            </button></DownloadAction>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <div className="font-semibold">โหลดข้อมูลไม่สำเร็จ</div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        {loading && !report ? (
          <div className="mt-10 text-sm text-[var(--app-text-secondary)]">กำลังอ่านข้อมูล production…</div>
        ) : null}

        {report ? (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="ร้านในรายงาน" value={formatReportNumber(report.scope.stores)} detail={`${formatReportNumber(report.scope.lineAccounts)} LINE OA`} />
              <MetricCard label="ข้อความลูกค้าเดือนนี้" value={formatReportNumber(report.totals.inboundMessages)} detail={`ตั้งแต่ ${report.period.start} ถึง ${report.period.through}`} />
              <MetricCard
                label="ตอบภายใน 24 ชม."
                value={formatRate(report.totals.replyRateWithin24h)}
                detail={`${formatReportNumber(report.totals.repliedWithin24h)} / ${formatReportNumber(report.totals.responseCycles)} response cycles · KPI through ${report.period.replyKpiThrough ?? "—"}`}
              />
              <MetricCard label="Follower Growth" value={formatReportNumber(report.totals.monthFollowerGrowth)} detail={`ช่วง 20 เป็นต้นมา ${formatReportNumber(report.totals.focusFollowerGrowth)}`} />
            </section>

            <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Follower snapshot ครบ" value={formatReportNumber(report.scope.followerComplete)} />
              <MetricCard label="Follower snapshot บางส่วน" value={formatReportNumber(report.scope.followerPartial)} />
              <MetricCard label="Follower snapshot ไม่มี" value={formatReportNumber(report.scope.followerMissing)} />
              <MetricCard label="Reply KPI coverage ครบ" value={formatReportNumber(report.scope.replyComplete)} detail="รวมใน official 24h KPI" />
              <MetricCard label="Reply KPI coverage บางส่วน" value={formatReportNumber(report.scope.replyPartial)} detail="แสดง N/A ใน official KPI" />
              <MetricCard label="Reply KPI ยังไม่ครอบคลุม" value={formatReportNumber(report.scope.replyNotCovered)} detail="แสดง N/A ไม่ใช่ 0%" />
            </section>

            <section className="mt-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Production data check</h2>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    Official 24h KPI ใช้ Historical Timeline ที่ merge historical + canonical data แล้ว และตัดวันล่าสุดที่ยังไม่ครบหน้าต่างตอบกลับ 24 ชั่วโมงออก
                  </p>
                </div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหาร้าน / LINE ID / จังหวัด / BM"
                  className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] px-3 text-sm lg:w-80"
                />
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1300px] w-full text-left text-sm">
                  <thead className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-text-tertiary)]">
                    <tr>
                      <th className="px-3 py-3">Store</th>
                      <th className="px-3 py-3">LINE ID</th>
                      <th className="px-3 py-3">Province / Region</th>
                      <th className="px-3 py-3">BM</th>
                      <th className="px-3 py-3 text-right">Follower Start</th>
                      <th className="px-3 py-3 text-right">Follower End</th>
                      <th className="px-3 py-3 text-right">Growth</th>
                      <th className="px-3 py-3 text-right">Inbound</th>
                      <th className="px-3 py-3 text-right">≤24h</th>
                      <th className="px-3 py-3 text-right">24h Rate</th>
                      <th className="px-3 py-3">Reply Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((store) => (
                      <tr key={store.lineOaId} className="border-b border-[var(--app-border-subtle)] align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium">{store.storeName}</div>
                          <div className="mt-1 text-xs text-[var(--app-text-tertiary)]">{store.externalStoreId ?? store.storeId}</div>
                        </td>
                        <td className="px-3 py-3">{store.lineBasicId ?? "—"}</td>
                        <td className="px-3 py-3">
                          <div>{store.province ?? "—"}</div>
                          <div className="text-xs text-[var(--app-text-tertiary)]">{store.region ?? "—"}</div>
                        </td>
                        <td className="px-3 py-3">{store.bmName ?? "—"}</td>
                        <td className="px-3 py-3 text-right">{formatReportNumber(store.followers.monthStart)}</td>
                        <td className="px-3 py-3 text-right">{formatReportNumber(store.followers.periodEnd)}</td>
                        <td className="px-3 py-3 text-right">{formatReportNumber(store.followers.monthGrowth)}</td>
                        <td className="px-3 py-3 text-right">{formatReportNumber(store.chat.inboundMessages)}</td>
                        <td className="px-3 py-3 text-right">
                          {store.chat.replyCoverage === "complete" ? formatReportNumber(store.chat.repliedWithin24h) : "N/A"}
                        </td>
                        <td className="px-3 py-3 text-right">{store.chat.replyCoverage === "complete" ? formatRate(store.chat.replyRateWithin24h) : "N/A"}</td>
                        <td className="px-3 py-3">
                          <ReplyCoverageBadge value={store.chat.replyCoverage} />
                          <div className="mt-1 text-[11px] text-[var(--app-text-tertiary)]">
                            Historical timeline: {formatReportNumber(store.chat.coveredResponseCycles)} response cycles
                          </div>
                          {store.chat.replyCoverage !== "complete" && store.chat.observedReplyRateWithin24h !== null ? (
                            <div className="mt-1 text-[11px] text-[var(--app-text-tertiary)]">
                              observed {formatRate(store.chat.observedReplyRateWithin24h)} · not official
                            </div>
                          ) : null}
                          <div className="mt-1 text-[11px] text-[var(--app-text-tertiary)]">
                            Follower: <CoverageBadge value={store.dataQuality.followerCoverage} />
                          </div>
                          {store.dataQuality.notes.length > 0 ? (
                            <div className="mt-1 max-w-64 text-[11px] text-[var(--app-text-tertiary)]">{store.dataQuality.notes.join(", ")}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 ? <div className="py-8 text-center text-sm text-[var(--app-text-secondary)]">ไม่พบร้านที่ตรงกับคำค้นหา</div> : null}
              </div>
            </section>


            <section id="kpi-audit" className="mt-5 scroll-mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold">24h KPI Audit</h2>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    Read-only stratified sample 20 stores · no raw customer text or customer identifiers returned
                  </p>
                </div>
                {audit ? (
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    audit.checks.status === "PASS" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {audit.checks.status}
                  </span>
                ) : null}
              </div>

              {auditError ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{auditError}</div> : null}
              {!audit && !auditing ? (
                <div className="mt-3 text-sm text-[var(--app-text-secondary)]">กด Run KPI Audit เพื่อสุ่มตรวจ 20 ร้าน</div>
              ) : null}
              {auditing ? <div className="mt-3 text-sm text-[var(--app-text-secondary)]">กำลังตรวจ response-cycle evidence…</div> : null}

              {audit ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Stores Audited" value={formatReportNumber(audit.storesAudited)} detail={`high ${audit.selection.high} · mid ${audit.selection.mid} · low ${audit.selection.low} · zero ${audit.selection.zero}`} />
                    <MetricCard label="Aggregate Match" value={`${audit.checks.aggregateMatches}/${audit.checks.total}`} />
                    <MetricCard label="Cycle Structure Valid" value={`${audit.checks.sampledCyclesValid}/${audit.checks.total}`} />
                    <MetricCard label="KPI Through" value={audit.kpiThrough} />
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-left text-xs">
                      <thead className="border-b border-[var(--app-border)] text-[var(--app-text-tertiary)]">
                        <tr>
                          <th className="px-3 py-2">Store</th>
                          <th className="px-3 py-2">Rate</th>
                          <th className="px-3 py-2">Report</th>
                          <th className="px-3 py-2">Recomputed</th>
                          <th className="px-3 py-2">Aggregate</th>
                          <th className="px-3 py-2">Sample Cycles</th>
                          <th className="px-3 py-2">Merge Paths</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.stores.map((item) => (
                          <tr key={item.storeId} className="border-b border-[var(--app-border-subtle)] align-top">
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.storeName}</div>
                              <div className="text-[11px] text-[var(--app-text-tertiary)]">{item.lineBasicId ?? "—"}</div>
                            </td>
                            <td className="px-3 py-2">{formatRate(item.report.replyRateWithin24h)}</td>
                            <td className="px-3 py-2">{item.report.repliedWithin24h}/{item.report.responseCycles}</td>
                            <td className="px-3 py-2">{item.recomputed.repliedWithin24h}/{item.recomputed.responseCycles}</td>
                            <td className="px-3 py-2">{item.checks.aggregateMatches ? "PASS" : "REVIEW"}</td>
                            <td className="px-3 py-2">{item.checks.sampledCyclesValid ? "PASS" : "REVIEW"} ({item.checks.sampledCycleCount})</td>
                            <td className="px-3 py-2">
                              {Object.entries(item.mergePathCounts).map(([path, count]) => (
                                <div key={path}>{path}: {count}</div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>

            <section id="zero-rate-forensics" className="mt-5 scroll-mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Zero-Rate Forensics</h2>
                  <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    ตรวจร้าน 0% สูงสุด 10 ร้านแบบ read-only เพื่อแยก late reply / auto-only / no reply / mapping issue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runZeroRateForensics()}
                  disabled={zeroForensicsLoading || loading || !report}
                  className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 text-sm font-semibold text-[var(--app-text-primary)] disabled:opacity-60"
                >
                  {zeroForensicsLoading ? "กำลังตรวจ…" : "Run Zero-Rate Forensics"}
                </button>
              </div>

              {zeroForensicsError ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{zeroForensicsError}</div> : null}
              {!zeroForensics && !zeroForensicsLoading ? (
                <div className="mt-3 text-sm text-[var(--app-text-secondary)]">ยังไม่ได้รัน zero-rate forensics</div>
              ) : null}
              {zeroForensicsLoading ? (
                <div className="mt-3 text-sm text-[var(--app-text-secondary)]">กำลังอ่าน Historical evidence ของร้าน 0%…</div>
              ) : null}

              {zeroForensics ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Zero-Rate Stores" value={formatReportNumber(zeroForensics.zeroRateStoresInFleet)} />
                    <MetricCard label="Stores Audited" value={formatReportNumber(zeroForensics.storesAudited)} />
                    <MetricCard label="KPI Through" value={zeroForensics.kpiThrough} />
                    <MetricCard
                      label="Top Causes"
                      value={Object.entries(zeroForensics.classificationCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(([key, value]) => `${key} ${value}`)
                        .join(" · ") || "—"}
                    />
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-[1200px] w-full text-left text-xs">
                      <thead className="border-b border-[var(--app-border)] text-[var(--app-text-tertiary)]">
                        <tr>
                          <th className="px-3 py-2">Store</th>
                          <th className="px-3 py-2">Cause</th>
                          <th className="px-3 py-2">Cycles</th>
                          <th className="px-3 py-2">Responded</th>
                          <th className="px-3 py-2">&gt;24h</th>
                          <th className="px-3 py-2">Pending</th>
                          <th className="px-3 py-2">Hist Outbound</th>
                          <th className="px-3 py-2">Auto</th>
                          <th className="px-3 py-2">Virtual Rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zeroForensics.stores.map((item) => (
                          <tr key={item.storeId} className="border-b border-[var(--app-border-subtle)]">
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.storeName}</div>
                              <div className="text-[11px] text-[var(--app-text-tertiary)]">{item.lineBasicId ?? "—"}</div>
                            </td>
                            <td className="px-3 py-2 font-medium">{item.classification}</td>
                            <td className="px-3 py-2">{item.analytics.total}</td>
                            <td className="px-3 py-2">{item.analytics.responded}</td>
                            <td className="px-3 py-2">{item.analytics.over24h}</td>
                            <td className="px-3 py-2">{item.analytics.pending}</td>
                            <td className="px-3 py-2">{item.historicalEvidence.nonAutoOutbound}</td>
                            <td className="px-3 py-2">{item.historicalEvidence.autoOutbound}</td>
                            <td className="px-3 py-2">{item.mergeDiagnostics.virtualHistoricalRows ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>

            <section className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-xs text-[var(--app-text-secondary)]">
              <div className="font-semibold text-[var(--app-text-primary)]">Isolation check</div>
              <div className="mt-2 grid gap-1 md:grid-cols-3">
                <div>Manager Mirror read: <strong>{report.dataContract.lineChatMirrorRead ? "YES" : "NO"}</strong></div>
                <div>Live Mirror write: <strong>{report.dataContract.liveMirrorWrite ? "YES" : "NO"}</strong></div>
                <div>Historical Mirror write: <strong>{report.dataContract.historicalMirrorWrite ? "YES" : "NO"}</strong></div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function MonthlyOperationsReportPage() {
  return (
    <AuthorizedSection section="dashboard">
      <InternalPageShell section="dashboard">
        <ReportContent />
      </InternalPageShell>
    </AuthorizedSection>
  );
}
