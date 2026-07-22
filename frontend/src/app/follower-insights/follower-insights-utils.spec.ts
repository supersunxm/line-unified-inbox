import { describe, expect, it } from "@jest/globals";
import {
  calculateCoverage,
  calculatePaginationBounds,
  escapeCsvCell,
  getInclusiveCalendarDays,
  validateDateRange,
} from "./follower-insights-utils";
import type { SummaryDailyRow } from "@/types/api";

describe("Follower Insights Pure Utility Helpers", () => {
  describe("getInclusiveCalendarDays", () => {
    it("returns 1 for a single day range", () => {
      expect(getInclusiveCalendarDays("2026-07-01", "2026-07-01")).toBe(1);
    });

    it("returns 7 for a 7 calendar-day range", () => {
      expect(getInclusiveCalendarDays("2026-07-01", "2026-07-07")).toBe(7);
    });

    it("returns 90 for a 90 calendar-day range", () => {
      expect(getInclusiveCalendarDays("2026-07-01", "2026-09-28")).toBe(90);
    });

    it("returns 91 for a 91 calendar-day range", () => {
      expect(getInclusiveCalendarDays("2026-07-01", "2026-09-29")).toBe(91);
    });

    it("returns 0 for reversed dates", () => {
      expect(getInclusiveCalendarDays("2026-07-15", "2026-07-01")).toBe(0);
    });
  });

  describe("validateDateRange", () => {
    it("allows a 90-calendar-day range", () => {
      const res = validateDateRange("2026-07-01", "2026-09-28");
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });

    it("rejects a 91-calendar-day range", () => {
      const res = validateDateRange("2026-07-01", "2026-09-29");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Date range cannot exceed 90 calendar days.");
    });

    it("rejects reversed dates", () => {
      const res = validateDateRange("2026-07-15", "2026-07-01");
      expect(res.valid).toBe(false);
      expect(res.error).toBe("End date cannot be earlier than start date.");
    });
  });

  describe("calculateCoverage", () => {
    it("counts only rows with followers !== null and accountsReady > 0", () => {
      const mockSummary: SummaryDailyRow[] = [
        { date: "2026-07-01", followers: 100, accountsReady: 10, accountsExpected: 10, accountsWithData: 10, accountsMissing: 0, dailyIncrease: null, targetedReaches: 50, blocks: 2 },
        { date: "2026-07-02", followers: null, accountsReady: 0, accountsExpected: 10, accountsWithData: 0, accountsMissing: 10, dailyIncrease: null, targetedReaches: null, blocks: null },
        { date: "2026-07-03", followers: 120, accountsReady: 5, accountsExpected: 10, accountsWithData: 5, accountsMissing: 5, dailyIncrease: 20, targetedReaches: 60, blocks: 3 },
      ];

      const res = calculateCoverage(mockSummary, "2026-07-01", "2026-07-03");
      expect(res.totalCalendarDays).toBe(3);
      expect(res.usableDays).toBe(2);
      expect(res.coveragePct).toBe(67);
      expect(res.hasMissingDates).toBe(true);
    });
  });

  describe("escapeCsvCell", () => {
    it("exports null and undefined as blank string", () => {
      expect(escapeCsvCell(null)).toBe("");
      expect(escapeCsvCell(undefined)).toBe("");
    });

    it("escapes commas, quotes, line breaks, and handles Thai text safely", () => {
      expect(escapeCsvCell("Store, Central")).toBe('"Store, Central"');
      expect(escapeCsvCell('OPPO "RBS"')).toBe('"OPPO ""RBS"""');
      expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(escapeCsvCell("ร้าน OPPO ชลบุรี")).toBe("ร้าน OPPO ชลบุรี");
    });
  });

  describe("calculatePaginationBounds", () => {
    it("handles 0 rows correctly", () => {
      const p = calculatePaginationBounds(0, 1, 10);
      expect(p.totalPages).toBe(1);
      expect(p.startRecord).toBe(0);
      expect(p.endRecord).toBe(0);
    });

    it("handles 1 row correctly", () => {
      const p = calculatePaginationBounds(1, 1, 10);
      expect(p.totalPages).toBe(1);
      expect(p.startRecord).toBe(1);
      expect(p.endRecord).toBe(1);
    });

    it("handles 10 rows correctly", () => {
      const p = calculatePaginationBounds(10, 1, 10);
      expect(p.totalPages).toBe(1);
      expect(p.startRecord).toBe(1);
      expect(p.endRecord).toBe(10);
    });

    it("handles 11 rows correctly on page 1 and page 2", () => {
      const p1 = calculatePaginationBounds(11, 1, 10);
      expect(p1.totalPages).toBe(2);
      expect(p1.startRecord).toBe(1);
      expect(p1.endRecord).toBe(10);

      const p2 = calculatePaginationBounds(11, 2, 10);
      expect(p2.totalPages).toBe(2);
      expect(p2.startRecord).toBe(11);
      expect(p2.endRecord).toBe(11);
    });

    it("handles 35 rows correctly across 4 pages", () => {
      const p1 = calculatePaginationBounds(35, 1, 10);
      expect(p1.totalPages).toBe(4);
      expect(p1.startRecord).toBe(1);
      expect(p1.endRecord).toBe(10);

      const p4 = calculatePaginationBounds(35, 4, 10);
      expect(p4.totalPages).toBe(4);
      expect(p4.startRecord).toBe(31);
      expect(p4.endRecord).toBe(35);

      // Clamp out-of-range page
      const pClamped = calculatePaginationBounds(35, 99, 10);
      expect(pClamped.safePage).toBe(4);
      expect(pClamped.startRecord).toBe(31);
      expect(pClamped.endRecord).toBe(35);
    });
  });
});
