# v2 data sources

Every v2 number comes from the endpoints below. The v2 additions (partner mapping, summary
date range, per-store daily 24h rate, month close) are additive backend endpoints under
`/v2` or optional query parameters. Definitions and constants are in `decisions.md`. Status values:

- **available**: an existing endpoint returns it directly.
- **derivable**: computed in the browser from a bounded set of existing responses
  (stated bound in the row).
- **MISSING**: no existing source. The UI says why, or hides the item.

## Monthly views: /v2 (ภาพรวมเดือน), /v2/stores (สาขา), scorecard drawer

Selected with `?month=YYYY-MM` (default: the current Bangkok month). Loaded by
`components/v2/v2-month-data.tsx`; shaped by `lib/v2/monthly-model.ts`.

| Item | Source | Same as | Status |
|---|---|---|---|
| แชท / ยังไม่ตอบ / ตอบแล้ว, network | `api.bmReplyStatusSummary(month)` → `GET /conversations/bm-reply-status-summary?month=`; `overview.total` and `effectiveSummaryCounts(overview)` | `/chats` sidebar overview (same call, same function) | available |
| แชท / ยังไม่ตอบ / ตอบแล้ว, per store | same response; `chatsStoreCounts(row)` | `/chats` sidebar store counts (same call, same function) | available |
| ตอบแล้ว % | ตอบแล้ว ÷ แชท from the rows above | — | derivable |
| Closed month (all of the above) | `GET /v2/month-close/:month` → latest revision of `MonthlyStoreKpiSnapshot` (values as computed at close time); network totals from `MonthlyKpiClose` | `/chats` and `/replymessage` at close time (parity-tested) | available |
| Previous month, not closed | `bm-reply-status-summary?month=<previous>` | `/chats` with the previous month selected | available |
| Previous month, same days (month in progress) | `bm-reply-status-summary?from=<prev>-01&to=<prev>-DD` (Bangkok days 1–D, same bucketing as month mode) | `/chats` endpoint | available |
| ตอบใน 24 ชม. | `GET /dashboard/store-24h-response-summary?dateFrom&dateTo` (replyAnalytics), current period and comparison period; network = response `overview`; partner = Σwithin24h ÷ Σtotal | `/replymessage` | available |
| Store list, location, placeholder signal | `api.stores()` → `GET /stores`: `name`, `region`, `area` (province), `_count.lineOfficialAccounts` | — | available |
| Partner | `GET /v2/store-partners` (Store ID → partner, `StorePartnerMapping`); "ไม่ระบุ partner" when unset | admin page "Partner ของสาขา" | available |
| อันดับใน partner | from the rows above (`rankWithinPartners`) | — | derivable |
| รอนานสุด (calendar) | summary `oldestWaitingMinutes`, formatted with `/chats`'s `formatWaitingDuration` | `/chats` "Waiting 6วัน 10ชม." | available |
| Google Review column | `GET /google-review-kpi?month=`; shown only when at least one store has a result | Google Review KPI page | available |
| Trend (drawer) | `bm-reply-status-summary?month=` and `store-24h-response-summary` for each month from max(2026-09, month − 5) | — | available (from Sep 2026 only; the drawer says how many months exist) |
| Daily breakdown (drawer) | `api.conversations({ storeId, month, sort: "latest-desc", pageSize: 100, page })`, ≤ `STORE_MONTH_MAX_PAGES` (20) pages; grouped by Bangkok day of latest message | `/chats` list for that store and month | derivable (bounded; the drawer says when it is cut) |
| Daily 24h rate (drawer) | `store-24h-response-summary?dateFrom&dateTo&storeId=` → `dates[]` (within24h ÷ total per day of first customer message) | `/replymessage` endpoint | available |
| Tag coverage (store list column, partner table, drawer) | `GET /v2/tag-coverage?month=` → per store: chats, names read, ≥ 1 tag, valid MM/YY, by tag type (Parser v4, `NicknameTagV4`); same chats as the `/chats` month summary; partner = sum of its stores | — | available (live for every month; not part of the month close) |
| Links | `/chats?storeId=&month=` (and `&replyState=NOT_REPLIED`) via `/chats`'s `buildChatsHref`; `/store-360?storeId=`; LINE OA Manager from `conversation.store.lineManagerUrl` when `VALID` | — | available |

## Monthly report: /v2/report

Same sources and numbers as the monthly views above (`V2MonthDataProvider`), no extra calls.
The "คัดลอกสรุป" text is built from those numbers by `lib/v2/report-summary.ts`.

## ตอนนี้ tab: /v2/response (live, business hours)

Unchanged from before the monthly redesign. These sources load only while this tab is open.

## Endpoints used

| Client call | Endpoint | Notes |
|---|---|---|
| `api.bmReplyStatusSummary()` | `GET /conversations/bm-reply-status-summary` | Active, non-archived stores; per-store waiting counts from `resolveEffectiveReplyState`. Waiting = `notReplied + notifiedBm` (`effectiveSummaryCounts`). |
| `api.conversations({ replyState: "NOT_REPLIED", sort: "latest-desc", pageSize: 100, page })` | `GET /conversations` | Same operational filter and resolver-based `replyState` filter as the summary. Each item carries `replyStateProjection.decidingEventKind/decidingEventAt`. Newest first, at most 5 requests in flight, and paging stops at the first page that reaches chats older than 7 days (`lib/v2/waiting-pages.ts`). A 30-page cap is a safety net; v2 says so if it is hit. |
| `api.conversations({ storeId, page, pageSize })` | `GET /conversations` | Chat view list (all states), as `/chats` uses it. |
| `api.conversationMessages(id, page)` | `GET /conversations/:id/messages` | Chat view thread, as `/chats` uses it. |
| `GET /api-backend/dashboard/store-24h-response-summary?dateFrom&dateTo` | `replyAnalytics` | Per-store `total`, `within24h`, `over24h`, `pending`, `responseRate24h` for a Bangkok date range (≤ 90 days). Same call the 24H Response Rate page makes. |
| `GET /api-backend/operations/line-chat-nickname/mirror-status` | `LineChatMirrorStatusService.getStatus` | Per-OA Live Mirror state: `storeId`, `enabled`, `status`, `lastSuccessfulSyncAt`. This is whether a store's chats are being collected. |

Not used: `GET /operations/line-chat-nickname/fleet-readiness`. It is the nickname feature's readiness (`READY` / `NEED_BOT_MAPPING` / `NEED_LOGIN` / `BLOCKED`), not chat collection. Using it marked 148 of 149 stores as "no data" on production.
| `api.getGoogleReviewKpis({ month })` | `GET /google-review-kpi` | Per-store review KPI (`kpiResult.isPassed`, `qualifiedReviews`, `targetQualifiedReviews`) and StoreMaster `region`. |

### /v2/response details

| Item | Source | Status |
|---|---|---|
| Store universe | `bmReplyStatusSummary.stores`, keeping only rows whose id is a Store record from `GET /stores`. The summary also prepends a synthetic "Focus group · 7 stores" row (id `focus-seven-store-group`) that re-counts 7 real stores; it is never a v2 store (`isRealStore`). | available |
| Waiting chats per store (count) | `bmReplyStatusSummary.stores[].notReplied + notifiedBm` | available |
| Waiting since (per chat) | `conversations?replyState=NOT_REPLIED` → `replyStateProjection.decidingEventAt` when `decidingEventKind = CUSTOMER_INBOUND`, else `latestMessageAt` (the same field the summary's `oldestWaitingMinutes` uses) | derivable (waits from the last 7 days) |
| Wait in business minutes | `businessMinutesBetween(waitingSince, now)` in `lib/v2/business-hours.ts` | derivable |
| "Has data" (chats are being collected) | `mirror-status`: the store has an OA with `enabled = true` and `lastSuccessfulSyncAt` within the last 24 hours. If mirror-status fails to load, the fallback is any conversation in the last 7 days (`store-24h-response-summary` `total > 0`), and the page says which source it used. | available |
| "ไม่มีข้อมูล" stores | stores without data by the rule above | available |
| "ตามวันนี้" (daily chase list) | per store, waiting chats whose customer message was sent since yesterday 10:00 Bangkok (`followTodayWindowStart`) and that have waited ≥ 60 business minutes; the top `FOLLOW_TODAY_LIMIT` (15) stores by that count, then longest such wait, then name. The sidebar badge, the tab count, the KPI and the ตอนนี้ tab badge use this one selection (`selectFollowToday`). | derivable |
| "รอนานสุด" | one value per store and scope (`displayedWait`): since yesterday 10:00 in the ตามวันนี้ tab; the last 7 days in ทั้งหมด ("รอนานสุด (7 วัน)") | derivable |
| "รอตอบ (ตั้งแต่เมื่อวาน)" | waiting chats whose customer message was sent since yesterday 10:00 | derivable |
| "ค้างเกิน 7 วัน" (backlog) per store | summary waiting count − the store's waiting chats from the last 7 days; sort by age uses the summary's `oldestWaitingMinutes` | derivable |
| ตอบใน 24 ชม. · 7 วัน, and the previous 7 days | `store-24h-response-summary` ×2 (`rangeForPreset("7d")` and the 7 days before), re-aggregated over stores with data as `Σwithin24h / Σtotal`, the backend's own overview formula | available |
| Δ vs previous week per store | the two calls above | derivable |
| 7-day mini trend and daily bar chart per store | `store-24h-response-summary` ×7, one call per Bangkok day | derivable (7 requests) |
| Store region and province | `api.stores()` → `GET /stores`, which returns full Store rows: `region` and `area` (the province), synced from StoreMaster by `sync-connected-line-oa`. Not in the shared `ApiStore` type, so v2 reads them locally. Shown in Thai via `lib/v2/thai-geo.ts` (7 regions, all 77 provinces; unknown values pass through unchanged). When both are empty, no location line is shown. (The Google Review KPI list has no region on production.) | available |
| "เปิดใน LINE OA Manager" (store) | `conversation.store.lineManagerUrl` when `lineManagerUrlStatus = "VALID"`, read from one conversation of that store | available; button hidden when absent |
| "เปิดใน LINE OA Manager" (chat) | `conversation.resolvedLineOaManagerUrl`, falling back to the store URL | available |
| Chat list and thread (read-only) | `conversations`, `conversationMessages` | available |
| "บันทึกว่าตามแล้ว" | none | **MISSING** (needs a backend write). Not built; listed as a follow-up. |

## Removed (2026-10-07)

The former /v2 "วันนี้" attention list and the former /v2/stores health page (the
"ต้องดู" rule, the "สาขาที่ต้องดู" KPI and per-row chips) were replaced by the monthly
views above. Their sources were the ones listed for /v2/response.

## Known limits

- A chat belongs to the month of its latest message (as in `/chats`). A chat that gets a
  new message moves to the newer month, so a month's live counts can still change until it
  is closed (B2); v2 then shows the snapshot. Reports of a month that is not closed say so.
- `/chats` itself stays live: for a closed month it can differ from the v2 snapshot.
- The 24-hour rate counts customer messages, not chats, so its n differs from แชท.

- The 7-day range includes today, as on the existing 24H Response Rate page.
  Chats from the last 24 hours can still be `pending`, which pulls the current
  week's rate down until they resolve.
- Business-hour waits are computed in the browser from the resolver's waiting
  timestamp. Counts and states always come from the backend.
