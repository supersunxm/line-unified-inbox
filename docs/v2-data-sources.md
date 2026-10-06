# v2 data sources

Inventory for `/v2` ("วันนี้"), `/v2/response` ("การตอบแชท"), and `/v2/stores` ("สาขา"). Every number in
v2 comes from an endpoint that already exists; nothing here needs a backend
change. Status values:

- **available**: an existing endpoint returns it directly.
- **derivable**: computed in the browser from a bounded set of existing responses
  (stated bound in the row).
- **MISSING**: no existing source. The UI shows "ยังไม่มีข้อมูลนี้" or omits the item.

Reply semantics are never re-derived in the frontend. "Waiting" means the
backend's effective reply state is `NOT_REPLIED` (the reply-state resolver,
exposed as `effectiveReplyState` and the `replyState=` filter). The 24-hour
rate is the backend's `within24h / total` from `replyAnalytics`.

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

## Step 3: /v2/response

| Item | Source | Status |
|---|---|---|
| Store universe | `bmReplyStatusSummary.stores`, keeping only rows whose id is a Store record from `GET /stores`. The summary also prepends a synthetic "Focus group · 7 stores" row (id `focus-seven-store-group`) that re-counts 7 real stores; it is never a v2 store (`isRealStore`). | available |
| Waiting chats per store (count) | `bmReplyStatusSummary.stores[].notReplied + notifiedBm` | available |
| Waiting since (per chat) | `conversations?replyState=NOT_REPLIED` → `replyStateProjection.decidingEventAt` when `decidingEventKind = CUSTOMER_INBOUND`, else `latestMessageAt` (the same field the summary's `oldestWaitingMinutes` uses) | derivable (waits from the last 7 days) |
| Wait in business minutes | `businessMinutesBetween(waitingSince, now)` in `lib/v2/business-hours.ts` | derivable |
| "Has data" (chats are being collected) | `mirror-status`: the store has an OA with `enabled = true` and `lastSuccessfulSyncAt` within the last 24 hours. If mirror-status fails to load, the fallback is any conversation in the last 7 days (`store-24h-response-summary` `total > 0`), and the page says which source it used. | available |
| "ไม่มีข้อมูล" stores | stores without data by the rule above | available |
| "ตามวันนี้" (daily chase list) | per store, waiting chats whose customer message was sent since yesterday 10:00 Bangkok (`followTodayWindowStart`) and that have waited ≥ 60 business minutes; the top `FOLLOW_TODAY_LIMIT` (15) stores by that count, then longest such wait, then name. The sidebar badge, the tab count, the KPI and "วันนี้" item 1 all use this one selection (`selectFollowToday`). | derivable |
| "รอนานสุด" | one value per store and scope (`displayedWait`): since yesterday 10:00 in the ตามวันนี้ tab, "วันนี้" item 1 and the top 5; the last 7 days in ทั้งหมด ("รอนานสุด (7 วัน)") | derivable |
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

## Step 4: /v2 วันนี้

| Item | Source | Status |
|---|---|---|
| 1. ตามวันนี้ | same selection as /v2/response; the top 3 are named with their counts | derivable |
| 2. 24h rate below target (90%) or down vs last week; 3 biggest drops | `store-24h-response-summary` ×2 | available |
| 3. Customer / product signals | `purchaseAnalytics` has record counts only: no target, no comparison period and no definition of "abnormal", and the counts depend on BM tagging habits | **MISSING**: omitted from the list |
| 4. Google review stores below target | `getGoogleReviewKpis({ month: current })`, `kpiResult.isPassed === false` | available |
| 5. Stores with no chat data | mirror-status (fallback: 7-day activity) | available |
| Top 5 longest waits | waiting chats, one row per store (its longest recent wait and waiting count) | derivable |
| This week vs last week (3 rows) | `store-24h-response-summary` overview fields `total`, `within24h` rate, `over24h + pending`, re-aggregated over stores with data | available |

## Step 5: /v2/stores

The store-health page does not add new data sources. It joins the same v2 store rows with the current-month Google Review KPI response.

| Item | Source | Status |
|---|---|---|
| Store universe and location | same Store records used by /v2/response; region/province from `GET /stores` | available |
| Has chat data / missing chat data | same Live Mirror freshness rule as /v2/response | available |
| Needs attention | frontend grouping only: missing chat data, ตามวันนี้ count > 0, >7-day backlog, 24h rate below target, or current-month Google Review below its store target | derivable |
| Waiting and >7-day backlog | same resolver-backed summary + recent waiting-chat split as /v2/response | available / derivable |
| 24h rate and week-on-week delta | same 7-day and previous-7-day `store-24h-response-summary` calls | available |
| Google Review status | current-month `getGoogleReviewKpis`; joined by `GoogleReviewKpiStoreItem.id = Store.id` (the backend emits `id: store.id`) | available |
| Drill-down to response | `/v2/response?tab=all&store=<Store.id>` | available |
| Drill-down to Store 360 | existing `/store-360?storeId=<Store.id>` | available |

## Known limits

- The 7-day range includes today, as on the existing 24H Response Rate page.
  Chats from the last 24 hours can still be `pending`, which pulls the current
  week's rate down until they resolve.
- Business-hour waits are computed in the browser from the resolver's waiting
  timestamp. Counts and states always come from the backend.
