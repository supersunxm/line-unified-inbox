"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { useAppLanguage } from "@/app/language";
import { PageHeader } from "@/components/shell/page-header";
import { SearchInput, SectionCard, SectionCardSkeleton, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow, useDeferredLoading } from "@/components/ui";
import { RATE24_TARGET, REPLIED_RATE_TARGET } from "@/lib/v2/kpi";
import { monthLongLabel } from "@/lib/v2/month";
import { parseStoresUrl, reportHref, storesHref, type StoresUrlState } from "@/lib/v2/month-url";
import { filterMonthRows, MIN_RATE_SAMPLE, sortMonthRows, type MonthSort, type MonthStoreRow } from "@/lib/v2/monthly-model";
import { sortPartnerNames, UNMATCHED_PARTNER } from "@/lib/v2/partners";
import { thaiLocationLabel, thaiRegion } from "@/lib/v2/thai-geo";
import { StoreScorecardDrawer } from "./store-scorecard-drawer";
import { DataLine } from "./v2-month-controls";
import { useV2Month } from "./v2-month-data";
import { HowCounted } from "./kpi-cards";
import { TagCoverageCell, useTagCoverageNote } from "./tag-coverage";
import { CountCell, RateCell, SourceNotice, StateValue } from "./v2-ui";
import { v2Text } from "@/lib/v2/v2-translations";

const SORT_LABELS: Array<[MonthSort, "sort24Gap" | "sortReplyRate" | "sort24Drop" | "sortUnanswered"]> = [
  ["rate24", "sort24Gap"],
  ["reply", "sortReplyRate"],
  ["delta", "sort24Drop"],
  ["unreplied", "sortUnanswered"],
];

const selectClass = "h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-xs text-[var(--app-text-primary)]";

/** "2/13", or "—" with the reason it is not ranked. */
export function PartnerRank({ row, language = "th" }: { row: MonthStoreRow; language?: "th" | "en" | "zh" }) {
  const t = v2Text(language);
  if (row.partnerRank !== null) return <span className="tabular-nums">{row.partnerRank}<span className="text-[var(--app-text-secondary)]">/{row.partnerRankedCount}</span></span>;
  const reason = row.partner === UNMATCHED_PARTNER ? t("noPartnerRank") : t("tooFewForRank", { count: MIN_RATE_SAMPLE });
  return <span title={reason} className="text-[var(--app-text-secondary)]">—<span className="sr-only"> ({reason})</span></span>;
}

function ReviewCell({ result, language }: { result: { qualifiedReviews: number; targetQualifiedReviews: number; isPassed: boolean } | null; language: "th" | "en" | "zh" }) {
  const t = v2Text(language);
  if (!result) return <span title={t("reviewNotChecked")} className="text-[var(--app-text-secondary)]">—<span className="sr-only"> ({t("reviewNotChecked")})</span></span>;
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold tabular-nums">{result.qualifiedReviews}/{result.targetQualifiedReviews}</span>{" "}
      <span className={`text-xs ${result.isPassed ? "text-[var(--app-text-secondary)]" : "text-[var(--app-danger)]"}`}>{result.isPassed ? t("targetMetShort") : t("targetBelowShort")}</span>
    </span>
  );
}

export function StoreScorecardView() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => ({ ...parseStoresUrl(params, data.now), month: data.month }), [data.month, data.now, params]);
  const [search, setSearch] = useState("");
  const showSkeleton = useDeferredLoading(data.coreLoading);

  const navigate = useCallback((patch: Partial<StoresUrlState>) => {
    router.replace(storesHref({ ...state, ...patch }), { scroll: false });
  }, [router, state]);

  const rows = useMemo(
    () => sortMonthRows(filterMonthRows(data.rows, { partner: state.partner, region: state.region, search }), state.sort),
    [data.rows, search, state.partner, state.region, state.sort],
  );
  const partners = useMemo(() => sortPartnerNames(data.rows.map((row) => row.partner)), [data.rows]);
  const regions = useMemo(
    () => [...new Set(data.rows.map((row) => row.region).filter((value): value is string => Boolean(value)))].sort((a, b) => (thaiRegion(a) ?? a).localeCompare(thaiRegion(b) ?? b, "th")),
    [data.rows],
  );
  const reviews = useMemo(() => new Map((data.google.data ?? []).map((store) => [store.id, store.kpiResult])), [data.google.data]);
  const openRow = state.store ? data.rows.find((row) => row.storeId === state.store) ?? null : null;
  const columns = 7 + (data.hasGoogleResults ? 1 : 0);
  const tagNote = useTagCoverageNote();

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader
        title={t("scorecardTitle", { month: monthLongLabel(data.month, language) })}
        description={t("scorecardDescription", { period: data.periodText })}
        actions={<Link href={reportHref({ month: data.month, partner: state.partner, store: null })} target="_blank" className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">{state.partner ? t("monthlyReportPartner", { partner: state.partner }) : t("monthlyReport") + " ↗"}</Link>}
      />
      <div className="space-y-4">
        <DataLine />
        {data.partnerMapping.error && !data.partnerMapping.data && <SourceNotice>{t("partnerMappingFailed", { error: data.partnerMapping.error })}</SourceNotice>}
        {(data.current.error || data.rates.error || data.previous.error) && (
          <SourceNotice>
            {t("sourceLoadListFailed", { details: [data.current.error && t("chatCountLabelError", { error: data.current.error }), data.rates.error && t("replyWithin24Error", { error: data.rates.error }), data.previous.error && t("comparisonPeriodError", { error: data.previous.error })].filter(Boolean).join(" · ") })}
          </SourceNotice>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            {t("partnerFilter")}
            <select data-v2-partner-filter value={state.partner ?? ""} onChange={(event) => navigate({ partner: event.target.value || null, store: null })} className={selectClass}>
              <option value="">{t("allPartners")}</option>
              {partners.map((partner) => <option key={partner} value={partner}>{partner}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            {t("region")}
            <select data-v2-region-filter value={state.region ?? ""} onChange={(event) => navigate({ region: event.target.value || null, store: null })} className={selectClass}>
              <option value="">{t("allRegions")}</option>
              {regions.map((region) => <option key={region} value={region}>{thaiRegion(region) ?? region}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">
            {t("sortBy")}
            <select data-v2-sort value={state.sort} onChange={(event) => navigate({ sort: event.target.value as MonthSort })} className={selectClass}>
              {SORT_LABELS.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
            </select>
          </label>
          <div className="ml-auto w-72">
            <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder={t("searchStoreName")} />
          </div>
        </div>

        <div data-v2-kpi-notes className="grid grid-cols-2 gap-4 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2">
          <div><span className="text-xs font-semibold">{t("repliedRate")}</span> <span className="text-xs text-[var(--app-text-secondary)]">· {t("noTarget")}</span><HowCounted kpi="replied" /></div>
          <div><span className="text-xs font-semibold">{t("rate24")}</span> <span className="text-xs text-[var(--app-text-secondary)]">· {RATE24_TARGET === null ? t("noTarget") : t("targetWithValue", { value: RATE24_TARGET })}</span><HowCounted kpi="rate24" /></div>
          <p className="col-span-2 text-xs text-[var(--app-text-secondary)]">{t("kpiDifference")} · {t("kpiDifferenceLegend")}</p>
        </div>

        {data.coreLoading ? (
          showSkeleton ? <SectionCardSkeleton title={t("storeScorecard")} lines={10} /> : null
        ) : (
          <SectionCard
            title={t("storeScorecard")}
            meta={t("storesFiltered", { visible: rows.length, total: data.rows.length, period: data.periodText })}
            bodyPadding="none"
            footer={<span className="text-xs text-[var(--app-text-secondary)]">{t("scorecardFooter", { count: MIN_RATE_SAMPLE, tagNote: tagNote ? t("tagCoverageNoteSuffix", { note: tagNote }) : "", reviewNote: data.hasGoogleResults ? "" : t("noGoogleReviewData") })}</span>}
          >
            <div className="overflow-x-auto">
              <Table data-v2-scorecard-table>
                <caption className="sr-only">{t("scorecardTitle", { month: data.periodText })}</caption>
                <TableHeader>
                  <tr>
                    <TableHead scope="col">{t("storeName")}</TableHead>
                    <TableHead scope="col" align="right">{t("chats")}</TableHead>
                    <TableHead scope="col" align="right">{t("unanswered")}</TableHead>
                    <TableHead scope="col" align="right">{t("repliedRate")}</TableHead>
                    <TableHead scope="col" align="right">{t("rate24")} (n)</TableHead>
                    <TableHead scope="col" align="right">{t("partnerRank")}</TableHead>
                    <TableHead scope="col" align="right">{t("tagCoverageLabel")}</TableHead>
                    {data.hasGoogleResults && <TableHead scope="col">{t("reviewLabel")}</TableHead>}
                  </tr>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableEmptyState colSpan={columns} message={t("noStoresForFilter")} />
                  ) : rows.map((row) => {
                    const location = thaiLocationLabel(row.region, row.province);
                    return (
                      <TableRow key={row.storeId} data-v2-scorecard-row={row.storeId} isSelected={row.storeId === state.store}>
                        <th scope="row" className="max-w-[18rem] px-4 py-3 text-left text-xs font-normal">
                          <button
                            type="button"
                            onClick={() => navigate({ store: row.storeId })}
                            className="block max-w-full truncate text-left text-sm font-medium text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/40"
                            title={row.storeName}
                          >
                            {row.storeName}
                          </button>
                          <span className="block truncate text-[var(--app-text-secondary)]">{[row.partner, location].filter(Boolean).join(" · ")}</span>
                        </th>
                        <TableCell align="right" numeric><StateValue state={row.chats} /></TableCell>
                        <TableCell align="right" numeric><CountCell value={row.unreplied} delta={row.unrepliedDelta} /></TableCell>
                        <TableCell align="right" numeric><RateCell value={row.replyRate} delta={row.replyRateDelta} target={REPLIED_RATE_TARGET} /></TableCell>
                        <TableCell align="right" numeric><RateCell value={row.rate24} delta={row.rate24Delta} target={RATE24_TARGET} showN /></TableCell>
                        <TableCell align="right"><PartnerRank row={row} language={language} /></TableCell>
                        <TableCell align="right"><TagCoverageCell counts={data.tagCoverageByStore.get(row.storeId)} /></TableCell>
                        {data.hasGoogleResults && <TableCell><ReviewCell result={reviews.get(row.storeId) ?? null} language={language} /></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
      </div>
      {openRow && <StoreScorecardDrawer row={openRow} onClose={() => navigate({ store: null })} />}
    </div>
  );
}
