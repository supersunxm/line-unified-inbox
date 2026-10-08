"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useMemo, useState } from "react";
import { AuthorizedSection } from "@/app/authorized-workspace";
import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { RATE24_TARGET, REPLIED_RATE_TARGET } from "@/lib/v2/kpi";
import { monthLongLabel, monthShortLabel, periodLabel } from "@/lib/v2/month";
import { parseReportUrl } from "@/lib/v2/month-url";
import { coverageText, dataCoverage, previousCoverage, sortMonthRows, type GroupTotals, type MonthStoreRow } from "@/lib/v2/monthly-model";
import { buildReportSummary } from "@/lib/v2/report-summary";
import { UNMATCHED_PARTNER } from "@/lib/v2/partners";
import { MIN_RATE_SAMPLE } from "@/lib/v2/value-state";
import { thaiLocationLabel } from "@/lib/v2/thai-geo";
import { KpiCompareTable } from "@/components/metrics/kpi-ui";
import { useV2Month, V2MonthDataProvider } from "./v2-month-data";
import { CountCell, RateCell, StateValue } from "@/components/metrics/value-ui";
import { v2Text } from "@/lib/v2/v2-translations";

// The report is light-only and A4: these light token values apply inside .v2-report whatever
// the app theme is, and @page sets the paper. They are :root's light values from
// app/globals.css, except a darker red and green so status colours stay legible on paper.
const REPORT_CSS = `
.v2-report {
  --app-bg: #ffffff; --app-surface: #ffffff; --app-surface-subtle: #f9f9fb; --app-surface-hover: #f2f4f7;
  --app-border: #e5e5ea; --app-border-subtle: #f0f0f4; --app-border-strong: #d1d1d6;
  --app-text-primary: #1d1d1f; --app-text-secondary: #6e6e73; --app-text-tertiary: #a1a1a6;
  --app-accent: #1f6b4a; --app-accent-soft: #e8f1ec; --app-danger: #d70015; --app-danger-soft: #fde8e8;
  --app-success: #1f6b4a;
  color-scheme: light; background: #ffffff; color: #1d1d1f;
}
.v2-report table { border-collapse: collapse; width: 100%; }
.v2-report tr { break-inside: avoid; }
@page { size: A4; margin: 12mm; }
@media print {
  html, body { background: #ffffff !important; }
  .v2-report-toolbar { display: none !important; }
  .v2-report { padding: 0 !important; }
}
`;

const th = "border-b border-[var(--app-border)] px-2 py-1.5 text-[11px] font-semibold text-[var(--app-text-secondary)]";
const td = "border-b border-[var(--app-border-subtle)] px-2 py-1.5 text-xs";

function StoreTable({ rows, language }: { rows: MonthStoreRow[]; language: "th" | "en" | "zh" }) {
  const t = v2Text(language);
  return (
    <table data-v2-report-stores>
      <thead>
        <tr>
          <th scope="col" className={`${th} text-left`}>{t("storeName")}</th>
          <th scope="col" className={`${th} text-right`}>{t("chats")}</th>
          <th scope="col" className={`${th} text-right`}>{t("unanswered")}</th>
          <th scope="col" className={`${th} text-right`}>{t("repliedRate")}</th>
          <th scope="col" className={`${th} text-right`}>{t("rate24")} (n)</th>
          <th scope="col" className={`${th} text-right`}>{t("rank")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.storeId}>
            <th scope="row" className={`${td} text-left font-normal`}>
              <span className="font-medium">{row.storeName}</span>
              {thaiLocationLabel(row.region, row.province) && <span className="block text-[11px] text-[var(--app-text-secondary)]">{thaiLocationLabel(row.region, row.province)}</span>}
            </th>
            <td className={`${td} text-right`}><StateValue state={row.chats} /></td>
            <td className={`${td} text-right`}><CountCell value={row.unreplied} delta={row.unrepliedDelta} /></td>
            <td className={`${td} text-right`}><RateCell value={row.replyRate} delta={row.replyRateDelta} target={REPLIED_RATE_TARGET} /></td>
            <td className={`${td} text-right`}><RateCell value={row.rate24} delta={row.rate24Delta} target={RATE24_TARGET} showN /></td>
            <td className={`${td} text-right`}><PartnerRank row={row} language={language} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PartnerSummaryTable() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  return (
    <table data-v2-report-partners>
      <thead>
        <tr>
          <th scope="col" className={`${th} text-left`}>{t("partnerFilter")}</th>
          <th scope="col" className={`${th} text-right`}>{t("storeName")}</th>
          <th scope="col" className={`${th} text-right`}>{t("chats")}</th>
          <th scope="col" className={`${th} text-right`}>{t("unanswered")}</th>
          <th scope="col" className={`${th} text-right`}>{t("repliedRate")}</th>
          <th scope="col" className={`${th} text-right`}>{t("rate24")}</th>
        </tr>
      </thead>
      <tbody>
        {data.partners.map((row) => (
          <tr key={row.partner}>
            <th scope="row" className={`${td} text-left font-medium`}>{row.partner}</th>
            <td className={`${td} text-right`}>{row.storeCount}</td>
            <td className={`${td} text-right`}><StateValue state={row.chats} /></td>
            <td className={`${td} text-right`}><CountCell value={row.unreplied} delta={row.unrepliedDelta} /></td>
            <td className={`${td} text-right`}><RateCell value={row.replyRate} delta={row.replyRateDelta} target={REPLIED_RATE_TARGET} /></td>
            <td className={`${td} text-right`}><RateCell value={row.rate24} delta={row.rate24Delta} target={RATE24_TARGET} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "← กลับ": the previous page, or /home when the report was opened without history (new tab, direct link). */
export function goBack(router: { back: () => void; push: (href: string) => void }) {
  if (typeof window !== "undefined" && window.history.length > 1) router.back();
  else router.push("/home");
}

function ReportBody() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const params = useSearchParams();
  const request = parseReportUrl(params, data.now);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const scope = useMemo(() => {
    if (request.store) {
      const row = data.rows.find((entry) => entry.storeId === request.store) ?? null;
      return row ? { kind: "store" as const, label: t("selectedStoreScope", { name: row.storeName }), totals: row as GroupTotals, rows: [row] } : null;
    }
    if (request.partner) {
      const partner = data.partners.find((entry) => entry.partner === request.partner) ?? null;
      const rows = sortMonthRows(data.rows.filter((row) => row.partner === request.partner), "rate24");
      return partner ? { kind: "partner" as const, label: t("partnerNamed", { partner: partner.partner }), totals: partner as GroupTotals, rows } : null;
    }
    return { kind: "network" as const, label: t("allStoresScope"), totals: data.network, rows: sortMonthRows(data.rows, "rate24") };
  }, [data.network, data.partners, data.rows, request.partner, request.store, t]);

  const summary = scope ? buildReportSummary({ monthLabel: monthShortLabel(data.month, language), periodText: data.periodText, scopeLabel: scope.label, totals: scope.totals, stores: scope.rows, inProgress: !data.close, language }) : "";
  const coverage = scope ? dataCoverage(scope.rows) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <div className="v2-report min-h-screen w-full">
    <div className="mx-auto max-w-[210mm] px-8 py-6 text-[var(--app-text-primary)]">
      <style>{REPORT_CSS}</style>
      <div className="v2-report-toolbar mb-6 flex flex-wrap items-center gap-2 border-b border-[var(--app-border)] pb-4 text-xs">
        <button type="button" data-report-back onClick={() => goBack(router)} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]">{t("reportBack")}</button>
        <span className="flex-1" />
        <button type="button" data-v2-copy-summary onClick={() => void copy()} disabled={!scope || data.coreLoading} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] disabled:opacity-50">{t("copySummary")}</button>
        <button type="button" onClick={() => window.print()} disabled={data.coreLoading} className="rounded-[var(--app-radius-md)] bg-[var(--app-accent)] px-3 py-1.5 font-medium text-white disabled:opacity-50">{t("printSavePdf")}</button>
        <span role="status" className="w-full text-right text-[var(--app-text-secondary)]">{copied === "done" ? t("summaryCopied") : copied === "failed" ? t("copyFailed") : ""}</span>
        {copied === "failed" && <textarea readOnly value={summary} className="h-32 w-full rounded border border-[var(--app-border)] p-2 font-mono text-xs" />}
      </div>

      <header className="mb-5">
        <p className="text-xs text-[var(--app-text-secondary)]">OPPO LINE OA · {t("monthlyReport")}</p>
        <h1 className="text-xl font-semibold">{monthLongLabel(data.month, language)} · {scope?.label ?? (request.partner ? t("partnerNamed", { partner: request.partner }) : t("storeName"))}</h1>
        <p className="text-xs text-[var(--app-text-secondary)]">{data.periodText} · <span data-v2-close-status>{data.statusText}</span></p>
      </header>

      {data.coreLoading ? (
        <p className="text-sm text-[var(--app-text-secondary)]">{t("loadingEllipsis")}</p>
      ) : !scope ? (
        <p className="text-sm">{t("reportNotFound", { scope: request.store ? t("storeName") : t("partnerFilter") })}</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">{t("scoreCompareTarget")}</h2>
            <KpiCompareTable totals={scope.totals} frame={data.frame} dense />
            <p className="mt-2 text-[11px] text-[var(--app-text-secondary)]">{t("kpiDifference")}</p>
          </section>
          {scope.kind === "network" && (
            <section>
            <h2 className="mb-2 text-sm font-semibold">{t("partnerFilter")}</h2>
              <PartnerSummaryTable />
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-semibold">{scope.kind === "store" ? t("storeName") : t("storeRankHeading", { count: scope.rows.length })}</h2>
            <StoreTable rows={scope.rows} language={language} />
          </section>
          <p data-v2-report-coverage className="text-xs text-[var(--app-text-secondary)]">
            {t("dataCoverageLabel", { coverage: coverage ? coverageText({ currentLabel: periodLabel(data.frame.current, language), previousLabel: periodLabel(data.frame.previous, language), current: coverage, previous: previousCoverage(scope.rows), previousReason: data.frame.previousCollected ? null : t("notCollected") }, language) : "", excluded: data.placeholders.length > 0 && scope.kind === "network" ? t("dataExcludesNoLine", { count: data.placeholders.length }) : "", comparisonError: data.previous.error ? t("reportComparisonError", { error: data.previous.error }) : "" })}
          </p>
        </div>
      )}

      <footer className="mt-8 border-t border-[var(--app-border)] pt-3 text-[11px] text-[var(--app-text-secondary)]">
        {!data.close && <p data-v2-report-open-month className="font-medium text-[var(--app-text-primary)]">{t("reportOpenMonthNote")}</p>}
        <p data-v2-report-how-counted>{t("howCountedLabel", { label: t("repliedRate"), detail: t("howReplied") })}</p>
        <p>{t("howCountedLabel", { label: t("rate24"), detail: t("howRate24") })}</p>
        <p>{t("rateInterpretation")}</p>
        <p>{t("printedAt", { date: new Date(data.now).toLocaleString(`${languageLocale(language)}-u-ca-gregory`, { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }) })}</p>
      </footer>
    </div>
    </div>
  );
}

/** "2/13", or "—" with the reason it is not ranked. */
export function PartnerRank({ row, language = "th" }: { row: MonthStoreRow; language?: "th" | "en" | "zh" }) {
  const t = v2Text(language);
  if (row.partnerRank !== null) return <span className="tabular-nums">{row.partnerRank}<span className="text-[var(--app-text-secondary)]">/{row.partnerRankedCount}</span></span>;
  const reason = row.partner === UNMATCHED_PARTNER ? t("noPartnerRank") : t("tooFewForRank", { count: MIN_RATE_SAMPLE });
  return <span title={reason} className="text-[var(--app-text-secondary)]">—<span className="sr-only"> ({reason})</span></span>;
}

/** /v2/report?month=&partner=&store= — A4, light, no navigation chrome. */
export function MonthReport() {
  return (
    <AuthorizedSection section="dashboard">
      <Suspense fallback={null}>
        <V2MonthDataProvider>
          <ReportBody />
        </V2MonthDataProvider>
      </Suspense>
    </AuthorizedSection>
  );
}
