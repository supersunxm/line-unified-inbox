import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptRelative = "scripts/weekly-collector/run-single-cycle.mjs";
const scriptDotRelative = "./scripts/weekly-collector/run-single-cycle.mjs";
const scriptAbsolute = path.resolve(__dirname, "run-single-cycle.mjs");
const backendDir = path.resolve(__dirname, "../..");

test("Collector direct execution guard vs module import", async (t) => {
  await t.test("1. Importing module in tests does not enter main()", async () => {
    // If main() were entered, it would attempt Prisma queries and fail without DATABASE_URL
    const imported = await import("./run-single-cycle.mjs");
    assert.ok(typeof imported.refreshWeeklyStoreTotal === "function");
    assert.ok(typeof imported.upsertDailyByReviewDate === "function");
  });

  await t.test("2. Running via relative path 'node scripts/weekly-collector/run-single-cycle.mjs' enters main()", async () => {
    try {
      await execFileAsync("node", [scriptRelative], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: "" },
      });
      assert.fail("Should have failed at Prisma initialization, not before entering main");
    } catch (err) {
      const output = (err.stdout || "") + (err.stderr || "");
      assert.ok(
        output.includes("[google-review-collector] main entered"),
        `Expected '[google-review-collector] main entered' in output, got:\n${output}`
      );
    }
  });

  await t.test("3. Running via dot-relative path 'node ./scripts/weekly-collector/run-single-cycle.mjs' enters main()", async () => {
    try {
      await execFileAsync("node", [scriptDotRelative], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: "" },
      });
      assert.fail("Should have failed at Prisma initialization, not before entering main");
    } catch (err) {
      const output = (err.stdout || "") + (err.stderr || "");
      assert.ok(
        output.includes("[google-review-collector] main entered"),
        `Expected '[google-review-collector] main entered' in output, got:\n${output}`
      );
    }
  });

  await t.test("4. Running via absolute path 'node /app/backend/scripts/...' enters main()", async () => {
    try {
      await execFileAsync("node", [scriptAbsolute], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: "" },
      });
      assert.fail("Should have failed at Prisma initialization, not before entering main");
    } catch (err) {
      const output = (err.stdout || "") + (err.stderr || "");
      assert.ok(
        output.includes("[google-review-collector] main entered"),
        `Expected '[google-review-collector] main entered' in output, got:\n${output}`
      );
    }
  });
});
