import assert from "node:assert/strict";
import test from "node:test";
import { MessageType } from "@prisma/client";
import {
  canonicalMessageTypeFromMirror,
  configuredLineChatMirrorReconcileDryRunStoreCodes,
  configuredLineChatMirrorReconcileStoreCodes,
  isLineChatMirrorReconcileApplyEnabled,
  isLineChatMirrorReconcileEnabled,
  lineChatMirrorReconcileBatchSize,
  lineChatMirrorReconcileIntervalMs,
  lineChatMirrorReconcileSince,
  managerResponderDisplayName,
  mirrorCanonicalExternalId,
  mirrorCanonicalText,
  selectUniqueExactInboundConversationId,
} from "./line-chat-mirror-reconciler.service";

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

test("Project B canonical reconciler stays opt-in and apply is independently gated", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_ENABLED: undefined,
      LINE_CHAT_MIRROR_RECONCILE_APPLY: undefined,
    },
    () => {
      assert.equal(isLineChatMirrorReconcileEnabled(), false);
      assert.equal(isLineChatMirrorReconcileApplyEnabled(), false);
    },
  );
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_ENABLED: "true",
      LINE_CHAT_MIRROR_RECONCILE_APPLY: "false",
    },
    () => {
      assert.equal(isLineChatMirrorReconcileEnabled(), true);
      assert.equal(isLineChatMirrorReconcileApplyEnabled(), false);
    },
  );
});

test("Project B canonical reconciler parses store scope and requires a valid since timestamp", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_STORE_CODES: "28375, 25610;28375 3791",
      LINE_CHAT_MIRROR_RECONCILE_SINCE: "2026-09-21T04:00:00.000Z",
    },
    () => {
      assert.deepEqual(
        configuredLineChatMirrorReconcileStoreCodes(),
        ["28375", "25610", "3791"],
      );
      assert.equal(
        lineChatMirrorReconcileSince()?.toISOString(),
        "2026-09-21T04:00:00.000Z",
      );
    },
  );
  withEnv({ LINE_CHAT_MIRROR_RECONCILE_SINCE: "invalid" }, () => {
    assert.equal(lineChatMirrorReconcileSince(), null);
  });
});

test("Project B canonical reconciler keeps dry-run stores separate from the apply scope", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_STORE_CODES: "28375,25610",
      LINE_CHAT_MIRROR_RECONCILE_DRY_RUN_STORE_CODES: "20789, 29039;28375 20789",
    },
    () => {
      assert.deepEqual(
        configuredLineChatMirrorReconcileStoreCodes(),
        ["28375", "25610"],
      );
      assert.deepEqual(
        configuredLineChatMirrorReconcileDryRunStoreCodes(),
        ["20789", "29039"],
      );
    },
  );
});

test("Project B canonical reconciler bounds interval and batch size", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_INTERVAL_MS: "1000",
      LINE_CHAT_MIRROR_RECONCILE_BATCH_SIZE: "5000",
    },
    () => {
      assert.equal(lineChatMirrorReconcileIntervalMs(), 30_000);
      assert.equal(lineChatMirrorReconcileBatchSize(), 1_000);
    },
  );
});

test("Project B canonical external IDs are namespaced away from webhook inbound IDs", () => {
  assert.equal(
    mirrorCanonicalExternalId("123456789"),
    "line-chat-manager:123456789",
  );
});

test("Manager mirror message types normalize to canonical types", () => {
  assert.equal(canonicalMessageTypeFromMirror("text"), MessageType.TEXT);
  assert.equal(canonicalMessageTypeFromMirror("image"), MessageType.IMAGE);
  assert.equal(canonicalMessageTypeFromMirror("file"), MessageType.FILE);
  assert.equal(canonicalMessageTypeFromMirror("future-type"), MessageType.UNSUPPORTED);
});

test("Manager mirror canonical text preserves text and supplies media placeholders", () => {
  assert.equal(
    mirrorCanonicalText({ messageType: "text", text: "hello", fileName: null }),
    "hello",
  );
  assert.equal(
    mirrorCanonicalText({ messageType: "file", text: null, fileName: "quote.pdf" }),
    "quote.pdf",
  );
  assert.equal(
    mirrorCanonicalText({ messageType: "image", text: null, fileName: null }),
    "[Image]",
  );
});


test("exact inbound Manager-message evidence maps only when every match points to one canonical conversation", () => {
  assert.deepEqual(selectUniqueExactInboundConversationId([]), { status: "NONE" });
  assert.deepEqual(
    selectUniqueExactInboundConversationId(["conversation-a", "conversation-a"]),
    { status: "UNIQUE", conversationId: "conversation-a" },
  );
  assert.deepEqual(
    selectUniqueExactInboundConversationId(["conversation-a", "conversation-b"]),
    { status: "AMBIGUOUS" },
  );
});


test("Project B statistics identity keeps the LINE OA Manager-visible responder name", () => {
  assert.equal(managerResponderDisplayName("  OBS-Sunx2  "), "OBS-Sunx2");
  assert.equal(managerResponderDisplayName("28375 PC Pub"), "28375 PC Pub");
  assert.equal(managerResponderDisplayName(null), "LINE OA Manager Staff");
});
