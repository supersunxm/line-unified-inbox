# v2 decisions

Every definition and constant v2 uses, with the date it was set. v2 is a **monthly
store-performance and accountability tool**: monthly numbers evaluate store KPIs, feed the
monthly summary sent to stores, BMs and partners, and drive partner review meetings. It is
not a daily follow-up tool. Store Chats (`/chats`) stays a separate tool; v2 must agree with it.

Status: **DECIDED** (owner brief or verified in code), **ASSUMED** (reasonable default, not
confirmed by the owner), **CANCELLED**.

## Policy

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Product model | Monthly accountability, not daily follow-up. Where earlier v2 docs say "daily", read "monthly" unless stated below. | DECIDED |
| 2026-10-07 | Which chats need a reply | Every customer message must be answered, stickers included. "ยังไม่ตอบ" is correct by definition. No "doesn't need a reply" logic exists or will be built. | DECIDED |
| 2026-10-07 | Daily follow-up loop and "needs reply" investigation | Cancelled. The ตามวันนี้ list survives only inside the "ตอนนี้" tab, unchanged. | CANCELLED |

## One definition, shared with /chats (Task 1)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Chats in a month (แชท / ยังไม่ตอบ / ตอบแล้ว), network and per store | `GET /conversations/bm-reply-status-summary?month=YYYY-MM` — the call `/chats` makes for its month view. Network = `overview.total` and `effectiveSummaryCounts(overview)`; per store = `chatsStoreCounts(row)`. Both functions live in `frontend/src/app/reply-state.ts` and `/chats` calls the same ones (`chatsStoreCounts` was extracted from `/chats`'s inline loop, behaviour unchanged). Locked by `test/v2-monthly-model.test.mts`. | DECIDED |
| 2026-10-07 | Which month a chat belongs to | The Bangkok month of its **latest message** (`Conversation.latestMessageAt`, backend `resolveChatMonthRange`). Consequence: a chat that gets a new message moves to the newer month, so a closed month's count can still fall slightly until snapshots exist (Wave B). | DECIDED (backend behaviour) |
| 2026-10-07 | ยังไม่ตอบ | `notReplied + notifiedBm` (`effectiveSummaryCounts`), from the backend reply-state resolver. Two states only in the UI. | DECIDED |
| 2026-10-07 | ตอบแล้ว % | ตอบแล้ว ÷ แชท for the period. | DECIDED |
| 2026-10-07 | ตอบใน 24 ชม. % | `GET /dashboard/store-24h-response-summary?dateFrom&dateTo` (replyAnalytics), the source of `/replymessage`: `within24h ÷ total`. Network value = the endpoint's own `overview`; partner value = Σwithin24h ÷ Σtotal of its stores. n = `total`. | DECIDED |
| 2026-10-07 | 24h target | 90% (`RESPONSE_RATE_TARGET_PERCENT`). | DECIDED |
| 2026-10-07 | Waiting time in monthly views | Calendar time, `/chats`'s `oldestWaitingMinutes` (now − latest message of the oldest unreplied chat in the month), formatted by `/chats`'s `formatWaitingDuration` ("6วัน 10ชม."). | DECIDED |
| 2026-10-07 | Business-hours waiting | Only inside the "ตอนนี้" tab, labelled "นับเฉพาะเวลาเปิดร้าน". | DECIDED |
| 2026-10-07 | Business hours | 10:00–21:00 Asia/Bangkok, every day. | **ASSUMED** |

## Month frame (Task 2)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | URL | `?month=YYYY-MM`, default the current Bangkok month. Selectable months = `/chats`'s (`chat-period.ts`): from 2026-09 (reply-status coverage start) to the current month. Anything else falls back to the current month. | DECIDED |
| 2026-10-07 | Current month | Month-to-date (day 1 00:00 → now). | DECIDED |
| 2026-10-07 | Comparison, current month | Previous month over the **same number of days** (1–7 Oct vs 1–7 Sep), never a whole month. Chat counts cut the previous month at the same elapsed time (7 Oct 14:30 ↔ 7 Sep 14:30); the 24h endpoint takes whole days, so it compares days 1–D. When the previous month is shorter than D days, it is used whole and the label says "ทั้งเดือน". | DECIDED |
| 2026-10-07 | Comparison, closed month | Whole month vs whole previous month. | DECIDED |
| 2026-10-07 | Previous-month counts for the same days | The summary endpoint only takes whole months, so these come from `GET /conversations?month=<previous>&sort=latest-asc&pageSize=100` (the `/chats` list call, same filters), paged until the cut, classified with `/chats`'s `getEffectiveReplyState`, and limited to the summary's active stores. Page cap `PREVIOUS_PERIOD_MAX_PAGES` = 100 (10,000 chats); when hit, the comparison is shown as not available, never as a smaller number. | DECIDED |
| 2026-10-07 | September 2026 comparison | August 2026 is before reply-status coverage: shown as "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้", never 0. | DECIDED |
| 2026-10-07 | Period label | Every number states its period: "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026", or "ทั้งเดือน ก.ย. 2026 เทียบ ทั้งเดือน ส.ค. 2026". Gregorian year, as `/chats`'s selector shows it. | DECIDED |

## Stores, partners and samples (Tasks 4, 5)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Store universe | `GET /stores` rows (active, non-archived Store records) that are also summary rows. The summary's synthetic "Focus group · 7 stores" row is never a store. | DECIDED |
| 2026-10-07 | Placeholder stores ("xxx", "Waitng for new store") | Excluded only when a Store/StoreMaster signal says so: `_count.lineOfficialAccounts = 0` on `GET /stores` (no LINE OA, so no chats are possible). Names are never pattern-matched. Excluded stores are listed in the data line. A placeholder that has an OA stays in and is reported. | DECIDED |
| 2026-10-07 | Partner field | Neither `Store` nor `StoreMaster` has a partner/dealer column (StoreMaster has `dashboardTier`, `kpiPlan`, `dashboardArea`, `bmName`). | VERIFIED |
| 2026-10-07 | Partner rule | Text after the last " By " in the store name (case-insensitive), trailing branch number stripped ("By TG 2" → TG), then looked up by compact key in `PARTNER_ALIASES` (`frontend/src/lib/v2/partners.ts`). Names without the suffix → "ไม่ระบุ partner", listed in the report. | DECIDED |
| 2026-10-07 | Partner normalization map | OPPO, Com7, TG, IT City (IT CITY / IT City), Siam TV (Siam TV / SiamTV), LCB Mobile Supply, VTEC, Jaymart. Variants not in the map keep their own trimmed spelling. "JP" vs "JP Store" and "INTERCOM" vs "Inter Computer & IT" are **not** merged: they may be different companies. | ASSUMED (owner to confirm merges) |
| 2026-10-07 | `MIN_RATE_SAMPLE` | 10 chats in the period. Below it a rate is muted, shows n, gets no target colour, is unranked and sorts after measured stores. Applies to ตอบแล้ว % (n = chats), ตอบใน 24 ชม. % (n = replyAnalytics total) and tag coverage. | DECIDED (default from brief) |
| 2026-10-07 | Δ column | Change in ยังไม่ตอบ vs the comparison period. Rate deltas (points) are shown in the scorecard drawer. | ASSUMED |
| 2026-10-07 | อันดับใน partner | Among the partner's stores with ≥ `MIN_RATE_SAMPLE` chats: highest ตอบแล้ว %, then highest 24h %, then fewest ยังไม่ตอบ, then name. Rank 1 = best. Stores in "ไม่ระบุ partner" are not ranked. | ASSUMED |
| 2026-10-07 | Default sort | ยังไม่ตอบ, most first. Rate sorts put the lowest first. | DECIDED |
| 2026-10-07 | "Stores with chat data N/M" | Stores with at least one chat in the selected period ÷ v2 stores. | ASSUMED |
| 2026-10-07 | Removed from /v2/stores | "สาขาที่ต้องดู" KPI, the daily "ต้องดู" inclusion rule, per-row chips that repeat columns. Google Review column hidden while no store has a result for the month. | DECIDED |

## Views (Tasks 3, 4)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | /v2 | "ภาพรวมเดือน": network KPIs with comparison, partner table (sorted by ยังไม่ตอบ, with an "ทุกสาขา" total row), top 10 stores by ยังไม่ตอบ (n and Δ) linking to the scorecard, data line. | DECIDED |
| 2026-10-07 | "ตอนนี้" tab | `/v2/response`, unchanged ตามวันนี้ list and chat view, reached as the second tab of /v2. Its live sources load only while it is open. The sidebar item "การตอบแชท" is folded into "ภาพรวมเดือน". | DECIDED |
| 2026-10-07 | Scorecard drawer limits | One store's month is read from at most `STORE_MONTH_MAX_PAGES` = 20 pages (2,000 chats); beyond it the drawer says the daily breakdown and tag coverage cover only the latest chats. | DECIDED |
| 2026-10-07 | Trend | Up to 6 months, never before Sep 2026; the drawer states how many months exist. | DECIDED |

## Values (Task 8)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Value states | `frontend/src/lib/v2/value-state.ts`: value, true zero, no activity, not collected, failed, not applicable, low sample, stale, loading. 0 is shown only for a measured zero; every "—" carries its reason (tooltip and screen-reader text). | DECIDED |

## Customer-name tags (Task 6)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Tag source | The backend Parser v3 result per conversation (`nicknameDerivedMetadata` on `/conversations`), from the staff-set LINE OA Manager nickname. v2 never parses raw names. | DECIDED |
| 2026-10-07 | Tag coverage | Share of a store's chats in the period with ≥ 1 recognised tag, and with a valid MM/YY purchase month. A lower bound: chats whose nickname was never read count as untagged. Computed only in the store scorecard drawer (one store-month); the store list column is hidden until a backend aggregate exists (see `tag-analysis.md`). | DECIDED |

## Reports (Task 7)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Open-month footer | "ตัวเลขเดือนที่ยังไม่ปิดอาจเปลี่ยนได้" on every report of a month in progress. Snapshots come in Wave B. | DECIDED |
