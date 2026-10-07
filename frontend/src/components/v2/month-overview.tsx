"use client";

import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { v2Text } from "@/lib/v2/v2-translations";

import Link from "next/link";
import { UNMATCHED_PARTNER } from "@/lib/v2/partners";
import React from "react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStripSkeleton, SectionCard, SectionCardSkeleton, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow, useDeferredLoading } from "@/components/ui";
import { RATE24_TARGET, REPLIED_RATE_TARGET } from "@/lib/v2/kpi";
import { monthLongLabel, periodLabel } from "@/lib/v2/month";
import { reportHref, storesHref } from "@/lib/v2/month-url";
import { topUnreplied } from "@/lib/v2/monthly-model";
import { sumTagCoverage } from "@/lib/v2/tag-coverage";
import { numericValue } from "@/lib/v2/value-state";
import { TwoKpiCards, VolumeLine } from "./kpi-cards";
import { TagCoverageCell } from "./tag-coverage";
import { DataLine, OverviewTabs } from "./v2-month-controls";
import { useV2Month } from "./v2-month-data";
import { CountCell, DeltaValue, RateCell, SourceNotice, StateValue } from "./v2-ui";

function PartnerTable() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  return (
    <SectionCard title={t("partnerFilter")} meta={t("partnerSort", { period: data.periodText })} bodyPadding="none">
      <div className="overflow-x-auto">
        <Table data-v2-partner-table>
          <TableHeader>
            <tr>
              <TableHead scope="col">{t("partnerFilter")}</TableHead>
              <TableHead scope="col" align="right">{t("stores")}</TableHead>
              <TableHead scope="col" align="right">{t("chats")}</TableHead>
              <TableHead scope="col" align="right">{t("unanswered")}</TableHead>
              <TableHead scope="col" align="right">{t("repliedRate")}</TableHead>
              <TableHead scope="col" align="right">{t("rate24")}</TableHead>
              <TableHead scope="col" align="right">{t("tagCoverage")}</TableHead>
              <TableHead scope="col"><span className="sr-only">{t("report")}</span></TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {data.partners.length === 0 ? (
              <TableEmptyState colSpan={8} message={t("noStores")} />
            ) : data.partners.map((row) => (
              <TableRow key={row.partner === UNMATCHED_PARTNER ? t("noPartner") : row.partner} data-v2-partner={row.partner === UNMATCHED_PARTNER ? t("noPartner") : row.partner}>
                <TableCell className="font-medium">
                  <Link href={storesHref({ month: data.month, partner: row.partner })} className="text-[var(--app-text-primary)] hover:text-[var(--app-accent)] hover:underline">{row.partner === UNMATCHED_PARTNER ? t("noPartner") : row.partner}</Link>
                </TableCell>
                <TableCell align="right" numeric>{row.storeCount.toLocaleString(languageLocale(language))}</TableCell>
                <TableCell align="right" numeric><StateValue state={row.chats} /></TableCell>
                <TableCell align="right" numeric><CountCell value={row.unreplied} delta={row.unrepliedDelta} /></TableCell>
                <TableCell align="right" numeric><RateCell value={row.replyRate} delta={row.replyRateDelta} target={REPLIED_RATE_TARGET} /></TableCell>
                <TableCell align="right" numeric><RateCell value={row.rate24} delta={row.rate24Delta} target={RATE24_TARGET} /></TableCell>
                <TableCell align="right"><TagCoverageCell counts={sumTagCoverage(row.storeIds.map((id) => data.tagCoverageByStore.get(id)))} /></TableCell>
                <TableCell>
                  <Link href={reportHref({ month: data.month, partner: row.partner, store: null })} target="_blank" className="whitespace-nowrap text-xs font-medium text-[var(--app-accent)] hover:underline">{t("reportLink")}<span className="sr-only"> {row.partner === UNMATCHED_PARTNER ? t("noPartner") : row.partner}</span></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {data.partners.length > 0 && (
            <tfoot className="border-t border-[var(--app-border)] text-xs">
              <tr>
                <th scope="row" className="px-4 py-3 text-left font-semibold">{t("allStores")}</th>
                <td className="px-4 py-3 text-right tabular-nums">{data.rows.length.toLocaleString(languageLocale(language))}</td>
                <td className="px-4 py-3 text-right"><StateValue state={data.network.chats} /></td>
                <td className="px-4 py-3 text-right"><CountCell value={data.network.unreplied} delta={data.network.unrepliedDelta} /></td>
                <td className="px-4 py-3 text-right"><RateCell value={data.network.replyRate} delta={data.network.replyRateDelta} target={REPLIED_RATE_TARGET} /></td>
                <td className="px-4 py-3 text-right"><RateCell value={data.network.rate24} delta={data.network.rate24Delta} target={RATE24_TARGET} /></td>
                <td className="px-4 py-3 text-right"><TagCoverageCell counts={data.tagCoverage.data?.network} /></td>
                <td className="px-4 py-3">
                  <Link href={reportHref({ month: data.month, partner: null, store: null })} target="_blank" className="whitespace-nowrap text-xs font-medium text-[var(--app-accent)] hover:underline">{t("reportLink")}<span className="sr-only"> {t("allStores")}</span></Link>
                </td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </SectionCard>
  );
}

function TopUnreplied() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const top = topUnreplied(data.rows, 10);
  return (
    <SectionCard
      title={t("topUnanswered")}
      meta={t("topTen", { period: periodLabel(data.frame.current, language) })}
      bodyPadding="none"
      footer={<Link href={storesHref({ month: data.month })} className="font-medium text-[var(--app-accent)]">{t("viewStores")}</Link>}
    >
      {top.length === 0 ? (
        <p className="p-4 text-sm text-[var(--app-text-secondary)]">{data.current.error ? t("loadError", { error: data.current.error }) : t("noUnanswered")}</p>
      ) : (
        <ol data-v2-top-unreplied className="divide-y divide-[var(--app-border-subtle)]">
          {top.map((row, index) => (
            <li key={row.storeId}>
              <Link href={storesHref({ month: data.month, store: row.storeId })} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--app-surface-hover)]">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--app-text-secondary)]">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--app-text-primary)]">{row.storeName}</span>
                  <span className="block truncate text-xs text-[var(--app-text-secondary)]">{row.partner === UNMATCHED_PARTNER ? t("noPartner") : row.partner}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold"><StateValue state={row.unreplied} /> <span className="text-xs font-normal text-[var(--app-text-secondary)]">{t("chats")}</span></span>
                  <span className="block text-xs text-[var(--app-text-secondary)]">{t("rate24Label")}<StateValue state={row.rate24} format="percent" target={RATE24_TARGET ?? undefined} />{numericValue(row.unrepliedDelta) !== null && <> · <DeltaValue state={row.unrepliedDelta} kind="count" worseWhen="up" /></>}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

export function MonthOverview() {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const data = useV2Month();
  const showSkeleton = useDeferredLoading(data.coreLoading);
  const failures = [
    data.stores.error && !data.stores.data && t("storeListError", { error: data.stores.error }),
    data.partnerMapping.error && !data.partnerMapping.data && t("partnersError", { error: data.partnerMapping.error }),
    data.current.error && !data.current.data && t("chatCountError", { error: data.current.error }),
    data.previous.error && t("comparisonError", { error: data.previous.error }),
    data.rates.error && !data.rates.data && t("rate24Error", { error: data.rates.error }),
    data.previousRates.error && !data.previousRates.data && t("previousRateError", { error: data.previousRates.error }),
  ].filter(Boolean);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader
        title={t("overviewTitle", { month: monthLongLabel(data.month, language) })}
        description={t("overviewDescription", { period: data.periodText })}
        actions={<OverviewTabs active="month" month={data.month} />}
      />
      <div className="space-y-4">
        <DataLine />
        {failures.length > 0 && <SourceNotice>{t("failedSources", { errors: failures.join(" · ") })}</SourceNotice>}
        {data.coreLoading ? (
          showSkeleton ? (
            <div className="space-y-4">
              <KpiStripSkeleton columns={2} labels={[t("repliedRate"), t("rate24")]} />
              <SectionCardSkeleton title={t("partnerFilter")} lines={8} />
            </div>
          ) : null
        ) : (
          <>
            <TwoKpiCards totals={data.network} frame={data.frame} />
            <VolumeLine totals={data.network} frame={data.frame} />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,380px)] items-start gap-5">
              <PartnerTable />
              <TopUnreplied />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
