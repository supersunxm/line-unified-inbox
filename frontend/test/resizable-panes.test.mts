import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CHAT_LAYOUT_STORAGE_KEY, CHAT_PANE_LIMITS, DEFAULT_CHAT_PANE_WIDTHS, parseSavedChatPaneWidths, resizeChatPanes } from "../src/app/resizable-panes.ts";

test("chat panes expose stable default, minimum, and maximum widths", () => {
  assert.deepEqual(DEFAULT_CHAT_PANE_WIDTHS, { sidebar: 240, conversations: 340 });
  assert.deepEqual(CHAT_PANE_LIMITS.sidebar, { default: 240, min: 180, max: 420 });
  assert.deepEqual(CHAT_PANE_LIMITS.conversations, { default: 340, min: 280, max: 600 });
  assert.equal(CHAT_PANE_LIMITS.detailMin, 520);
  assert.equal(CHAT_LAYOUT_STORAGE_KEY, "oppo-line-oa-chat-layout-v1");
});

test("dragging the first separator resizes sidebar and conversation panes", () => {
  assert.deepEqual(resizeChatPanes(DEFAULT_CHAT_PANE_WIDTHS, "sidebar", 40, 1400), { sidebar: 280, conversations: 300 });
  assert.deepEqual(resizeChatPanes(DEFAULT_CHAT_PANE_WIDTHS, "sidebar", -200, 1400), { sidebar: 180, conversations: 400 });
  assert.deepEqual(resizeChatPanes({ sidebar: 400, conversations: 300 }, "sidebar", 100, 1500), { sidebar: 420, conversations: 280 });
});

test("dragging the second separator preserves minimum detail width", () => {
  assert.deepEqual(resizeChatPanes(DEFAULT_CHAT_PANE_WIDTHS, "conversations", 80, 1400), { sidebar: 240, conversations: 420 });
  assert.deepEqual(resizeChatPanes(DEFAULT_CHAT_PANE_WIDTHS, "conversations", -200, 1400), { sidebar: 240, conversations: 280 });
  assert.deepEqual(resizeChatPanes({ sidebar: 240, conversations: 590 }, "conversations", 100, 1400), { sidebar: 240, conversations: 600 });
  assert.deepEqual(resizeChatPanes(DEFAULT_CHAT_PANE_WIDTHS, "conversations", 500, 1100), { sidebar: 240, conversations: 324 });
});

test("saved widths restore only when the payload is valid", () => {
  assert.deepEqual(parseSavedChatPaneWidths('{"sidebar":300,"conversations":450}'), { sidebar: 300, conversations: 450 });
  for (const malformed of [null, "", "not-json", "{}", '{"sidebar":100,"conversations":450}', '{"sidebar":300,"conversations":900}']) assert.equal(parseSavedChatPaneWidths(malformed), null);
});

test("reset, keyboard resizing, and resize isolation are wired without changing chat filters", () => {
  const hook = readFileSync(new URL("../src/app/use-resizable-panes.ts", import.meta.url), "utf8");
  const separator = readFileSync(new URL("../src/app/resizable-separator.tsx", import.meta.url), "utf8");
  assert.match(hook, /setWidths\(DEFAULT_CHAT_PANE_WIDTHS\)/);
  assert.match(hook, /localStorage\.setItem\(CHAT_LAYOUT_STORAGE_KEY/);
  assert.match(separator, /ArrowLeft/); assert.match(separator, /ArrowRight/); assert.match(separator, /keyboardStep/);
  assert.match(separator, /role="separator"/); assert.match(separator, /aria-orientation="vertical"/);
  assert.doesNotMatch(`${hook}${separator}`, /setSelectedStore|setSelectedConversationId|loadApplicationData|api\./);
});

test("mobile hides handles and light/dark semantic colors keep them visible", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 1120px\)[\s\S]*\.chat-resize-handle[\s\S]*display: none/);
  assert.match(css, /\.chat-resize-handle::before[\s\S]*var\(--border\)/);
  assert.match(css, /\.chat-resize-handle:hover::before[\s\S]*var\(--focus\)/);
  assert.match(css, /html\[data-theme="dark"\][\s\S]*--border:/);
});
