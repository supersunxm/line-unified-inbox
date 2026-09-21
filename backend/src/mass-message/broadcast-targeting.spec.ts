import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFriendshipDemographicFilter,
  validateBroadcastMessages,
} from "./broadcast-targeting";

void test("180-364 plus 365+ normalizes to a single >=180 friendship filter", () => {
  assert.deepEqual(
    buildFriendshipDemographicFilter(["D180_364", "D365_PLUS"]),
    { type: "subscriptionPeriod", gte: "day_180" },
  );
});

void test("non-contiguous friendship periods preserve exact targeting with OR", () => {
  assert.deepEqual(
    buildFriendshipDemographicFilter(["LE_6", "D180_364"]),
    {
      type: "operator",
      or: [
        { type: "subscriptionPeriod", lt: "day_7" },
        { type: "subscriptionPeriod", gte: "day_180", lt: "day_365" },
      ],
    },
  );
});

void test("all six buckets never widen to unknown friendship duration", () => {
  assert.deepEqual(
    buildFriendshipDemographicFilter([
      "LE_6",
      "D7_29",
      "D30_89",
      "D90_179",
      "D180_364",
      "D365_PLUS",
    ]),
    {
      type: "operator",
      or: [
        { type: "subscriptionPeriod", lt: "day_365" },
        { type: "subscriptionPeriod", gte: "day_365" },
      ],
    },
  );
});

void test("broadcast message validation permits up to five text/image objects", () => {
  const messages = validateBroadcastMessages([
    { type: "text", text: "A" },
    { type: "text", text: "B" },
    { type: "image", originalContentUrl: "https://example.com/a.jpg", previewImageUrl: "https://example.com/a.jpg" },
    { type: "text", text: "C" },
    { type: "image", originalContentUrl: "https://example.com/b.jpg", previewImageUrl: "https://example.com/b.jpg" },
  ]);
  assert.equal(messages.length, 5);
  assert.throws(
    () => validateBroadcastMessages([...messages, { type: "text", text: "six" }]),
    /at most 5/,
  );
});


void test("broadcast message validation accepts Rich Message references", () => {
  const messages = validateBroadcastMessages([
    { type: "rich_message", richMessageId: "rich-123" },
  ]);
  assert.deepEqual(messages, [
    { type: "rich_message", richMessageId: "rich-123" },
  ]);
});

void test("broadcast message validation rejects missing Rich Message IDs", () => {
  assert.throws(
    () => validateBroadcastMessages([{ type: "rich_message", richMessageId: "   " }]),
    /Rich Message ID is required/,
  );
});
