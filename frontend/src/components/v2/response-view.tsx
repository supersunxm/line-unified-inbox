"use client";

import { useAppLanguage } from "@/app/language";
import { languageLocale } from "@/app/language-utils";
import { v2Text } from "@/lib/v2/v2-translations";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStripSkeleton, SectionCardSkeleton, SegmentedControl, useDeferredLoading } from "@/components/ui";
import { FOLLOW_TODAY_LIMIT, FOLLOW_UP_THRESHOLD_MINUTES, RECENT_WAIT_WINDOW_DAYS } from "@/lib/v2/business-hours";
import { defaultSortForTab, filterStoreRows, sortStoreRows, type StoreSort, type StoreTab } from "@/lib/v2/response-model";
import { ALL_STORES, parseResponseUrl, responseUrlQuery, type ResponseUrlState, type ResponseView as View } from "@/lib/v2/response-url";
import { ResponseChatView } from "./response-chat-view";
import { ResponseKpis, ResponseStoresView } from "./response-stores-view";
import { useV2Data, WAITING_MAX_PAGES, WAITING_PAGE_SIZE } from "./v2-data";
import { OverviewTabs } from "./v2-month-controls";
import { SourceNotice } from "./v2-ui";


function Notices() {
  const { language } = useAppLanguage();
  const t = v2Text(language);

  const data = useV2Data();
  const notices: string[] = [];
  if (data.summary.error) notices.push(t("responseStatusError", { error: data.summary.error }));
  if (data.waiting.error) notices.push(t("waitingError", { error: data.waiting.error }));
  if (data.waiting.data?.truncated) notices.push(t("truncatedWait", { days: RECENT_WAIT_WINDOW_DAYS, count: (WAITING_MAX_PAGES * WAITING_PAGE_SIZE).toLocaleString(languageLocale(language)) }));
  if (data.mirror.error) notices.push(data.hasDataSource === "activity"
    ? t("activityFallback", { error: data.mirror.error })
    : t("collectionError", { error: data.mirror.error }));
  if (data.rates7d.error || data.ratesPrev7d.error) notices.push(t("responseRateError", { error: data.rates7d.error ?? data.ratesPrev7d.error ?? "" }));
  if (data.daily.error) notices.push(t("dailyError", { error: data.daily.error }));
  if (notices.length === 0) return null;
  return <div className="space-y-2">{notices.map((notice) => <SourceNotice key={notice}>{notice}</SourceNotice>)}</div>;
}

export function ResponseView() {
  const { language } = useAppLanguage();
  const t = v2Text(language);

const TAB_LABELS: Record<StoreTab, string> = { "follow-today": t("followToday"), all: t("all"), "no-data": t("noData") };
const SORT_LABELS: Array<[StoreSort, string]> = [["recent", t("sortRecent")], ["wait", t("sortWait")], ["rate", t("sortRate")], ["age", t("sortAge")]];

  const data = useV2Data();
  const router = useRouter();
  const pathname = usePathname() || "/v2/response";
  const searchParams = useSearchParams();
  const state = useMemo(() => parseResponseUrl(searchParams), [searchParams]);
  const showSkeleton = useDeferredLoading(data.coreLoading);

  const navigate = useCallback((patch: Partial<ResponseUrlState>) => {
    router.replace(`${pathname}${responseUrlQuery({ ...state, ...patch })}`, { scroll: false });
  }, [pathname, router, state]);

  const sort = state.sort ?? defaultSortForTab(state.tab);
  const rows = useMemo(() => sortStoreRows(filterStoreRows(data.storeRows, state.tab), sort), [data.storeRows, state.tab, sort]);

  // Stores view: select the first row when nothing is selected, so the detail panel is never empty.
  const firstStoreId = rows[0]?.storeId ?? null;
  const needsDefaultStore = state.view === "stores" && !data.coreLoading && firstStoreId !== null && (!state.store || state.store === ALL_STORES);
  useEffect(() => {
    if (needsDefaultStore && firstStoreId) navigate({ store: firstStoreId, conversation: null });
  }, [firstStoreId, navigate, needsDefaultStore]);

  const tabs = (
    <div role="tablist" aria-label={t("storeFilters")} className="inline-flex gap-1 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-1">
      {(Object.keys(TAB_LABELS) as StoreTab[]).map((tab) => {
        const count = filterStoreRows(data.storeRows, tab).length;
        const active = state.tab === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            data-v2-tab={tab}
            onClick={() => navigate({ tab, sort: null, store: state.store === ALL_STORES ? ALL_STORES : null, conversation: null })}
            className={`rounded-[var(--app-radius-sm)] px-3 py-1.5 text-sm font-medium ${active ? "bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-[var(--app-shadow-card)]" : "text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"}`}
          >
            {TAB_LABELS[tab]} <span className="tabular-nums text-[var(--app-text-tertiary)]">{data.summary.data ? count : ""}</span>
          </button>
        );
      })}
    </div>
  );

  // "ทั้งหมด" can be re-sorted; "ตามวันนี้" keeps its own order (count, then longest wait).
  const sortControl = state.tab === "all" ? (
    <label className="flex items-center gap-2 text-sm text-[var(--app-text-secondary)]">
      {t("sortBy")}<select
        data-v2-sort
        value={sort}
        onChange={(event) => navigate({ sort: event.target.value as StoreSort })}
        className="h-9 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-sm text-[var(--app-text-primary)]"
      >
        {SORT_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  ) : null;

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 px-6 py-5 ${state.view === "stores" ? "overflow-y-auto" : "overflow-hidden"}`}>
      <PageHeader
        title={t("now")}
        description={<span data-v2-business-hours-label>{t("responseDescription", { minutes: FOLLOW_UP_THRESHOLD_MINUTES, limit: FOLLOW_TODAY_LIMIT })}</span>}
        actions={
          <div data-v2-view-switch className="flex flex-wrap items-center gap-3 text-[var(--app-text-primary)]">
            <OverviewTabs active="now" />
            <SegmentedControl<View>
              aria-label={t("view")}
              value={state.view}
              onChange={(view) => navigate({ view })}
              items={[{ id: "stores", label: t("storeOverview") }, { id: "chat", label: t("chatView") }]}
            />
          </div>
        }
      />
      <Notices />
      {data.coreLoading ? (
        showSkeleton ? (
          <div className="space-y-4">
            <KpiStripSkeleton columns={5} labels={[t("followStores"), t("waitingChats"), t("backlogDays", { days: RECENT_WAIT_WINDOW_DAYS }), t("weekRate"), t("noDataStores")]} />
            <SectionCardSkeleton title={t("tableWait")} lines={8} />
          </div>
        ) : null
      ) : state.view === "stores" ? (
        <>
          <ResponseKpis />
          <div className="flex flex-wrap items-center justify-between gap-3">{tabs}{sortControl}</div>
          <ResponseStoresView
            rows={rows}
            state={{ ...state, sort }}
            onSelectStore={(store) => navigate({ store, conversation: null })}
            onOpenConversation={(store, conversation) => navigate({ view: "chat", store, conversation })}
          />
        </>
      ) : (
        <>
          {tabs}
          <div className="min-h-0 flex-1">
            <ResponseChatView
              rows={rows}
              state={state}
              onSelectStore={(store) => navigate({ store, conversation: null })}
              onSelectConversation={(store, conversation) => navigate({ store, conversation })}
            />
          </div>
        </>
      )}
    </div>
  );
}
