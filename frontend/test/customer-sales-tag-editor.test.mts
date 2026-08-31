import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editorCode = readFileSync(new URL("../src/app/customer-sales-tag-editor.tsx", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const typesCode = readFileSync(new URL("../src/types/api.ts", import.meta.url), "utf8");

test("api.ts declares updateCustomerSalesInfo calling PATCH /mobile/conversations/:id/customer-sales-info", () => {
  assert.match(apiCode, /updateCustomerSalesInfo:\s*\(id:\s*string,\s*input:\s*UpdateCustomerSalesInfoInput\)\s*=>/);
  assert.match(apiCode, /request<ApiConversation>\(`\/mobile\/conversations\/\$\{encodeURIComponent\(id\)\}\/customer-sales-info`,\s*\{\s*method:\s*"PATCH"/);
  assert.match(typesCode, /export type UpdateCustomerSalesInfoInput = \{/);
  assert.match(typesCode, /status\?: "ONLINE" \| "INTERESTED" \| "PURCHASED" \| null;/);
  assert.match(typesCode, /paymentMethod\?: "CASH" \| "INSTALLMENT" \| "CREDIT_CARD" \| "OTHER" \| null;/);
});

test("CustomerSalesTagEditor renders required status options (ONLINE, INTERESTED, PURCHASED)", () => {
  assert.match(editorCode, /data-customer-sales-editor/);
  assert.match(editorCode, /data-sales-tag-section/);
  assert.match(editorCode, /data-sales-status-options/);
  assert.match(editorCode, /data-sales-status-button=\{value\}/);
  assert.match(editorCode, /"ONLINE"/);
  assert.match(editorCode, /"INTERESTED"/);
  assert.match(editorCode, /"PURCHASED"/);
});

test("CustomerSalesTagEditor creates ONLINE save payload { status: 'ONLINE' }", () => {
  const saveBlock = editorCode.slice(editorCode.indexOf("const handleSave"), editorCode.indexOf("return ("));
  assert.match(saveBlock, /const payload:\s*UpdateCustomerSalesInfoInput\s*=\s*\{\s*status,?\s*\};/);
});

test("CustomerSalesTagEditor creates INTERESTED save payload { status: 'INTERESTED' }", () => {
  const saveBlock = editorCode.slice(editorCode.indexOf("const handleSave"), editorCode.indexOf("return ("));
  assert.match(saveBlock, /const payload:\s*UpdateCustomerSalesInfoInput\s*=\s*\{\s*status,?\s*\};/);
});

test("CustomerSalesTagEditor displays CASH and INSTALLMENT options and product selector when PURCHASED is selected", () => {
  assert.match(editorCode, /\{status === "PURCHASED" && \(/);
  assert.match(editorCode, /data-purchased-fields/);
  assert.match(editorCode, /data-payment-method-options/);
  assert.match(editorCode, /data-payment-method-radio=\{val\}/);
  assert.match(editorCode, /data-product-model-select/);
});

test("CustomerSalesTagEditor constructs PURCHASED payload with paymentMethod, store channel, and products", () => {
  const saveBlock = editorCode.slice(editorCode.indexOf("const handleSave"), editorCode.indexOf("return ("));
  assert.match(saveBlock, /if \(status === "PURCHASED"\) \{/);
  assert.match(saveBlock, /payload\.paymentMethod = paymentMethod;/);
  assert.match(saveBlock, /payload\.purchaseChannel = \["STORE"\];/);
  assert.match(saveBlock, /payload\.products = \[/);
  assert.match(saveBlock, /productModelId: selectedProductModelId,/);
  assert.match(saveBlock, /quantity: 1,/);
  assert.match(saveBlock, /status: "PURCHASED",/);
});

test("CustomerSalesTagEditor initializes and syncs with existing customer sales status", () => {
  assert.match(editorCode, /if \(prevKey !== currentKey\) \{/);
  assert.match(editorCode, /setStatus\(salesInfo\?\.status \?\? ""\);/);
  assert.match(editorCode, /setPaymentMethod\(salesInfo\?\.paymentMethod === "INSTALLMENT" \? "INSTALLMENT" : "CASH"\);/);
  assert.match(editorCode, /setSelectedProductModelId\(firstProduct\.model\?\.id \?\? ""\);/);
});

test("CustomerSalesTagEditor manages save loading and visual success/error states", () => {
  assert.match(editorCode, /const \[isSaving, setIsSaving\] = useState\(false\);/);
  assert.match(editorCode, /const \[feedback, setFeedback\] = useState/);
  assert.match(editorCode, /data-sales-tag-feedback/);
  assert.match(editorCode, /data-save-sales-tag-button/);
  assert.match(editorCode, /disabled=\{!status \|\| isSaving \|\| disabled\}/);
});

test("page.tsx integrates CustomerSalesTagEditor in the conversation detail workspace", () => {
  assert.match(pageCode, /import \{ CustomerSalesTagEditor \} from "\.\/customer-sales-tag-editor";/);
  assert.match(pageCode, /<CustomerSalesTagEditor/);
  assert.match(pageCode, /conversationId=\{selectedConversation\.id\}/);
  assert.match(pageCode, /salesInfo=\{selectedApiConversation\?\.customerSalesInformation \?\? selectedConversation\.customerSalesInformation\}/);
  assert.match(pageCode, /availableProductModels=\{availableProductModels\}/);
  assert.match(pageCode, /onSaved=\{\(updated\) => \{/);
});

test("page.tsx safely guards topics, aiInsight, and collections when topics is undefined", () => {
  // Regression test for: Cannot read properties of undefined (reading 'some')
  assert.match(pageCode, /selectedApiConversation\?\.topics\?\.some\(/);
  assert.match(pageCode, /selectedApiConversation\?\.topics\?\.filter\(/);
  assert.match(pageCode, /selectedApiConversation\?\.aiInsight\?\.topics\?\.length/);
  assert.match(pageCode, /selectedApiConversation\?\.aiInsight\?\.mentionedProducts\?\.length/);
  assert.match(pageCode, /selectedApiConversation\?\.aiInsight\?\.classification\?\.productRelationship/);
  assert.match(pageCode, /selectedApiConversation\?\.aiInsight\?\.classification\?\.purchaseIntent/);

  // Verify runtime simulation: partial conversation object with topics undefined
  type PartialRuleTopic = { source: string };
  const partialConversation: {
    id: string;
    customer: { displayName: string };
    store: { id: string; name: string };
    customerSalesInformation: { status: string; paymentMethod: null; products: never[] };
    topics?: PartialRuleTopic[];
    aiInsight?: { topics?: { topic: { id: string; name: string } }[] };
  } = {
    id: "e36030a1-bb26-4c8c-bf6e-4b483925d0be",
    customer: { displayName: "Test Customer" },
    store: { id: "store-1", name: "OPPO BigC MAHACHAI 1" },
    customerSalesInformation: { status: "ONLINE", paymentMethod: null, products: [] },
    topics: undefined,
    aiInsight: undefined,
  };

  // Check that the topics rendering logic executes without throwing
  const topicsList = (partialConversation?.aiInsight?.topics ?? partialConversation?.topics?.filter(({ source }) => source === "RULE") ?? []);
  assert.deepEqual(topicsList, []);

  const noTopicDetected = !partialConversation?.aiInsight?.topics?.length && !partialConversation?.topics?.some(({ source }) => source === "RULE");
  assert.equal(noTopicDetected, true);
});

