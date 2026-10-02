import assert from "node:assert/strict";
import test from "node:test";
import { provenHistoricalSourceAnchorsSql } from "./historical-source-anchors";

test("Historical source anchors include every accepted durable alias, normalized and scoped to Store/OA", () => {
  const query = provenHistoricalSourceAnchorsSql(new Date("2026-08-31T17:00:00Z"), { storeId: "store-a", lineOfficialAccountId: "oa-a" });
  assert.match(query.sql, /externalMessageId/);
  assert.match(query.sql, /providerMessageId/);
  assert.match(query.sql, /managerMessageId/);
  assert.match(query.sql, /regexp_replace/);
  assert.match(query.sql, /c\."storeId" = h\."storeId" AND c\."lineOfficialAccountId" = h\."lineOfficialAccountId"/);
  assert.ok(query.values.includes("store-a"));
  assert.ok(query.values.includes("oa-a"));
});

test("Historical source anchors require compatible delivered text and a unique destination", () => {
  const query = provenHistoricalSourceAnchorsSql(new Date("2026-08-31T17:00:00Z"));
  assert.match(query.sql, /count\(DISTINCT c\."conversationId"\) = 1/);
  assert.match(query.sql, /bool_and/);
  assert.match(query.sql, /messageType.*TEXT.*deliveryStatus.*DELIVERED/s);
  assert.match(query.sql, /originalText.*h\."text".*direction.*h\."direction"/s);
  assert.match(query.sql, /abs\(extract\(epoch.*<= 1/s);
});

test("Historical source anchors reject conflicting direct and LINK_SAFE destinations without writes", () => {
  const query = provenHistoricalSourceAnchorsSql(new Date("2026-08-31T17:00:00Z"));
  assert.match(query.sql, /direct\."id" <> a\."canonicalConversationId"/);
  assert.match(query.sql, /LINK_SAFE/);
  assert.match(query.sql, /x\."canonicalConversationId" <> a\."canonicalConversationId"/);
  assert.doesNotMatch(query.sql, /\b(INSERT|UPDATE|DELETE|UPSERT)\b/);
});
