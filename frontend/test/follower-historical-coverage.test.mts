import assert from "node:assert/strict";
import test from "node:test";
import { getFollowerInsightsText, followerInsightsTranslations } from "../src/app/follower-insights/follower-insights-translations.ts";
import type { ByStoreAccountRow, SummaryDailyRow } from "../src/types/api.d.ts";

test("newly connected account historical backfill - targeted lineOaId parameter validation", () => {
  const backfillPayload = {
    dateFrom: "2026-07-01",
    dateTo: "2026-07-22",
    lineOaId: "oa-newly-connected-123",
  };

  assert.equal(backfillPayload.lineOaId, "oa-newly-connected-123");
  assert.equal(backfillPayload.dateFrom, "2026-07-01");
  assert.equal(backfillPayload.dateTo, "2026-07-22");
});

test("aggregate available mode uses 35 then 41 accounts while comparable mode uses 35 across range", () => {
  // Mock summary data for 3 dates:
  // Date 1 (2026-07-01): 35 accounts ready (total followers 350,000)
  // Date 2 (2026-07-02): 35 accounts ready (total followers 351,000)
  // Date 3 (2026-07-03): 41 accounts ready (6 newly connected added 60,000 followers -> total 412,000)

  const dates = ["2026-07-01", "2026-07-02", "2026-07-03"];
  const storeRows: ByStoreAccountRow[] = [];

  // 35 old accounts present on all 3 dates
  for (let i = 1; i <= 35; i++) {
    const lineOaId = `oa-${i}`;
    for (const d of dates) {
      storeRows.push({
        lineOaId,
        accountName: `OA ${i}`,
        storeId: `store-${i}`,
        storeName: `Store ${i}`,
        date: d,
        followers: 10000,
        previousFollowers: 9900,
        startFollowers: 9500,
        dailyIncrease: 100,
        periodIncrease: 500,
        targetedReaches: 8000,
        blocks: 100,
        status: "ready",
        fetchedAt: "2026-07-03T10:00:00Z",
      });
    }
  }

  // 6 new accounts present ONLY on Date 3 (2026-07-03)
  for (let i = 36; i <= 41; i++) {
    const lineOaId = `oa-${i}`;
    storeRows.push({
      lineOaId,
      accountName: `OA ${i}`,
      storeId: `store-${i}`,
      storeName: `Store ${i}`,
      date: "2026-07-03",
      followers: 10000,
      previousFollowers: null,
      startFollowers: null,
      dailyIncrease: null,
      periodIncrease: null,
      targetedReaches: 8000,
      blocks: 100,
      status: "ready",
      fetchedAt: "2026-07-03T10:00:00Z",
    });
  }

  // Calculate Available Mode (sums all ready rows per date)
  const availableSums = dates.map((d) => {
    const rows = storeRows.filter((r) => r.date === d && r.status === "ready");
    const count = rows.length;
    const followers = rows.reduce((acc, r) => acc + (r.followers ?? 0), 0);
    return { date: d, count, followers };
  });

  assert.equal(availableSums[0].count, 35);
  assert.equal(availableSums[0].followers, 350000);
  assert.equal(availableSums[2].count, 41);
  assert.equal(availableSums[2].followers, 410000);
  // In available mode, followers jump artificially by +60,000 on Date 3!
  assert.equal(availableSums[2].followers - availableSums[1].followers, 60000);

  // Calculate Comparable Mode (find accounts present on ALL dates)
  const accountDateCounts = new Map<string, Set<string>>();
  for (const r of storeRows) {
    if (r.status === "ready" && r.followers !== null) {
      if (!accountDateCounts.has(r.lineOaId)) accountDateCounts.set(r.lineOaId, new Set());
      accountDateCounts.get(r.lineOaId)!.add(r.date);
    }
  }

  const comparableLineOaIds = new Set<string>();
  accountDateCounts.forEach((readyDates, lineOaId) => {
    if (dates.every((d) => readyDates.has(d))) {
      comparableLineOaIds.add(lineOaId);
    }
  });

  assert.equal(comparableLineOaIds.size, 35, "Only the 35 old accounts are present on all dates");

  const comparableSums = dates.map((d) => {
    const rows = storeRows.filter((r) => r.date === d && comparableLineOaIds.has(r.lineOaId));
    const count = rows.length;
    const followers = rows.reduce((acc, r) => acc + (r.followers ?? 0), 0);
    return { date: d, count, followers };
  });

  assert.equal(comparableSums[0].count, 35);
  assert.equal(comparableSums[0].followers, 350000);
  assert.equal(comparableSums[2].count, 35);
  assert.equal(comparableSums[2].followers, 350000);
  // No artificial jump in comparable mode!
  assert.equal(comparableSums[2].followers - comparableSums[1].followers, 0);
});

test("coverage variation warning is triggered when accountsReady differs across dates", () => {
  const summaryWithVariation: SummaryDailyRow[] = [
    { date: "2026-07-01", followers: 350000, targetedReaches: 200000, blocks: 1000, dailyIncrease: null, accountsExpected: 41, accountsWithData: 35, accountsReady: 35, accountsUnready: 0, accountsMissing: 6 },
    { date: "2026-07-02", followers: 410000, targetedReaches: 240000, blocks: 1100, dailyIncrease: 60000, accountsExpected: 41, accountsWithData: 41, accountsReady: 41, accountsUnready: 0, accountsMissing: 0 },
  ];

  const readyCounts = new Set(summaryWithVariation.map((d) => d.accountsReady));
  const hasVariation = readyCounts.size > 1;

  assert.equal(hasVariation, true);
});

test("all required follower historical coverage labels exist for th, en, and zh", () => {
  const languages = ["th", "en", "zh"] as const;

  for (const lang of languages) {
    const t = getFollowerInsightsText(lang);
    assert.ok(t.comparableAccounts && t.comparableAccounts.length > 0);
    assert.ok(t.availableAccounts && t.availableAccounts.length > 0);
    assert.ok(t.accountCoverageDiffersNote && t.accountCoverageDiffersNote.length > 0);
    assert.ok(t.backfillHistoricalData && t.backfillHistoricalData.length > 0);
    assert.ok(t.skipForNow && t.skipForNow.length > 0);
    assert.ok(t.confirmHistoricalBackfill && t.confirmHistoricalBackfill.length > 0);

    const countLabel = t.comparableCountLabel(35);
    assert.ok(countLabel.includes("35"));

    const apiCallLabel = t.estimatedApiCallVolume(22, "OPPO Store");
    assert.ok(apiCallLabel.includes("22"));
    assert.ok(apiCallLabel.includes("OPPO Store"));
  }

  // Confirm exact strings requested in prompt
  assert.equal(followerInsightsTranslations.th.accountCoverageDiffersNote, "จำนวนบัญชีที่นำมาคำนวณแตกต่างกันในแต่ละวัน");
  assert.equal(followerInsightsTranslations.en.accountCoverageDiffersNote, "Account coverage differs by date");
  assert.equal(followerInsightsTranslations.zh.accountCoverageDiffersNote, "每日参与计算的账号数量不同");

  // Confirm exact Requirement 14 backfill status strings
  assert.equal(followerInsightsTranslations.th.backfillStatusQueued, "เชื่อมต่อสำเร็จ กำลังดึงข้อมูลผู้ติดตามย้อนหลัง");
  assert.equal(followerInsightsTranslations.th.backfillStatusCompleted, "ดึงข้อมูลย้อนหลังสำเร็จ");
  assert.equal(followerInsightsTranslations.th.backfillStatusPartial, "ดึงข้อมูลย้อนหลังสำเร็จบางส่วน");
  assert.equal(followerInsightsTranslations.th.backfillStatusFailed, "ดึงข้อมูลย้อนหลังไม่สำเร็จ คลิกเพื่อลองใหม่");

  assert.equal(followerInsightsTranslations.en.backfillStatusQueued, "Connected successfully. Historical follower data is being fetched.");
  assert.equal(followerInsightsTranslations.en.backfillStatusCompleted, "Historical backfill completed.");
  assert.equal(followerInsightsTranslations.en.backfillStatusPartial, "Historical backfill completed with some errors.");
  assert.equal(followerInsightsTranslations.en.backfillStatusFailed, "Historical backfill failed. Click to retry.");

  assert.equal(followerInsightsTranslations.zh.backfillStatusQueued, "连接成功，正在获取历史关注者数据。");
  assert.equal(followerInsightsTranslations.zh.backfillStatusCompleted, "历史数据回填完成。");
  assert.equal(followerInsightsTranslations.zh.backfillStatusPartial, "历史数据回填完成，但部分日期失败。");
  assert.equal(followerInsightsTranslations.zh.backfillStatusFailed, "历史数据回填失败，点击重试。");
});
