import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyWeek2Date,
  getBangkokDateString,
  offsetBangkokDate,
  WEEK_2_START,
  WEEK_2_END_EXCLUSIVE,
} from "./date-classifier.mjs";

describe("Date Classifier for Weekly Continuous Google Review KPI", () => {
  describe("Timezone & Calendar Math", () => {
    it("formats ISO timestamps in Asia/Bangkok correctly around midnight", () => {
      // 16:59 UTC on 2026-09-04 is 23:59 Asia/Bangkok on 2026-09-04
      const beforeMidnightUtc = new Date("2026-09-04T16:59:00.000Z");
      assert.equal(getBangkokDateString(beforeMidnightUtc), "2026-09-04");

      // 17:00 UTC on 2026-09-04 is 00:00 Asia/Bangkok on 2026-09-05
      const atMidnightUtc = new Date("2026-09-04T17:00:00.000Z");
      assert.equal(getBangkokDateString(atMidnightUtc), "2026-09-05");

      // 17:30 UTC on 2026-09-04 is 00:30 Asia/Bangkok on 2026-09-05
      const afterMidnightUtc = new Date("2026-09-04T17:30:00.000Z");
      assert.equal(getBangkokDateString(afterMidnightUtc), "2026-09-05");
    });

    it("offsets date strings cleanly without timezone drift", () => {
      assert.equal(offsetBangkokDate("2026-09-05", 0), "2026-09-05");
      assert.equal(offsetBangkokDate("2026-09-05", -1), "2026-09-04");
      assert.equal(offsetBangkokDate("2026-09-05", -2), "2026-09-03");
      assert.equal(offsetBangkokDate("2026-09-05", -3), "2026-09-02");
      assert.equal(offsetBangkokDate("2026-09-05", -4), "2026-09-01");
      assert.equal(offsetBangkokDate("2026-09-01", -1), "2026-08-31");
    });
  });

  describe("Reference Date: 2026-09-04 (Historical Backfill Anchor)", () => {
    const ref = "2026-09-04";

    it("resolves today to 2026-09-04", () => {
      const resEn = classifyWeek2Date("today", ref);
      assert.equal(resEn.type, "WEEK2_CANDIDATE");
      assert.equal(resEn.exactDate, "2026-09-04");

      const resTh = classifyWeek2Date("วันนี้", ref);
      assert.equal(resTh.type, "WEEK2_CANDIDATE");
      assert.equal(resTh.exactDate, "2026-09-04");

      const resHours = classifyWeek2Date("3 hours ago", ref);
      assert.equal(resHours.type, "WEEK2_CANDIDATE");
      assert.equal(resHours.exactDate, "2026-09-04");
    });

    it("resolves yesterday to 2026-09-03", () => {
      const resEn = classifyWeek2Date("yesterday", ref);
      assert.equal(resEn.type, "WEEK2_CANDIDATE");
      assert.equal(resEn.exactDate, "2026-09-03");

      const res1Day = classifyWeek2Date("1 day ago", ref);
      assert.equal(res1Day.type, "WEEK2_CANDIDATE");
      assert.equal(res1Day.exactDate, "2026-09-03");

      const resTh = classifyWeek2Date("เมื่อวาน", ref);
      assert.equal(resTh.type, "WEEK2_CANDIDATE");
      assert.equal(resTh.exactDate, "2026-09-03");
    });

    it("resolves 2 days ago to 2026-09-02", () => {
      const res = classifyWeek2Date("2 days ago", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-02");

      const resTh = classifyWeek2Date("2 วันที่แล้ว", ref);
      assert.equal(resTh.type, "WEEK2_CANDIDATE");
      assert.equal(resTh.exactDate, "2026-09-02");
    });

    it("resolves 3 days ago to OLDER_THAN_WEEK2 (Sep 1)", () => {
      const res = classifyWeek2Date("3 days ago", ref);
      assert.equal(res.type, "OLDER_THAN_WEEK2");
      assert.equal(res.exactDate, "2026-09-01");

      const resTh = classifyWeek2Date("3 วันที่ผ่านมา", ref);
      assert.equal(resTh.type, "OLDER_THAN_WEEK2");
      assert.equal(resTh.exactDate, "2026-09-01");
    });
  });

  describe("Reference Date: 2026-09-05 (Next Day Dynamic Cron Execution)", () => {
    const ref = "2026-09-05";

    it("resolves today to 2026-09-05", () => {
      const res = classifyWeek2Date("today", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-05");
    });

    it("resolves yesterday to 2026-09-04", () => {
      const res = classifyWeek2Date("yesterday", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-04");
    });

    it("resolves 2 days ago to 2026-09-03", () => {
      const res = classifyWeek2Date("2 days ago", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-03");
    });

    it("resolves 3 days ago to 2026-09-02", () => {
      const res = classifyWeek2Date("3 days ago", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-02");
    });

    it("resolves 4 days ago to OLDER_THAN_WEEK2 (Sep 1)", () => {
      const res = classifyWeek2Date("4 days ago", ref);
      assert.equal(res.type, "OLDER_THAN_WEEK2");
      assert.equal(res.exactDate, "2026-09-01");
    });
  });

  describe("Reference Date: 2026-09-08 (Final Day of Week 2)", () => {
    const ref = "2026-09-08";

    it("resolves today to 2026-09-08", () => {
      const res = classifyWeek2Date("today", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-08");
    });

    it("resolves yesterday to 2026-09-07", () => {
      const res = classifyWeek2Date("yesterday", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-07");
    });

    it("resolves 6 days ago to 2026-09-02 (Week 2 Start Boundary)", () => {
      const res = classifyWeek2Date("6 days ago", ref);
      assert.equal(res.type, "WEEK2_CANDIDATE");
      assert.equal(res.exactDate, "2026-09-02");
    });

    it("resolves 7 days ago to OLDER_THAN_WEEK2 (Sep 1)", () => {
      const res = classifyWeek2Date("7 days ago", ref);
      assert.equal(res.type, "OLDER_THAN_WEEK2");
      assert.equal(res.exactDate, "2026-09-01");
    });
  });

  describe("Non-candidate & Edge Cases", () => {
    it("flags edited reviews as EDITED", () => {
      const res = classifyWeek2Date("today (edited)", "2026-09-05");
      assert.equal(res.type, "EDITED");

      const resTh = classifyWeek2Date("เมื่อวานนี้ (แก้ไขแล้ว)", "2026-09-05");
      assert.equal(resTh.type, "EDITED");
    });

    it("treats weeks/months/years ago as OLDER_THAN_WEEK2", () => {
      assert.equal(classifyWeek2Date("1 week ago", "2026-09-05").type, "OLDER_THAN_WEEK2");
      assert.equal(classifyWeek2Date("สัปดาห์ที่แล้ว", "2026-09-05").type, "OLDER_THAN_WEEK2");
      assert.equal(classifyWeek2Date("2 months ago", "2026-09-05").type, "OLDER_THAN_WEEK2");
    });

    it("returns UNKNOWN for unparseable or empty strings", () => {
      assert.equal(classifyWeek2Date("", "2026-09-05").type, "UNKNOWN");
      assert.equal(classifyWeek2Date(null, "2026-09-05").type, "UNKNOWN");
      assert.equal(classifyWeek2Date("just random text", "2026-09-05").type, "UNKNOWN");
    });
  });
});
