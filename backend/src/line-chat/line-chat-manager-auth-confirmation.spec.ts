import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmLineManagerAuthentication,
  LINE_MANAGER_AUTH_CONFIRMATION_ATTEMPTS,
} from "./line-chat-manager-auth-confirmation";

test("one transient UNKNOWN followed by YES remains authenticated", async () => {
  const results = [
    { authenticated: "UNKNOWN" as const, transport: "FAILED" as const },
    { authenticated: "YES" as const, status: 200, transport: "SUCCEEDED" as const },
  ];
  let calls = 0;
  const confirmation = await confirmLineManagerAuthentication(
    async () => results[calls++] ?? results[results.length - 1],
    async () => {},
  );
  assert.equal(confirmation.outcome, "AUTHENTICATED");
  assert.equal(confirmation.attempts, 2);
});

test("one transient NO followed by YES does not expire the session", async () => {
  const results = [
    { authenticated: "NO" as const, status: 401, transport: "SUCCEEDED" as const },
    { authenticated: "YES" as const, status: 200, transport: "SUCCEEDED" as const },
  ];
  let calls = 0;
  const confirmation = await confirmLineManagerAuthentication(
    async () => results[calls++] ?? results[results.length - 1],
    async () => {},
  );
  assert.equal(confirmation.outcome, "AUTHENTICATED");
  assert.equal(confirmation.attempts, 2);
});

test("session expires only after every bounded attempt is definitive NO", async () => {
  let calls = 0;
  const confirmation = await confirmLineManagerAuthentication(
    async () => {
      calls += 1;
      return { authenticated: "NO", status: 403, transport: "SUCCEEDED" } as const;
    },
    async () => {},
  );
  assert.equal(calls, LINE_MANAGER_AUTH_CONFIRMATION_ATTEMPTS);
  assert.equal(confirmation.outcome, "AUTH_EXPIRED");
});

test("mixed NO and UNKNOWN is inconclusive and remains fail-closed", async () => {
  const results = [
    { authenticated: "NO" as const, status: 401, transport: "SUCCEEDED" as const },
    { authenticated: "UNKNOWN" as const, transport: "FAILED" as const },
    { authenticated: "NO" as const, status: 403, transport: "SUCCEEDED" as const },
  ];
  let calls = 0;
  const confirmation = await confirmLineManagerAuthentication(
    async () => results[calls++],
    async () => {},
  );
  assert.equal(confirmation.outcome, "INCONCLUSIVE");
  assert.equal(confirmation.attempts, 3);
});

test("probe exceptions become inconclusive instead of expired", async () => {
  const confirmation = await confirmLineManagerAuthentication(
    async () => { throw new Error("temporary transport failure"); },
    async () => {},
  );
  assert.equal(confirmation.outcome, "INCONCLUSIVE");
  assert.equal(confirmation.attempts, LINE_MANAGER_AUTH_CONFIRMATION_ATTEMPTS);
});
