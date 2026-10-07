// Seeded API for rendering v2 in a headless browser without a backend (used by
// scripts/contrast-audit.mjs). Every value is synthetic and deterministic: no customer data.
// The summary, the conversation list and the 24-hour rates are generated from one synthetic
// chat set, so the numbers on the page agree with each other exactly as they do in production.

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTNERS = ["OPPO", "TG", "Com7", "IT City", "Siam TV", "Jaymart"];
const REGIONS = [["Bangkok", "Bangkok"], ["Eastern", "Chonburi"], ["Northern", "Chiang Mai"], ["Northeastern", "Khon Kaen"], ["Southern", "Songkhla"], ["Central", "Nakhon Pathom"]];

function monthStart(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return Date.UTC(year, monthNumber - 1, 1) - BANGKOK_OFFSET_MS;
}
function nextMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function bangkokMonth(ms) {
  return new Date(ms + BANGKOK_OFFSET_MS).toISOString().slice(0, 7);
}

export function buildSeed(now = Date.now()) {
  const random = mulberry32(20261007);
  const stores = [];
  for (let index = 0; index < 28; index += 1) {
    const partner = PARTNERS[index % PARTNERS.length];
    const [region, area] = REGIONS[index % REGIONS.length];
    stores.push({ id: `store-${index + 1}`, storeId: `9${String(index + 1).padStart(4, "0")}`, partner, name: `OBS Synthetic ${String(index + 1).padStart(2, "0")} By ${partner}${index % 7 === 3 ? " 2" : ""}`, code: `S${index + 1}`, region, area, isActive: true, archivedAt: null, _count: { conversations: 0, lineOfficialAccounts: 1 } });
  }
  stores.push({ id: "store-unmatched", name: "OBS Synthetic Stand Alone", code: "SX", region: "Central", area: "Ayutthaya", isActive: true, archivedAt: null, _count: { conversations: 0, lineOfficialAccounts: 1 } });
  stores.push({ id: "store-placeholder", name: "Synthetic placeholder", code: "SP", region: null, area: null, isActive: true, archivedAt: null, _count: { conversations: 0, lineOfficialAccounts: 0 } });

  const conversations = [];
  const metaPool = [
    { source: null, customerType: "ONLINE", product: { name: "OPPO Reno16", classificationLevel: "MODEL" }, paymentMethod: null, financeProvider: null, service: null, period: { year: 2026, month: 9 }, eventDate: null },
    { source: null, customerType: null, product: null, paymentMethod: "CASH", financeProvider: null, service: "FILM_INSTALLATION", period: null, eventDate: null },
    null, null,
  ];
  let id = 0;
  for (const month of ["2026-09", "2026-10", "2026-11", "2026-12"]) {
    const start = monthStart(month);
    const end = Math.min(monthStart(nextMonth(month)), now);
    if (end <= start) continue;
    stores.forEach((store, storeIndex) => {
      if (store._count.lineOfficialAccounts === 0) return;
      const volume = storeIndex % 9 === 8 ? 3 : Math.round(15 + random() * 120 * ((end - start) / (30 * DAY_MS)));
      for (let n = 0; n < volume; n += 1) {
        const at = start + Math.floor(random() * (end - start));
        const replied = random() > (storeIndex % 5 === 0 ? 0.3 : 0.08);
        conversations.push({
          id: `conv-${++id}`,
          latestMessageAt: new Date(at).toISOString(),
          bmReplyStatus: replied ? "REPLIED" : "NOT_REPLIED",
          effectiveReplyState: replied ? "REPLIED" : "NOT_REPLIED",
          replyStateProjection: { state: replied ? "REPLIED" : "NOT_REPLIED", decidingEventKind: replied ? "HUMAN_STAFF_REPLY" : "CUSTOMER_INBOUND", decidingEventAt: new Date(at).toISOString() },
          followUpStatus: "OPEN",
          priority: "Normal",
          customer: { id: `cust-${id}`, lineUserId: null, displayName: `ลูกค้าตัวอย่าง ${id}`, pictureUrl: null, statusMessage: null, preferredLanguage: null, profileFetchStatus: "OK", profileFetchError: null },
          store: { id: store.id, name: store.name, lineManagerUrl: "https://chat.line.biz/", lineManagerUrlStatus: "VALID" },
          lineOfficialAccount: { id: `oa-${store.id}`, name: store.name, basicId: null, connectionStatus: "CONNECTED", isActive: true, lastWebhookReceivedAt: null },
          messages: [], notes: [], products: [], topics: [],
          nicknameDerivedMetadata: metaPool[id % metaPool.length] ? { parserVersion: "synthetic", provenance: "MANAGER_NICKNAME", observedAt: new Date(at).toISOString(), appliedAt: new Date(at).toISOString(), ...metaPool[id % metaPool.length] } : null,
          owner: null,
        });
      }
    });
  }
  return { stores, conversations, now };
}

function summaryFor(seed, month) {
  const start = monthStart(month);
  const end = monthStart(nextMonth(month));
  const active = seed.stores.filter((store) => store.isActive);
  const rows = new Map(active.map((store) => [store.id, { total: 0, notReplied: 0, notifiedBm: 0, replied: 0, oldest: 0 }]));
  const overview = { total: 0, notReplied: 0, notifiedBm: 0, replied: 0 };
  for (const chat of seed.conversations) {
    const at = Date.parse(chat.latestMessageAt);
    if (at < start || at >= end) continue;
    const row = rows.get(chat.store.id);
    if (!row) continue;
    row.total += 1; overview.total += 1;
    if (chat.effectiveReplyState === "REPLIED") { row.replied += 1; overview.replied += 1; }
    else { row.notReplied += 1; overview.notReplied += 1; row.oldest = Math.max(row.oldest, Math.floor((seed.now - at) / 60000)); }
  }
  return {
    overview,
    stores: [
      { id: "focus-seven-store-group", storeId: "focus-seven-store-group", storeName: "Focus group · 7 stores", total: 1, notReplied: 0, notifiedBm: 0, replied: 1, oldestWaitingMinutes: 0 },
      ...active.map((store) => {
        const row = rows.get(store.id);
        return { id: store.id, storeId: store.id, masterStoreId: null, externalStoreId: null, storeName: store.name, total: row.total, notReplied: row.notReplied, notifiedBm: 0, replied: row.replied, oldestWaitingMinutes: row.notReplied > 0 ? row.oldest : 0 };
      }),
    ],
  };
}

function ratesFor(seed, dateFrom, dateTo) {
  const start = Date.parse(`${dateFrom}T00:00:00+07:00`);
  const end = Date.parse(`${dateTo}T00:00:00+07:00`) + DAY_MS;
  const byStore = new Map();
  for (const chat of seed.conversations) {
    const at = Date.parse(chat.latestMessageAt);
    if (at < start || at >= end) continue;
    const row = byStore.get(chat.store.id) ?? { storeId: chat.store.id, storeName: chat.store.name, total: 0, within24h: 0, over24h: 0, pending: 0 };
    row.total += 1;
    const hash = Number(chat.id.slice(5)) % 10;
    if (chat.effectiveReplyState === "REPLIED" && hash > 0) row.within24h += 1; else if (chat.effectiveReplyState === "REPLIED") row.over24h += 1; else row.pending += 1;
    byStore.set(chat.store.id, row);
  }
  const stores = [...byStore.values()].map((row) => ({ ...row, responseRate24h: row.total ? Math.round((row.within24h / row.total) * 1000) / 10 : null }));
  const overview = stores.reduce((sum, row) => ({ storeCount: sum.storeCount + 1, total: sum.total + row.total, within24h: sum.within24h + row.within24h, over24h: sum.over24h + row.over24h, pending: sum.pending + row.pending }), { storeCount: 0, total: 0, within24h: 0, over24h: 0, pending: 0 });
  return { dateFrom, dateTo, timezone: "Asia/Bangkok", overview: { ...overview, responseRate24h: overview.total ? Math.round((overview.within24h / overview.total) * 1000) / 10 : null }, stores, dates: [], months: [] };
}

function listFor(seed, params) {
  let items = seed.conversations;
  const month = params.get("month");
  if (month && month !== "all") {
    const start = monthStart(month);
    const end = monthStart(nextMonth(month));
    items = items.filter((chat) => { const at = Date.parse(chat.latestMessageAt); return at >= start && at < end; });
  }
  const storeId = params.get("storeId");
  if (storeId) items = items.filter((chat) => chat.store.id === storeId);
  const replyState = params.get("replyState");
  if (replyState) items = items.filter((chat) => chat.effectiveReplyState === replyState);
  const sort = params.get("sort") ?? "latest-desc";
  items = [...items].sort((a, b) => (sort === "latest-asc" ? 1 : -1) * (Date.parse(a.latestMessageAt) - Date.parse(b.latestMessageAt)) || a.id.localeCompare(b.id));
  const page = Number(params.get("page") ?? 1);
  const pageSize = Math.min(100, Number(params.get("pageSize") ?? 25));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

/** Route every API call of the page to the seed. Unknown endpoints get an empty 200. */
export async function routeSeededApi(page, seed = buildSeed()) {
  const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/auth/**", (route) => json(route, { id: "user-1", email: "hq@example.com", displayName: "HQ Synthetic", role: "ADMIN", permissions: { canAccessAllStores: true, canAccessMainOa: true, canManageMainOa: true, canManageAccounts: true } }));
  await page.route("**/api-backend/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api-backend/, "");
    if (path === "/stores") return json(route, seed.stores);
    if (path === "/v2/store-partners") return json(route, { stores: seed.stores.filter((store) => store.isActive).map((store) => ({ storeUuid: store.id, storeId: store.storeId ?? null, storeName: store.name, partner: store.partner ?? null, updatedAt: store.partner ? new Date(seed.now - 86_400_000).toISOString() : null, updatedByName: store.partner ? "system (seed)" : null })) });
    if (path === "/v2/store-partners/changes") return json(route, { changes: [] });
    if (path === "/conversations/bm-reply-status-summary") return json(route, summaryFor(seed, url.searchParams.get("month") ?? bangkokMonth(seed.now)));
    if (path === "/conversations") return json(route, listFor(seed, url.searchParams));
    if (/^\/conversations\/[^/]+\/messages$/.test(path)) return json(route, { items: [], total: 0, page: 1, pageSize: 30 });
    if (path === "/dashboard/store-24h-response-summary") return json(route, ratesFor(seed, url.searchParams.get("dateFrom"), url.searchParams.get("dateTo")));
    if (path === "/operations/line-chat-nickname/mirror-status") return json(route, { stores: seed.stores.map((store) => ({ storeId: store.id, enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: new Date(seed.now - 3600_000).toISOString() })) });
    if (path === "/google-review-kpi") return json(route, { month: url.searchParams.get("month"), stores: seed.stores.map((store, index) => ({ id: store.id, storeId: store.code, name: store.name, code: store.code, region: store.region, province: store.area, googleMapsUrl: null, googleMapsName: null, hasGoogleMaps: true, kpiResult: index % 3 === 0 ? { id: `k${index}`, month: url.searchParams.get("month"), reviewsChecked: 10, reviewsWithPhoto: 4, photoReviewsInTargetMonth: 3, reviewsOver15ThaiWords: 3, qualifiedReviews: index % 6 === 0 ? 3 : 1, targetQualifiedReviews: 3, isPassed: index % 6 === 0 } : null })) });
    return json(route, {});
  });
  return seed;
}
