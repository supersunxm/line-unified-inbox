import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageCode = read("../src/app/page.tsx");

const conversationsPaneStart = pageCode.indexOf('<section data-chat-pane="conversations"');
const detailPaneStart = pageCode.indexOf('<section data-chat-pane="detail"');
const chatsPanes = pageCode.slice(conversationsPaneStart, pageCode.indexOf("{bulkConfirmState && (", detailPaneStart));

test("conversation list Retry reloads through the shared conversation load path", () => {
  const errorStart = chatsPanes.indexOf(") : chatPageError ? (");
  const errorBlock = chatsPanes.slice(errorStart, chatsPanes.indexOf(") : filteredConversations.length === 0 ? (", errorStart));
  assert.match(errorBlock, /onClick=\{\(\) => void loadConversations\(conversationQueryRef\.current\)\}/);
  assert.match(errorBlock, /\{text\.retry\}/);
  assert.doesNotMatch(pageCode, /setIsChatPageLoading\(\(v\) => !v\)/);

  // The shared loader shows the skeleton for non-silent loads and keeps request guards.
  const loader = pageCode.slice(pageCode.indexOf("const loadConversations = useCallback("), pageCode.indexOf("const loadSupportingData = useCallback("));
  assert.match(loader, /if \(!silent\) setIsChatPageLoading\(true\);/);
  assert.match(loader, /conversationRequestController\.current\?\.abort\(\);/);
  assert.match(loader, /conversationRequestGuard\.current\.begin\(\)/);
  assert.match(loader, /setChatPageError\(error instanceof Error \? error\.message : text\.connectionError\)/);
  // Polling uses the same loader with the same current-query ref.
  assert.match(pageCode, /loadConversations\(conversationQueryRef\.current, true\)/);
});

test("Store Chats uses the app font for names, times, dates and counts", () => {
  assert.doesNotMatch(chatsPanes, /font-mono/);
  assert.doesNotMatch(read("../src/app/conversation-pagination-footer.tsx"), /font-mono/);
  assert.match(chatsPanes, /data-conversation-metadata className="[^"]*font-tabular[^"]*"/);
  assert.match(chatsPanes, /font-tabular text-\[var\(--app-text-tertiary\)\]">\{chatHistory\.total\} \{text\.messagesToday\}/);
  assert.match(chatsPanes, /text-\[10px\] text-\[var\(--app-text-tertiary\)\] font-tabular">\{formatRelativeTime\(selectedConversation\.time, language\)\}/);

  // The sidebar keeps monospace only for the store code.
  const sidebar = read("../src/components/shell/context-sidebar.tsx");
  const monoUses = sidebar.match(/font-mono/g) ?? [];
  assert.equal(monoUses.length, 1);
  assert.match(sidebar, /<span className="font-mono text-\[10px\][^"]*">\s*\[\{store\.masterStoreId \?\? store\.externalStoreId\}\]/);

  // Mobile Store Chats has no monospace names or times.
  assert.doesNotMatch(read("../src/components/chats/mobile-chats-app.tsx"), /font-mono/);
});

test("chat detail header truncates long names before the action buttons", () => {
  const header = chatsPanes.slice(chatsPanes.indexOf("<header data-chat-detail-header"), chatsPanes.indexOf("</header>"));
  assert.match(header, /<div className="flex min-w-0 flex-1 items-center gap-3">/);
  assert.match(header, /<span data-chat-detail-store className="min-w-0 max-w-full truncate [^"]*" title=\{selectedConversation\.store\}>\{selectedConversation\.store\}<\/span>/);
  assert.doesNotMatch(header, /shrink-0 text-xs font-medium text-\[var\(--app-text-secondary\)\]">\{selectedConversation\.store\}/);
  assert.match(header, /data-chat-detail-customer className="truncate [^"]* min-w-0 max-w-full" title=/);
  assert.match(header, /<div className="flex shrink-0 items-center gap-2">/);
});

test("truncated store names expose the full name on hover", () => {
  assert.match(chatsPanes, /<span className="min-w-0 truncate font-medium text-\[var\(--app-text-secondary\)\]" title=\{conversation\.store\}>\{conversation\.store\}<\/span>/);
  const sidebar = read("../src/components/shell/context-sidebar.tsx");
  assert.match(sidebar, /<span className="min-w-0 flex-1 truncate pr-1 font-medium" title=\{getStoreDisplayName\(store\.name\)\}>/);
  assert.doesNotMatch(sidebar, /data-focus-store-group|focusGroupLabel|focusGroupSubtitle/);
  assert.match(sidebar, /data-chat-period-select/);
});

test("Store Chats guardrail attributes are untouched", () => {
  for (const attribute of ["data-conversation-action-menu", "data-product-intent-card", "data-bm-reply-status-select", "data-chat-detail-header", "data-conversation-metadata"]) {
    assert.ok(pageCode.includes(attribute), `${attribute} must remain`);
  }
  // The detail-header reply-status select stays read-only.
  assert.match(pageCode, /data-bm-reply-status-select\s+aria-label=\{text\.bmReplyStatus\}\s+disabled\n/);
});
