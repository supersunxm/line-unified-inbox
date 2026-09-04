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
    assert.equal(p1.endDate.toISOString(), "2026-09-01T17:00:00.000Z");   // 2026-09-02 00:00:00+07
    assert.equal(p1.status, "OPEN");
  });

  it("formats Week 2 exact display label: 第二周 สัปดาห์ที่ 2 (02-09.09.2026)", () => {
    const p2 = getWeeklyPeriod(2, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p2.weekNumber, 2);
    assert.equal(p2.labelZh, "第二周");
    assert.equal(p2.labelTh, "สัปดาห์ที่ 2");
    assert.equal(p2.label, "第二周 สัปดาห์ที่ 2 (02-09.09.2026)");
    assert.equal(p2.startDate.toISOString(), "2026-09-01T17:00:00.000Z"); // 2026-09-02 00:00:00+07
    assert.equal(p2.endDate.toISOString(), "2026-09-08T17:00:00.000Z");   // 2026-09-09 00:00:00+07
    assert.equal(p2.status, "OPEN");
  });

  it("formats Week 3 label: 第三周 สัปดาห์ที่ 3 (09-16.09.2026)", () => {
    const p3 = getWeeklyPeriod(3, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p3.label, "第三周 สัปดาห์ที่ 3 (09-16.09.2026)");
  });

  it("marks past week as CLOSED when referenceDate >= endDate", () => {
    const p1 = getWeeklyPeriod(1, new Date("2026-09-04T12:00:00+07:00"));
    assert.equal(p1.status, "CLOSED");
  });

  it("resolves weekNumber accurately across boundaries", () => {
    assert.equal(resolveWeekNumber(new Date("2026-08-25T12:00:00+07:00")), 1);
    assert.equal(resolveWeekNumber(new Date("2026-08-26T00:00:00+07:00")), 1);
    assert.equal(resolveWeekNumber(new Date("2026-09-01T23:59:59+07:00")), 1);
    assert.equal(resolveWeekNumber(new Date("2026-09-02T00:00:00+07:00")), 2);
    assert.equal(resolveWeekNumber(new Date("2026-09-04T15:00:00+07:00")), 2);
    assert.equal(resolveWeekNumber(new Date("2026-09-09T00:00:00+07:00")), 3);
  });

  it("generates an array of continuous weekly periods", () => {
    const periods = generateWeeklyPeriods(5, new Date("2026-09-04T15:00:00+07:00"));
    assert.equal(periods.length, 5);
    assert.equal(periods[0].weekNumber, 1);
    assert.equal(periods[0].status, "CLOSED");
    assert.equal(periods[1].weekNumber, 2);
    assert.equal(periods[1].status, "OPEN");
    assert.equal(periods[2].weekNumber, 3);
    assert.equal(periods[2].status, "OPEN");
  });
});
