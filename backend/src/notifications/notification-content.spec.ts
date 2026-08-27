import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationContent,
  notificationBody,
  notificationTitle,
  normalizeNotificationText,
} from "./notification-content";

void test("text notifications include the customer, store, and normalized message", () => {
  assert.deepEqual(
    buildNotificationContent({
      customerName: " Somchai Jaidee ",
      storeName: " OPPO CentralWorld ",
      messageType: "TEXT",
      preview: " สนใจ OPPO Find X9 Pro ครับ\n\nมีของไหม ",
    }),
    {
      title: "Somchai Jaidee • OPPO CentralWorld",
      body: "สนใจ OPPO Find X9 Pro ครับ มีของไหม",
    },
  );
});

void test("media and unsupported notifications use safe readable fallbacks", () => {
  assert.equal(notificationBody("IMAGE", "private image URL"), "📷 ส่งรูปภาพ");
  assert.equal(notificationBody("VIDEO", "private video URL"), "🎥 ส่งวิดีโอ");
  assert.equal(notificationBody("STICKER", ""), "ส่งสติกเกอร์");
  assert.equal(notificationBody("FILE", "customer-file.pdf"), "ส่งไฟล์");
  assert.equal(notificationBody("UNSUPPORTED", "internal-id-123"), "ไม่สามารถแสดงข้อความจากลูกค้าได้");
});

void test("missing names omit broken separators and use the existing customer fallback", () => {
  assert.equal(notificationTitle("", ""), "LINE Customer");
  assert.equal(notificationTitle(null, "OPPO CentralWorld"), "LINE Customer • OPPO CentralWorld");
  assert.equal(notificationTitle("Somchai", null), "Somchai");
});

void test("notification text collapses whitespace and truncates long content", () => {
  const normalized = normalizeNotificationText(`  first\n\tsecond ${"x".repeat(200)}  `);
  assert.equal(normalized.length, 160);
  assert.equal(normalized.startsWith("first second"), true);
  assert.equal(normalized.endsWith("..."), true);
});
