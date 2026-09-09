import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatWeekDateRangeLabel,
  generateWeeklyPeriods,
  getWeeklyPeriod,
  resolveWeekNumber,
  toChineseNumeral,
} from "./weekly-period.util";

describe("Weekly Period Utility for Google Review KPI", () => {
  it("converts numerals to Chinese characters accurately", () => {
    assert.equal(toChineseNumeral(1), "一");
    assert.equal(toChineseNumeral(2), "二");
    assert.equal(toChineseNumeral(3), "三");
    assert.equal(toChineseNumeral(10), "十");
    assert.equal(toChineseNumeral(11), "十一");
    assert.equal(toChineseNumeral(20), "二十");
  });

  it("formats Week 1 exact display label: 第一周 สัปดาห์ที่ 1 (26.08-02.09.2026)", () => {
    const p1 = getWeeklyPeriod(1, new Date("2026-08-30T10:00:00+07:00"));
    assert.equal(p1.weekNumber, 1);
    assert.equal(p1.labelZh, "第一周");
    assert.equal(p1.labelTh, "สัปดาห์ที่ 1");
    assert.equal(p1.label, "第一周 สัปดาห์ที่ 1 (26.08-02.09.2026)");
    assert.equal(p1.startDate.toISOString(), "2026-08-25T17:00:00.000Z"); // 2026-08-26 00:00:00+07
    assert.equal(p1.endDate.toISOString(), "2026-09-02T17:00:00.000Z");   // 2026-09-03 00:00:00+07 (endExclusive)
    assert.equal(p1.status, "OPEN");
  });

  it("formats Week 2 exact display label: 第二周 สัปดาห์ที่ 2 (03-09.09.2026)", () => {
    const p2 = getWeeklyPeriod(2, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p2.weekNumber, 2);
    assert.equal(p2.labelZh, "第二周");
    assert.equal(p2.labelTh, "สัปดาห์ที่ 2");
    assert.equal(p2.label, "第二周 สัปดาห์ที่ 2 (03-09.09.2026)");
    assert.equal(p2.startDate.toISOString(), "2026-09-02T17:00:00.000Z"); // 2026-09-03 00:00:00+07
    assert.equal(p2.endDate.toISOString(), "2026-09-09T17:00:00.000Z");   // 2026-09-10 00:00:00+07 (endExclusive)
    assert.equal(p2.status, "OPEN");
  });

  it("formats Week 3 label: 第三周 สัปดาห์ที่ 3 (10-16.09.2026)", () => {
    const p3 = getWeeklyPeriod(3, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p3.label, "第三周 สัปดาห์ที่ 3 (10-16.09.2026)");
    assert.equal(p3.startDate.toISOString(), "2026-09-09T17:00:00.000Z"); // 2026-09-10 00:00:00+07
    assert.equal(p3.endDate.toISOString(), "2026-09-16T17:00:00.000Z");   // 2026-09-17 00:00:00+07
  });

  it("formats Week 4 label: 第四周 สัปดาห์ที่ 4 (17-23.09.2026)", () => {
    const p4 = getWeeklyPeriod(4, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p4.label, "第四周 สัปดาห์ที่ 4 (17-23.09.2026)");
  });

  it("marks past week as CLOSED when referenceDate >= endDate", () => {
    const p1 = getWeeklyPeriod(1, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p1.status, "CLOSED");
  });

  it("resolves weekNumber accurately across boundaries", () => {
    assert.equal(resolveWeekNumber(new Date("2026-08-25T12:00:00+07:00")), 1);
    assert.equal(resolveWeekNumber(new Date("2026-08-26T00:00:00+07:00")), 1);
    assert.equal(resolveWeekNumber(new Date("2026-09-02T23:59:59+07:00")), 1);
    assert.equal(resolveWeekNumber(new Date("2026-09-03T00:00:00+07:00")), 2);
    assert.equal(resolveWeekNumber(new Date("2026-09-09T23:59:59+07:00")), 2);
    assert.equal(resolveWeekNumber(new Date("2026-09-10T00:00:00+07:00")), 3);
    assert.equal(resolveWeekNumber(new Date("2026-09-16T23:59:59+07:00")), 3);
    assert.equal(resolveWeekNumber(new Date("2026-09-17T00:00:00+07:00")), 4);
  });

  it("generates an array of continuous weekly periods up to Week 10", () => {
    const periods = generateWeeklyPeriods(10, new Date("2026-09-09T15:00:00+07:00"));
    assert.equal(periods.length, 10);
    assert.equal(periods[0].weekNumber, 1);
    assert.equal(periods[0].status, "CLOSED");
    assert.equal(periods[1].weekNumber, 2);
    assert.equal(periods[1].status, "OPEN");
    assert.equal(periods[2].weekNumber, 3);
    assert.equal(periods[2].status, "OPEN");

    assert.equal(periods[0].label, "第一周 สัปดาห์ที่ 1 (26.08-02.09.2026)");
    assert.equal(periods[1].label, "第二周 สัปดาห์ที่ 2 (03-09.09.2026)");
    assert.equal(periods[2].label, "第三周 สัปดาห์ที่ 3 (10-16.09.2026)");
    assert.equal(periods[3].label, "第四周 สัปดาห์ที่ 4 (17-23.09.2026)");
    assert.equal(periods[4].label, "第五周 สัปดาห์ที่ 5 (24-30.09.2026)");
    assert.equal(periods[5].label, "第六周 สัปดาห์ที่ 6 (01-07.10.2026)");
    assert.equal(periods[6].label, "第七周 สัปดาห์ที่ 7 (08-14.10.2026)");
    assert.equal(periods[7].label, "第八周 สัปดาห์ที่ 8 (15-21.10.2026)");
    assert.equal(periods[8].label, "第九周 สัปดาห์ที่ 9 (22-28.10.2026)");
    assert.equal(periods[9].label, "第十周 สัปดาห์ที่ 10 (29.10-04.11.2026)");
  });
});
