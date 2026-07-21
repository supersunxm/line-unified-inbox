import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { openLineOaManager, validLineOaManagerUrl } from "../src/app/line-oa-manager.ts";

void test("translation button remains a dedicated original/translated toggle", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /onClick=\{\(\) => setShowTranslation\(!showTranslation\)\}/);
  assert.match(page, /showTranslation\s*\? text\.showOriginal\s*:\s*text\.translateMessage/);
});

void test("manager action copies the customer and opens the exact stored URL safely", async () => {
  const copied: string[] = []; const opened: string[][] = [];
  const result = await openLineOaManager({ managerUrl: "https://manager.line.biz/account/@oppo", customerName: "Nattaya", copy: (value) => { copied.push(value); return Promise.resolve(); }, open: (...args) => opened.push(args) });
  assert.equal(result, "copied"); assert.deepEqual(copied, ["Nattaya"]); assert.deepEqual(opened, [["https://manager.line.biz/account/@oppo", "_blank", "noopener,noreferrer"]]);
});

void test("store manager link opens while chat URLs are ignored", async () => {
  const opened: string[] = [];
  const result = await openLineOaManager({ managerUrl: "https://manager.line.biz/account/26197", customerName: "Customer", copy: () => Promise.resolve(), open: (url) => opened.push(url) });
  const ignoredChat = await openLineOaManager({ managerUrl: "https://chat.line.biz/U1234567890abcdef", customerName: "Customer", copy: () => Promise.resolve(), open: (url) => opened.push(url) });
  assert.equal(result, "copied"); assert.equal(ignoredChat, "missing");
  assert.deepEqual(opened, ["https://manager.line.biz/account/26197"]);
});

void test("both missing produces the missing-link result without opening a tab", async () => {
  let opened = false;
  const result = await openLineOaManager({ managerUrl: null, customerName: "Customer", copy: () => Promise.resolve(), open: () => { opened = true; } });
  assert.equal(result, "missing");
  assert.equal(opened, false);
});

void test("clipboard failure still opens the manager account", async () => {
  let opened = false; const result = await openLineOaManager({ managerUrl: "https://manager.line.biz/account/@oppo", customerName: "Customer", copy: () => Promise.reject(new Error("denied")), open: () => { opened = true; } });
  assert.equal(result, "copy-failed"); assert.equal(opened, true);
});

void test("missing and invalid manager URLs are blocked", async () => {
  for (const url of [null, "http://manager.line.biz/account/x", "https://evil.example/account/x", "not-a-url"]) {
    let opened = false; const result = await openLineOaManager({ managerUrl: url, customerName: "Customer", copy: () => Promise.resolve(), open: () => { opened = true; } });
    assert.equal(result, "missing"); assert.equal(opened, false);
  }
  assert.equal(validLineOaManagerUrl("https://manager.line.biz/account/x"), "https://manager.line.biz/account/x");
});

void test("switching conversations uses each resolved URL without retaining the previous store", async () => {
  const opened: string[] = [];
  for (const managerUrl of ["https://manager.line.biz/account/store-a", "https://manager.line.biz/account/store-b"]) await openLineOaManager({ managerUrl, customerName: "Customer", copy: () => Promise.resolve(), open: (url) => opened.push(url) });
  assert.deepEqual(opened, ["https://manager.line.biz/account/store-a", "https://manager.line.biz/account/store-b"]);
});

void test("conversation action uses only the backend-resolved manager URL field", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /managerUrl: selectedApiConversation\.resolvedLineOaManagerUrl,/);
  assert.doesNotMatch(page, /resolvedLineOa(?:Chat|Open)Url/);
  assert.match(page, /lineManagerUrlStatus === "INVALID"/);
});

void test("store management and conversation detail consume backend-resolved manager URLs", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /account\.store\.lineManagerUrl/);
  assert.match(page, /selectedApiConversation\.resolvedLineOaManagerUrl/);
});
