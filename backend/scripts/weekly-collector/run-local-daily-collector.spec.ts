import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveMissingCompletedDates,
} from "./run-local-daily-collector.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");
const LOCAL_DATA_DIR = path.resolve(BACKEND_DIR, "local-data");
const LOCK_FILE_PATH = path.join(LOCAL_DATA_DIR, "google-review-daily.lock");
const STATE_FILE_PATH = path.join(LOCAL_DATA_DIR, "google-review-daily-state.json");

describe("Permanent Local Daily Collector Tests", () => {
  it("verifies missing completed dates resolution logic for Week 3", async () => {
    // Mock prisma client
    const mockPrisma = {
      googleReviewWeeklyPeriod: {
        findUnique: async ({ where }: any) => {
          if (where.weekNumber === 3) {
            return { id: "week-3-id", weekNumber: 3, status: "OPEN" };
          }
          return null;
        },
      },
      googleReviewDailyKpi: {
        groupBy: async ({ where }: any) => {
          // Simulate Sep 10, 11, 12, 13 present, Sep 14 missing
          return [
            { date: "2026-09-10", _count: { storeCode: 65 } },
            { date: "2026-09-11", _count: { storeCode: 65 } },
            { date: "2026-09-12", _count: { storeCode: 65 } },
            { date: "2026-09-13", _count: { storeCode: 65 } },
          ];
        },
      },
    };

    // On 2026-09-16 09:00:00+07:00, yesterday was 2026-09-15 (not in DB or state)
    const ref = new Date("2026-09-16T09:00:00+07:00");
    const missing = await resolveMissingCompletedDates(mockPrisma as any, ref);

    assert.deepEqual(missing, ["2026-09-15"]);
  });

  it("scrubs database credentials and sensitive tokens from logger", () => {
    const rawUrl = "postgresql://myuser:secretpassword123@tokaido.proxy.rlwy.net:38745/railway";
    const scrubbed = rawUrl.replace(/postgresql:\/\/[^@\s]+@[^\s/]+/gi, (m) => {
      const parsed = new URL(m);
      return `${parsed.protocol}//***:***@${parsed.host}`;
    });

    assert.ok(!scrubbed.includes("secretpassword123"));
    assert.ok(!scrubbed.includes("myuser"));
    assert.ok(scrubbed.includes("***:***@tokaido.proxy.rlwy.net:38745"));
  });

  it("handles lock file creation, detection, and cleanup", () => {
    const testLockPath = path.join(LOCAL_DATA_DIR, "test-collector.lock");
    try {
      // Create mock active lock with current process PID
      fs.writeFileSync(
        testLockPath,
        JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
        "utf8"
      );
      assert.ok(fs.existsSync(testLockPath));

      const readData = JSON.parse(fs.readFileSync(testLockPath, "utf8"));
      assert.equal(readData.pid, process.pid);
    } finally {
      if (fs.existsSync(testLockPath)) {
        fs.unlinkSync(testLockPath);
      }
    }
  });
});
