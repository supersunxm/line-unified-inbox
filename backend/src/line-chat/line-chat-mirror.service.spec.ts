import assert from "node:assert/strict";
import test from "node:test";
import { LineChatMirrorDirection } from "@prisma/client";
import {
  configuredLineChatMirrorStoreCodes,
  isLineChatMirrorEnabled,
  lineChatMirrorIntervalMs,
  lineChatMirrorMaxChangedChatsPerCycle,
  managerAccountKeyFromInputs,
  managerBotIdFromRedirect,
  mirrorDirectionForManagerEvent,
  selectMirrorResolvedCandidate,
} from "./line-chat-mirror.service";

function withEnv(
  values: Record<string, string | undefined>,
  callback: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Project B mirror pilot parses and deduplicates configured store codes", () => {
  withEnv(
    { LINE_CHAT_MIRROR_STORE_CODES: "20789, 29113;20789 29737" },
    () => {
      assert.deepEqual(
        configuredLineChatMirrorStoreCodes(),
        ["20789", "29113", "29737"],
      );
    },
  );
});

test("Project B mirror remains opt-in", () => {
  withEnv({ LINE_CHAT_MIRROR_ENABLED: undefined }, () => {
    assert.equal(isLineChatMirrorEnabled(), false);
  });
  withEnv({ LINE_CHAT_MIRROR_ENABLED: "true" }, () => {
    assert.equal(isLineChatMirrorEnabled(), true);
  });
});

test("Project B mirror cadence and per-cycle history work are bounded", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_INTERVAL_MS: "1000",
      LINE_CHAT_MIRROR_MAX_CHANGED_CHATS_PER_CYCLE: "500",
    },
    () => {
      assert.equal(lineChatMirrorIntervalMs(), 30_000);
      assert.equal(lineChatMirrorMaxChangedChatsPerCycle(), 50);
    },
  );
});

test("Manager history direction classification is fail-closed", () => {
  assert.equal(
    mirrorDirectionForManagerEvent("messageSent"),
    LineChatMirrorDirection.OUTBOUND,
  );
  assert.equal(
    mirrorDirectionForManagerEvent("messageReceived"),
    LineChatMirrorDirection.INBOUND,
  );
  assert.equal(
    mirrorDirectionForManagerEvent("message"),
    LineChatMirrorDirection.INBOUND,
  );
  assert.equal(
    mirrorDirectionForManagerEvent("someFutureEvent"),
    LineChatMirrorDirection.UNKNOWN,
  );
  assert.equal(
    mirrorDirectionForManagerEvent(undefined),
    LineChatMirrorDirection.UNKNOWN,
  );
});


test("Project B mirror derives Manager account key from configured account URL or Basic ID", () => {
  assert.equal(
    managerAccountKeyFromInputs({
      storeManagerUrl: "https://manager.line.biz/account/@688zunxx",
      basicId: "@fallback",
    }),
    "@688zunxx",
  );
  assert.equal(
    managerAccountKeyFromInputs({
      lineChatWorkspaceUrl: "https://chat.line.biz/account/@123abcd",
      storeManagerUrl: "https://manager.line.biz/account/@fallback",
    }),
    "@123abcd",
  );
  assert.equal(
    managerAccountKeyFromInputs({ basicId: "@912xjbyi" }),
    "@912xjbyi",
  );
  assert.equal(
    managerAccountKeyFromInputs({
      storeManagerUrl: "https://evil.example/account/@bad",
      basicId: null,
    }),
    null,
  );
});

test("Project B mirror accepts only canonical LINE chat bot redirects", () => {
  assert.equal(
    managerBotIdFromRedirect(
      "https://chat.line.biz/U0123456789abcdef0123456789abcdef",
    ),
    "U0123456789abcdef0123456789abcdef",
  );
  assert.equal(
    managerBotIdFromRedirect(
      "https://chat.line.biz/U0123456789abcdef0123456789abcdef/chat/Ucustomer",
    ),
    "U0123456789abcdef0123456789abcdef",
  );
  assert.equal(
    managerBotIdFromRedirect("https://chat.line.biz/account/@688zunxx"),
    null,
  );
  assert.equal(
    managerBotIdFromRedirect(
      "https://evil.example/U0123456789abcdef0123456789abcdef",
    ),
    null,
  );
});


test("Project B mirror accepts duplicate Manager sessions when they resolve the same bot", () => {
  const sessionA = {
    id: "session-a",
    sessionKey: "profile-b",
    status: "ACTIVE" as any,
    profilePath: "/tmp/a",
    profileStorageKey: null,
  };
  const sessionB = {
    id: "session-b",
    sessionKey: "account-1",
    status: "ACTIVE" as any,
    profilePath: "/tmp/b",
    profileStorageKey: null,
  };

  const selected = selectMirrorResolvedCandidate([
    { botId: "U0123456789abcdef0123456789abcdef", session: sessionA },
    { botId: "U0123456789abcdef0123456789abcdef", session: sessionB },
  ]);

  assert.notEqual(selected, null);
  assert.notEqual(selected, "AMBIGUOUS");
  if (selected && selected !== "AMBIGUOUS") {
    assert.equal(selected.session.id, "session-a");
    assert.equal(selected.botId, "U0123456789abcdef0123456789abcdef");
  }
});

test("Project B mirror fails closed when Manager sessions resolve different bots", () => {
  const sessionA = {
    id: "session-a",
    sessionKey: "profile-b",
    status: "ACTIVE" as any,
    profilePath: "/tmp/a",
    profileStorageKey: null,
  };
  const sessionB = {
    id: "session-b",
    sessionKey: "account-1",
    status: "ACTIVE" as any,
    profilePath: "/tmp/b",
    profileStorageKey: null,
  };

  assert.equal(
    selectMirrorResolvedCandidate([
      { botId: "U0123456789abcdef0123456789abcdef", session: sessionA },
      { botId: "Ufedcba9876543210fedcba9876543210", session: sessionB },
    ]),
    "AMBIGUOUS",
  );
});
