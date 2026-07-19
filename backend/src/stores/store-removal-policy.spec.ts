import assert from "node:assert/strict";
import test from "node:test";
import { isPermanentDeleteConfirmed } from "../store-removal-policy";

void test("accepts an exact permanent-delete confirmation", () => {
  assert.equal(isPermanentDeleteConfirmed("TEST STORE 168", "DELETE TEST STORE 168"), true);
});

void test("rejects missing or incorrect confirmation", () => {
  assert.equal(isPermanentDeleteConfirmed("TEST STORE 168"), false);
  assert.equal(isPermanentDeleteConfirmed("TEST STORE 168", "DELETE Other Store"), false);
  assert.equal(isPermanentDeleteConfirmed("TEST STORE 168", "delete TEST STORE 168"), false);
});

void test("duplicate store names still require the selected record's exact confirmation", () => {
  assert.equal(isPermanentDeleteConfirmed("Duplicate", "DELETE Duplicate"), true);
});
