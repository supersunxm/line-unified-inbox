import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseUrlHandoffParams, EARLY_LOCATION } from "../src/core/handoffParams.ts";
import { BatchAuditRunner } from "../src/batch/batchAuditRunner.ts";

describe("Token Handoff & Session Precedence", () => {
  it("parses URL hash parameters accurately", () => {
    // Mock window.location
    const origWindow = globalThis.window;
    try {
      (globalThis as any).window = {
        location: {
          href: "https://www.google.com/maps/place/Central+World#oppoToken=test_bearer_token_123&oppoSessionId=sess_456&oppoStoreId=store_789&oppoName=OPPO%20CentralWorld&oppoMonth=2026-09",
          hash: "#oppoToken=test_bearer_token_123&oppoSessionId=sess_456&oppoStoreId=store_789&oppoName=OPPO%20CentralWorld&oppoMonth=2026-09",
          search: "",
        },
      };

      const params = parseUrlHandoffParams();
      assert.equal(params.oppoToken, "test_bearer_token_123");
      assert.equal(params.oppoSessionId, "sess_456");
      assert.equal(params.oppoStoreId, "store_789");
      assert.equal(params.oppoName, "OPPO CentralWorld");
      assert.equal(params.oppoMonth, "2026-09");
    } finally {
      (globalThis as any).window = origWindow;
    }
  });

  it("parses search parameters when hash is empty", () => {
    const origWindow = globalThis.window;
    try {
      (globalThis as any).window = {
        location: {
          href: "https://www.google.com/maps/place/Samrong?oppoStoreId=store_123&oppoMonth=2026-09",
          hash: "",
          search: "?oppoStoreId=store_123&oppoMonth=2026-09",
        },
      };

      const params = parseUrlHandoffParams();
      assert.equal(params.oppoStoreId, "store_123");
      assert.equal(params.oppoMonth, "2026-09");
      assert.equal(params.oppoToken, null);
    } finally {
      (globalThis as any).window = origWindow;
    }
  });

  it("initFromStorage gives precedence to URL token over stale storage token", async () => {
    const origWindow = globalThis.window;
    const origChrome = (globalThis as any).chrome;
    try {
      (globalThis as any).window = {
        location: {
          href: "https://www.google.com/maps/#oppoToken=fresh_url_token&oppoSessionId=sess_abc",
          hash: "#oppoToken=fresh_url_token&oppoSessionId=sess_abc",
          search: "",
        },
      };

      (globalThis as any).chrome = {
        storage: {
          local: {
            get: (keys: string[], callback: (res: any) => void) => {
              callback({
                batchAuditSession: {
                  sessionId: "sess_abc",
                  targetMonth: "2026-09",
                  runnerToken: "stale_expired_token",
                  status: "RUNNING",
                  currentStore: {
                    storeId: "store_1",
                    storeName: "Central World",
                    googleMapsUrl: "https://maps.google.com/...",
                  },
                },
              });
            },
          },
        },
      };

      const runner = new BatchAuditRunner();
      const isActive = await runner.initFromStorage();
      assert.equal(isActive, true);

      // Verify token in runner Authorization header is the fresh URL token
      const headers = (runner as any).buildAuthHeaders();
      assert.equal(headers.Authorization, "Bearer fresh_url_token");
    } finally {
      (globalThis as any).window = origWindow;
      (globalThis as any).chrome = origChrome;
    }
  });

  it("buildAuthHeaders fails closed when runnerToken is absent in session and URL", () => {
    const origWindow = globalThis.window;
    try {
      (globalThis as any).window = {
        location: {
          href: "https://www.google.com/maps/place/Central+World",
          hash: "",
          search: "",
        },
      };

      const runner = new BatchAuditRunner();
      runner.setSession({
        sessionId: "sess_no_token",
        targetMonth: "2026-09",
        status: "RUNNING",
        runnerToken: undefined,
      });

      assert.throws(
        () => (runner as any).buildAuthHeaders(),
        /Runner authentication token is missing/,
      );
    } finally {
      (globalThis as any).window = origWindow;
    }
  });

  it("buildAuthHeaders attaches Bearer token when runnerToken is present in session", () => {
    const runner = new BatchAuditRunner();
    runner.setSession({
      sessionId: "sess_valid",
      targetMonth: "2026-09",
      status: "RUNNING",
      runnerToken: "valid_session_token_xyz",
    });

    const headers = (runner as any).buildAuthHeaders({ "Content-Type": "application/json" });
    assert.equal(headers["Content-Type"], "application/json");
    assert.equal(headers["Authorization"], "Bearer valid_session_token_xyz");
  });
});
