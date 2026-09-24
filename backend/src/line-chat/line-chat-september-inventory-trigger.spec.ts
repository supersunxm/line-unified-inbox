import assert from "node:assert/strict";
import test from "node:test";
import { emptySeptemberChatInventoryReport } from "./line-chat-september-inventory";
import {
  isSeptemberInventoryStartupEnabled,
  runSeptemberInventoryStartupDiagnostic,
} from "./line-chat-september-inventory-trigger";

test("startup inventory trigger is enabled only by explicit true", () => {
  assert.equal(isSeptemberInventoryStartupEnabled("true"), true);
  assert.equal(isSeptemberInventoryStartupEnabled("TRUE"), false);
  assert.equal(isSeptemberInventoryStartupEnabled("1"), false);
  assert.equal(isSeptemberInventoryStartupEnabled(undefined), false);
});

test("disabled startup inventory does not touch the service", async () => {
  let calls = 0;
  const result = await runSeptemberInventoryStartupDiagnostic({
    enabled: false,
    service: {
      discoverPilotStores: async () => {
        calls += 1;
        return [];
      },
    },
    logger: { log() {}, warn() {} },
  });

  assert.equal(calls, 0);
  assert.equal(result.ran, false);
  assert.equal(result.attempts, 0);
});

test("startup inventory retries only profile contention and emits aggregate-only reports", async () => {
  let calls = 0;
  const logs: string[] = [];
  const busy = emptySeptemberChatInventoryReport("29113", "PROFILE_OPERATION_BUSY");
  const complete = {
    ...emptySeptemberChatInventoryReport("29113", "unused"),
    inventoryComplete: true,
    inventoryIncompleteReason: null,
    conversationsObserved: 42,
    septemberChats: 40,
    septemberChatsObserved: 40,
    beforeSeptemberObserved: 2,
    pagesFetched: 2,
    reachedBeforeSeptember: true,
    orderingValidated: true,
    historicalChecked: 5,
    fastPathComplete: 2,
    needsBackwardPagination: 3,
    historicalNotStarted: 35,
    historicalCheckedRate: 5 / 40,
    fastPathCompleteRate: 2 / 40,
    targetResolutionSource: "MANAGER_ACCOUNT_REDIRECT" as const,
    chatsWithValidTimestamp: 42,
    chatsWithoutLatestEvent: 0,
    chatsWithMissingTimestamp: 0,
    chatsWithInvalidTimestamp: 0,
    pageLimitReached: false,
    chatLimitReached: false,
    timeLimitReached: false,
  };

  const result = await runSeptemberInventoryStartupDiagnostic({
    enabled: true,
    maxAttempts: 2,
    retryDelayMs: 0,
    service: {
      discoverPilotStores: async () => {
        calls += 1;
        return calls === 1 ? [busy] : [complete];
      },
    },
    logger: {
      log(message) { logs.push(message); },
      warn(message) { logs.push(message); },
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.ran, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.reports[0]?.inventoryComplete, true);
  assert.ok(logs.some((line) => line.includes("line_chat_september_inventory_startup_retrying")));
  assert.ok(logs.some((line) => line.includes('"septemberChats":40')));
  assert.ok(logs.some((line) => line.includes('"targetResolutionSource":"MANAGER_ACCOUNT_REDIRECT"')));
  assert.ok(logs.some((line) => line.includes('"chatsWithMissingTimestamp":0')));
  assert.ok(logs.some((line) => line.includes('"timeLimitReached":false')));
  assert.ok(logs.every((line) => !line.includes("chatUserId")));
  assert.ok(logs.every((line) => !line.includes("displayName")));
  assert.ok(logs.every((line) => !line.includes("lastMessageText")));
});

test("startup inventory does not retry a permanent target-not-found result", async () => {
  let calls = 0;
  const logs: string[] = [];
  const notFound = emptySeptemberChatInventoryReport("29113", "MIRROR_MANAGER_TARGET_NOT_FOUND");

  const result = await runSeptemberInventoryStartupDiagnostic({
    enabled: true,
    maxAttempts: 3,
    retryDelayMs: 0,
    service: {
      discoverPilotStores: async () => {
        calls += 1;
        return [notFound];
      },
    },
    logger: {
      log(message) { logs.push(message); },
      warn(message) { logs.push(message); },
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.reports[0]?.inventoryIncompleteReason, "MIRROR_MANAGER_TARGET_NOT_FOUND");
  assert.ok(logs.some((line) => line.includes("line_chat_september_inventory_startup_completed")));
  assert.ok(logs.every((line) => !line.includes("line_chat_september_inventory_startup_retrying")));
});

test("startup inventory failure log keeps only the error type", async () => {
  const privateDetail = "/private/profile/private-cursor-token-customer-name";
  const logs: string[] = [];
  const result = await runSeptemberInventoryStartupDiagnostic({
    enabled: true,
    service: {
      discoverPilotStores: async () => { throw new Error(privateDetail); },
    },
    logger: {
      log(message) { logs.push(message); },
      warn(message) { logs.push(message); },
    },
  });
  assert.equal(result.ran, true);
  assert.equal(result.error, "Error");
  assert.ok(logs.every((line) => !line.includes(privateDetail)));
  assert.ok(logs.every((line) => !line.includes("private-cursor-token")));
});
