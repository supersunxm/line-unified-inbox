import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatVariantLabel,
  getBmCustomerSalesTags,
  getBmReplyStatusBadge,
  getBmTagChipClass,
  getConversationListTags,
  getConversationListTitle,
} from "../src/app/conversation-list-presentation.ts";
import type { ApiCustomerSalesInformation } from "../src/types/api.ts";

const labels = {
  conversations: "Conversations",
  notReplied: "Not replied",
  notifiedBm: "BM notified",
  replied: "Replied",
  status: (value: string) => `Status: ${value}`,
};

test("conversation list title follows the active sidebar and status filter", () => {
  assert.equal(getConversationListTitle("notReplied", "all", labels), "Not replied");
  assert.equal(getConversationListTitle("notifiedBm", "all", labels), "BM notified");
  assert.equal(getConversationListTitle("replied", "all", labels), "Replied");
  assert.equal(getConversationListTitle("dashboard", "completed", labels), "Status: completed");
  assert.equal(getConversationListTitle("dashboard", "all", labels), "Conversations");
});

test("formatVariantLabel handles RAM, ROM, color and combinations cleanly", () => {
  assert.equal(formatVariantLabel("16GB", "512GB", "Graphite"), "16GB / 512GB · Graphite");
  assert.equal(formatVariantLabel("12GB", "256GB", null), "12GB / 256GB");
  assert.equal(formatVariantLabel(null, null, "Titanium Silver"), "Titanium Silver");
  assert.equal(formatVariantLabel("8GB", null, null), "8GB");
  assert.equal(formatVariantLabel(null, "128GB", null), "128GB");
  assert.equal(formatVariantLabel(null, null, null), null);
});

test("getBmCustomerSalesTags generates INTERESTED and interestLevel tags with appropriate priority", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "INTERESTED",
    interestLevel: "HOT",
    purchaseChannel: null,
    paymentMethod: null,
    products: [
      {
        model: "OPPO Watch S",
        ram: null,
        rom: null,
        color: null,
        quantity: 1,
      },
    ],
  };

  const tags = getBmCustomerSalesTags(sales);
  assert.deepEqual(
    tags.map(({ kind, label }) => ({ kind, label })),
    [
      { kind: "salesStatus", label: "INTERESTED" },
      { kind: "interestLevel", label: "HOT" },
      { kind: "productModel", label: "OPPO Watch S" },
    ]
  );
  assert.match(getBmTagChipClass(tags[0]), /bg-blue-100.*text-blue-800/);
  assert.match(getBmTagChipClass(tags[1]), /bg-rose-100.*text-rose-800/);
});

test("getBmCustomerSalesTags renders the ONLINE customer status", () => {
  const tags = getBmCustomerSalesTags({
    status: "ONLINE",
    interestLevel: null,
    purchaseChannel: null,
    paymentMethod: null,
    products: [],
  });
  assert.deepEqual(tags.map(({ kind, label }) => ({ kind, label })), [
    { kind: "salesStatus", label: "ONLINE" },
  ]);
});

test("getBmCustomerSalesTags generates PURCHASED with model, variant, store channel, and payment method", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "PURCHASED",
    interestLevel: null,
    purchaseChannel: "STORE",
    paymentMethod: "CREDIT_CARD",
    products: [
      {
        model: "OPPO Find N6",
        ram: "16GB",
        rom: "512GB",
        color: "Silver",
        quantity: 1,
      },
    ],
  };

  const tags = getBmCustomerSalesTags(sales);
  assert.deepEqual(
    tags.map(({ kind, label }) => ({ kind, label })),
    [
      { kind: "salesStatus", label: "PURCHASED" },
      { kind: "productModel", label: "OPPO Find N6" },
      { kind: "productVariant", label: "16GB / 512GB · Silver" },
      { kind: "purchaseChannel", label: "STORE" },
      { kind: "paymentMethod", label: "CREDIT CARD" },
    ]
  );
  assert.match(getBmTagChipClass(tags[0]), /bg-emerald-100.*text-emerald-800/);
});

test("interestLevel color classes handle HOT, WARM, and COLD correctly", () => {
  const hotTag = getBmCustomerSalesTags({
    status: "INTERESTED",
    interestLevel: "HOT",
    purchaseChannel: null,
    paymentMethod: null,
    products: [],
  })[1];
  const warmTag = getBmCustomerSalesTags({
    status: "INTERESTED",
    interestLevel: "WARM",
    purchaseChannel: null,
    paymentMethod: null,
    products: [],
  })[1];
  const coldTag = getBmCustomerSalesTags({
    status: "INTERESTED",
    interestLevel: "COLD",
    purchaseChannel: null,
    paymentMethod: null,
    products: [],
  })[1];

  assert.match(getBmTagChipClass(hotTag), /bg-rose-100.*text-rose-800/);
  assert.match(getBmTagChipClass(warmTag), /bg-amber-100.*text-amber-800/);
  assert.match(getBmTagChipClass(coldTag), /bg-slate-100.*text-slate-700/);
});

test("all payment methods are formatted with human-friendly labels", () => {
  const methods = ["CASH", "INSTALLMENT", "CREDIT_CARD", "OTHER"] as const;
  const expectedLabels = ["CASH", "INSTALLMENT", "CREDIT CARD", "OTHER"];

  methods.forEach((method, idx) => {
    const tags = getBmCustomerSalesTags({
      status: "PURCHASED",
      interestLevel: null,
      purchaseChannel: null,
      paymentMethod: method,
      products: [],
    });
    assert.equal(tags[1].kind, "paymentMethod");
    assert.equal(tags[1].label, expectedLabels[idx]);
  });
});

test("getBmCustomerSalesTags returns empty array when customerSalesInformation is undefined or empty", () => {
  assert.deepEqual(getBmCustomerSalesTags(undefined), []);
  assert.deepEqual(
    getBmCustomerSalesTags({
      status: null,
      interestLevel: null,
      purchaseChannel: null,
      paymentMethod: null,
      products: [],
    }),
    []
  );
});

test("getConversationListTags truncates to maxVisible (default 3) and returns hidden tags count", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "PURCHASED",
    interestLevel: null,
    purchaseChannel: "STORE",
    paymentMethod: "CREDIT_CARD",
    products: [
      {
        model: "OPPO Find N6",
        ram: "16GB",
        rom: "512GB",
        color: null,
        quantity: 1,
      },
    ],
  };

  const listTags = getConversationListTags(sales, 3);
  assert.equal(listTags.visible.length, 3);
  assert.deepEqual(
    listTags.visible.map(({ label }) => label),
    ["PURCHASED", "OPPO Find N6", "16GB / 512GB"]
  );
  assert.equal(listTags.hidden.length, 2);
  assert.deepEqual(
    listTags.hidden.map(({ label }) => label),
    ["STORE", "CREDIT CARD"]
  );
});

test("message previews stay readable across content and row states while metadata remains quieter", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const globalsCode = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.match(activeRows, /data-conversation-message-preview/);
  assert.match(activeRows, /conversation-message-preview mt-(1|1\.5|2) line-clamp-2 text-(xs|sm)/);
  assert.match(activeRows, /\{conversation\.translations\[language\]\}/);
  assert.match(activeRows, /data-conversation-metadata className="app-muted/);
  assert.match(activeRows, /data-selected=\{isSelected\}/);
  assert.doesNotMatch(activeRows, /conversation-list-row[^"]*opacity-|conversation-message-preview[^"]*opacity-/);
  assert.match(globalsCode, /\.conversation-message-preview \{\s*color: var\(--foreground\);\s*opacity: 1;/);
  assert.match(pageCode, /latestMessage\?\.messageType === "IMAGE"[\s\S]*📷 รูปภาพ/);
  assert.match(pageCode, /latestMessage\?\.originalText \?\? ""/);
});

test("conversation list rows render BM tags with data-conversation-bm-tag and no AI or legacy tags", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.match(activeRows, /getConversationListTags\(conversation\.customerSalesInformation\)/);
  assert.match(activeRows, /data-conversation-bm-tag=\{tag\.kind\}/);
  assert.match(activeRows, /getBmTagChipClass\(tag\)/);
  assert.match(activeRows, /data-conversation-bm-reply-status=\{currentBmReplyStatus\}/);

  // Assert legacy/AI tags are NOT rendered in conversation list rows
  assert.doesNotMatch(activeRows, /data-conversation-priority/);
  assert.doesNotMatch(activeRows, /getStatusLabel\(language,\s*status\)/);
  assert.doesNotMatch(activeRows, /conversation\.product/);
  assert.doesNotMatch(activeRows, /conversation\.topic/);
});

test("chat detail header renders BM tags with data-chat-detail-bm-tag, reply status dropdown, and relative time", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const headerStart = pageCode.indexOf("<header data-chat-detail-header");
  const headerEnd = pageCode.indexOf("</header>", headerStart);
  const activeHeader = pageCode.slice(headerStart, headerEnd);

  assert.match(activeHeader, /getBmCustomerSalesTags\(selectedApiConversation\?\.customerSalesInformation \?\? selectedConversation\.customerSalesInformation\)/);
  assert.match(activeHeader, /data-chat-detail-bm-tag=\{tag\.kind\}/);
  assert.match(activeHeader, /getBmTagChipClass\(tag\)/);
  assert.match(activeHeader, /data-bm-reply-status-select/);
  assert.match(activeHeader, /formatRelativeTime\(selectedConversation\.time,\s*language\)/);

  // Assert legacy/AI tags are NOT rendered in chat detail header
  assert.doesNotMatch(activeHeader, /customerIntelligence/);
  assert.doesNotMatch(activeHeader, /customerStage/);
  assert.doesNotMatch(activeHeader, /followUpStatusLabels/);
  assert.doesNotMatch(activeHeader, /selectedConversation\.priority/);
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
  assert.match(globalsCode, /\[data-chat-pane="conversations"\] \.conversation-list-row\.is-selected/);
  assert.match(globalsCode, /box-shadow: inset 4px 0 0 var\(--focus\)/);
  assert.match(pageCode, /\{chatTotalCount\} \{text\.searchResults\}/);
  assert.doesNotMatch(pageCode, /chatTotalCount \|\| filteredConversations\.length/);

  const pagination = pageCode.indexOf("<ConversationPaginationFooter", listStart);
  assert.ok(listStart < pagination && pagination < listEnd);
});

test("bmReplyStatus badge is rendered per row separately from tag truncation", () => {
  const badge = getBmReplyStatusBadge("NOTIFIED_BM", {
    NOT_REPLIED: "ยังไม่ตอบ",
    NOTIFIED_BM: "แจ้ง BM แล้ว",
    REPLIED: "ตอบแล้ว",
  });
  assert.deepEqual(badge, {
    kind: "bmReplyStatus",
    status: "NOTIFIED_BM",
    label: "แจ้ง BM แล้ว",
  });

  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.match(activeRows, /data-conversation-bm-reply-status=\{currentBmReplyStatus\}/);
  assert.match(activeRows, /bmReplyStatusLabels\[language\]\[currentBmReplyStatus\]/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Explicit 17-Point Specification Verification
// ─────────────────────────────────────────────────────────────────────────────

test("1. INTERESTED appears on conversation cards", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "INTERESTED",
    interestLevel: null,
    purchaseChannel: null,
    paymentMethod: null,
    products: [],
  };
  const tags = getBmCustomerSalesTags(sales);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].kind, "salesStatus");
  assert.equal(tags[0].label, "INTERESTED");
  assert.match(getBmTagChipClass(tags[0]), /bg-blue-100.*text-blue-800/);
});

test("2. PURCHASED appears correctly", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "PURCHASED",
    interestLevel: null,
    purchaseChannel: null,
    paymentMethod: null,
    products: [],
  };
  const tags = getBmCustomerSalesTags(sales);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].kind, "salesStatus");
  assert.equal(tags[0].label, "PURCHASED");
  assert.match(getBmTagChipClass(tags[0]), /bg-emerald-100.*text-emerald-800/);
});

test("3. HOT / WARM / COLD mapping", () => {
  const levels = ["HOT", "WARM", "COLD"] as const;
  const expectedPatterns = [/bg-rose-100.*text-rose-800/, /bg-amber-100.*text-amber-800/, /bg-slate-100.*text-slate-700/];
  levels.forEach((level, i) => {
    const tags = getBmCustomerSalesTags({
      status: "INTERESTED",
      interestLevel: level,
      purchaseChannel: null,
      paymentMethod: null,
      products: [],
    });
    assert.equal(tags[1].kind, "interestLevel");
    assert.equal(tags[1].label, level);
    assert.match(getBmTagChipClass(tags[1]), expectedPatterns[i]);
  });
});

test("4. Product model appears", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "INTERESTED",
    interestLevel: null,
    purchaseChannel: null,
    paymentMethod: null,
    products: [
      {
        id: "prod-1",
        model: { id: "m-1", name: "OPPO Find X8 Pro", seriesName: "Find X Series", category: "SMARTPHONE" },
        variant: null,
        customProductName: null,
        quantity: 1,
        status: "INTERESTED",
      },
    ],
  };
  const tags = getBmCustomerSalesTags(sales);
  const modelTag = tags.find((t) => t.kind === "productModel");
  assert.ok(modelTag, "Product model tag must exist");
  assert.equal(modelTag.label, "OPPO Find X8 Pro");
  assert.match(getBmTagChipClass(modelTag), /bg-\[var\(--app-accent-soft\)\]/);
});

test("5. Product variant appears when available", () => {
  const sales: ApiCustomerSalesInformation = {
    status: "PURCHASED",
    interestLevel: null,
    purchaseChannel: null,
    paymentMethod: null,
    products: [
      {
        id: "prod-2",
        model: { id: "m-2", name: "OPPO Reno13", seriesName: "Reno Series", category: "SMARTPHONE" },
        variant: { id: "v-1", ram: "12GB", rom: "256GB", color: "Midnight Black" },
        customProductName: null,
        quantity: 1,
        status: "PURCHASED",
      },
    ],
  };
  const tags = getBmCustomerSalesTags(sales);
  const variantTag = tags.find((t) => t.kind === "productVariant");
  assert.ok(variantTag, "Product variant tag must exist");
  assert.equal(variantTag.label, "12GB / 256GB · Midnight Black");
});

test("6. STORE / ONLINE mapping", () => {
  const channels = ["STORE", "ONLINE"];
  channels.forEach((ch) => {
    const tags = getBmCustomerSalesTags({
      status: "PURCHASED",
      interestLevel: null,
      purchaseChannel: [ch],
      paymentMethod: null,
      products: [],
    });
    const chTag = tags.find((t) => t.kind === "purchaseChannel");
    assert.ok(chTag, `Channel ${ch} tag must exist`);
    assert.equal(chTag.label, ch);
  });
});

test("7. Payment method mapping", () => {
  const mappings: Array<["CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER", string]> = [
    ["CASH", "CASH"],
    ["INSTALLMENT", "INSTALLMENT"],
    ["CREDIT_CARD", "CREDIT CARD"],
    ["OTHER", "OTHER"],
  ];
  mappings.forEach(([raw, expected]) => {
    const tags = getBmCustomerSalesTags({
      status: "PURCHASED",
      interestLevel: null,
      purchaseChannel: null,
      paymentMethod: raw,
      products: [],
    });
    const pmTag = tags.find((t) => t.kind === "paymentMethod");
    assert.ok(pmTag, `Payment method ${raw} tag must exist`);
    assert.equal(pmTag.label, expected);
  });
});

test("8. BM tags appear in the detail header", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const headerStart = pageCode.indexOf("<header data-chat-detail-header");
  const headerEnd = pageCode.indexOf("</header>", headerStart);
  const activeHeader = pageCode.slice(headerStart, headerEnd);

  assert.match(activeHeader, /getBmCustomerSalesTags\(/);
  assert.match(activeHeader, /data-chat-detail-bm-tag=\{tag\.kind\}/);
  assert.match(activeHeader, /getBmTagChipClass\(tag\)/);
});

test("9. BM Reply Status remains visible", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(pageCode, /data-conversation-bm-reply-status=\{currentBmReplyStatus\}/);
  assert.match(pageCode, /data-bm-reply-status-select/);
});

test("10. BM Reply Status remains editable", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(pageCode, /updateBmReplyStatus\(e\.target\.value as ApiBmReplyStatus\)/);
  assert.match(pageCode, /updateConversationBmReplyStatus\(conversation\.id,\s*"REPLIED"\)/);
});

test("11. Follow Up tag no longer appears in the list tag area", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.doesNotMatch(activeRows, /getStatusLabel\(language,\s*status\)/);
  assert.doesNotMatch(activeRows, /followUpStatusLabels/);
});

test("12. Priority tag no longer appears in the list tag area", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.doesNotMatch(activeRows, /data-conversation-priority/);
  assert.doesNotMatch(activeRows, /conversation\.priority/);
});

test("13. AI Topic tag no longer appears in the list tag area", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.doesNotMatch(activeRows, /conversation\.topic/);
});

test("14. AI Product tag no longer appears in the list tag area", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const rowStart = pageCode.indexOf("filteredConversations.map");
  const rowEnd = pageCode.indexOf("<ConversationPaginationFooter", rowStart);
  const activeRows = pageCode.slice(rowStart, rowEnd);

  assert.doesNotMatch(activeRows, /conversation\.product/);
  assert.doesNotMatch(activeRows, /conversation\.series/);
});

test("15. AI Customer Stage no longer appears in the detail header", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const headerStart = pageCode.indexOf("<header data-chat-detail-header");
  const headerEnd = pageCode.indexOf("</header>", headerStart);
  const activeHeader = pageCode.slice(headerStart, headerEnd);

  assert.doesNotMatch(activeHeader, /customerStage/);
  assert.doesNotMatch(activeHeader, /customerIntelligence/);
  assert.doesNotMatch(activeHeader, /followUpStatusLabels/);
  assert.doesNotMatch(activeHeader, /selectedConversation\.priority/);
});

test("16. Conversation with no BM-entered information shows no fake/AI replacement tags", () => {
  const emptySales: ApiCustomerSalesInformation = {
    status: null,
    interestLevel: null,
    purchaseChannel: [],
    paymentMethod: null,
    products: [],
  };
  const tags = getBmCustomerSalesTags(emptySales);
  assert.deepEqual(tags, []);

  const nullTags = getBmCustomerSalesTags(null);
  assert.deepEqual(nullTags, []);

  const undefinedTags = getBmCustomerSalesTags(undefined);
  assert.deepEqual(undefinedTags, []);
});

test("17. Existing filters and analytics still work", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // Filters retain priority, status, topics, and date filtering
  assert.match(pageCode, /priority:\s*priorityFilter/);
  assert.match(pageCode, /status:\s*statusFilter/);
  assert.match(pageCode, /topic:\s*topicFilter/);
  assert.match(pageCode, /item\.followUpStatus/);
  assert.match(pageCode, /item\.priority/);
  assert.match(pageCode, /item\.topics/);
  assert.match(pageCode, /item\.products/);
});
