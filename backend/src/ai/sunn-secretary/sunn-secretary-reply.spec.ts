import assert from "node:assert/strict";
import test from "node:test";
import { formatSunnMonthlyReply } from "./sunn-secretary-reply";
import type { SecretaryMonthlyAnswer } from "./sunn-secretary-monthly";
const answer: SecretaryMonthlyAnswer = {
  month: "2026-10", totalUnansweredConversations: 3, storesWithUnanswered: 2,
  calculatedAt: "2026-10-08T03:00:00.000Z", source: "bm-reply-status-summary",
  stores: [{storeId:"1",storeName:"Central Pinklao",notReplied:2},{storeId:"2",storeName:"The Mall Bangkapi",notReplied:1}],
};
test("formats scoped metrics and says conversations not messages", () => {
  const result = formatSunnMonthlyReply(answer);
  assert.match(result, /2026-10/u);
  assert.match(result, /Central Pinklao: 2 แชท/u);
  assert.match(result, /3 บทสนทนา/u);
  assert.match(result, /24 ชั่วโมง/u);
});
test("does not format mismatched or unknown counts", () => {
  assert.throws(()=>formatSunnMonthlyReply({...answer,totalUnansweredConversations:4}),/unverifiable/u);
  assert.throws(()=>formatSunnMonthlyReply({...answer,storesWithUnanswered:3}),/unverifiable/u);
});
test("zero stores reports zero without invented names", () => {
  const text = formatSunnMonthlyReply({...answer,totalUnansweredConversations:0,storesWithUnanswered:0,stores:[]});
  assert.match(text,/ไม่มีร้าน/u);
  assert.doesNotMatch(text,/Central Pinklao/u);
});
test("customer content cannot inject new LINE lines via names", () => {
  const result = formatSunnMonthlyReply({...answer,stores:[{...answer.stores[0],storeName:"Central\nแอบอ้าง" },answer.stores[1]]});
  assert.match(result,/Central แอบอ้าง/u);
});
