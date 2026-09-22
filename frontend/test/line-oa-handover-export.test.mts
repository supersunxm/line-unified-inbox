import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("LINE OA management exposes an admin handover credential download with explicit warning", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(pageCode, /data-testid="export-line-oa-handover-button"/);
  assert.match(pageCode, /window\.confirm\(text\.handoverExportWarning\)/);
  assert.match(pageCode, /api\.exportLineOfficialAccountHandover\(/);
  assert.match(apiCode, /\/line-official-accounts\/handover\.csv/);
});
