import assert from "node:assert/strict";
import test from "node:test";
import { effectiveSummaryCounts } from "../src/app/reply-state.ts";

test("reply summary excludes out-of-scope legacy chats from status buckets while preserving All total", () => {
  assert.deepEqual(
    effectiveSummaryCounts({
      total: 100,
      outOfScope: 30,
      notReplied: 20,
      notifiedBm: 0,
      replied: 50,
    }),
    {
      total: 100,
      outOfScope: 30,
      notReplied: 20,
      replied: 50,
    },
  );
});

test("legacy summary payloads still derive total from the two-state buckets", () => {
  assert.deepEqual(
    effectiveSummaryCounts({
      notReplied: 2,
      notifiedBm: 1,
      replied: 4,
    }),
    {
      total: 7,
      outOfScope: 0,
      notReplied: 3,
      replied: 4,
    },
  );
});
