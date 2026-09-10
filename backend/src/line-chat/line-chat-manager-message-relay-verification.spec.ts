import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/line-chat/line-chat-manager-message-relay-worker.service.ts"),
  "utf8",
);

test("manager relay only accepts a real outbound bubble as delivery evidence", () => {
  assert.match(source, /countOutboundExactText/);
  assert.match(source, /horizontalCenter >= viewportWidth \* 0\.5/);
  assert.match(source, /aboveComposer/);
  assert.match(source, /outboundCount > beforeOutboundCount/);
  assert.doesNotMatch(source, /composerCleared && count > beforeCount/);
});

test("manager relay keeps composer selection safe while accepting the single Manager textarea", () => {
  assert.match(source, /const semanticComposer =/);
  assert.match(source, /metadata\.className\.includes\("prosemirror"\)/);
  assert.match(source, /const isSearchField = \/search\|ค้นหา\/u\.test\(hint\)/);
  assert.match(source, /const singleTextareaFallback = metadata\.tag === "textarea" && count === 1/);
  assert.match(source, /\(!lowerPane && !singleTextareaFallback\)/);
  assert.match(source, /if \(singleTextareaFallback\) score \+= 6/);
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
