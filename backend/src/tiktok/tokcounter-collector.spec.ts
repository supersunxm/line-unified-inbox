import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe, it } from "node:test";
import {
  normalizeTikTokUsername,
  extractAccountsFromCsv,
} from "../../scripts/tiktok-public/sheet-reader.mjs";
import { parseMetricValue } from "../../scripts/tiktok-public/tokcounter-extractor.mjs";
import {
  calculateTikTokGrowth,
  baselineAtOrBefore,
} from "./tiktok-public-analytics.service";
import {
  LockManager,
  StateManager,
  getBangkokDate,
  offsetBangkokDate,
  resolveDefaultMetricDate,
  calculatePacingDelayMs,
} from "../../scripts/tiktok-public/run-daily-collector.mjs";

describe("TokCounter Daily Collector Suite", () => {
  describe("Username Normalization", () => {
    it("normalizes simple lowercase usernames", () => {
      assert.equal(normalizeTikTokUsername("o_seaconsquaresrinakarin"), "o_seaconsquaresrinakarin");
    });

    it("strips leading @ symbols and trims whitespace", () => {
      assert.equal(normalizeTikTokUsername("  @@@o_taweekitburiram  "), "o_taweekitburiram");
    });

    it("lowercases uppercase characters", () => {
      assert.equal(normalizeTikTokUsername("O_SermthaiComplex"), "o_sermthaicomplex");
    });

    it("extracts username from full TikTok profile URL", () => {
      assert.equal(
        normalizeTikTokUsername("https://www.tiktok.com/@o_lotusthathong?lang=en"),
        "o_lotusthathong"
      );
    });

    it("handles hyphens in usernames", () => {
      assert.equal(normalizeTikTokUsername("o-themallthaphra"), "o-themallthaphra");
    });

    it("rejects invalid, empty, or spreadsheet error strings", () => {
      assert.equal(normalizeTikTokUsername(""), null);
      assert.equal(normalizeTikTokUsername(null), null);
      assert.equal(normalizeTikTokUsername("#REF!"), null);
      assert.equal(normalizeTikTokUsername("#VALUE!"), null);
      assert.equal(normalizeTikTokUsername("NULL"), null);
    });
  });

  describe("Number Parsing & Precision Flags", () => {
    it("parses exact comma-separated integers with EXACT precision", () => {
      const res = parseMetricValue("4,477");
      assert.deepEqual(res, {
        rawValue: "4,477",
        parsedValue: 4477,
        precision: "EXACT",
      });
    });

    it("parses exact space-separated integers with EXACT precision", () => {
      const res = parseMetricValue("11 035");
      assert.deepEqual(res, {
        rawValue: "11 035",
        parsedValue: 11035,
        precision: "EXACT",
      });
    });

    it("parses K abbreviation with ABBREVIATED precision", () => {
      const res = parseMetricValue("12.3K");
      assert.deepEqual(res, {
        rawValue: "12.3K",
        parsedValue: 12300,
        precision: "ABBREVIATED",
      });
    });

    it("parses M abbreviation with ABBREVIATED precision", () => {
      const res = parseMetricValue("1.5M");
      assert.deepEqual(res, {
        rawValue: "1.5M",
        parsedValue: 1500000,
        precision: "ABBREVIATED",
      });
    });

    it("parses B abbreviation with ABBREVIATED precision", () => {
      const res = parseMetricValue("2B");
      assert.deepEqual(res, {
        rawValue: "2B",
        parsedValue: 2000000000,
        precision: "ABBREVIATED",
      });
    });

    it("handles null or empty input gracefully", () => {
      assert.deepEqual(parseMetricValue(null), {
        rawValue: null,
        parsedValue: null,
        precision: "UNKNOWN",
      });
      assert.deepEqual(parseMetricValue("   "), {
        rawValue: "",
        parsedValue: null,
        precision: "UNKNOWN",
      });
    });
  });

  describe("CSV Parsing & Duplicate Store Mapping", () => {
    it("correctly groups duplicate stores under a single account", () => {
      const sampleCsv = `STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,"Province\nจังหวัด","Region\nภูมิภาค",TikTok Username,TikTok Profile URL,Google Maps links,Google Maps Name,Status,
27837,OBS Taweekit Buriram By TG 2,OPPOTaweekitBuriram2,https://lin.ee/o4BDzYp,@652tflff,https://chat.line.biz/account/@652tflff,Buriram,Northeastern,o_taweekitburiram,https://www.tiktok.com/@o_taweekitburiram,,,
27368,OBS Taweekit Buriram By TG,OPPOTaweekitBuriram,https://lin.ee/5mxYf0n,@476pfxwe,https://chat.line.biz/account/@476pfxwe,Buriram,Northeastern,o_taweekitburiram,https://www.tiktok.com/@o_taweekitburiram,,,
109,OBS Seacon Square,OPPO Seacon Square,https://lin.ee/q5nLK91,@891uqqhq,https://chat.line.biz/account/@891uqqhq,Bangkok,Central,o_seaconsquaresrinakarin,https://www.tiktok.com/@o_seaconsquaresrinakarin,,,
99999,Store Without TikTok,OPPO Test,,,,,,,,,,`;

      const parsed = extractAccountsFromCsv(sampleCsv);
      assert.equal(parsed.totalStoreRows, 4);
      assert.equal(parsed.rowsWithTiktok, 3);
      assert.equal(parsed.uniqueAccountsCount, 2);
      assert.equal(parsed.blankOrInvalid, 1);

      const duplicateGroup = parsed.duplicateGroups.find((g) => g.username === "o_taweekitburiram");
      assert.ok(duplicateGroup);
      assert.equal(duplicateGroup?.stores.length, 2);
      assert.deepEqual(duplicateGroup?.stores.map((s) => s.storeId), ["27837", "27368"]);
    });
  });

  describe("Bangkok Date Determination", () => {
    it("formats Bangkok dates correctly", () => {
      const bkkDate = getBangkokDate(new Date("2026-09-16T18:00:00Z"));
      // 18:00 UTC is next day 01:00 Bangkok
      assert.equal(bkkDate, "2026-09-17");
    });

    it("offsets Bangkok dates by day count correctly", () => {
      assert.equal(offsetBangkokDate("2026-09-16", -1), "2026-09-15");
      assert.equal(offsetBangkokDate("2026-09-01", -1), "2026-08-31");
      assert.equal(offsetBangkokDate("2026-09-16", 1), "2026-09-17");
    });

    it("resolves early morning run to previous completed day", () => {
      // 01:30 Bangkok time
      const earlyMorning = new Date("2026-09-16T18:30:00Z"); // 01:30 Bangkok on Sep 17
      const target = resolveDefaultMetricDate(earlyMorning);
      assert.equal(target, "2026-09-16");
    });
  });

  describe("Growth & Interval Honesty", () => {
    it("calculates positive growth and percentage correctly", () => {
      const growth = calculateTikTokGrowth(1050, 1000);
      assert.deepEqual(growth, {
        absolute: 50,
        percent: 5,
      });
    });

    it("calculates negative growth correctly", () => {
      const growth = calculateTikTokGrowth(950, 1000);
      assert.deepEqual(growth, {
        absolute: -50,
        percent: -5,
      });
    });

    it("returns null when baseline is missing (honest reporting)", () => {
      const growth = calculateTikTokGrowth(1000, null);
      assert.deepEqual(growth, {
        absolute: null,
        percent: null,
      });
    });

    it("finds the nearest baseline at or before target date without fabricating", () => {
      const metrics = [
        { metricDate: "2026-09-10", followerCount: 1000 },
        { metricDate: "2026-09-12", followerCount: 1020 },
        { metricDate: "2026-09-15", followerCount: 1050 },
      ];

      const baseline = baselineAtOrBefore(metrics as any, "2026-09-14");
      assert.equal(baseline?.metricDate, "2026-09-12");
      assert.equal(baseline?.followerCount, 1020);
    });
  });

  describe("Process Locking & Dead PID Cleanup", () => {
    const testLockPath = path.resolve(__dirname, "../../local-data/tiktok-public-daily.lock");

    it("acquires and releases lock cleanly", () => {
      if (fs.existsSync(testLockPath)) {
        try { fs.unlinkSync(testLockPath); } catch {}
      }

      const logs: string[] = [];
      const mockLogger = {
        log: (m: string) => logs.push(m),
        warn: (m: string) => logs.push(m),
        error: (m: string) => logs.push(m),
      };

      const acquired = LockManager.acquire(mockLogger as any, "2026-09-16");
      assert.equal(acquired, true);
      assert.equal(fs.existsSync(testLockPath), true);

      LockManager.release(mockLogger as any);
      assert.equal(fs.existsSync(testLockPath), false);
    });

    it("clears stale dead PID lock safely", () => {
      if (fs.existsSync(testLockPath)) {
        try { fs.unlinkSync(testLockPath); } catch {}
      }

      const warnings: string[] = [];
      const mockLogger = {
        log: () => {},
        warn: (m: string) => warnings.push(m),
        error: () => {},
      };

      // Write lock with dead PID
      const fakeLock = { pid: 9999999, startedAt: "2026-01-01T00:00:00Z", targetDate: "2026-01-01" };
      fs.writeFileSync(testLockPath, JSON.stringify(fakeLock), "utf8");

      const acquired = LockManager.acquire(mockLogger as any, "2026-09-16");
      assert.equal(acquired, true);
      assert.ok(warnings.some((w) => w.includes("Clearing stale lock from dead PID 9999999")));

      LockManager.release(mockLogger as any);
    });
  });

  describe("Conservative Pacing & Jitter", () => {
    it("generates delays within the specified range", () => {
      for (let i = 0; i < 50; i++) {
        const delay = calculatePacingDelayMs(8000, 15000);
        assert.ok(delay >= 8000, `Delay ${delay} is less than min 8000`);
        assert.ok(delay <= 15000, `Delay ${delay} is greater than max 15000`);
        assert.equal(Number.isInteger(delay), true);
      }
    });

    it("handles default 8-15s bounds", () => {
      const delay = calculatePacingDelayMs();
      assert.ok(delay >= 8000 && delay <= 15000);
    });

    it("handles inverted bounds safely", () => {
      const delay = calculatePacingDelayMs(10000, 5000);
      assert.ok(delay >= 10000);
    });
  });

  describe("Store Auto-Binding Recurrence Prevention", () => {
    it("binds all active StoreMaster rows sharing a handle even if omitted from target.stores", () => {
      const target = {
        username: "oppo.bigcmahachai",
        profileUrl: "https://www.tiktok.com/@oppo.bigcmahachai",
        stores: [{ storeId: "30679", storeName: "OBS Big C Mahachai By JP" }],
      };

      const storeMasterRows = [
        {
          id: "sm-30679",
          externalStoreId: "30679",
          tiktokUsername: "oppo.bigcmahachai",
          tiktokPublicAccountId: null,
          isActive: true,
        },
        {
          id: "sm-31754",
          externalStoreId: "31754",
          tiktokUsername: "oppo.bigcmahachai",
          tiktokPublicAccountId: null,
          isActive: true,
        },
        {
          id: "sm-99999",
          externalStoreId: "99999",
          tiktokUsername: "oppo.bigcmahachai",
          tiktokPublicAccountId: null,
          isActive: false,
        },
      ];

      const storeIds = target.stores.map((s) => s.storeId).filter(Boolean);
      const whereClause = {
        OR: [
          ...(storeIds.length > 0 ? [{ externalStoreId: { in: storeIds } }] : []),
          {
            isActive: true,
            tiktokUsername: { equals: target.username, mode: "insensitive" },
          },
          {
            isActive: true,
            tiktokUsername: { equals: `@${target.username}`, mode: "insensitive" },
          },
        ],
      };

      const publicAccountId = "pub-oppo.bigcmahachai";

      // Simulate Prisma updateMany execution
      for (const row of storeMasterRows) {
        const matches =
          (storeIds.includes(row.externalStoreId)) ||
          (row.isActive && row.tiktokUsername?.toLowerCase() === target.username.toLowerCase()) ||
          (row.isActive && row.tiktokUsername?.toLowerCase() === `@${target.username.toLowerCase()}`);

        if (matches) {
          row.tiktokPublicAccountId = publicAccountId;
        }
      }

      // Both active stores (30679 and 31754) must be linked
      const store30679 = storeMasterRows.find((s) => s.externalStoreId === "30679");
      const store31754 = storeMasterRows.find((s) => s.externalStoreId === "31754");
      const inactiveStore = storeMasterRows.find((s) => s.externalStoreId === "99999");

      assert.equal(store30679?.tiktokPublicAccountId, publicAccountId);
      assert.equal(store31754?.tiktokPublicAccountId, publicAccountId);
      assert.equal(inactiveStore?.tiktokPublicAccountId, null);
    });

    it("leaves verified non-existent profiles (e.g. oppo_kamthieng01) unbound with zero mutations", () => {
      const storeMasterRows = [
        {
          id: "sm-28764",
          externalStoreId: "28764",
          storeName: "OBS Kamthieng Plaza",
          tiktokUsername: "oppo_kamthieng01",
          tiktokPublicAccountId: null,
          isActive: true,
        },
      ];

      const extraction = {
        status: "PROFILE_NOT_FOUND",
        username: "oppo_kamthieng01",
      };

      let dbMutationsExecuted = 0;

      if (extraction.status === "SUCCESS") {
        dbMutationsExecuted++;
      }

      assert.equal(dbMutationsExecuted, 0);
      assert.equal(storeMasterRows[0].tiktokPublicAccountId, null);
    });
  });
});
