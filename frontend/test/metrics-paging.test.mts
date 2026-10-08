import assert from "node:assert/strict";
import test from "node:test";
import { fetchPagesUntil } from "../src/lib/metrics/waiting-pages.ts";

// Bounded paging of /conversations (lib/metrics/waiting-pages.ts): Store 360 reads one store's month
// with it. Kept from test/v2-response-model.test.mts when the v2 "ตอนนี้" tab it also covered was
// retired (8 Oct 2026).

const NOW = Date.parse("2026-10-04T15:00:00+07:00");

test("paging stops at the 7-day cutoff and runs at most 5 requests at once", async () => {
  const pageSize = 100;
  const day = 24 * 60 * 60 * 1000;
  let inFlight = 0;
  let maxInFlight = 0;
  const started: number[] = [];
  // 50 pages newest first; page p's last chat is (p - 1) * 2.5 days old, so page 4 crosses 7 days.
  const fetchPage = async (page: number) => {
    started.push(page);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5 + (page % 3)));
    inFlight -= 1;
    const items = Array.from({ length: pageSize }, (_, index) => ({ page, latestMessageAt: NOW - (page - 1) * 2.5 * day - (index * day) / 100 }));
    return { items, total: 50 * pageSize };
  };
  const outcome = await fetchPagesUntil({ fetchPage, pageSize, concurrency: 5, maxPages: 50, pastCutoff: (last) => last.latestMessageAt < NOW - 7 * day });
  assert.equal(outcome.pagesUsed, 4);
  assert.deepEqual([...new Set(outcome.items.map((item) => item.page))], [1, 2, 3, 4]);
  assert.equal(outcome.truncated, false);
  assert.ok(maxInFlight > 1 && maxInFlight <= 5, `ran ${maxInFlight} at once`);
  assert.ok(outcome.requestsStarted <= 4 + 5, `started ${outcome.requestsStarted} of 50 pages`);
  assert.ok(Math.max(...started) < 50);
});

test("paging stops on a short page and reports truncation at the cap", async () => {
  const short = await fetchPagesUntil({
    fetchPage: async (page) => ({ items: page === 1 ? [1, 2, 3] : [], total: 3 }),
    pageSize: 100, concurrency: 5, maxPages: 30, pastCutoff: () => false,
  });
  assert.deepEqual([short.items, short.pagesUsed, short.truncated], [[1, 2, 3], 1, false]);
  const capped = await fetchPagesUntil({
    fetchPage: async (page) => ({ items: Array.from({ length: 10 }, () => page), total: 10_000 }),
    pageSize: 10, concurrency: 3, maxPages: 4, pastCutoff: () => false,
  });
  assert.deepEqual([capped.pagesUsed, capped.items.length, capped.truncated], [4, 40, true]);
});

