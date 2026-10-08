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
| ผู้ติดตาม เพิ่ม / บล็อก / สุทธิ (network) | The existing follower growth: เพิ่ม = Δfollowers, บล็อก = Δblocks, สุทธิ = เพิ่ม − บล็อก, comparing the day before day 1 with the last day that has a daily snapshot (yesterday for the open month), over LINE OAs ready on both days. | `GET /dashboard/analytics?dateFrom&dateTo` (custom range) | Month | Dashboard | Home KPI strip (สุทธิ) |
| ผู้ติดตามรายวัน (chart) | Network follower total per day (the existing follower trend). | `GET /dashboard/executive-store-health?dateFrom&dateTo` → `followerTrend` | Month | Dashboard | — |
| ผู้ติดตามสุทธิ (per store) | Same arithmetic per store, summed over the store's LINE OAs ready on both days; a store without both snapshots shows "—" with its reason, never 0. | `GET /follower-insights/by-store?dateFrom=D&dateTo=D` (baseline day, last day) | Month | Dashboard (column, top movers) | Store 360 (one store). `followers.ts` `storeFollowerChanges` |
| เพิ่ม / ลดมากสุด 5 ร้าน | Top 5 by per-store net change, excluding stores with fewer than `FOLLOWER_MIN_BASE` (100) followers at the baseline and stores with no snapshot `FOLLOWER_MIN_AGE_DAYS` (30) days before the baseline (likely new). Contribution line "+X จาก N ร้านที่เพิ่ม · −Y จาก M ร้านที่ลด" sums every store in scope with both snapshots (it can differ slightly from the network total, which the backend computes with its own nearest-reliable-date rule; the page says so). | as above, plus the day 30 days before the baseline | Month | Dashboard | — |
| ความครบของแท็ก | Chats with ≥ 1 Parser v4 tag ÷ chats whose name was read; "อ่านชื่อแล้ว N จาก M แชท". Never a sales figure. | `GET /v2/tag-coverage?month=` | Month (live, not snapshotted) | Store 360 | `/v2/report` |
| Google Review | The store's monthly review KPI result. | `GET /google-review-kpi?month=` | Month | Store 360 | `/google-review-kpi` |

## Modules removed in this program (Home / Dashboard / Store 360 rework)

### Dashboard (PR 2)

| Module | Why |
|---|---|
| Partner table (and its "OPPO" vs "OPPO 2", "TG" vs "TG 2" grouping by store name) | The partner view is dropped (owner, 8 Oct 2026); work is evaluated per store. |
| "แจ้งเตือนแล้ว 0 (0%)" | A retired reply state; the UI is two-state (ยังไม่ตอบ / ตอบแล้ว). |
| Response-speed tiers (<4 ชม. … >24 ชม.), average and median response time, and their message drill-down | Came from a different source than the 24h KPI (n = 4 conversations in production), so they contradicted it. The 24h KPI with its n is the one measure of speed. |
| Peak-hour block and its "add staff at 13:00–14:00" tip | A canned tip; peak hours live in Message Traffic. |
| Product-signal / customer-demand card | Came from a different, near-empty source; customers and sales (from name tags) live in Store 360, labelled as tags, not sales. |
| "เชื่อมต่อ 141/150" and "ข้อมูลเสถียร" cards | System health, not store performance; Home carries one data-health line. |
| Follower-count lists ("Top 10 สาขาผู้ติดตามสูงสุด vs สาขาที่ต้องการการดูแล") | Ranked by follower stock, which flags new stores with 5–9 followers; replaced by the top 5 growers and decliners by net change, without small or new stores. |
| 7D / 14D / 30D period buttons | The month is the frame; `?month=` (the /chats month list) replaces them. |
| StoreMaster peer panel (Tier / KPI plan / Area / BM ranking) | Ranked stores by follower stock with partner parsed from names; the store table (24h gap to target) is the one store ranking. |

Files deleted (unreachable after the change): `app/dashboard/executive-dashboard-v2.tsx`, `executive-dashboard-base.tsx`, `executive-store-peer-panel.tsx`.
