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
| อันดับใน 24 ชม. (Store 360) | "อันดับ X จาก N": rank of the store's 24h % among stores in scope with ≥ `MIN_RATE_SAMPLE`; ties share the better rank; below the sample: "ไม่จัดอันดับ". | as ตอบใน 24 ชม. | Month | Store 360 | — (`store-view.ts` `rate24Rank`) |
| ยังไม่ตอบ / ตอบใน 24 ชม. per day (Store 360) | ยังไม่ตอบ by the Bangkok day of the latest message (the store's month from the `/chats` list, ≤ 2,000 chats); 24h as within/total by the day of the customer's first message. | `/conversations?storeId&month`, `store-24h-response-summary?storeId` | Month, by day | Store 360 | — |
| Data coverage chip (Store 360) | "เก็บแชทถึง <date of the store's latest chat, any month>"; a store with no chat at all reads "ไม่ได้เก็บแชทของร้านนี้" and shows one no-data state (followers and Google Review still shown). | `/conversations?storeId&sort=latest-desc&pageSize=1` | All time | Store 360 | — |
| ลูกค้าและการขาย (name tags) | Top products, channels and payment/finance counted per chat from the parsed customer-name metadata of the store's month; always labelled "นับจากชื่อลูกค้าที่ร้านตั้งใน LINE ไม่ใช่ยอดขายจริง" with "อ่านชื่อแล้ว N จาก M แชท" (tag coverage). | `/conversations?storeId&month` (`nicknameDerivedMetadata`), `/v2/tag-coverage` | Month | Store 360 | — |
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

### Home (PR 3)

| Module | Why |
|---|---|
| "ยังไม่ตอบ (ทุกเดือน)" card (7,652 in production) and its "ต้องจัดการ" row | Counted every month, so it contradicted the sidebar badge (this month) and the Dashboard (the period). Home shows one number: ยังไม่ตอบ this month, the same function and request as the badge. |
| Quick-access grid (10 tiles) | Duplicated the sidebar. Three shortcuts remain: แชทร้านค้า (with the badge), รายงาน KPI รายเดือน, แดชบอร์ด. |
| "วันนี้" cards (messages, 24h %, peak time, +followers today) | At 09:42 they read 24h 0% and +0 followers: a day is not the frame and the day had barely started. The month is the frame. |
| Total stores / Connected / Total followers cards | Store counts disagreed with other pages (150 / 149 / 144 / 141). The one store count is the data-health line ("X จาก Y ร้านที่มีข้อมูลแชท", `store-scope.ts`). |
| System status card | Replaced by one data-health line linking to LINE Chat Health, and a banner only when the backend, database or webhook is down. |

Home's "ซิงก์แชทล่าสุด" is the latest successful chat sync (`GET /operations/line-chat-nickname/mirror-status`, ADMIN only); for other roles the line shows the last message received (`GET /operations/status` `lastValidWebhookReceived`).

### Store 360 (PR 4)

| Module | Why |
|---|---|
| Opening an arbitrary (nearly empty) store when no store is given | `/store-360` now opens the last viewed store (localStorage) or a searchable picker with the stores to check. |
| KPI cards with their own definitions ("ยังไม่ตอบ: ไม่มีข้อมูล", "ตอบภายใน 24 ชม.: ไม่มีข้อมูล" while a panel said ยังไม่ตอบ 608) | Replaced by the scorecard from the shared rows (the Dashboard's numbers); the old per-page computation is gone. |
| Customer Voice module | Covered 4 of 935 chats (showed 0%). Shown only as a link at the bottom when ≥ 20% of the month's chats are classified; `/store-360/customer-voice` keeps working. |
| Team performance (5 staff, all "ไม่มีข้อมูล") | Per-staff performance is out of scope (owner); work is evaluated per store. |
| Response analytics block and first-response-time tiles | A different source from the 24h KPI; `/store-360/response` keeps working, unlinked. |
| Unique-customers headline, sales-tagged customers card, conversation explorer, 7D/30D/custom range | The month is the frame; customers and sales come from name tags, labelled as such. |

Files deleted (unreachable after the change): `app/store-360/store-360-view.tsx`, `customer-voice-panel.tsx`, `store-search-combobox.tsx`, `store-search.ts`. The export control stays (scoped to the selected month).
