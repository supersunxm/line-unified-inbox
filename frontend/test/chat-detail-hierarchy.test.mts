import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const globalsCode = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const detailStart = pageCode.indexOf('data-chat-pane="detail"');
const detailEnd = pageCode.indexOf("\n        </section>\n        </>\n        )}", detailStart);
const detail = pageCode.slice(detailStart, detailEnd);

test("chat detail customer identity and action hierarchy use the active handlers", () => {
  assert.match(detail, /data-chat-detail-customer className="truncate text-(base|xl) font-bold/);
  assert.match(detail, /data-chat-detail-primary-action[\s\S]{0,240}openSelectedConversationInLineOa\(\)[\s\S]{0,240}app-button-primary/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*refreshProfile\(\)/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*setShowTranslation\(!showTranslation\)/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*reanalyzeConversation\(\)/);
  assert.match(detail, /data-chat-detail-secondary-action[\s\S]*editConversationTags\(\)/);
  assert.match(detail, /showTranslation\s*\? text\.showOriginal\s*:\s*text\.translateMessage/);
});

test("message viewport dominates the workspace and preserves ordering, media, translation, and the manager notice", () => {
  assert.match(detail, /data-chat-message-scroll className=".*overflow-y-auto/);
  assert.match(detail, /chatHistory\.items\.map\(\(message, index\)/);
  assert.match(detail, /const previous = chatHistory\.items\[index - 1\]/);
  assert.match(detail, /data-chat-date-separator/);
  assert.match(detail, /message\.messageType === "IMAGE" \? <MessageImage/);
  assert.match(detail, /<MessageTranslationAction message=\{message\} userRole=\{authUser\.role\}/);
  assert.match(detail, /showTranslation \? translated \?\? message\.originalText : message\.originalText/);
  assert.match(detail, /data-line-oa-manager-notice[\s\S]*\{text\.repliesMayNotAppear\}/);
});

test("insights consolidate product intent and topics while the internal note remains separate and editable", () => {
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
  assert.match(detail, /data-insights-section/);
  assert.match(detail, /data-internal-note-section/);
  assert.match(detail, /selectedApiConversation\?\.topics/);
  assert.match(detail, /value=\{selectedConversationState\.note\}/);
  assert.match(detail, /onChange=\{\(event\) => updateInternalNote\(event\.target\.value\)\}/);
  assert.match(detail, /onBlur=\{\(\) => void saveInternalNote\(\)\}/);
  assert.match(detail, /placeholder=\{text\.notePlaceholder\}/);
  assert.match(detail, /text\.noteSaveHint/);
});

test("Store Follow-up is a persistent pane footer and all existing status handlers remain visible", () => {
  assert.match(detail, /data-chat-detail-workspace className="flex h-full min-h-0 flex-col"/);
  assert.match(detail, /data-chat-detail-scroll className="min-h-0.*overflow-y-auto/);
  assert.match(detail, /data-store-follow-up-bar[^>]*sticky bottom-0/);
  assert.match(detail, /data-store-follow-up-bar[\s\S]*shrink-0[\s\S]*aria-label=\{text\.storeFollowUp\}/);
  for (const status of ["followUp", "reminded", "acknowledged", "completed", "escalated"]) {
    assert.match(detail, new RegExp(`updateFollowUpStatus\\("${status}"\\)`));
  }
  assert.doesNotMatch(detail, /data-store-follow-up-actions[\s\S]{0,1000}aria-haspopup/);
});

test("detail pane uses container-responsive consolidation and reserves the assistant corner", () => {
  assert.match(pageCode, /data-chat-pane="detail" className="app-surface h-full min-w-0 min-h-0 overflow-hidden flex flex-col"/);
  assert.match(globalsCode, /container-name: chat-detail/);
  assert.match(globalsCode, /@container chat-detail \(min-width: 44rem\)/);
  assert.match(globalsCode, /\.chat-detail-follow-up \{[\s\S]*bottom: 0;[\s\S]*padding-right: 5\.5rem;[\s\S]*position: sticky;[\s\S]*z-index: 20;/);
  assert.match(globalsCode, /@media \(max-width: 1120px\)[\s\S]*\[data-chat-message-scroll\][\s\S]*min-height: clamp\(20rem, 46vh, 28rem\)/);
});
