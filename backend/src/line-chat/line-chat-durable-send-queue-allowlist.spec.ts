import test from "node:test";
import assert from "node:assert/strict";
import {
  getLineChatDurableSendQueueConversationIds,
  getLineChatDurableSendQueueStoreCodes,
  isLineChatDurableSendQueueConversationEnabled,
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

  await t.test("missing conversation allowlist: fails closed when LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS is missing or empty", () => {
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: "a04560a5-8658-493b-9b18-c992adc2b683" },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: undefined,
        },
      ),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: "a04560a5-8658-493b-9b18-c992adc2b683" },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: "",
        },
      ),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: "a04560a5-8658-493b-9b18-c992adc2b683" },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: "   ",
        },
      ),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: "a04560a5-8658-493b-9b18-c992adc2b683" },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: ", , ,",
        },
      ),
      false,
    );
    assert.equal(getLineChatDurableSendQueueConversationIds("").size, 0);
    assert.equal(getLineChatDurableSendQueueConversationIds(undefined).size, 0);
  });

  await t.test("wrong conversation: rejects conversations not in allowlist", () => {
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: "other-conv-123" },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: "a04560a5-8658-493b-9b18-c992adc2b683",
        },
      ),
      false,
    );
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: null },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: "a04560a5-8658-493b-9b18-c992adc2b683",
        },
      ),
      false,
    );
  });

  await t.test("correct Store 28375 + correct OBS-Sunx2 conversation: activates only when all 3 match", () => {
    const sunx2Id = "a04560a5-8658-493b-9b18-c992adc2b683";
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: sunx2Id },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: sunx2Id,
        },
      ),
      true,
    );
    // Trimmed whitespace
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: " 28375 ", conversationId: `  ${sunx2Id}  ` },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: sunx2Id,
        },
      ),
      true,
    );
  });

  await t.test("correct store but Max conversation -> MUST reject permanently", () => {
    const sunx2Id = "a04560a5-8658-493b-9b18-c992adc2b683";
    const maxId = "9cf223e4-194a-47ce-b795-1192a22d3928";
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: maxId },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: sunx2Id,
        },
      ),
      false,
    );
  });

  await t.test("whitespace and duplicate conversation IDs: trims and deduplicates", () => {
    const sunx2Id = "a04560a5-8658-493b-9b18-c992adc2b683";
    const otherId = "c8901234-1234-1234-1234-123456789012";
    const raw = `  ${sunx2Id} , ${sunx2Id},  ${otherId} , , ${sunx2Id}  `;
    const ids = getLineChatDurableSendQueueConversationIds(raw);
    assert.equal(ids.size, 2);
    assert.ok(ids.has(sunx2Id));
    assert.ok(ids.has(otherId));

    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: sunx2Id },
        {
          enabled: "true",
          storeCodes: "28375",
          conversationIds: raw,
        },
      ),
      true,
    );
  });

  await t.test("LineChatMessageSendQueueService: respects conversation allowlist gating", () => {
    const originalEnabled = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED;
    const originalStoreCodes = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES;
    const originalConvIds = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS;
    const sunx2Id = "a04560a5-8658-493b-9b18-c992adc2b683";
    const maxId = "9cf223e4-194a-47ce-b795-1192a22d3928";
    try {
      // Disabled flag
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = "false";
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = "28375";
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS = sunx2Id;
      const service = new LineChatMessageSendQueueService(null as never);
      assert.equal(service.enabled(), false);
      assert.equal(service.isConversationEnabled({ storeCode: "28375", conversationId: sunx2Id }), false);

      // Enabled with allowlist
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = "true";
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = "28375";
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS = sunx2Id;
      assert.equal(service.enabled(), true);
      assert.equal(service.isConversationEnabled({ storeCode: "28375", conversationId: sunx2Id }), true);
      assert.equal(service.isConversationEnabled({ storeCode: "28375", conversationId: maxId }), false);
      assert.equal(service.isConversationEnabled({ storeCode: "25610", conversationId: sunx2Id }), false);

      // Empty conversation allowlist fails closed
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS = "";
      assert.equal(service.isConversationEnabled({ storeCode: "28375", conversationId: sunx2Id }), false);
    } finally {
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED = originalEnabled;
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES = originalStoreCodes;
      process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS = originalConvIds;
    }
  });

  await t.test("worker egress and retry protection: rejects non-canary conversations and Max", () => {
    const sunx2Id = "a04560a5-8658-493b-9b18-c992adc2b683";
    const maxId = "9cf223e4-194a-47ce-b795-1192a22d3928";
    const randomStoreConv = "random-store-conv-id";

    const env = {
      enabled: "true",
      storeCodes: "28375",
      conversationIds: sunx2Id,
    };

    // Egress check for normal send on OBS-Sunx2
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: sunx2Id },
        env,
      ),
      true,
    );

    // Egress check for normal send on Max -> REJECTED
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: maxId },
        env,
      ),
      false,
    );

    // Egress check for retry on Max -> REJECTED (retry cannot bypass)
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: maxId },
        env,
      ),
      false,
    );

    // Egress check for random conversation in store 28375 -> REJECTED
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "28375", conversationId: randomStoreConv },
        env,
      ),
      false,
    );

    // Egress check for random conversation in other store -> REJECTED
    assert.equal(
      isLineChatDurableSendQueueConversationEnabled(
        { storeCode: "25610", conversationId: randomStoreConv },
        env,
      ),
      false,
    );
  });
});
