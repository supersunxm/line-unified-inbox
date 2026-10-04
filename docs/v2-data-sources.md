# v2 data sources

Inventory for `/v2` ("วันนี้") and `/v2/response` ("การตอบแชท"). Every number in
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
| `api.conversations({ replyState: "NOT_REPLIED", sort: "latest-asc", pageSize: 100, page })` | `GET /conversations` | Same operational filter and resolver-based `replyState` filter as the summary. Each item carries `replyStateProjection.decidingEventKind/decidingEventAt`. Paged; v2 stops at 20 pages (2,000 chats) and says so if it stops early. |
| `api.conversations({ storeId, page, pageSize })` | `GET /conversations` | Chat view list (all states), as `/chats` uses it. |
| `api.conversationMessages(id, page)` | `GET /conversations/:id/messages` | Chat view thread, as `/chats` uses it. |
| `GET /api-backend/dashboard/store-24h-response-summary?dateFrom&dateTo` | `replyAnalytics` | Per-store `total`, `within24h`, `over24h`, `pending`, `responseRate24h` for a Bangkok date range (≤ 90 days). Same call the 24H Response Rate page makes. |
| `api.lineChatFleetReadiness()` | `GET /operations/line-chat-nickname/fleet-readiness` | Per-OA LINE Chat collection status (`READY` / `NEED_BOT_MAPPING` / `NEED_LOGIN` / `BLOCKED`) with `storeId`. |
| `api.getGoogleReviewKpis({ month })` | `GET /google-review-kpi` | Per-store review KPI (`kpiResult.isPassed`, `qualifiedReviews`, `targetQualifiedReviews`) and StoreMaster `region`. |

## Step 3: /v2/response

| Item | Source | Status |
|---|---|---|
| Store universe | `bmReplyStatusSummary.stores` | available |
| Waiting chats per store (count) | `bmReplyStatusSummary.stores[].notReplied + notifiedBm` | available |
| Waiting since (per chat) | `conversations?replyState=NOT_REPLIED` → `replyStateProjection.decidingEventAt` when `decidingEventKind = CUSTOMER_INBOUND`, else `latestMessageAt` (the same field the summary's `oldestWaitingMinutes` uses) | derivable (≤ 2,000 chats) |
| Wait in business minutes | `businessMinutesBetween(waitingSince, now)` in `lib/v2/business-hours.ts` | derivable |
| "ต้องตาม" stores (a chat waiting ≥ 60 business min) | waiting chats above | derivable |
| "ไม่มีข้อมูล" stores (chats not being collected) | `lineChatFleetReadiness.stores[].status !== "READY"`, or no OA row for the store | available |
| ตอบใน 24 ชม. · 7 วัน, and the previous 7 days | `store-24h-response-summary` ×2 (`rangeForPreset("7d")` and the 7 days before), re-aggregated over stores with data as `Σwithin24h / Σtotal`, the backend's own overview formula | available |
| Δ vs previous week per store | the two calls above | derivable |
| 7-day mini trend and daily bar chart per store | `store-24h-response-summary` ×7, one call per Bangkok day | derivable (7 requests) |
| Store region | `getGoogleReviewKpis().stores[].region` joined on `storeId` (StoreMaster region) | derivable; blank where a store has no StoreMaster row |
| "เปิดใน LINE OA Manager" (store) | `conversation.store.lineManagerUrl` when `lineManagerUrlStatus = "VALID"`, read from one conversation of that store | available; button hidden when absent |
| "เปิดใน LINE OA Manager" (chat) | `conversation.resolvedLineOaManagerUrl`, falling back to the store URL | available |
| Chat list and thread (read-only) | `conversations`, `conversationMessages` | available |
| "บันทึกว่าตามแล้ว" | none | **MISSING** (needs a backend write). Not built; listed as a follow-up. |

## Step 4: /v2 วันนี้

| Item | Source | Status |
|---|---|---|
| 1. Stores waiting ≥ threshold | as above | derivable |
| 2. 24h rate below target (90%) or down vs last week; 3 biggest drops | `store-24h-response-summary` ×2 | available |
| 3. Customer / product signals | `purchaseAnalytics` has record counts only: no target, no comparison period and no definition of "abnormal", and the counts depend on BM tagging habits | **MISSING**: omitted from the list |
| 4. Google review stores below target | `getGoogleReviewKpis({ month: current })`, `kpiResult.isPassed === false` | available |
| 5. Stores with no chat data | fleet readiness | available |
| Top 5 longest waits | waiting chats | derivable |
| This week vs last week (3 rows) | `store-24h-response-summary` overview fields `total`, `within24h` rate, `over24h + pending`, re-aggregated over stores with data | available |

## Known limits

- The 7-day range includes today, as on the existing 24H Response Rate page.
  Chats from the last 24 hours can still be `pending`, which pulls the current
  week's rate down until they resolve.
- Business-hour waits are computed in the browser from the resolver's waiting
  timestamp. Counts and states always come from the backend.
