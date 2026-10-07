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

## Owner decisions, 7 Oct 2026

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Official KPIs | Two KPIs, each with its own target: (1) **ตอบแล้ว %** — conversation status in the month, the /chats definition; (2) **ตอบใน 24 ชม. %** — the /replymessage definition. | DECIDED (owner) |
| 2026-10-07 | ตอบแล้ว % target | Not set yet: `REPLIED_RATE_TARGET = null` (`frontend/src/lib/v2/kpi.ts`). While null there is no target colour anywhere and the UI says "ยังไม่กำหนดเป้า". | DECIDED (owner) |
| 2026-10-07 | ตอบใน 24 ชม. % target | 90% (`RATE24_TARGET`). | DECIDED (owner) |
| 2026-10-07 | Backend work | Approved, additive only: month close (snapshots), tag-parser fixes + per-store tag coverage, a date range on the summary API, a per-store per-day 24h rate. Reply-state logic untouched. | DECIDED (owner) |
| 2026-10-07 | Partner | Anchored to the Store ID in a mapping table, not parsed from names at read time. | DECIDED (owner) |
| 2026-10-07 | Comparisons (A1) | The comparison that carries semantic colour is each KPI's change in **percentage points**. Counts (แชท, ยังไม่ตอบ) and their change stay visible but neutral: they move with chat volume (Oct 1–7 had 51% more chats than Sep 1–7). | DECIDED (owner) |
| 2026-10-07 | Default sort (A1) | Partner table and store list: the 24-hour rate's gap to its target, worst first; low-sample rows last. Other sorts kept: ตอบแล้ว %, the 24-hour rate's drop in points, ยังไม่ตอบ. | DECIDED (owner) |
| 2026-10-07 | Coverage line (A3) | States stores-with-chat-data for both compared periods, without inferring causes. | DECIDED (owner) |

### Why ตอบใน 24 ชม. % can be higher than ตอบแล้ว %

They measure different things (from the code):

- **ตอบแล้ว %** (`bm-reply-status-summary`, `conversations.service.ts getBmReplyStatusSummary`): the unit is a
  **conversation**, bucketed by the month of its **latest message** (`latestMessageAt`). It is "replied" when the
  reply-state resolver says the **latest** customer message has a human reply **now**.
- **ตอบใน 24 ชม. %** (`store-24h-response-summary`, `historical-timeline.service.ts replyAnalytics`, default mode
  `CHAT_FIRST_REPLY`): the unit is a **chat with a customer message in the period**, bucketed by the date of the
  customer's **first** message in the period. It counts "within 24h" when the first human reply after that first
  message came within 24 hours.

So a chat whose first message was answered quickly, and whose customer then wrote again and is still waiting,
counts as "ตอบใน 24 ชม." and as "ยังไม่ตอบ" at the same time. The populations also differ (latest-message month vs
first-customer-message date), so the two n's differ. UI sentence (`KPI_DIFFERENCE_NOTE`): "ตอบใน 24 ชม. ดูแค่ข้อความแรกของลูกค้าในช่วงนี้
ส่วนตอบแล้ว % ดูข้อความล่าสุด แชทที่ตอบครั้งแรกทันแต่ลูกค้าทักมาใหม่แล้วยังไม่ได้ตอบ จึงนับเป็น “ตอบใน 24 ชม.” และ “ยังไม่ตอบ” พร้อมกัน"

## Store → partner mapping (B1)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Key | The canonical Store ID: `StoreMaster.externalStoreId` (the "Store ID" shown in the app; `docs/store-id-canonical-export-audit.md`). Not a foreign key, so the mapping survives Store row changes. Stores without a Store ID cannot be mapped and read "ไม่ระบุ partner"; the admin page lists them as "ไม่มี Store ID". | DECIDED |
| 2026-10-07 | Tables | `StorePartnerMapping` (storeId PK, partnerName, updatedById, updatedByName, createdAt, updatedAt) and the append-only `StorePartnerMappingChange` (storeId, previousPartner, partnerName, source SEED/ADMIN, actorId, actorName, reason, changedAt). Migration `20261007150000_v2_store_partner_mapping`: two new tables only. | DECIDED |
| 2026-10-07 | Seed | Once, in the background after the API starts (`StorePartnersService.onModuleInit`, advisory-locked, marker = any SEED change row), from the store-name "By <partner>" suffix with the normalization map. Never overwrites an existing row. Names without the suffix get no row. Admin re-trigger: `POST /v2/store-partners/seed` (idempotent: does nothing after the first run). | DECIDED |
| 2026-10-07 | Ambiguous pairs | Seeded as separate partners for the owner to decide: **JP** vs **JP Store**, **INTERCOM** vs **Inter Computer & IT**. Merge by editing in "Partner ของสาขา". | DECIDED (owner to confirm) |
| 2026-10-07 | Reads | v2 (all views, report) reads partner only from `GET /v2/store-partners` (scoped to the caller's stores). The frontend no longer parses names. If the mapping fails to load, every store reads "ไม่ระบุ partner" and the page says so. | DECIDED |
| 2026-10-07 | Edits | `PUT /v2/store-partners/:storeId` ADMIN only; each change writes one audit row (actor, time, before/after, reason). Same value = no-op, no audit row. Admin UI: /v2/admin/partners "Partner ของสาขา" with a "ยังไม่ระบุ" filter and the last 50 changes. | DECIDED |

## Month close (B2)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Tables | `MonthlyKpiClose` (one row per close: month, revision, closedBy SYSTEM/ADMIN, actor, reason, backfill, dueAt, closedAt, definitionVersion, store count, network totals) and `MonthlyStoreKpiSnapshot` (per store: Store UUID, Store ID, name, chats all/unreplied/replied, oldest waiting minutes, 24h numerator/denominator, coverage flags hasChatData / rate24Measured / replyStatusCovered, computedAt, definitionVersion, closedBy). Migration `20261007160000_v2_month_close`: two new tables only. | DECIDED |
| 2026-10-07 | Values | Computed at close time by the same functions as /chats (`getBmReplyStatusSummary(month)`, effective two-state counts) and /replymessage (`replyAnalytics` over the month's Bangkok days, as an all-stores system actor). Parity test: at close time the snapshot equals the live /chats counts. `definitionVersion` = `v2-month-1`. | DECIDED |
| 2026-10-07 | `MONTH_CLOSE_GRACE_DAYS` | 1. A month closes automatically at 00:00 Asia/Bangkok on day (1 + grace) of the next month — October 2026 closes at 2 Nov 2026 00:00. | DECIDED (owner) |
| 2026-10-07 | Scheduler | The backend's existing pattern: an in-process interval in the API service (as `BroadcastSchedulerService`), every 10 minutes, advisory-locked, closes only months with no close yet. No new Railway service or cron. Disable with `V2_MONTH_CLOSE_SCHEDULER_DISABLED=true`. | DECIDED |
| 2026-10-07 | Backfill | A first close made more than 24 h after its due time is flagged `backfill` ("ปิดย้อนหลัง"; values as of the close time). September 2026 (due 2 Oct) is closed by the first scheduler tick after deploy and is flagged. | DECIDED (owner) |
| 2026-10-07 | No overwrite | A closed month is never re-computed automatically. Re-closing: `POST /v2/month-close/:month` (ADMIN) with a reason; it writes revision n+1 and keeps every earlier revision's rows. The same endpoint performs a first close of an ended month on demand (idempotent with the scheduler: whichever runs first is revision 1). | DECIDED (owner) |
| 2026-10-07 | Reads | `GET /v2/month-close/:month` → the latest revision's snapshot, limited to the caller's stores (all-store callers get the close's network totals = /chats overview at close time; scoped callers the sum of their stores), plus `dueAt`. v2 (all views, trend, report) reads the snapshot for closed months and live data for open months; the comparison of an open month stays live (days 1–D). If the lookup fails, live data is shown and the page says so. Status shown: "ปิดเดือนแล้ว เมื่อ …", "ปิดย้อนหลัง เมื่อ … (ตัวเลข ณ เวลาที่ปิด)", "ปิดใหม่ครั้งที่ n เมื่อ … โดย … (เหตุผล)", "เดือนนี้ยังไม่ปิด (ข้อมูลถึงวันที่ D)", or "สิ้นเดือนแล้ว รอปิดอัตโนมัติ …". The open-month report footer shows until the month is closed. | DECIDED |
| 2026-10-07 | Manual command | None needed. If the scheduler is ever disabled: `curl -X POST -b <admin session> https://<api>/v2/month-close/2026-09 -H 'Content-Type: application/json' -d '{}'` (add `"reason"` to re-close). | DECIDED |

## Tag parser v4 (B3)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Contract | `backend/src/v2-monthly/nickname-parser-v4.ts`, version `nickname-parser-v4.0.0`. Parser v3 (`nickname-parser-v3.0.1`) and its tables stay as they are; `/chats` chips still read v3. | DECIDED |
| 2026-10-07 | MM/YY | Any two-digit year is 20YY (owner). A four-digit year is Gregorian 1900–2199 or Buddhist 2400–2699 (−543). Month outside 1–12 or an impossible date is rejected and left as a word. The last purchase month in a name wins. Consequence: `69`, which v3 read as Buddhist 2569 = 2026, is now 2069. | DECIDED (owner) |
| 2026-10-07 | Film | Thai ฟิล์ม, ฟิมล์, ฟิลม์ (also with ติด… / …กระจก) anywhere in the name, and `film` in any case as a whole word → `FILM_INSTALLATION`. A customer whose own nickname is ฟิล์ม is read as film too (accepted risk). | DECIDED (owner) |
| 2026-10-07 | Extra words | Never drop the recognised tags. Unknown words are free text (stored only as `hasFreeText`). A conflict (two payment methods, two platforms, two finance providers, two full dates) drops only that field. | DECIDED (owner) |
| 2026-10-07 | Platforms | TikTok, Facebook/FB, Instagram/IG, LINE, Website, Lemon8 anywhere in the name (v3: only in `<source> <MM/YY>`). ออนไลน์ = Online. | DECIDED |
| 2026-10-07 | Products | The catalog safe aliases (`tag-analysis.md` §5, same policy as v3), matched on the longest run of leftover words (≤ 6); more than one product can be read. The starred proposals (`x9`, bare `a6`) are not added: they await owner approval. | DECIDED |
| 2026-10-07 | Storage | New table `NicknameTagV4` (derived, recomputable, one row per conversation and parser version, from the conversation's latest READ observation of the same Store/OA/chat identity); no FKs. New table `NicknameTagRederiveRun` (counts only, audit). Migration `20261007170000_v2_nickname_tags_v4`: two new tables only. The v3 table could not take v4 rows without changing its CHECK (`parserVersion LIKE 'nickname-parser-v3.%'`), so a nullable column was not enough. Raw observations, v3 state and v3 receipts are only read. | DECIDED |
| 2026-10-07 | Re-derive | Full pass in id order, 500 conversations per advisory-locked batch, ≤ 20 batches per call, resumable. Then incremental: conversations with READ observations newer than the watermark (15-minute re-read overlap), one audit row per Bangkok day. Runs by the existing in-process scheduler pattern every 10 minutes (first tick 90 s after start); disable with `V2_TAG_REDERIVE_SCHEDULER_DISABLED=true`. Admin: `POST /v2/tags/rederive` (start or continue a full pass, one bounded step), `GET /v2/tags/rederive-runs` (counts). Each tick logs `tag_rederive … counts={…}` (counts only). | DECIDED |

## One definition, shared with /chats (Task 1)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Chats in a month (แชท / ยังไม่ตอบ / ตอบแล้ว), network and per store | `GET /conversations/bm-reply-status-summary?month=YYYY-MM` — the call `/chats` makes for its month view. Network = `overview.total` and `effectiveSummaryCounts(overview)`; per store = `chatsStoreCounts(row)`. Both functions live in `frontend/src/app/reply-state.ts` and `/chats` calls the same ones (`chatsStoreCounts` was extracted from `/chats`'s inline loop, behaviour unchanged). Locked by `test/v2-monthly-model.test.mts`. | DECIDED |
| 2026-10-07 | Which month a chat belongs to | The Bangkok month of its **latest message** (`Conversation.latestMessageAt`, backend `resolveChatMonthRange`). Consequence: a chat that gets a new message moves to the newer month; once a month is closed (B2), v2 shows its snapshot, so its numbers no longer move. | DECIDED (backend behaviour) |
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
| 2026-10-07 | Previous-month counts for the same days | `GET /conversations/bm-reply-status-summary?from=YYYY-MM-DD&to=YYYY-MM-DD` (B5): the /chats endpoint with an optional Bangkok date range, same `latestMessageAt` bucketing and the same reply-status coverage rule as month mode; at most 92 days; month and from/to are exclusive. Backend parity test: a whole-month from/to returns exactly the month-mode result. Replaces the former client-side paging. | DECIDED |
| 2026-10-07 | Same-days cut | The previous month is compared over whole days 1–D (day D complete), the current month over day 1 → now (month mode). Chat counts are neutral (A1), so the partial current day only nudges volume; the rates compare like for like on days 1–D. Supersedes the former same-elapsed-time cut. | DECIDED |
| 2026-10-07 | Per-store per-day 24h (B6) | `GET /dashboard/store-24h-response-summary?dateFrom&dateTo&storeId=` — an optional storeId (the store's UUID) passed to the existing `replyAnalytics`, whose `dates` array then is that store's per-day breakdown (within24h ÷ total, by the day of the customer's first message). Only the controller changed; `replyAnalytics` (historical timeline code) is untouched and keeps its own store-scope check. The drawer shows it per day as "ตอบทัน/ทั้งหมด". | DECIDED |
| 2026-10-07 | September 2026 comparison | August 2026 is before reply-status coverage: shown as "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้", never 0. | DECIDED |
| 2026-10-07 | Period label | Every number states its period: "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026", or "ทั้งเดือน ก.ย. 2026 เทียบ ทั้งเดือน ส.ค. 2026". Gregorian year, as `/chats`'s selector shows it. | DECIDED |

## Stores, partners and samples (Tasks 4, 5)

| Date | Item | Decision | Status |
|---|---|---|---|
| 2026-10-07 | Store universe | `GET /stores` rows (active, non-archived Store records) that are also summary rows. The summary's synthetic "Focus group · 7 stores" row is never a store. | DECIDED |
| 2026-10-07 | Placeholder stores ("xxx", "Waitng for new store") | Excluded only when a Store/StoreMaster signal says so: `_count.lineOfficialAccounts = 0` on `GET /stores` (no LINE OA, so no chats are possible). Names are never pattern-matched. Excluded stores are listed in the data line. A placeholder that has an OA stays in and is reported. | DECIDED |
| 2026-10-07 | Partner field | Neither `Store` nor `StoreMaster` has a partner/dealer column (StoreMaster has `dashboardTier`, `kpiPlan`, `dashboardArea`, `bmName`). | VERIFIED |
| 2026-10-07 | Partner rule | Superseded by the Store ID mapping (B1). The name rule now only seeds the mapping once (`backend/src/v2-monthly/partner-parse.ts`). | SUPERSEDED |
| 2026-10-07 | Partner normalization map | OPPO, Com7, TG, IT City (IT CITY / IT City), Siam TV (Siam TV / SiamTV), LCB Mobile Supply, VTEC, Jaymart. Variants not in the map keep their own trimmed spelling. "JP" vs "JP Store" and "INTERCOM" vs "Inter Computer & IT" are **not** merged: they may be different companies. | ASSUMED (owner to confirm merges) |
| 2026-10-07 | `MIN_RATE_SAMPLE` | 10 chats in the period. Below it a rate is muted, shows n, gets no target colour, is unranked and sorts after measured stores. Applies to ตอบแล้ว % (n = chats), ตอบใน 24 ชม. % (n = replyAnalytics total) and tag coverage. | DECIDED (default from brief) |
| 2026-10-07 | Δ column | Superseded by the owner decision above: Δ is shown under each KPI in points (coloured) and under counts (neutral). | SUPERSEDED |
| 2026-10-07 | อันดับใน partner | Among the partner's stores with ≥ `MIN_RATE_SAMPLE` chats: highest ตอบแล้ว %, then highest 24h %, then fewest ยังไม่ตอบ, then name. Rank 1 = best. Stores in "ไม่ระบุ partner" are not ranked. | ASSUMED |
| 2026-10-07 | Default sort | Superseded: the 24-hour rate gap to target (see owner decisions). | SUPERSEDED |
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
| 2026-10-07 | Open-month footer | "ตัวเลขเดือนที่ยังไม่ปิดอาจเปลี่ยนได้" on every report of a month that is not closed yet (in progress, or ended and awaiting its close). | DECIDED |
| 2026-10-07 | Report URL | `/v2/report?month=YYYY-MM` (network: KPIs, partner table, all stores), `&partner=<name>` (that partner's KPIs and stores), `&store=<id>` (one store). Outside the shell route group, so it has no navigation chrome. | DECIDED |
| 2026-10-07 | Report rendering | A4 (`@page size: A4; margin 12mm`), light only: the report scopes the light token values to `.v2-report`, so it is light whatever the app theme. PDF is the browser's print → Save as PDF. No new dependencies. Red and green are darkened slightly so they stay legible on paper. | DECIDED |
| 2026-10-07 | "คัดลอกสรุป" text | Lines: `สรุปเดือน <เดือน> · <scope>` / `ช่วง: <period>` / `แชท N · ยังไม่ตอบ N (Δ)` / `ตอบแล้ว % · ตอบใน 24 ชม. % (Δ จุด) · เป้า 90%` / the 3 stores with the most ยังไม่ตอบ / the open-month note when the month is open. Built by `lib/v2/report-summary.ts`. | DECIDED |
