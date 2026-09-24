import assert from "node:assert/strict";
import test from "node:test";
import {
  isPinklaoResolverStartupEnabled,
  runPinklaoResolverStartupDiagnostic,
} from "./line-chat-pinklao-resolver-trigger";

const storeTarget = {
  storeId: "store-private",
  effectiveStoreCode: "29113",
  storeMasterAccountName: "OPPO Central Pinklao",
  storeMasterLineId: "@pinklao",
  storeManagerUrl: "https://manager.line.biz/account/@pinklao",
  selectionSource: "STORE_MASTER_LINE_ID" as const,
  oa: {
    id: "oa-private",
    name: "OPPO Central Pinklao",
    basicId: "@pinklao",
    lineChatWorkspaceUrl: null,
    chatBotId: "persisted-bot-must-not-be-used",
    lineChatSession: null,
  },
};

test("Pinklao resolver startup trigger is explicit true only", () => {
  assert.equal(isPinklaoResolverStartupEnabled("true"), true);
  assert.equal(isPinklaoResolverStartupEnabled("TRUE"), false);
  assert.equal(isPinklaoResolverStartupEnabled("1"), false);
  assert.equal(isPinklaoResolverStartupEnabled(undefined), false);
});

test("disabled Pinklao resolver trigger performs no work", async () => {
  let calls = 0;
  const result = await runPinklaoResolverStartupDiagnostic({
    enabled: false,
    service: {
      getStoreMirrorTargetInputs: async () => {
        calls += 1;
        return storeTarget;
      },
      resolveMirrorTarget: async () => {
        calls += 1;
        throw new Error("must not run");
      },
    },
    logger: { log() {}, warn() {} },
  });

  assert.equal(calls, 0);
  assert.equal(result.ran, false);
});

test("Pinklao resolver diagnostic forces a fresh redirect path and emits only aggregate result", async () => {
  const logs: string[] = [];
  let resolverInput: Record<string, unknown> | null = null;
  const result = await runPinklaoResolverStartupDiagnostic({
    enabled: true,
    service: {
      getStoreMirrorTargetInputs: async () => storeTarget,
      resolveMirrorTarget: async (input) => {
        resolverInput = input as unknown as Record<string, unknown>;
        return {
          ok: true as const,
          botId: "private-bot",
          session: {
            id: "private-session",
            sessionKey: "private-profile",
            status: "ACTIVE" as never,
            profilePath: "/private/profile",
            profileStorageKey: null,
          },
          source: "MANAGER_ACCOUNT_REDIRECT" as const,
        };
      },
    },
    logger: {
      log(message) { logs.push(message); },
      warn(message) { logs.push(message); },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.targetResolutionSource, "MANAGER_ACCOUNT_REDIRECT");
  assert.equal(resolverInput?.storeCode, "29113");
  assert.equal(resolverInput?.chatBotId, null);
  assert.equal(resolverInput?.lineChatSession, null);
  assert.equal(resolverInput?.bypassCache, true);
  assert.ok(logs.some((line) => line.includes('"freshRedirectProven":true')));
  assert.ok(logs.every((line) => !line.includes("private-bot")));
  assert.ok(logs.every((line) => !line.includes("private-session")));
  assert.ok(logs.every((line) => !line.includes("/private/profile")));
});

test("Pinklao resolver diagnostic retries temporary contention and then succeeds", async () => {
  let calls = 0;
  const logs: string[] = [];
  const result = await runPinklaoResolverStartupDiagnostic({
    enabled: true,
    maxAttempts: 3,
    retryDelayMs: 0,
    service: {
      getStoreMirrorTargetInputs: async () => storeTarget,
      resolveMirrorTarget: async () => {
        calls += 1;
        if (calls < 3) {
          return {
            ok: false as const,
            errorCode: "MIRROR_MANAGER_TARGET_BUSY" as const,
            errorMessage: "busy",
          };
        }
        return {
          ok: true as const,
          botId: "private-bot",
          session: {
            id: "private-session",
            sessionKey: "private-profile",
            status: "ACTIVE" as never,
            profilePath: "/private/profile",
            profileStorageKey: null,
          },
          source: "MANAGER_ACCOUNT_REDIRECT" as const,
        };
      },
    },
    logger: {
      log(message) { logs.push(message); },
      warn(message) { logs.push(message); },
    },
  });

  assert.equal(calls, 3);
  assert.equal(result.attempts, 3);
  assert.equal(result.success, true);
  assert.equal(logs.filter((line) => line.includes("resolver_startup_retrying")).length, 2);
});

test("Pinklao resolver diagnostic does not retry permanent target-not-found", async () => {
  let calls = 0;
  const result = await runPinklaoResolverStartupDiagnostic({
    enabled: true,
    maxAttempts: 3,
    retryDelayMs: 0,
    service: {
      getStoreMirrorTargetInputs: async () => storeTarget,
      resolveMirrorTarget: async () => {
        calls += 1;
        return {
          ok: false as const,
          errorCode: "MIRROR_MANAGER_TARGET_NOT_FOUND" as const,
          errorMessage: "not found",
        };
      },
    },
    logger: { log() {}, warn() {} },
  });

  assert.equal(calls, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "MIRROR_MANAGER_TARGET_NOT_FOUND");
});
