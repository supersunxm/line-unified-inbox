import assert from "node:assert/strict";
import test from "node:test";
import { selectLineChatStoreOa } from "./line-chat-store-oa-selector";

test("Store Master LINE ID is the strongest OA identity", () => {
  assert.deepEqual(
    selectLineChatStoreOa(
      {
        accountName: "OPPO CentralChonburi",
        normalizedAccountName: "oppocentralchonburi",
        lineId: "@487spiji",
      },
      [
        { id: "oa-old", name: "OPPO CentralChonburi Old", basicId: "@old" },
        { id: "oa-right", name: "Anything", basicId: "@487spiji" },
      ],
    ),
    { ok: true, oaId: "oa-right", source: "MASTER_LINE_ID" },
  );
});

test("Store Master account name selects the OA when LINE ID is unavailable", () => {
  assert.deepEqual(
    selectLineChatStoreOa(
      {
        accountName: "OPPO CentralChonburi",
        normalizedAccountName: "oppocentralchonburi",
        lineId: null,
      },
      [
        { id: "oa-other", name: "OPPO Central World", basicId: "@126fiiqf" },
        { id: "oa-right", name: "OPPO CentralChonburi", basicId: "@487spiji" },
      ],
    ),
    { ok: true, oaId: "oa-right", source: "MASTER_ACCOUNT_NAME" },
  );
});

test("single active OA is a safe fallback", () => {
  assert.deepEqual(
    selectLineChatStoreOa(null, [
      { id: "oa-only", name: "OPPO CentralChonburi", basicId: "@487spiji" },
    ]),
    { ok: true, oaId: "oa-only", source: "ONLY_ACTIVE_OA" },
  );
});

test("multiple active OAs without a unique Store Master match fail closed", () => {
  assert.deepEqual(
    selectLineChatStoreOa(
      {
        accountName: "Unknown",
        normalizedAccountName: "unknown",
        lineId: "@missing",
      },
      [
        { id: "oa-a", name: "OA A", basicId: "@a" },
        { id: "oa-b", name: "OA B", basicId: "@b" },
      ],
    ),
    { ok: false, reason: "MULTIPLE_ACTIVE_OAS_NO_MASTER_MATCH" },
  );
});

test("ambiguous Store Master LINE ID fails closed", () => {
  assert.deepEqual(
    selectLineChatStoreOa(
      {
        accountName: "OPPO CentralChonburi",
        normalizedAccountName: "oppocentralchonburi",
        lineId: "@487spiji",
      },
      [
        { id: "oa-a", name: "OPPO CentralChonburi", basicId: "@487spiji" },
        { id: "oa-b", name: "Duplicate", basicId: "@487spiji" },
      ],
    ),
    { ok: false, reason: "MASTER_LINE_ID_AMBIGUOUS" },
  );
});
