import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getConversationListTags,
  getConversationListTitle,
} from "../src/app/conversation-list-presentation.ts";

const labels = {
  conversations: "Conversations",
  incoming: "Incoming",
  followUp: "Follow-up",
  reminded: "Reminded",
  status: (value: string) => `Status: ${value}`,
};

test("conversation list title follows the active sidebar and status filter", () => {
  assert.equal(getConversationListTitle("incoming", "all", labels), "Incoming");
  assert.equal(getConversationListTitle("followUp", "all", labels), "Follow-up");
  assert.equal(getConversationListTitle("reminded", "all", labels), "Reminded");
  assert.equal(getConversationListTitle("dashboard", "completed", labels), "Status: completed");
  assert.equal(getConversationListTitle("dashboard", "all", labels), "Conversations");
});

test("default priority is hidden while attention priority remains visible", () => {
  const normal = getConversationListTags({
    priority: "Normal",
    priorityLabel: "Normal Priority",
    statusLabel: "",
    product: "Reno 16",
    topic: "",
  });
  assert.deepEqual(normal.visible.map(({ label }) => label), ["Reno 16"]);

  const high = getConversationListTags({
    priority: "High",
    priorityLabel: "High Priority",
    statusLabel: "",
    product: "Reno 16",
    topic: "",
  });
  assert.deepEqual(high.visible.map(({ label }) => label), ["High Priority", "Reno 16"]);
});

test("only three tags are visible and remaining tags are counted", () => {
  const tags = getConversationListTags({
    priority: "High",
    priorityLabel: "High Priority",
    statusLabel: "Follow-up",
    product: "Reno 16",
    topic: "Price · Stock",
  });
  assert.equal(tags.visible.length, 3);
  assert.deepEqual(tags.hidden.map(({ label }) => label), ["Price", "Stock"]);
});

test("message previews stay readable across content and row states while metadata remains quieter", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const globalsCode = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.match(activeRows, /data-conversation-message-preview/);
  assert.match(activeRows, /conversation-message-preview mt-2 line-clamp-2 text-sm leading-5/);
  assert.match(activeRows, /\{conversation\.translations\[language\]\}/);
  assert.match(activeRows, /data-conversation-metadata className="app-muted/);
  assert.match(activeRows, /data-selected=\{isSelected\}/);
  assert.doesNotMatch(activeRows, /conversation-list-row[^"]*opacity-|conversation-message-preview[^"]*opacity-/);
  assert.match(globalsCode, /\.conversation-message-preview \{\s*color: var\(--foreground\);\s*opacity: 1;/);
  assert.match(pageCode, /latestMessage\?\.messageType === "IMAGE"[\s\S]*📷 รูปภาพ/);
  assert.match(pageCode, /latestMessage\?\.originalText \?\? ""/);
});

test("conversation list retains selected-row state, accurate count, and in-pane pagination", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const globalsCode = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const listStart = pageCode.indexOf('data-chat-pane="conversations"');
  const listEnd = pageCode.indexOf('separator="conversations"', listStart);
  const activeListBranch = pageCode.slice(listStart, listEnd);
  const headerEnd = activeListBranch.indexOf("{showFilterPanel &&");
  const activeHeader = activeListBranch.slice(0, headerEnd);
  const rowStart = activeListBranch.indexOf("filteredConversations.map");
  const rowEnd = activeListBranch.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = activeListBranch.slice(rowStart, rowEnd);

  assert.match(pageCode, /isSelected \? "is-selected/);
  assert.match(activeHeader, /data-chat-list-title/);
  assert.match(activeHeader, /\{conversationListTitle\}/);
  assert.match(activeHeader, /data-chat-filter-button/);
  assert.match(activeHeader, /\{text\.moreFilters\}/);
  assert.doesNotMatch(activeHeader, /text\.conversationsToFollow|\{text\.filter\}/);
  assert.match(activeRows, /data-conversation-row/);
  assert.match(activeRows, /data-selected=\{isSelected\}/);
  assert.match(activeRows, /data-conversation-priority=\{tag\.kind === "priority"/);
  assert.doesNotMatch(activeRows, /text\.normalPriority/);
  assert.match(globalsCode, /\[data-chat-pane="conversations"\] \.conversation-list-row\.is-selected/);
  assert.match(globalsCode, /box-shadow: inset 4px 0 0 var\(--focus\)/);
  assert.match(pageCode, /\{chatTotalCount\} \{text\.searchResults\}/);
  assert.doesNotMatch(pageCode, /chatTotalCount \|\| filteredConversations\.length/);

  const pagination = pageCode.indexOf("<ConversationPaginationFooter", listStart);
  assert.ok(listStart < pagination && pagination < listEnd);
});
