import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineMessagingService } from "./line-messaging.service";
import { PilotAwareLineMessagingService } from "./pilot-aware-line-messaging.service";

const input = {
  accessToken: "secret",
  lineUserId: "Uline-user",
  text: "ทดสอบข้อความ",
  retryKey: "11111111-1111-4111-8111-111111111111",
  context: {
    conversationId: "conv-28375",
    storeId: "store-db-id",
    storeName: "OPPO BS RBS Chonburi",
  },
};

const imageInput = {
  accessToken: "secret",
  lineUserId: "Uline-user",
  originalContentUrl: "https://example.com/image.jpg",
  previewImageUrl: "https://example.com/image.jpg",
  retryKey: "22222222-2222-4222-8222-222222222222",
  context: {
    conversationId: "conv-image",
    storeId: "store-image-id",
    storeName: "OPPO Bangkapi",
  },
};

const managerTextDeliveryNotVerifiedError = new Error(
  "ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ",
);
const managerImageDeliveryNotVerifiedError = new Error(
  "ยังยืนยันการส่งรูปจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกว่าส่งสำเร็จ",
);

test("pilot-aware transport returns manager relay result without calling Push API", async () => {
  const relayCalls: unknown[] = [];
  const relay = {
    relayText: async (value: unknown) => {
      relayCalls.push(value);
      return { handled: true as const, duplicate: false, lineChatUserId: "Uchat-user" };
    },
  };
  const service = new PilotAwareLineMessagingService(relay as any);
  const original = LineMessagingService.prototype.pushText;
  let pushCalls = 0;
  LineMessagingService.prototype.pushText = async () => {
    pushCalls += 1;
    throw new Error("Push API must not be called for handled pilot relay");
  };
  try {
    const result = await service.pushText(input);
    assert.equal(relayCalls.length, 1);
    assert.equal(pushCalls, 0);
    assert.equal(result.requestId, null);
    assert.equal(result.externalMessageId, null);
    assert.equal(result.duplicateAccepted, false);
  } finally {
    LineMessagingService.prototype.pushText = original;
  }
});

test("non-pilot transport preserves existing Push API behavior", async () => {
  const relay = { relayText: async () => ({ handled: false as const }) };
  const service = new PilotAwareLineMessagingService(relay as any);
  const original = LineMessagingService.prototype.pushText;
  let pushCalls = 0;
  LineMessagingService.prototype.pushText = async () => {
    pushCalls += 1;
    return {
      requestId: "req-1",
      acceptedRequestId: null,
      externalMessageId: "provider-1",
      duplicateAccepted: false,
    };
  };
  try {
    const result = await service.pushText({ ...input, context: { conversationId: "conv-other" } });
    assert.equal(pushCalls, 1);
    assert.equal(result.requestId, "req-1");
  } finally {
    LineMessagingService.prototype.pushText = original;
  }
});

test("manager relay failures before or outside delivery verification still fail closed", async () => {
  const relay = { relayText: async () => { throw new Error("manager relay unavailable"); } };
  const service = new PilotAwareLineMessagingService(relay as any);
  const original = LineMessagingService.prototype.pushText;
  let pushCalls = 0;
  LineMessagingService.prototype.pushText = async () => {
    pushCalls += 1;
    return {
      requestId: "unexpected",
      acceptedRequestId: null,
      externalMessageId: null,
      duplicateAccepted: false,
    };
  };
  try {
    await assert.rejects(() => service.pushText(input), /manager relay unavailable/);
    assert.equal(pushCalls, 0);
  } finally {
    LineMessagingService.prototype.pushText = original;
  }
});

test("post-send text verification gaps are reconciled for every Manager-relay store", async () => {
  const relay = { relayText: async () => { throw managerTextDeliveryNotVerifiedError; } };
  const service = new PilotAwareLineMessagingService(relay as any);
  const original = LineMessagingService.prototype.pushText;
  let pushCalls = 0;
  LineMessagingService.prototype.pushText = async () => {
    pushCalls += 1;
    throw new Error("Push API must not be used for a Manager recovery path");
  };
  try {
    for (const storeName of ["OPPO Central World", "OPPO Bangkapi", "OPPO BS RBS Chonburi", "Future rollout store"]) {
      const result = await service.pushText({
        ...input,
        context: { ...input.context, storeName },
      });
      assert.equal(result.requestId, null);
      assert.equal(result.externalMessageId, null);
      assert.equal(result.duplicateAccepted, false);
    }
    assert.equal(pushCalls, 0);
  } finally {
    LineMessagingService.prototype.pushText = original;
  }
});

test("post-send image verification gaps are reconciled for every Manager-relay store", async () => {
  const relay = { relayImage: async () => { throw managerImageDeliveryNotVerifiedError; } };
  const service = new PilotAwareLineMessagingService(relay as any);
  const original = LineMessagingService.prototype.pushImage;
  let pushCalls = 0;
  LineMessagingService.prototype.pushImage = async () => {
    pushCalls += 1;
    throw new Error("Push API must not be used for an image Manager recovery path");
  };
  try {
    const result = await service.pushImage(imageInput);
    assert.equal(pushCalls, 0);
    assert.equal(result.requestId, null);
    assert.equal(result.externalMessageId, null);
    assert.equal(result.duplicateAccepted, false);
  } finally {
    LineMessagingService.prototype.pushImage = original;
  }
});

test("unrelated image relay failures still fail closed", async () => {
  const relay = { relayImage: async () => { throw new Error("image manager relay unavailable"); } };
  const service = new PilotAwareLineMessagingService(relay as any);
  const original = LineMessagingService.prototype.pushImage;
  let pushCalls = 0;
  LineMessagingService.prototype.pushImage = async () => {
    pushCalls += 1;
    return {
      requestId: "unexpected",
      acceptedRequestId: null,
      externalMessageId: null,
      duplicateAccepted: false,
    };
  };
  try {
    await assert.rejects(() => service.pushImage(imageInput), /image manager relay unavailable/);
    assert.equal(pushCalls, 0);
  } finally {
    LineMessagingService.prototype.pushImage = original;
  }
});
