import assert from "node:assert/strict";
import test from "node:test";
import { ExportLineOfficialAccountsDto } from "./line-official-account.dto";
import { buildCanonicalLineOaCsv, requireCanonicalStoreId } from "./line-official-account-canonical-export";

function item(overrides: Record<string, unknown> = {}) {
  const base = {
    id: "oa-1",
    name: "OPPO Central Nakhon",
    basicId: "@tay5614g",
    channelId: "channel-1",
    connectionStatus: "CONNECTED",
    isActive: true,
    webhookUrl: "https://example.test/webhook",
    webhookConfigured: true,
    lastWebhookReceivedAt: new Date("2026-09-08T00:00:00Z"),
    messagesReceivedToday: 3,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-08T00:00:00Z"),
    store: {
      id: "4f0a7f1b-1111-2222-3333-abcdefabcdef",
      storeId: "12140",
      externalStoreId: "12140",
      code: "12140",
      name: "OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT",
      province: "Nakhon Si Thammarat",
      region: "Southern",
      accountName: "OPPO Central Nakhon.",
      lineManagerUrl: "https://chat.line.biz/account/@tay5614g",
      lineOaLink: "https://lin.ee/w9OhI6D",
    },
  };
  return { ...base, ...overrides } as any;
}

test("LINE OA export uses the business Store ID and never the internal store UUID", () => {
  const query = new ExportLineOfficialAccountsDto();
  const source = item();
  const result = buildCanonicalLineOaCsv([source], query);

  assert.match(result.csv, /"12140"/);
  assert.doesNotMatch(result.csv, /4f0a7f1b-1111-2222-3333-abcdefabcdef/);
  assert.equal(result.rowCount, 1);
});

test("canonical Store ID rejects stale StoreMaster relation instead of guessing", () => {
  const source = item();
  source.store.externalStoreId = "22057";
  source.store.storeId = "22057";

  assert.throws(
    () => requireCanonicalStoreId(source.store),
    /Store ID conflict detected/,
  );
});

test("canonical Store ID rejects missing Store.code even if an internal UUID exists", () => {
  const source = item();
  source.store.code = null;
  source.store.storeId = null;
  source.store.externalStoreId = null;

  assert.throws(
    () => requireCanonicalStoreId(source.store),
    /Canonical Store ID is missing/,
  );
});

test("filtered export still validates every Store ID before writing any row", () => {
  const query = new ExportLineOfficialAccountsDto();
  query.search = "does-not-match";
  const source = item();
  source.store.externalStoreId = "22057";
  source.store.storeId = "22057";

  assert.throws(
    () => buildCanonicalLineOaCsv([source], query),
    /Store ID conflict detected/,
  );
});
