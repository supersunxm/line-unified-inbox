import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyActiveLineChatJob,
  isRecentLineChatFailure,
  summarizeActiveLineChatJobs,
} from "./line-chat-health-semantics";

const now = new Date("2026-09-20T10:00:00.000Z");
const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000);

test("recent pending work is NORMAL and does not degrade current health", () => {
  const result = classifyActiveLineChatJob({
    status: "PENDING",
    createdAt: at(1),
    updatedAt: at(1),
    scheduledAt: at(1),
    claimedAt: null,
    lockedUntil: null,
  }, now);
  assert.equal(result.risk, "NORMAL");
});

test("overdue pending work becomes WARNING then CRITICAL by age", () => {
  const warning = classifyActiveLineChatJob({
    status: "PENDING",
    createdAt: at(6),
    updatedAt: at(6),
    scheduledAt: at(6),
    claimedAt: null,
    lockedUntil: null,
  }, now);
  const critical = classifyActiveLineChatJob({
    status: "PENDING",
    createdAt: at(16),
    updatedAt: at(16),
    scheduledAt: at(16),
    claimedAt: null,
    lockedUntil: null,
  }, now);
  assert.equal(warning.risk, "WARNING");
  assert.equal(critical.risk, "CRITICAL");
});

test("processing with a live lease is normal until it exceeds the operational window", () => {
  const result = classifyActiveLineChatJob({
    status: "PROCESSING",
    createdAt: at(2),
    updatedAt: at(2),
    scheduledAt: at(2),
    claimedAt: at(2),
    lockedUntil: new Date(now.getTime() + 60_000),
  }, now);
  assert.equal(result.risk, "NORMAL");
});

test("expired processing lease is CRITICAL and summarized as an active stuck job", () => {
  const job = {
    status: "PROCESSING",
    createdAt: at(8),
    updatedAt: at(8),
    scheduledAt: at(8),
    claimedAt: at(8),
    lockedUntil: at(1),
  };
  assert.equal(classifyActiveLineChatJob(job, now).risk, "CRITICAL");
  assert.deepEqual(summarizeActiveLineChatJobs([job], now), {
    risk: "CRITICAL",
    warningJobs: 0,
    criticalJobs: 1,
  });
});

test("only recent timestamp evidence makes a safe failure retry-eligible", () => {
  assert.equal(isRecentLineChatFailure(at(1), now), true);
  assert.equal(isRecentLineChatFailure(at(16), now), false);
  assert.equal(isRecentLineChatFailure(null, now), false);
});
