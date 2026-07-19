import assert from "node:assert/strict";
import test from "node:test";
import { Priority, ProductRelationship, PurchaseIntent } from "@prisma/client";
import { classifyConversationText } from "./classification-engine";

void test("Thai buying language produces high intent and high priority", () => {
  const result = classifyConversationText("พร้อมซื้อ OPPO Reno16 สีขาว มีของไหม", true);
  assert.equal(result.purchaseIntent, PurchaseIntent.HIGH);
  assert.equal(result.priority, Priority.HIGH);
  assert.equal(result.productRelationship, ProductRelationship.INTERESTED);
});

void test("English price question produces medium intent", () => {
  const result = classifyConversationText("How much is the Find X9?", true);
  assert.equal(result.purchaseIntent, PurchaseIntent.MEDIUM);
  assert.ok(result.matchedRules.some(({ name }) => name === "Price Inquiry"));
});

void test("Simplified Chinese order language produces high intent", () => {
  const result = classifyConversationText("我想买 Find X9，可以下单吗？", true);
  assert.equal(result.purchaseIntent, PurchaseIntent.HIGH);
  assert.equal(result.priority, Priority.HIGH);
});

void test("after-sales language identifies a current owner", () => {
  const result = classifyConversationText("A6 Pro ชาร์จไม่เข้า ต้องซ่อม", true);
  assert.equal(result.purchaseIntent, PurchaseIntent.AFTER_SALES);
  assert.equal(result.productRelationship, ProductRelationship.CURRENT_OWNER);
  assert.equal(result.priority, Priority.HIGH);
});

void test("critical safety language overrides other priority suggestions", () => {
  assert.equal(classifyConversationText("โทรศัพท์มีควัน", false).priority, Priority.CRITICAL);
});
