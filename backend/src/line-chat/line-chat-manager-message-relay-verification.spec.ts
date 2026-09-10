import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/line-chat/line-chat-manager-message-relay-worker.service.ts"),
  "utf8",
);
const fallbackSource = readFileSync(
  join(process.cwd(), "src/line-chat/line-chat-composer-fallback.ts"),
  "utf8",
);

test("manager relay only accepts a real outbound bubble as delivery evidence", () => {
  assert.match(source, /countOutboundExactText/);
  assert.match(source, /horizontalCenter >= viewportWidth \* 0\.5/);
  assert.match(source, /aboveComposer/);
  assert.match(source, /outboundCount > beforeOutboundCount/);
  assert.doesNotMatch(source, /composerCleared && count > beforeCount/);
});

test("all phase2 manager layouts prefer the same sole textarea primitive as Central World", () => {
  assert.match(source, /findSoleManagerTextarea/);
  assert.match(source, /if \(soleTextarea\) return soleTextarea/);
  assert.match(fallbackSource, /count !== 1/);
  assert.match(fallbackSource, /search\|ค้นหา/);
  assert.match(fallbackSource, /return textarea/);
});

test("manager relay can focus and populate a transient manager textarea", () => {
  assert.match(source, /private async focusComposer/);
  assert.match(source, /element as HTMLElement\)\.focus/);
  assert.match(source, /element\.value = value/);
  assert.match(source, /new InputEvent\("input"/);
});

test("manager relay prefers the real Manager send control before keyboard fallback", () => {
  assert.match(source, /SEND_BUTTON_SELECTORS/);
  assert.match(source, /findSendButton\(page, composer\)/);
  assert.match(source, /action: "SEND_BUTTON"/);
  assert.match(source, /await sendButton\.click/);
  assert.match(source, /action: "KEYBOARD_ENTER"/);
  assert.match(source, /await page\.keyboard\.press\("Enter"\)/);
});

test("unverified manager sends fail closed instead of being persisted as sent", () => {
  assert.match(source, /line_chat_manager_message_delivery_not_verified/);
  assert.match(source, /ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ/);
});
