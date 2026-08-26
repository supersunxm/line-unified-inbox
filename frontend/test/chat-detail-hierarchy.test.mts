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
  assert.doesNotMatch(detail, /editConversationTags\(\)/);
  assert.doesNotMatch(detail, /editPurchaseInformation\(\)/);
  assert.doesNotMatch(detail, /data-purchase-information-card/);
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
    "text.mentionedProduct",
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

test("customer purchase card is removed while AI insight, note, and activity sections remain intact", () => {
  assert.doesNotMatch(detail, /data-purchase-information-card/);
  assert.doesNotMatch(detail, /text\.customerPurchase/);
  assert.doesNotMatch(detail, /text\.editPurchaseInformation/);

  const insightStart = detail.indexOf("data-product-intent-card");
  const noteStart = detail.indexOf("data-topics-note-card");
  const activityStart = detail.indexOf("data-activity-history");

  assert.ok(insightStart >= 0, "AI insight card must be present");
  assert.ok(noteStart > insightStart, "Internal note card must follow insight card");
  assert.ok(activityStart > noteStart, "Activity history card must follow internal note card");

  const insightSection = detail.slice(insightStart, noteStart);
  assert.match(insightSection, /aiInsight/);
  assert.match(insightSection, /mentionedProducts/);
  assert.match(insightSection, /purchaseIntent/);
});

test("Store Follow-up bottom panel is removed from Chat Detail while shared status handlers remain intact", () => {
  assert.match(detail, /data-chat-detail-workspace className="flex h-full min-h-0 flex-col"/);
  assert.match(detail, /data-chat-detail-scroll className="min-h-0.*overflow-y-auto/);
  assert.doesNotMatch(detail, /data-store-follow-up-bar/);
  assert.doesNotMatch(detail, /data-store-follow-up-actions/);
  for (const status of ["followUp", "reminded", "acknowledged", "completed", "escalated"]) {
    assert.match(pageCode, new RegExp(`"${status}"|status === "${status}"`));
  }
});

test("detail pane uses dominant chat message timeline and collapsible details drawer", () => {
  assert.match(pageCode, /data-chat-pane="detail" className="app-surface h-full min-w-0 min-h-0 overflow-hidden flex flex-col"/);
  assert.match(detail, /data-chat-details-toggle/);
  assert.match(detail, /data-chat-details-drawer/);
  assert.match(detail, /data-chat-message-scroll className="flex-1 min-h-0 space-y-2\.5 overflow-y-auto/);
  assert.match(globalsCode, /container-name: chat-detail/);
  assert.match(globalsCode, /\[data-chat-details-drawer\]/);
});

test("detail pane renders centered empty state when no conversation is selected", () => {
  assert.match(pageCode, /data-chat-detail-empty-state/);
  assert.match(pageCode, /text\.selectConversationTitle/);
  assert.match(pageCode, /text\.selectConversationDescription/);
});

test("collapsible details drawer encapsulates secondary metadata without consuming permanent vertical space", () => {
  // Toggle button in header
  assert.match(detail, /data-chat-details-toggle[\s\S]*setShowDetailsDrawer\(\(v\) => !v\)/);
  assert.match(detail, /aria-expanded=\{showDetailsDrawer\}/);
  assert.match(detail, /\{text\.details\}/);

  // Drawer structure
  assert.match(detail, /showDetailsDrawer && \(\s*<aside\s+data-chat-details-drawer/);
  assert.match(detail, /className="w-80 lg:w-\[22rem\] shrink-0 border-l border-\[var\(--app-border\)\] bg-\[var\(--app-surface\)\] flex flex-col h-full min-h-0/);
  assert.match(detail, /onClick=\{\(\) => setShowDetailsDrawer\(false\)\}/);

  // Dominant chat timeline
  assert.match(detail, /data-chat-message-scroll className="flex-1 min-h-0 space-y-2\.5 overflow-y-auto/);
  assert.match(detail, /data-chat-reply-composer className="shrink-0 border-t/);
});
