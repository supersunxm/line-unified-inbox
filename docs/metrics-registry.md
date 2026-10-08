# Metrics registry

One row per number shown on Home (`/home`), Dashboard (`/dashboard`) and Store 360 (`/store-360`).
Each number has **one definition and one owning page**. Other pages may show it only as a link to its
owner, computed by the same function. Owner decisions of 8 Oct 2026: HQ evaluates **stores monthly**;
the partner view is dropped; every customer message must be answered; the month is the frame
everywhere.

Code: `frontend/src/lib/metrics/` (pure functions, tested by `node --test`) and
`frontend/src/lib/metrics/use-monthly-metrics.tsx` (`useMonthlyMetrics(month)`, one shared response
cache, 2-minute expiry, used by Home, Dashboard, Store 360, `/v2/report` and the sidebar badge).
`frontend/src/lib/v2/*` re-exports these modules so `/v2/report` keeps working.

## Frame

| Item | Definition | Code |
|---|---|---|
| Month | `?month=YYYY-MM`, default the current Bangkok month. Selectable: from 2026-09 (reply-status coverage start) to the current month, the `/chats` list. Anything else → the current month. Home always shows the current month. | `month.ts` `parseV2Month`, `selectableMonths` |
| Current month | Month to date (day 1 00:00 → now). | `month.ts` `monthWindow` |
| Comparison | Current month: the previous month over the same days 1–D (whole previous month if it is shorter). Closed month: whole month vs whole previous month. August 2026 and earlier: "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้", never 0. | `month.ts` `monthWindow`, `comparisonLabel` |
| Closed months | Read the month-close snapshot (`GET /v2/month-close/:month`) instead of live data; live data if the lookup fails, and the page says so. | `month-close.ts`, `use-monthly-metrics.tsx` |
| Value states | value · true zero · no activity · not collected · failed · not applicable · low sample · stale · loading. 0 only for a measured zero; every "—" carries its reason (tooltip + screen-reader text). | `value-state.ts` |
| Low sample | `MIN_RATE_SAMPLE` = 10. A rate over fewer than 10 is muted, shows n, gets no target colour, is unranked and sorts last. | `value-state.ts` |

## Metrics

| Metric | Definition | Endpoint | Window | Owning page | Elsewhere (link / same function only) |
|---|---|---|---|---|---|
| แชท (chats) | Conversations whose latest message is in the period. | `GET /conversations/bm-reply-status-summary?month=` (previous same days: `?from=&to=`) — `/chats`'s call | Month (comparison: same days) | Dashboard | Store 360 (one store), `/chats` |
| ยังไม่ตอบ (unreplied) | `effectiveSummaryCounts(overview).notReplied` = notReplied + notifiedBm; per store `chatsStoreCounts`. Count, neutral colour. | as above | Month | Dashboard (network + per store) | Home KPI strip and "สาขาที่ต้องดู", sidebar badge (current month), Store 360 (one store), `/chats`. All call `unrepliedCount` / `storeCounts` (`store-model.ts`). |
| ตอบแล้ว % | ตอบแล้ว ÷ แชท for the period (the `/chats` month definition). Target not set: no colour, "ยังไม่กำหนดเป้า". | as above | Month | Dashboard | Home KPI strip, Store 360 |
| ตอบใน 24 ชม. % | `within24h ÷ total` of replyAnalytics (the `/replymessage` definition); n = total. Target 90%. | `GET /dashboard/store-24h-response-summary?dateFrom&dateTo` (per store per day: `&storeId=`) | Month (whole Bangkok days) | Dashboard | Home KPI strip, Store 360 (with "อันดับ X จาก N"), `/replymessage` |
| Δ จุด | KPI change vs the comparison period, in percentage points (semantic colour). Counts change neutral. | — | Comparison | with each KPI | — |
| ร้านที่ผ่านเป้า 24 ชม. | Stores in scope with ≥ `MIN_RATE_SAMPLE` and 24h % ≥ 90, out of stores with ≥ `MIN_RATE_SAMPLE`. | as ตอบใน 24 ชม. | Month | Dashboard | — |
| Stores in scope | `GET /stores` rows (active, non-archived) that are rows of the `/chats` summary (so the synthetic focus group is never a store), minus stores with no LINE OA (`_count.lineOfficialAccounts = 0`). Never by name. | `GET /stores` + summary | — | Dashboard | Home data-health line, Store 360 picker. `store-scope.ts` `storesInScope` |
| Stores with chat data | Stores in scope with ≥ 1 chat in the period. Phrased "X จาก Y ร้านที่มีข้อมูลแชท". | as แชท | Month | Dashboard | Home data-health line. `store-scope.ts` `storeCoverage`, `storeScopeText` |
| ผู้ติดตามสุทธิ / เพิ่ม / บล็อก | Net follower change for the period, adds and blocks (existing follower source). | `GET /dashboard/analytics` (network), `GET /follower-insights/*` (per store) | Month | Dashboard | Home KPI strip (network), Store 360 (one store) |
| ความครบของแท็ก | Chats with ≥ 1 Parser v4 tag ÷ chats whose name was read; "อ่านชื่อแล้ว N จาก M แชท". Never a sales figure. | `GET /v2/tag-coverage?month=` | Month (live, not snapshotted) | Store 360 | `/v2/report` |
| Google Review | The store's monthly review KPI result. | `GET /google-review-kpi?month=` | Month | Store 360 | `/google-review-kpi` |

## Modules removed in this program (Home / Dashboard / Store 360 rework)

Filled in by each PR; see the sections below.
