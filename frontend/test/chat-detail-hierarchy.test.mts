import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const detailStart = pageCode.indexOf('data-chat-pane="detail"');
const detailEnd = pageCode.indexOf("\n        </section>", detailStart);
const detail = pageCode.slice(detailStart, detailEnd);

test("chat detail customer identity and action hierarchy use the active handlers", () => {
  assert.match(detail, /data-chat-detail-customer className="truncate text-2xl font-bold/);
  assert.match(detail, /data-chat-detail-primary-action[\s\S]{0,240}openSelectedConversationInLineOa\(\)[\s\S]{0,240}app-button-primary/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*refreshProfile\(\)/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*setShowTranslation\(!showTranslation\)/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*reanalyzeConversation\(\)/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*editConversationTags\(\)/);
  assert.match(detail, /showTranslation\s*\? text\.showOriginal\s*:\s*text\.translateMessage/);
});

test("message viewport is compact and preserves ordering, separators, media, and manager notice", () => {
  assert.match(detail, /data-chat-message-scroll className="max-h-\[420px\] min-h-0[\s\S]*overflow-y-auto/);
  assert.doesNotMatch(detail, /max-h-\[520px\]|min-h-\[[^\]]+\]/);
  assert.match(detail, /chatHistory\.items\.map\(\(message, index\)/);
  assert.match(detail, /const previous = chatHistory\.items\[index - 1\]/);
  assert.match(detail, /data-chat-date-separator/);
  assert.match(detail, /message\.messageType === "IMAGE" \? <MessageImage/);
  assert.match(detail, /showTranslation \? translated \?\? message\.originalText : message\.originalText/);
  assert.match(detail, /data-line-oa-manager-notice[\s\S]*\{text\.repliesMayNotAppear\}/);
});

test("product intent, topics, and editable internal note remain complete", () => {
  for (const field of [
    "text.productCategory",
    "text.productModel",
    "text.customerRelationship",
    "text.purchaseIntent",
  ]) {
    assert.match(detail, new RegExp(field.replace(".", "\\.")));
  }
  assert.match(detail, /Math\.round\(confidence \* 100\)/);
  assert.match(detail, /data-topics-note-card/);
  assert.match(detail, /selectedApiConversation\?\.topics/);
  assert.match(detail, /value=\{selectedConversationState\.note\}/);
  assert.match(detail, /onChange=\{\(event\) => updateInternalNote\(event\.target\.value\)\}/);
  assert.match(detail, /onBlur=\{\(\) => void saveInternalNote\(\)\}/);
  assert.match(detail, /placeholder=\{text\.notePlaceholder\}/);
});
