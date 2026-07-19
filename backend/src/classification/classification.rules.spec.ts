import assert from "node:assert/strict";
import test from "node:test";
import { criticalKeywords, topicRules } from "./topic-rules";

const topics = (text: string) => topicRules.filter(({ keywords }) => keywords.some((keyword) => text.toLocaleLowerCase().includes(keyword))).map(({ name }) => name);

void test("Thai installment text is classified", () => assert.ok(topics("สนใจ Reno 16 แบบผ่อน").includes("Installment")));
void test("Thai stock and color text has both topics", () => assert.deepEqual(topics("Reno16 Pro สีขาวมีของไหม").filter((name) => name === "Color Availability" || name === "Stock Inquiry").sort(), ["Color Availability", "Stock Inquiry"]));
void test("Thai charging problem is classified", () => assert.ok(topics("A6 Pro ชาร์จไม่เข้า").includes("Charging Problem")));
void test("English stock question is classified", () => assert.ok(topics("Is Reno 16 in stock?").includes("Stock Inquiry")));
void test("Chinese price question is classified", () => assert.ok(topics("Find X9 多少钱？").includes("Price Inquiry")));
void test("critical safety terms are recognized", () => assert.ok(criticalKeywords.some((keyword) => "โทรศัพท์แบตบวมและมีควัน".includes(keyword))));
