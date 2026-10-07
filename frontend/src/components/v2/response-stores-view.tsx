"use client";

import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { v2Text } from "@/lib/v2/v2-translations";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { KpiStrip, SectionCard, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from "@/components/ui";
import { api } from "@/lib/api";
import { FOLLOW_TODAY_LIMIT, FOLLOW_UP_THRESHOLD_MINUTES, RECENT_WAIT_WINDOW_DAYS, RESPONSE_RATE_TARGET_PERCENT, followTodayWindowStart, formatWaitMinutes } from "@/lib/v2/business-hours";
import { displayedWait, locationLabel, rateDelta, responseKpis, storeManagerUrlOf, type StoreRow, type StoreSort, type WaitScope } from "@/lib/v2/response-model";
import { responseHref, type ResponseUrlState } from "@/lib/v2/response-url";
import { useV2Data } from "./v2-data";
import type { WaitingChat } from "@/lib/v2/response-model";
import { DailyRateBars, ManagerLink, MiniTrend, RateDelta, WaitLabel, formatRate } from "./v2-ui";

export function ResponseKpis() {
  const { language } = useAppLanguage();
  const t = v2Text(language);

  const data = useV2Data();
  const kpis = responseKpis(data.storeRows);
  const rate = data.totals7d?.rate ?? null;
  const previous = data.totalsPrev7d?.rate ?? null;
  const delta = rateDelta(rate, previous);
  return (
    <KpiStrip
      columns={5}
      items={[
        {
          id: "follow-today",
          label: t("followStores"),
          value: data.waiting.data ? kpis.followTodayStores.toLocaleString(languageLocale(language)) : null,
          subtext: data.waiting.data
            ? t("followCandidates", { count: kpis.followTodayCandidates, minutes: FOLLOW_UP_THRESHOLD_MINUTES, limit: FOLLOW_TODAY_LIMIT })
            : t("noDataYet"),
        },
        {
          id: "waiting",
          label: t("waitingChats"),
          value: kpis.waitingChats.toLocaleString(languageLocale(language)),
          subtext: t("waitingCoverage", { count: kpis.waitingStores, total: kpis.storesWithData }),
        },
        {
          id: "old-backlog",
          label: t("backlogDays", { days: RECENT_WAIT_WINDOW_DAYS }),
          value: data.waiting.data ? kpis.oldBacklogChats.toLocaleString(languageLocale(language)) : null,
          subtext: data.waiting.data ? (
            <>
              {t("oldBacklogStores", { count: kpis.oldBacklogStores })} ·{" "}
              <Link href={responseHref({ tab: "all", sort: "age" })} className="font-medium text-[var(--app-accent)] hover:underline">{t("viewAge")}</Link>
            </>
          ) : t("noDataYet"),
        },
        {
          id: "rate",
          label: t("weekRate"),
          value: formatRate(rate) === "—" ? null : formatRate(rate),
          subtext: rate === null
            ? t("noDataYet")
            : t("rateComparison", { target: RESPONSE_RATE_TARGET_PERCENT, previous: formatRate(previous), change: delta === null ? "" : ` (${t("points", { value: `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}` })})` }),
        },
        {
          id: "no-data",
          label: t("noDataStores"),
          value: data.storesWithData ? kpis.noDataStores.toLocaleString(languageLocale(language)) : null,
          subtext: data.storesWithData ? t("noDataCoverage", { count: kpis.totalStores }) : t("noDataYet"),
        },
      ]}
    />
  );
}


/** ตามวันนี้ measures waits since yesterday 10:00; every other tab uses the last 7 days. */
export function waitScopeForTab(tab: ResponseUrlState["tab"]): WaitScope {
  return tab === "follow-today" ? "window" : "7d";
}

function StoreTable({ rows, selectedStoreId, onSelect, tab, sort }: { rows: StoreRow[]; selectedStoreId: string | null; onSelect: (storeId: string) => void; tab: ResponseUrlState["tab"]; sort: StoreSort | null }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);

const TABLE_TITLES: Record<StoreSort, string> = {
  follow: t("tableFollow"),
  recent: t("tableRecent"),
  wait: t("tableWait"),
  rate: t("tableRate"),
  age: t("tableAge"),
};

  const scope = waitScopeForTab(tab);
  const data = useV2Data();
  const trendLoading = data.daily.loading && !data.daily.data;
  const emptyMessage = tab === "follow-today"
    ? t("noOverdueStores", { minutes: FOLLOW_UP_THRESHOLD_MINUTES })
    : tab === "no-data" ? t("allHaveData") : t("noneHaveData");
  return (
    <SectionCard title={TABLE_TITLES[sort ?? "recent"]} meta={t("storeCount", { count: rows.length })} bodyPadding="none">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>{t("store")}</TableHead>
              <TableHead align="right">{t("waiting")}</TableHead>
              <TableHead align="right">{t("waitingYesterday")}</TableHead>
              <TableHead>{scope === "window" ? t("waitYesterday") : t("waitWeek")}</TableHead>
              <TableHead>{t("rateWeek")}</TableHead>
              <TableHead>{t("trendWeek")}</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableEmptyState colSpan={6} message={emptyMessage} /> : rows.map((row) => (
              <TableRow
                key={row.storeId}
                data-v2-store-row={row.storeId}
                aria-selected={row.storeId === selectedStoreId}
                onClick={() => onSelect(row.storeId)}
                className={`cursor-pointer ${row.storeId === selectedStoreId ? "bg-[var(--app-accent-soft)]" : ""}`}
              >
                <TableCell className="max-w-[13rem]">
                  <button type="button" title={row.storeName} onClick={(event) => { event.stopPropagation(); onSelect(row.storeId); }} className="block max-w-full text-left font-medium hover:underline">
                    <span className="block truncate text-[var(--app-text-primary)]">{row.storeName}</span>
                  </button>
                  {!row.hasData ? (
                    <div className="text-xs text-[var(--app-text-secondary)]">{t("notCollectingStore")}</div>
                  ) : locationLabel(row) ? (
                    <div title={locationLabel(row) ?? undefined} className="truncate text-xs text-[var(--app-text-secondary)]">{locationLabel(row)}</div>
                  ) : null}
                </TableCell>
                <TableCell align="right" numeric>
                  {row.hasData ? row.waitingCount.toLocaleString(languageLocale(language)) : "—"}
                  {row.hasData && row.oldWaitingCount > 0 && <div className="whitespace-nowrap text-xs font-normal text-[var(--app-text-secondary)]">{t("oldCount", { days: RECENT_WAIT_WINDOW_DAYS, count: row.oldWaitingCount })}</div>}
                </TableCell>
                <TableCell align="right" numeric data-v2-since-yesterday={row.storeId}>
                  {row.hasData ? row.sinceYesterdayCount.toLocaleString(languageLocale(language)) : "—"}
                  {row.hasData && row.followTodayCount > 0 && <div className="whitespace-nowrap text-xs font-normal text-[var(--app-danger)]">{t("overdueCount", { minutes: FOLLOW_UP_THRESHOLD_MINUTES, count: row.followTodayCount })}</div>}
                </TableCell>
                <TableCell>{row.hasData ? <WaitLabel compact businessMinutes={displayedWait(row, scope).minutes} waitingSince={displayedWait(row, scope).waitingSince} now={data.now} /> : "—"}</TableCell>
                <TableCell>
                  {row.hasData ? (
                    <span className="inline-flex flex-col whitespace-nowrap">
                      <span className={`font-semibold tabular-nums ${row.rate7d !== null && row.rate7d < RESPONSE_RATE_TARGET_PERCENT ? "text-[var(--app-danger)]" : ""}`}>{formatRate(row.rate7d)}</span>
                      <RateDelta delta={row.rateDelta} />
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>{row.hasData ? <MiniTrend values={row.trend} loading={trendLoading} /> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

/** Manager URL for a store: from a loaded waiting chat, else from one conversation of the store. */
function useStoreManagerUrl(row: StoreRow | null): string | null {
  const [fetched, setFetched] = useState<{ storeId: string; url: string | null } | null>(null);
  const storeId = row?.storeId ?? null;
  const known = row?.managerUrl ?? null;
  useEffect(() => {
    if (!storeId || known) return undefined;
    let cancelled = false;
    void api.conversations({ storeId, pageSize: 1 })
      .then((response) => { if (!cancelled) setFetched({ storeId, url: response.items[0] ? storeManagerUrlOf(response.items[0].store) : null }); })
      .catch(() => { if (!cancelled) setFetched({ storeId, url: null }); });
    return () => { cancelled = true; };
  }, [storeId, known]);
  return known ?? (fetched && fetched.storeId === storeId ? fetched.url : null);
}

function WaitingChatList({ chats, storeId, now, onOpenConversation }: { chats: WaitingChat[]; storeId: string; now: number; onOpenConversation: (storeId: string, conversationId: string) => void }) {
  return (
    <ul className="divide-y divide-[var(--app-border-subtle)]">
      {chats.map((chat) => (
        <li key={chat.id}>
          <button type="button" data-v2-waiting-chat={chat.id} onClick={() => onOpenConversation(storeId, chat.id)} className="flex w-full items-start justify-between gap-3 py-2.5 text-left hover:bg-[var(--app-surface-hover)]">
            <span className="min-w-0 truncate text-sm font-medium text-[var(--app-text-primary)]">{chat.customerName}</span>
            <span className="shrink-0 text-right text-sm"><WaitLabel businessMinutes={chat.businessMinutes} waitingSince={chat.waitingSince} now={now} /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StoreDetail({ row, scope, onOpenConversation }: { row: StoreRow | null; scope: WaitScope; onOpenConversation: (storeId: string, conversationId: string) => void }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);

  const data = useV2Data();
  const managerUrl = useStoreManagerUrl(row);
  const chats = useMemo(() => (row ? data.waitingChats.filter((chat) => chat.storeId === row.storeId) : []), [data.waitingChats, row]);
  // Since yesterday 10:00 first; older chats (≤ 7 days) go into a collapsed section.
  const windowStart = followTodayWindowStart(data.now);
  const recentChats = chats.filter((chat) => Date.parse(chat.waitingSince) >= windowStart);
  const olderChats = chats.filter((chat) => Date.parse(chat.waitingSince) < windowStart);
  if (!row) {
    return (
      <SectionCard title={t("storeDetails")}>
        <p className="text-sm text-[var(--app-text-secondary)]">{t("selectStoreHelp")}</p>
      </SectionCard>
    );
  }
  return (
    <SectionCard title={row.storeName} meta={locationLabel(row) ?? undefined}>
      <div className="space-y-5">
        {managerUrl && <ManagerLink href={managerUrl} />}
        {!row.hasData && <p className="text-sm text-[var(--app-text-secondary)]">{t("notCollectingHelp")}</p>}
        <dl className="grid grid-cols-3 gap-3">
          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--app-text-secondary)]">{t("waiting")}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{row.hasData ? row.waitingCount : "—"}</dd>
          </div>
          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--app-text-secondary)]">{scope === "window" ? t("waitYesterday") : t("waitWeek")}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{row.hasData && displayedWait(row, scope).minutes !== null ? formatWaitMinutes(displayedWait(row, scope).minutes ?? 0, language) : "—"}</dd>
          </div>
          <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-3">
            <dt className="text-xs text-[var(--app-text-secondary)]">{t("rate24Label")}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{row.hasData ? formatRate(row.rate7d) : "—"}</dd>
            {row.hasData && <dd><RateDelta delta={row.rateDelta} /></dd>}
          </div>
        </dl>
        {row.hasData && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("dailyRateTitle")}</h3>
            <DailyRateBars days={data.dailyDays} values={row.trend} target={RESPONSE_RATE_TARGET_PERCENT} loading={data.daily.loading && !data.daily.data} />
          </div>
        )}
        {row.hasData && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("waitingDays", { days: RECENT_WAIT_WINDOW_DAYS })}</h3>
            {row.oldWaitingCount > 0 && <p className="mb-2 text-xs text-[var(--app-text-secondary)]">{t("additionalBacklog", { days: RECENT_WAIT_WINDOW_DAYS, count: row.oldWaitingCount })}</p>}
            {chats.length === 0 ? (
              <p className="text-sm text-[var(--app-text-secondary)]">{row.waitingCount > 0 ? t("noWaitingDays", { days: RECENT_WAIT_WINDOW_DAYS }) : t("noWaiting")}</p>
            ) : (
              <>
                {recentChats.length > 0
                  ? <WaitingChatList chats={recentChats} storeId={row.storeId} now={data.now} onOpenConversation={onOpenConversation} />
                  : <p className="text-sm text-[var(--app-text-secondary)]">{t("noWaitingYesterday")}</p>}
                {olderChats.length > 0 && (
                  <details data-v2-older-chats className="mt-2 rounded-[var(--app-radius-md)] border border-[var(--app-border-subtle)]">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--app-text-secondary)]">{t("olderChats", { count: olderChats.length })}</summary>
                    <div className="px-3"><WaitingChatList chats={olderChats} storeId={row.storeId} now={data.now} onOpenConversation={onOpenConversation} /></div>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export function ResponseStoresView({ rows, state, onSelectStore, onOpenConversation }: {
  rows: StoreRow[];
  state: ResponseUrlState;
  onSelectStore: (storeId: string) => void;
  onOpenConversation: (storeId: string, conversationId: string) => void;
}) {
  const data = useV2Data();
  const { requestDaily } = data;
  useEffect(() => { requestDaily(); }, [requestDaily]);
  const selected = data.storeRows.find((row) => row.storeId === state.store) ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_340px]">
      <StoreTable rows={rows} selectedStoreId={selected?.storeId ?? null} onSelect={onSelectStore} tab={state.tab} sort={state.sort} />
      <div className="sticky top-0">
        <StoreDetail row={selected} scope={waitScopeForTab(state.tab)} onOpenConversation={onOpenConversation} />
      </div>
    </div>
  );
}
