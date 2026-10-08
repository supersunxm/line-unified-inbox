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
  // A store with a LINE OA whose chats the system never collected (Store 360's no-data state).
  stores.push({ id: "store-nochat", name: "OBS Synthetic No Chat Data", code: "SN", region: "Southern", area: "Phuket", isActive: true, archivedAt: null, noChats: true, _count: { conversations: 0, lineOfficialAccounts: 1 } });
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
      if (store._count.lineOfficialAccounts === 0 || store.noChats) return;
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

function summaryFor(seed, month, range = null) {
  const start = range ? Date.parse(`${range.from}T00:00:00+07:00`) : monthStart(month);
  const end = range ? Date.parse(`${range.to}T00:00:00+07:00`) + DAY_MS : monthStart(nextMonth(month));
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

function ratesFor(seed, dateFrom, dateTo, storeId = null) {
  const start = Date.parse(`${dateFrom}T00:00:00+07:00`);
  const end = Date.parse(`${dateTo}T00:00:00+07:00`) + DAY_MS;
  const byStore = new Map();
  for (const chat of seed.conversations) {
    const at = Date.parse(chat.latestMessageAt);
    if (at < start || at >= end || (storeId && chat.store.id !== storeId)) continue;
    const row = byStore.get(chat.store.id) ?? { storeId: chat.store.id, storeName: chat.store.name, total: 0, within24h: 0, over24h: 0, pending: 0 };
    row.total += 1;
    const hash = Number(chat.id.slice(5)) % 10;
    if (chat.effectiveReplyState === "REPLIED" && hash > 0) row.within24h += 1; else if (chat.effectiveReplyState === "REPLIED") row.over24h += 1; else row.pending += 1;
    byStore.set(chat.store.id, row);
  }
  const stores = [...byStore.values()].map((row) => ({ ...row, responseRate24h: row.total ? Math.round((row.within24h / row.total) * 1000) / 10 : null }));
  const overview = stores.reduce((sum, row) => ({ storeCount: sum.storeCount + 1, total: sum.total + row.total, within24h: sum.within24h + row.within24h, over24h: sum.over24h + row.over24h, pending: sum.pending + row.pending }), { storeCount: 0, total: 0, within24h: 0, over24h: 0, pending: 0 });
  const dates = new Map();
  for (const chat of seed.conversations) {
    const at = Date.parse(chat.latestMessageAt);
    if (at < start || at >= end || (storeId && chat.store.id !== storeId)) continue;
    const date = new Date(at + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
    const day = dates.get(date) ?? { date, total: 0, within24h: 0 };
    day.total += 1;
    if (chat.effectiveReplyState === "REPLIED" && Number(chat.id.slice(5)) % 10 > 0) day.within24h += 1;
    dates.set(date, day);
  }
  return { dateFrom, dateTo, timezone: "Asia/Bangkok", overview: { ...overview, responseRate24h: overview.total ? Math.round((overview.within24h / overview.total) * 1000) / 10 : null }, stores, dates: [...dates.values()].sort((a, b) => a.date.localeCompare(b.date)), months: [] };
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
// Synthetic follower snapshots: one LINE OA per store, deterministic by store and day. store-12 has
// no snapshot before 2026-09-20 (a new store); store-5 has a small base (under 100 followers).
function followerSnapshot(store, index, date) {
  const day = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse("2026-08-01T00:00:00Z")) / DAY_MS);
  if (store.id === "store-12" && date < "2026-09-20") return null;
  if (store._count.lineOfficialAccounts === 0) return null;
  const base = store.id === "store-5" ? 60 : 400 + ((index * 389) % 4200);
  const slope = ((index * 7) % 11) - 3;
  const followers = Math.max(0, base + slope * day + (store.id === "store-12" ? 200 : 0));
  const blocks = Math.round(base / 12) + Math.max(0, Math.round(day * (index % 4) / 3));
  return { followers, blocks };
}

function followerRowsOn(seed, date) {
  return seed.stores.filter((store) => store.isActive).map((store, index) => {
    const snap = followerSnapshot(store, index, date);
    return { lineOaId: `oa-${store.id}`, accountName: store.name, storeId: store.id, storeName: store.name, date, followers: snap ? snap.followers : null, previousFollowers: null, startFollowers: null, dailyIncrease: null, periodIncrease: null, targetedReaches: null, blocks: snap ? snap.blocks : null, status: snap ? "ready" : "missing", fetchedAt: null };
  });
}

function datesBetween(from, to) {
  const days = [];
  for (let at = Date.parse(`${from}T00:00:00Z`); at <= Date.parse(`${to}T00:00:00Z`); at += DAY_MS) days.push(new Date(at).toISOString().slice(0, 10));
  return days;
}

function shiftDay(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function followerTotals(seed, date, storeId = null) {
  return followerRowsOn(seed, date).filter((row) => !storeId || row.storeId === storeId).reduce((sum, row) => ({ followers: sum.followers + (row.followers ?? 0), blocks: sum.blocks + (row.blocks ?? 0) }), { followers: 0, blocks: 0 });
}

export async function routeSeededApi(page, seed = buildSeed()) {
  const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/auth/**", (route) => json(route, { id: "user-1", email: "hq@example.com", displayName: "HQ Synthetic", role: "ADMIN", permissions: { canAccessAllStores: true, canAccessMainOa: true, canManageMainOa: true, canManageAccounts: true } }));
  await page.route("**/api-backend/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api-backend/, "");
    if (path === "/stores") return json(route, seed.stores);
    if (path === "/v2/store-partners") return json(route, { stores: seed.stores.filter((store) => store.isActive).map((store) => ({ storeUuid: store.id, storeId: store.storeId ?? null, storeName: store.name, partner: store.partner ?? null, updatedAt: store.partner ? new Date(seed.now - 86_400_000).toISOString() : null, updatedByName: store.partner ? "system (seed)" : null })) });
    if (path === "/v2/store-partners/changes") return json(route, { changes: [] });
    if (path === "/v2/tag-coverage") {
      // Deterministic synthetic coverage: one store with no names read yet ("ยังไม่ได้อ่านชื่อ").
      const summary = summaryFor(seed, url.searchParams.get("month") ?? bangkokMonth(seed.now));
      const stores = summary.stores.filter((row) => row.storeId !== "focus-seven-store-group").map((row, index) => {
        const read = index === 3 ? 0 : Math.round(row.total * (0.55 + (index % 5) * 0.08));
        const tagged = Math.round(read * (0.4 + (index % 4) * 0.12));
        const withPeriod = Math.round(tagged * 0.6);
        return { storeUuid: row.storeId, storeId: null, total: row.total, read, tagged, withPeriod, byType: { online: Math.round(tagged * 0.5), source: Math.round(tagged * 0.1), product: Math.round(tagged * 0.7), film: Math.round(tagged * 0.3), payment: Math.round(tagged * 0.4), finance: Math.round(tagged * 0.2), period: withPeriod, date: Math.round(tagged * 0.05) } };
      });
      const network = stores.reduce((sum, row) => ({ total: sum.total + row.total, read: sum.read + row.read, tagged: sum.tagged + row.tagged, withPeriod: sum.withPeriod + row.withPeriod, byType: Object.fromEntries(Object.keys(sum.byType).map((key) => [key, sum.byType[key] + row.byType[key]])) }), { total: 0, read: 0, tagged: 0, withPeriod: 0, byType: { online: 0, source: 0, product: 0, film: 0, payment: 0, finance: 0, period: 0, date: 0 } });
      return json(route, { month: summary.month ?? null, parserVersion: "nickname-parser-v4.0.0", rederiveComplete: true, updatedAt: new Date(seed.now - 600_000).toISOString(), network, stores });
    }
    const closeMatch = /^\/v2\/month-close\/(\d{4}-\d{2})$/.exec(path);
    if (closeMatch) {
      // Synthetic: September 2026 is closed as a backfill; later months are open.
      const month = closeMatch[1];
      const dueAt = new Date(Date.parse(`${nextMonth(month)}-02T00:00:00+07:00`)).toISOString();
      if (month !== "2026-09") return json(route, { close: null, stores: [], network: null, dueAt });
      const summary = summaryFor(seed, month);
      const rates = ratesFor(seed, "2026-09-01", "2026-09-30");
      const rateBy = new Map(rates.stores.map((row) => [row.storeId, row]));
      const stores = summary.stores.filter((row) => row.storeId !== "focus-seven-store-group").map((row) => ({ storeUuid: row.storeId, storeId: null, storeName: row.storeName, chatsTotal: row.total, chatsUnreplied: row.notReplied + row.notifiedBm, chatsReplied: row.replied, oldestWaitingMinutes: row.oldestWaitingMinutes || null, rate24Total: rateBy.get(row.storeId)?.total ?? 0, rate24Within: rateBy.get(row.storeId)?.within24h ?? 0 }));
      return json(route, {
        close: { id: "close-sep", month, revision: 1, closedBy: "SYSTEM", actorName: "system", reason: null, backfill: true, dueAt, closedAt: new Date(seed.now - 3_600_000).toISOString(), definitionVersion: "synthetic" },
        stores,
        network: { chatsTotal: summary.overview.total, chatsUnreplied: summary.overview.notReplied + summary.overview.notifiedBm, chatsReplied: summary.overview.replied, rate24Total: rates.overview.total, rate24Within: rates.overview.within24h },
        dueAt,
      });
    }
    if (path === "/conversations/bm-reply-status-summary") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      return json(route, from && to ? summaryFor(seed, null, { from, to }) : summaryFor(seed, url.searchParams.get("month") ?? bangkokMonth(seed.now)));
    }
    if (path === "/conversations") return json(route, listFor(seed, url.searchParams));
    if (/^\/conversations\/[^/]+\/messages$/.test(path)) return json(route, { items: [], total: 0, page: 1, pageSize: 30 });
    if (path === "/dashboard/store-24h-response-summary") return json(route, ratesFor(seed, url.searchParams.get("dateFrom"), url.searchParams.get("dateTo"), url.searchParams.get("storeId")));
    if (path === "/operations/line-chat-nickname/mirror-status") return json(route, { stores: seed.stores.map((store) => ({ storeId: store.id, enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: new Date(seed.now - 3600_000).toISOString() })) });
    if (path === "/google-review-kpi") return json(route, { month: url.searchParams.get("month"), stores: seed.stores.map((store, index) => ({ id: store.id, storeId: store.code, name: store.name, code: store.code, region: store.region, province: store.area, googleMapsUrl: null, googleMapsName: null, hasGoogleMaps: true, kpiResult: index % 3 === 0 ? { id: `k${index}`, month: url.searchParams.get("month"), reviewsChecked: 10, reviewsWithPhoto: 4, photoReviewsInTargetMonth: 3, reviewsOver15ThaiWords: 3, qualifiedReviews: index % 6 === 0 ? 3 : 1, targetQualifiedReviews: 3, isPassed: index % 6 === 0 } : null })) });
    if (path === "/operations/status") return json(route, { frontend: "HEALTHY", backendApi: "HEALTHY", database: "HEALTHY", lineWebhookEnabled: true, publicWebhookUrlConfigured: true, activeLineOaCount: seed.stores.length - 1, connectedLineOaCount: seed.stores.length - 1, lineOaIssueCount: 0, lastValidWebhookReceived: new Date(seed.now - 120_000).toISOString(), lastStoreMasterImport: null, storeMasterRecordCount: seed.stores.length, classificationEngine: "HEALTHY", pilotMode: false });
    if (path === "/follower-insights/by-store") return json(route, followerRowsOn(seed, url.searchParams.get("dateTo") ?? url.searchParams.get("dateFrom")));
    if (path === "/follower-insights/summary") {
      const storeId = url.searchParams.get("storeId");
      return json(route, datesBetween(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo")).map((date) => {
        const today = followerTotals(seed, date, storeId);
        const before = followerTotals(seed, shiftDay(date, -1), storeId);
        return { date, followers: today.followers, targetedReaches: null, blocks: today.blocks, dailyIncrease: today.followers - before.followers, accountsExpected: 1, accountsWithData: 1, accountsReady: 1, accountsUnready: 0, accountsMissing: 0 };
      }));
    }
    if (path === "/dashboard/analytics") {
      const from = url.searchParams.get("dateFrom");
      const to = url.searchParams.get("dateTo");
      const end = followerTotals(seed, to);
      const start = followerTotals(seed, shiftDay(from, -1));
      const added = end.followers - start.followers;
      const blocked = end.blocks - start.blocks;
      return json(route, { summaryCards: { followerGrowth: { totalFriends: end.followers - end.blocks, addedToday: added, blockedToday: blocked, netToday: added - blocked, added, blocked, net: added - blocked, growthAccountsCompared: seed.stores.length - 2, totalEligibleAccounts: seed.stores.length - 1 } } });
    }
    if (path === "/dashboard/executive-store-health") {
      return json(route, { stores: [], followerTrend: datesBetween(url.searchParams.get("dateFrom"), url.searchParams.get("dateTo")).map((date) => ({ date, followers: followerTotals(seed, date).followers })), connectedStoreCount: seed.stores.length - 1, totalStoreCount: seed.stores.length, scopeStoreCount: seed.stores.length, filterOptions: { tiers: [], kpiPlans: [], areas: [], bms: [] } });
    }
    return json(route, {});
  });
  return seed;
}
