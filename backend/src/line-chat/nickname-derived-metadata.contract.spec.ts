import assert from "node:assert/strict";
import test from "node:test";
import { parseNicknameV3 } from "./nickname-parser-v3.contract";
import {
  createManifest,
  parserValuesToMetadata,
  selectRepresentativeCanary,
  validateManifest,
  type NicknameDerivedManifestRow,
} from "./nickname-derived-metadata.contract";

test("v3 snapshot conversion keeps independent partial metadata dimensions", () => {
  const online = parseNicknameV3("Online", true);
  assert.equal(online.decision, "DETERMINISTIC");
  assert.deepEqual(parserValuesToMetadata(online), {
    source: null,
    customerType: "ONLINE",
    productModelId: null,
    productName: null,
    paymentMethod: null,
    financeProvider: null,
    service: null,
    periodYear: null,
    periodMonth: null,
    eventDate: null,
  });
});

function row(index: number, values: Partial<NicknameDerivedManifestRow["values"]>, storeIndex: number, profileKey: "A" | "B"): NicknameDerivedManifestRow {
  const empty: NicknameDerivedManifestRow["values"] = {
    source: null, customerType: null, productModelId: null, productName: null, paymentMethod: null,
    financeProvider: null, service: null, periodYear: null, periodMonth: null, eventDate: null,
  };
  return {
    conversationId: `conversation-${index}`,
    storeId: `store-${storeIndex}`,
    lineOfficialAccountId: `oa-${storeIndex}`,
    lineChatUserId: `chat-${index}`,
    sourceObservationId: `observation-${index}`,
    observedAt: "2026-10-06T00:00:00.000Z",
    nicknameSha256: "a".repeat(64),
    parserVersion: "nickname-parser-v3.0.1",
    profileKey,
    values: { ...empty, ...values },
    expectedCurrentState: null,
    salesFieldsSha256: "b".repeat(64),
  };
}

test("manifest canonical digest is stable and detects row edits", () => {
  const rows = [
    row(1, { customerType: "ONLINE" }, 1, "A"),
    row(2, { financeProvider: "SG_FINANCE", paymentMethod: "CASH", source: "TikTok", periodYear: 2026, periodMonth: 9 }, 2, "B"),
  ];
  const manifest = createManifest(rows, "nickname-parser-v3.0.1", "2026-10-06T00:00:00.000Z");
  const reversed = createManifest([...rows].reverse(), "nickname-parser-v3.0.1", "2026-10-06T00:00:00.000Z");
  assert.equal(manifest.rowSetSha256, reversed.rowSetSha256);
  assert.equal(manifest.sha256, reversed.sha256);
  validateManifest(manifest, "nickname-parser-v3.0.1");
  assert.throws(() => validateManifest({ ...manifest, rows: [{ ...rows[0], values: { ...rows[0].values, source: "Facebook" } }, rows[1]] }, "nickname-parser-v3.0.1"), /MANIFEST_ROW_SET_CHANGED/);
});

test("canary set cover includes available dimensions, both profiles and multiple stores", () => {
  const rows = [
    row(1, { customerType: "ONLINE", productModelId: "p1", productName: "OPPO Reno16", periodYear: 2026, periodMonth: 9 }, 1, "A"),
    row(2, { financeProvider: "SG_FINANCE", paymentMethod: "CASH", source: "TikTok", eventDate: "2026-09-27" }, 2, "B"),
    row(3, { financeProvider: "UFUND", paymentMethod: "INSTALLMENT", service: "FILM_INSTALLATION" }, 3, "A"),
  ];
  const canary = selectRepresentativeCanary(rows, 20);
  assert.deepEqual(new Set(canary.map((item) => item.conversationId)), new Set(rows.map((item) => item.conversationId)));
  assert.equal(new Set(canary.map((item) => item.storeId)).size, 3);
  assert.ok(canary.some((item) => item.profileKey === "A"));
  assert.ok(canary.some((item) => item.profileKey === "B"));
});
