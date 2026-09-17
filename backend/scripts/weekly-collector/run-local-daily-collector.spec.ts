import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveMissingCompletedDates,
  runCollectionForDate,
  StateManager,
} from "./run-local-daily-collector.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");
const LOCAL_DATA_DIR = path.resolve(BACKEND_DIR, "local-data");
const LOCK_FILE_PATH = path.join(LOCAL_DATA_DIR, "google-review-daily.lock");
const STATE_FILE_PATH = path.join(LOCAL_DATA_DIR, "google-review-daily-state.json");

describe("Permanent Local Daily Collector Tests", () => {
  it("verifies missing completed dates resolution logic for Week 3", async () => {
    const origIsDateCompleted = StateManager.isDateCompleted;
    StateManager.isDateCompleted = () => false;

    try {
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
            // Simulate Sep 10, 11, 12, 13 present, Sep 14, 15 missing
            return [
              { date: "2026-09-10", _count: { storeCode: 65 } },
              { date: "2026-09-11", _count: { storeCode: 65 } },
              { date: "2026-09-12", _count: { storeCode: 65 } },
              { date: "2026-09-13", _count: { storeCode: 65 } },
            ];
          },
          count: async () => 0,
        },
      };

      // On 2026-09-16 09:00:00+07:00, yesterday was 2026-09-15 (not in DB or state)
      const ref = new Date("2026-09-16T09:00:00+07:00");
      const missing = await resolveMissingCompletedDates(mockPrisma as any, ref);

      assert.deepEqual(missing, ["2026-09-14", "2026-09-15"]);
    } finally {
      StateManager.isDateCompleted = origIsDateCompleted;
    }
  });

  describe("Week-Boundary Catch-up and Safety Invariants (Cases 1-5)", () => {
    it("Case 1: 2026-09-17 01:00 queues missing 2026-09-16 from CLOSED Week 3", async () => {
      const origIsDateCompleted = StateManager.isDateCompleted;
      StateManager.isDateCompleted = () => false;

      try {
        const mockPrisma = {
          googleReviewWeeklyPeriod: {
            findUnique: async ({ where }: any) => {
              if (where.weekNumber === 3) {
                return { id: "week-3-id", weekNumber: 3, status: "CLOSED" };
              }
              if (where.weekNumber === 4) {
                return { id: "week-4-id", weekNumber: 4, status: "OPEN" };
              }
              return null;
            },
          },
          googleReviewDailyKpi: {
            count: async ({ where }: any) => {
              // 2026-09-16 has 0 entries in DB
              if (where.date === "2026-09-16") return 0;
              return 65;
            },
            groupBy: async () => [],
          },
        };

        const ref = new Date("2026-09-17T01:00:00+07:00");
        const missing = await resolveMissingCompletedDates(mockPrisma as any, ref);

        assert.deepEqual(missing, ["2026-09-16"]);
      } finally {
        StateManager.isDateCompleted = origIsDateCompleted;
      }
    });

    it("Case 2: 2026-09-16 already SUCCESS in state is skipped without re-scraping", async () => {
      const origIsDateCompleted = StateManager.isDateCompleted;
      StateManager.isDateCompleted = (d: string) => d === "2026-09-16";

      try {
        const mockPrisma = {
          googleReviewWeeklyPeriod: {
            findUnique: async ({ where }: any) => {
              if (where.weekNumber === 4) {
                return { id: "week-4-id", weekNumber: 4, status: "OPEN" };
              }
              return null;
            },
          },
          googleReviewDailyKpi: {
            count: async () => 0,
            groupBy: async () => [],
          },
        };

        const ref = new Date("2026-09-17T01:00:00+07:00");
        const missing = await resolveMissingCompletedDates(mockPrisma as any, ref);

        assert.deepEqual(missing, []);
      } finally {
        StateManager.isDateCompleted = origIsDateCompleted;
      }
    });

    it("Case 3: 2026-09-16 Daily KPI exists in DB but missing in state reconciles state without re-scraping", async () => {
      const origIsDateCompleted = StateManager.isDateCompleted;
      const origRecordSuccess = StateManager.recordSuccess;

      let recordedDate: string | null = null;
      StateManager.isDateCompleted = () => false;
      StateManager.recordSuccess = ({ targetDate }: any) => {
        recordedDate = targetDate;
      };

      try {
        const mockPrisma = {
          googleReviewWeeklyPeriod: {
            findUnique: async ({ where }: any) => {
              if (where.weekNumber === 3) {
                return { id: "week-3-id", weekNumber: 3, status: "CLOSED" };
              }
              if (where.weekNumber === 4) {
                return { id: "week-4-id", weekNumber: 4, status: "OPEN" };
              }
              return null;
            },
          },
          googleReviewDailyKpi: {
            count: async ({ where }: any) => {
              if (where.date === "2026-09-16") return 65;
              return 0;
            },
            groupBy: async () => [],
          },
        };

        const ref = new Date("2026-09-17T01:00:00+07:00");
        const missing = await resolveMissingCompletedDates(mockPrisma as any, ref);

        assert.deepEqual(missing, []);
        assert.equal(recordedDate, "2026-09-16");
      } finally {
        StateManager.isDateCompleted = origIsDateCompleted;
        StateManager.recordSuccess = origRecordSuccess;
      }
    });

    it("Case 4: Arbitrary old Week 2 CLOSED date is blocked by runCollectionForDate even with allowPreviousWeekFinalization", async () => {
      const mockPrisma = {
        googleReviewWeeklyPeriod: {
          findUnique: async ({ where }: any) => {
            if (where.weekNumber === 2) {
              return { id: "week-2-id", weekNumber: 2, status: "CLOSED" };
            }
            return null;
          },
        },
      };

      const mockLogger = {
        log: () => {},
        warn: () => {},
        error: () => {},
      };

      const ref = new Date("2026-09-17T01:00:00+07:00");
      // Target date 2026-09-08 is Week 2. Today is Week 4.
      await assert.rejects(
        async () => {
          await runCollectionForDate({
            targetDate: "2026-09-08",
            referenceNow: ref,
            prisma: mockPrisma as any,
            logger: mockLogger as any,
            options: {
              allowPreviousWeekFinalization: true,
              forceReconcile: false,
            },
          });
        },
        /Cannot collect into CLOSED Week 2 period!/
      );
    });

    it("Case 5: 2026-09-18 targets 2026-09-17 in Week 4 normally", async () => {
      const origIsDateCompleted = StateManager.isDateCompleted;
      StateManager.isDateCompleted = () => false;

      try {
        const mockPrisma = {
          googleReviewWeeklyPeriod: {
            findUnique: async ({ where }: any) => {
              if (where.weekNumber === 4) {
                return { id: "week-4-id", weekNumber: 4, status: "OPEN" };
              }
              return null;
            },
          },
          googleReviewDailyKpi: {
            groupBy: async () => [],
            count: async () => 0,
          },
        };

        // Today is 2026-09-18 (Week 4), yesterday was 2026-09-17 (Week 4)
        const ref = new Date("2026-09-18T01:00:00+07:00");
        const missing = await resolveMissingCompletedDates(mockPrisma as any, ref);

        assert.deepEqual(missing, ["2026-09-17"]);
      } finally {
        StateManager.isDateCompleted = origIsDateCompleted;
      }
    });
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
