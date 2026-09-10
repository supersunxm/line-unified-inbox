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

test("manager relay does not select arbitrary lower-pane editable fields as the composer", () => {
  assert.match(source, /const semanticComposer =/);
  assert.match(source, /metadata\.className\.includes\("prosemirror"\)/);
  assert.match(source, /metadata\.tag === "textarea"/);
  assert.match(source, /if \(!semanticComposer \|\| !lowerPane\) continue/);
});

test("unverified manager sends fail closed instead of being persisted as sent", () => {
  assert.match(source, /line_chat_manager_message_delivery_not_verified/);
  assert.match(source, /ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ/);
});
