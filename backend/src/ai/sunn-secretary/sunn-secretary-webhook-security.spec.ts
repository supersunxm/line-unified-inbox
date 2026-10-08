import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { authorizeSunnEvent, validateSunnEventId, verifySunnLineSignature } from "./sunn-secretary-webhook-security";

const secret = "test-only-secret";
const body = Buffer.from('{"events":[]}', "utf8");
const signature = createHmac("sha256", secret).update(body).digest("base64");
const botUserId = "U" + "a".repeat(32);
const config = { groupIds: ["allowed-group"], userIds: ["allowed-user"], botUserId };
const event = {
  type: "message", webhookEventId: "event-001", source: {type:"group",groupId:"allowed-group",userId:"allowed-user"},
  message: {type:"text",text:"@เลขาซันน์ ร้านไหนค้างตอบ",mention:{mentionees:[{type:"user",userId:botUserId}]}},
};

test("valid LINE signature must cover exact raw bytes", () => {
  assert.equal(verifySunnLineSignature(body, signature, secret), true);
  assert.equal(verifySunnLineSignature(Buffer.from('{"events": []}'), signature, secret), false);
  assert.equal(verifySunnLineSignature(body, "invalid", secret), false);
  assert.equal(verifySunnLineSignature(undefined, signature, secret), false);
  assert.equal(verifySunnLineSignature(body, signature, undefined), false);
});
test("requires real bot mention and both LINE sender/group allowlists", () => {
  assert.equal(authorizeSunnEvent(event, config), true);
  assert.equal(authorizeSunnEvent({...event,source:{...event.source,groupId:"unknown"}},config),false);
  assert.equal(authorizeSunnEvent({...event,source:{...event.source,userId:"unknown"}},config),false);
  assert.equal(authorizeSunnEvent({...event,message:{...event.message,mention:{mentionees:[]}}},config),false);
  assert.equal(authorizeSunnEvent({...event,source:{...event.source,type:"user"}},config),false);
});
test("rejects fake bot nickname without LINE mention metadata", () => {
  assert.equal(authorizeSunnEvent({...event,message:{type:"text",text:"@เลขาซันน์ ร้านไหนค้างตอบ"}},config),false);
});
test("rejects missing replay identification", () => {
  assert.equal(validateSunnEventId(event),"event-001");
  assert.equal(validateSunnEventId({...event,webhookEventId:undefined}),null);
});
