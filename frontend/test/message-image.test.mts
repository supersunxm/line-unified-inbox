import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../src/app/message-image.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("conversation list uses the localized image summary", () => {
  assert.match(page, /latestMessage\?\.messageType === "IMAGE"/);
  assert.match(page, /📷 รูปภาพ/);
});

test("ready image renders an authenticated thumbnail through the approved endpoint", () => {
  assert.match(component, /messageMediaUrl\(messageId\)/);
  assert.match(component, /credentials: "include"/);
  assert.match(component, /message-image-thumbnail/);
  assert.match(component, /<Image[\s\S]*alt=\{alt\}/);
});

test("historical, failed, and loading image states render dedicated placeholders", () => {
  assert.match(component, /if \(!media\).*unavailableLabel/);
  assert.match(component, /processingStatus === "PENDING"/);
  assert.match(component, /processingStatus === "FAILED"/);
  assert.match(component, /processingStatus === "SKIPPED"/);
  assert.match(page, /รูปภาพไม่ได้ถูกจัดเก็บในระบบ/);
});

test("lightbox opens by click and closes by button, backdrop, or Escape", () => {
  assert.match(component, /setLightboxOpen\(true\)/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /onClick=\{close\}/);
});
