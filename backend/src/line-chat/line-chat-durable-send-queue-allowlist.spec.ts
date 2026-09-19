import test from "node:test";
import assert from "node:assert/strict";
import {
  getLineChatDurableSendQueueStoreCodes,
  isLineChatDurableSendQueueStoreEnabled,
} from "./line-chat-pilot.constants";
import { LineChatMessageSendQueueService } from "./line-chat-message-send-queue.service";

test("durable send queue store allowlist parsing and validation", async (t) => {
  await t.test("disabled flag: returns false when LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED is false or unset", () => {
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "false",
        storeCodes: "28375",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: undefined,
        storeCodes: "28375",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "",
        storeCodes: "28375",
      }),
      false,
    );
  });

  await t.test("missing allowlist: fails closed when LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES is missing or empty", () => {
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: undefined,
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: "",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: "   ",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: ", , ,",
      }),
      false,
    );
    // Ensure getLineChatDurableSendQueueStoreCodes returns empty set
    assert.equal(getLineChatDurableSendQueueStoreCodes("").size, 0);
    assert.equal(getLineChatDurableSendQueueStoreCodes(undefined).size, 0);
    assert.equal(getLineChatDurableSendQueueStoreCodes("   ").size, 0);
  });

  await t.test("wrong store: rejects stores not in allowlist", () => {
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("25610", {
        enabled: "true",
        storeCodes: "28375",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("99999", {
        enabled: "true",
        storeCodes: "28375",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled(null, {
        enabled: "true",
        storeCodes: "28375",
      }),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("", {
        enabled: "true",
        storeCodes: "28375",
      }),
      false,
    );
  });

  await t.test("correct store 28375: activates only when enabled and explicitly allowlisted", () => {
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: "28375",
      }),
      true,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled(" 28375 ", {
        enabled: "true",
        storeCodes: "28375",
      }),
      true,
    );
  });

  await t.test("multiple allowlisted stores parsing: handles comma-separated list", () => {
    const raw = "28375,25610,27627";
    const codes = getLineChatDurableSendQueueStoreCodes(raw);
    assert.equal(codes.size, 3);
    assert.ok(codes.has("28375"));
    assert.ok(codes.has("25610"));
    assert.ok(codes.has("27627"));

    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: raw,
      }),
      true,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("25610", {
        enabled: "true",
        storeCodes: raw,
      }),
      true,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("27627", {
        enabled: "true",
        storeCodes: raw,
      }),
      true,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("25391", {
        enabled: "true",
        storeCodes: raw,
      }),
      false,
    );
  });

  await t.test("whitespace and duplicate store codes: trims whitespace and deduplicates cleanly", () => {
    const raw = "  28375 , 28375,  25610 , , 28375  ";
    const codes = getLineChatDurableSendQueueStoreCodes(raw);
    assert.equal(codes.size, 2);
    assert.deepEqual([...codes].sort(), ["25610", "28375"]);

    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("28375", {
        enabled: "true",
        storeCodes: raw,
      }),
      true,
    );
    assert.equal(
      isLineChatDurableSendQueueStoreEnabled("25610", {
        enabled: "true",
        storeCodes: raw,
      }),
      true,
    );
  });

  await t.test("LineChatMessageSendQueueService: respects store allowlist gating", () => {
    const originalEnabled = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED;
    const originalStoreCodes = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES;
    try {
      // Disabled flag
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = "false";
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = "28375";
      const service = new LineChatMessageSendQueueService(null as never);
      assert.equal(service.enabled(), false);
      assert.equal(service.isStoreEnabled("28375"), false);

      // Enabled with allowlist
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = "true";
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = "28375";
      assert.equal(service.enabled(), true);
      assert.equal(service.isStoreEnabled("28375"), true);
      assert.equal(service.isStoreEnabled("25610"), false);

      // Enabled with empty allowlist (fail closed)
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = "";
      assert.equal(service.enabled(), true);
      assert.equal(service.isStoreEnabled("28375"), false);
    } finally {
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = originalEnabled;
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = originalStoreCodes;
    }
  });
});
