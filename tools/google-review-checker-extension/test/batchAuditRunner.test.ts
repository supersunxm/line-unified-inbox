import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BatchAuditRunner } from "../src/batch/batchAuditRunner.ts";

describe("BatchAuditRunner State Machine", () => {
  it("initializes with IDLE state", () => {
    const runner = new BatchAuditRunner();
    assert.equal(runner.getState(), "IDLE");
  });

  it("registers status listeners and receives state updates", () => {
    const runner = new BatchAuditRunner();
    const transitions: string[] = [];

    runner.onStatusChange((state) => {
      transitions.push(state);
    });

    runner.stop();
    assert.equal(runner.getState(), "PAUSED");
    assert.deepEqual(transitions, ["PAUSED"]);
  });

  it("sets session info cleanly", () => {
    const runner = new BatchAuditRunner();
    runner.setSession({
      sessionId: "session-123",
      targetMonth: "2026-09",
      status: "RUNNING",
      currentStore: {
        storeId: "store-456",
        storeName: "OPPO Brand Shop Central World",
        storeCode: "BS-CTW",
        googleMapsUrl: "https://maps.google.com/?cid=123",
      },
    });

    assert.equal(runner.getState(), "IDLE");
  });
});
