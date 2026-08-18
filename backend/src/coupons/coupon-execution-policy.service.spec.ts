import assert from "node:assert/strict";
import test from "node:test";
import { CouponExecutionPolicyService } from "./coupon-execution-policy.service";

type QueryRaw = (...args: unknown[]) => Promise<Array<{ count: bigint }>>;

function createPolicy(count = 1n) {
  const prisma = {
    $queryRaw: (async () => [{ count }]) as QueryRaw,
  };
  return new CouponExecutionPolicyService(prisma as never);
}

void test("pilot mode blocks ALL store selection", () => {
  const previous = process.env.COUPON_EXECUTION_MODE;
  delete process.env.COUPON_EXECUTION_MODE;
  try {
    assert.throws(() => createPolicy().assertSelection({ mode: "ALL" }), /exactly one selected store/);
  } finally {
    if (previous === undefined) delete process.env.COUPON_EXECUTION_MODE;
    else process.env.COUPON_EXECUTION_MODE = previous;
  }
});

void test("pilot mode allows exactly one selected store", () => {
  const previous = process.env.COUPON_EXECUTION_MODE;
  process.env.COUPON_EXECUTION_MODE = "pilot";
  try {
    assert.doesNotThrow(() => createPolicy().assertSelection({ mode: "SELECTED", storeIds: ["store-1"] }));
    assert.throws(() => createPolicy().assertSelection({ mode: "SELECTED", storeIds: ["store-1", "store-2"] }), /exactly one selected store/);
  } finally {
    if (previous === undefined) delete process.env.COUPON_EXECUTION_MODE;
    else process.env.COUPON_EXECUTION_MODE = previous;
  }
});

void test("full mode allows multi-store selection", () => {
  const previous = process.env.COUPON_EXECUTION_MODE;
  process.env.COUPON_EXECUTION_MODE = "full";
  try {
    assert.doesNotThrow(() => createPolicy().assertSelection({ mode: "ALL" }));
    assert.doesNotThrow(() => createPolicy().assertSelection({ mode: "SELECTED", storeIds: ["store-1", "store-2"] }));
  } finally {
    if (previous === undefined) delete process.env.COUPON_EXECUTION_MODE;
    else process.env.COUPON_EXECUTION_MODE = previous;
  }
});

void test("pilot mode blocks retry/discontinue for multi-store campaigns", async () => {
  const previous = process.env.COUPON_EXECUTION_MODE;
  process.env.COUPON_EXECUTION_MODE = "pilot";
  try {
    await assert.rejects(() => createPolicy(2n).assertCampaign("campaign-1"), /blocks actions on multi-store campaigns/);
    await assert.doesNotReject(() => createPolicy(1n).assertCampaign("campaign-2"));
  } finally {
    if (previous === undefined) delete process.env.COUPON_EXECUTION_MODE;
    else process.env.COUPON_EXECUTION_MODE = previous;
  }
});
