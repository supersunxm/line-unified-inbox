import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  assertStoreMasterCsvSnapshot,
  createStoreMasterCsvSnapshot,
  fetchStoreMasterCsvSnapshot,
  resolveStoreMasterCsvExportUrl,
} from "./store-master-source";

void test("Google Sheets source resolution preserves an explicit gid", () => {
  assert.equal(
    resolveStoreMasterCsvExportUrl("https://docs.google.com/spreadsheets/d/sheet_id/edit?gid=123#gid=123"),
    "https://docs.google.com/spreadsheets/d/sheet_id/export?format=csv&gid=123",
  );
  assert.equal(
    resolveStoreMasterCsvExportUrl("https://docs.google.com/spreadsheets/d/sheet_id/edit#gid=0"),
    "https://docs.google.com/spreadsheets/d/sheet_id/export?format=csv&gid=0",
  );
});

void test("source resolution rejects malformed, ambiguous, or non-Google configurations", () => {
  for (const value of [
    "",
    "https://example.com/spreadsheets/d/sheet_id/edit?gid=1",
    "http://docs.google.com/spreadsheets/d/sheet_id/edit?gid=1",
    "https://docs.google.com/spreadsheets/d/sheet_id/edit?gid=1&gid=2",
    "https://docs.google.com/spreadsheets/d/sheet_id/edit?gid=1#gid=2",
    "https://docs.google.com/spreadsheets/d/sheet_id/edit?gid=not-a-number",
    "https://docs.google.com/spreadsheets/d/sheet_id/edit#gid=1&range=A1",
  ]) {
    assert.throws(() => resolveStoreMasterCsvExportUrl(value));
  }
});

void test("one fetch produces a digest for the exact CSV bytes", async () => {
  const csv = "STORE ID,STORE NAME\r\n100,Store 100\r\n";
  const bytes = new TextEncoder().encode(csv);
  const requested: string[] = [];
  const snapshot = await fetchStoreMasterCsvSnapshot(
    "https://docs.google.com/spreadsheets/d/sheet_id/edit?gid=42",
    async (input) => {
      if (typeof input === "string") requested.push(input);
      else if (input instanceof URL) requested.push(input.toString());
      else requested.push(input.url);
      return new Response(bytes, { status: 200 });
    },
  );

  assert.equal(requested.length, 1);
  assert.equal(requested[0], "https://docs.google.com/spreadsheets/d/sheet_id/export?format=csv&gid=42");
  assert.equal(snapshot.csv, csv);
  assert.equal(snapshot.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.doesNotThrow(() => assertStoreMasterCsvSnapshot(snapshot));
});

void test("a changed CSV cannot reuse the validated source digest", async () => {
  const snapshot = await fetchStoreMasterCsvSnapshot(
    "https://docs.google.com/spreadsheets/d/sheet_id/edit?gid=42",
    async () => new Response("STORE ID,STORE NAME\n100,Store 100\n", { status: 200 }),
  );

  assert.throws(
    () => assertStoreMasterCsvSnapshot({ ...snapshot, csv: snapshot.csv.replace("Store 100", "Store 200") }),
    /does not match its original bytes/,
  );
});

void test("the source fingerprint covers exact original bytes including a UTF-8 BOM", () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("STORE ID,STORE NAME\n")]);
  const snapshot = createStoreMasterCsvSnapshot(bytes, "local-file");
  assert.equal(snapshot.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(snapshot.csv.charAt(0), "S");
  assert.doesNotThrow(() => assertStoreMasterCsvSnapshot(snapshot));
  assert.throws(
    () => assertStoreMasterCsvSnapshot({ ...snapshot, bytes: new TextEncoder().encode(snapshot.csv) }),
    /source changed after validation/,
  );
});

void test("invalid source configuration fails before making an HTTP request", async () => {
  let fetchCount = 0;
  await assert.rejects(
    fetchStoreMasterCsvSnapshot("https://example.com/not-a-sheet", async () => {
      fetchCount += 1;
      return new Response("unexpected", { status: 200 });
    }),
    /Invalid STORE_MASTER_GOOGLE_SHEET_URL/,
  );
  assert.equal(fetchCount, 0);
});
