"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useMemo, useState } from "react";
import { AuthorizedSection } from "@/app/authorized-workspace";
import { RESPONSE_RATE_TARGET_PERCENT } from "@/lib/v2/business-hours";
import { monthLongLabel, monthShortLabel, monthStatusLabel, periodLabel } from "@/lib/v2/month";
import { parseReportUrl, storesHref } from "@/lib/v2/month-url";
import { dataCoverage, sortMonthRows, type GroupTotals, type MonthStoreRow } from "@/lib/v2/monthly-model";
import { buildReportSummary, OPEN_MONTH_NOTE } from "@/lib/v2/report-summary";
import { thaiLocationLabel } from "@/lib/v2/thai-geo";
import { type ValueState } from "@/lib/v2/value-state";
import { PartnerRank } from "./store-scorecard-view";
import { useV2Month, V2MonthDataProvider } from "./v2-month-data";
import { DeltaValue, StateValue } from "./v2-ui";

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

function KpiTable({ totals }: { totals: GroupTotals }) {
  const data = useV2Month();
  const lines: Array<[string, ValueState, ValueState, React.ReactNode, "count" | "percent", number | undefined]> = [
    ["แชท", totals.chats, totals.previousChats, "—", "count", undefined],
    ["ยังไม่ตอบ", totals.unreplied, totals.previousUnreplied, <DeltaValue key="d" state={totals.unrepliedDelta} kind="count" worseWhen="up" />, "count", undefined],
    ["ตอบแล้ว %", totals.replyRate, totals.previousReplyRate, <DeltaValue key="d" state={totals.replyRateDelta} kind="points" worseWhen="down" />, "percent", undefined],
    ["ตอบใน 24 ชม.", totals.rate24, totals.previousRate24, <DeltaValue key="d" state={totals.rate24Delta} kind="points" worseWhen="down" />, "percent", RESPONSE_RATE_TARGET_PERCENT],
  ];
  return (
    <table data-v2-report-kpis>
      <thead>
        <tr>
          <th scope="col" className={`${th} text-left`}>ตัวชี้วัด</th>
          <th scope="col" className={`${th} text-right`}>{periodLabel(data.frame.current)}</th>
          <th scope="col" className={`${th} text-right`}>{periodLabel(data.frame.previous)}</th>
          <th scope="col" className={`${th} text-right`}>เปลี่ยน</th>
          <th scope="col" className={`${th} text-right`}>เป้า</th>
        </tr>
      </thead>
      <tbody>
        {lines.map(([label, current, previous, delta, format, target]) => (
          <tr key={label}>
            <th scope="row" className={`${td} text-left font-medium`}>{label}</th>
            <td className={`${td} text-right font-semibold`}><StateValue state={current} format={format} target={target} showN={format === "percent"} /></td>
            <td className={`${td} text-right`}><StateValue state={previous} format={format} /></td>
            <td className={`${td} text-right`}>{delta}</td>
            <td className={`${td} text-right text-[var(--app-text-secondary)]`}>{target ? `${target}%` : label === "ยังไม่ตอบ" ? "0" : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StoreTable({ rows }: { rows: MonthStoreRow[] }) {
  return (
    <table data-v2-report-stores>
      <thead>
        <tr>
          <th scope="col" className={`${th} text-left`}>สาขา</th>
          <th scope="col" className={`${th} text-right`}>แชท</th>
          <th scope="col" className={`${th} text-right`}>ยังไม่ตอบ</th>
          <th scope="col" className={`${th} text-right`}>เทียบ</th>
          <th scope="col" className={`${th} text-right`}>ตอบแล้ว %</th>
          <th scope="col" className={`${th} text-right`}>ตอบใน 24 ชม. (n)</th>
          <th scope="col" className={`${th} text-right`}>อันดับ</th>
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
            <td className={`${td} text-right font-semibold`}><StateValue state={row.unreplied} /></td>
            <td className={`${td} text-right`}><DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /></td>
            <td className={`${td} text-right`}><StateValue state={row.replyRate} format="percent" /></td>
            <td className={`${td} text-right`}><StateValue state={row.rate24} format="percent" target={RESPONSE_RATE_TARGET_PERCENT} showN /></td>
            <td className={`${td} text-right`}><PartnerRank row={row} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PartnerSummaryTable() {
  const data = useV2Month();
  return (
    <table data-v2-report-partners>
      <thead>
        <tr>
          <th scope="col" className={`${th} text-left`}>Partner</th>
          <th scope="col" className={`${th} text-right`}>สาขา</th>
          <th scope="col" className={`${th} text-right`}>แชท</th>
          <th scope="col" className={`${th} text-right`}>ยังไม่ตอบ</th>
          <th scope="col" className={`${th} text-right`}>เทียบ</th>
          <th scope="col" className={`${th} text-right`}>ตอบแล้ว %</th>
          <th scope="col" className={`${th} text-right`}>ตอบใน 24 ชม.</th>
        </tr>
      </thead>
      <tbody>
        {data.partners.map((row) => (
          <tr key={row.partner}>
            <th scope="row" className={`${td} text-left font-medium`}>{row.partner}</th>
            <td className={`${td} text-right`}>{row.storeCount}</td>
            <td className={`${td} text-right`}><StateValue state={row.chats} /></td>
            <td className={`${td} text-right font-semibold`}><StateValue state={row.unreplied} /></td>
            <td className={`${td} text-right`}><DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /></td>
            <td className={`${td} text-right`}><StateValue state={row.replyRate} format="percent" /></td>
            <td className={`${td} text-right`}><StateValue state={row.rate24} format="percent" target={RESPONSE_RATE_TARGET_PERCENT} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportBody() {
  const data = useV2Month();
  const params = useSearchParams();
  const request = parseReportUrl(params, data.now);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const scope = useMemo(() => {
    if (request.store) {
      const row = data.rows.find((entry) => entry.storeId === request.store) ?? null;
      return row ? { kind: "store" as const, label: `สาขา ${row.storeName}`, totals: row as GroupTotals, rows: [row] } : null;
    }
    if (request.partner) {
      const partner = data.partners.find((entry) => entry.partner === request.partner) ?? null;
      const rows = sortMonthRows(data.rows.filter((row) => row.partner === request.partner), "unreplied");
      return partner ? { kind: "partner" as const, label: `Partner ${partner.partner}`, totals: partner as GroupTotals, rows } : null;
    }
    return { kind: "network" as const, label: "ทุกสาขา", totals: data.network, rows: sortMonthRows(data.rows, "unreplied") };
  }, [data.network, data.partners, data.rows, request.partner, request.store]);

  const summary = scope ? buildReportSummary({ monthLabel: monthShortLabel(data.month), periodText: data.periodText, scopeLabel: scope.label, totals: scope.totals, stores: scope.rows, inProgress: data.frame.inProgress }) : "";
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
        <Link href={storesHref({ month: data.month, partner: request.partner, store: request.store })} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]">← กลับ</Link>
        <span className="flex-1" />
        <button type="button" data-v2-copy-summary onClick={() => void copy()} disabled={!scope || data.coreLoading} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1.5 font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] disabled:opacity-50">คัดลอกสรุป</button>
        <button type="button" onClick={() => window.print()} disabled={data.coreLoading} className="rounded-[var(--app-radius-md)] bg-[var(--app-accent)] px-3 py-1.5 font-medium text-white disabled:opacity-50">พิมพ์ / บันทึก PDF</button>
        <span role="status" className="w-full text-right text-[var(--app-text-secondary)]">{copied === "done" ? "คัดลอกสรุปแล้ว วางใน LINE ได้เลย" : copied === "failed" ? "คัดลอกไม่ได้ เลือกข้อความด้านล่างแล้วคัดลอกเอง" : ""}</span>
        {copied === "failed" && <textarea readOnly value={summary} className="h-32 w-full rounded border border-[var(--app-border)] p-2 font-mono text-xs" />}
      </div>

      <header className="mb-5">
        <p className="text-xs text-[var(--app-text-secondary)]">OPPO LINE OA · รายงานเดือน</p>
        <h1 className="text-xl font-semibold">{monthLongLabel(data.month)} · {scope?.label ?? (request.partner ? `Partner ${request.partner}` : "สาขา")}</h1>
        <p className="text-xs text-[var(--app-text-secondary)]">{data.periodText} · {monthStatusLabel(data.frame)}</p>
      </header>

      {data.coreLoading ? (
        <p className="text-sm text-[var(--app-text-secondary)]">กำลังโหลด…</p>
      ) : !scope ? (
        <p className="text-sm">ไม่พบ{request.store ? "สาขา" : " partner "}นี้ในเดือนที่เลือก</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">ตัวชี้วัดเทียบเดือนก่อนและเป้า</h2>
            <KpiTable totals={scope.totals} />
          </section>
          {scope.kind === "network" && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Partner</h2>
              <PartnerSummaryTable />
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-semibold">{scope.kind === "store" ? "สาขา" : `สาขา (${scope.rows.length}) เรียงตามยังไม่ตอบ`}</h2>
            <StoreTable rows={scope.rows} />
          </section>
          <p data-v2-report-coverage className="text-xs text-[var(--app-text-secondary)]">
            ความครบของข้อมูล: สาขาที่มีข้อมูลแชท {coverage?.withChats}/{coverage?.total}
            {data.placeholders.length > 0 && scope.kind === "network" ? ` · ไม่นับ ${data.placeholders.length} ร้านที่ยังไม่มี LINE OA` : ""}
            {data.previous.error ? ` · ช่วงเทียบ: ${data.previous.error}` : ""}
          </p>
        </div>
      )}

      <footer className="mt-8 border-t border-[var(--app-border)] pt-3 text-[11px] text-[var(--app-text-secondary)]">
        {data.frame.inProgress && <p data-v2-report-open-month className="font-medium text-[var(--app-text-primary)]">{OPEN_MONTH_NOTE}</p>}
        <p>แชท ยังไม่ตอบ ตอบแล้ว: เหมือนหน้าแชทร้านค้าของเดือนเดียวกัน · ตอบใน 24 ชม.: เหมือนหน้าอัตราตอบกลับ 24 ชม. · อัตราจากแชทน้อยกว่า 10 แชทแสดงสีจางและไม่เทียบเป้า</p>
        <p>พิมพ์เมื่อ {new Date(data.now).toLocaleString("th-TH-u-ca-gregory", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}</p>
      </footer>
    </div>
    </div>
  );
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
