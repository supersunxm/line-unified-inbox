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
  const result = await openLineOaManager({ managerUrl: "https://manager.line.biz/account/@oppo/chat", customerName: "Nattaya", copy: (value) => { copied.push(value); return Promise.resolve(); }, open: (...args) => opened.push(args) });
  assert.equal(result, "copied"); assert.deepEqual(copied, ["Nattaya"]); assert.deepEqual(opened, [["https://manager.line.biz/account/@oppo/chat", "_blank", "noopener,noreferrer"]]);
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

void test("switching conversations uses each selected store manager URL", async () => {
  const opened: string[] = [];
  for (const managerUrl of ["https://manager.line.biz/account/store-a", "https://manager.line.biz/account/store-b/messages"]) await openLineOaManager({ managerUrl, customerName: "Customer", copy: () => Promise.resolve(), open: (url) => opened.push(url) });
  assert.deepEqual(opened, ["https://manager.line.biz/account/store-a", "https://manager.line.biz/account/store-b/messages"]);
});

void test("conversation action reads the latest manager URL returned with its Store Master-backed store", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /managerUrl: selectedApiConversation\.resolvedLineOaManagerUrl/);
  assert.match(page, /lineManagerUrlStatus === "INVALID"/);
});

void test("store management and conversation detail consume backend-resolved manager URLs", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /account\.store\.lineManagerUrl/);
  assert.match(page, /selectedApiConversation\.resolvedLineOaManagerUrl/);
});
