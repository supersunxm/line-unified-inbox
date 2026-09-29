import assert from "node:assert/strict";
import test from "node:test";
import { BmReplyStatus } from "@prisma/client";
import { resolveEffectiveReplyState } from "./reply-state-effective";

void test("projection REPLIED overrides legacy NOT_REPLIED", () => {
  assert.deepEqual(
    resolveEffectiveReplyState({
      bmReplyStatus: BmReplyStatus.NOT_REPLIED,
      projectionState: "REPLIED",
    }),
    { state: "REPLIED", source: "PROJECTION" },
  );
});

void test("projection NOT_REPLIED overrides legacy REPLIED", () => {
  assert.deepEqual(
    resolveEffectiveReplyState({
      bmReplyStatus: BmReplyStatus.REPLIED,
      projectionState: "NOT_REPLIED",
    }),
    { state: "NOT_REPLIED", source: "PROJECTION" },
  );
});

void test("legacy REPLIED remains REPLIED when no trusted projection exists", () => {
  assert.deepEqual(
    resolveEffectiveReplyState({
      bmReplyStatus: BmReplyStatus.REPLIED,
      projectionState: null,
    }),
    { state: "REPLIED", source: "LEGACY_FALLBACK" },
  );
});

void test("legacy NOT_REPLIED remains NOT_REPLIED when no trusted projection exists", () => {
  assert.deepEqual(
    resolveEffectiveReplyState({
      bmReplyStatus: BmReplyStatus.NOT_REPLIED,
      projectionState: null,
    }),
    { state: "NOT_REPLIED", source: "LEGACY_FALLBACK" },
  );
});

void test("legacy NOTIFIED_BM collapses to NOT_REPLIED for two-state read path", () => {
  assert.deepEqual(
    resolveEffectiveReplyState({
      bmReplyStatus: BmReplyStatus.NOTIFIED_BM,
      projectionState: null,
    }),
    { state: "NOT_REPLIED", source: "LEGACY_FALLBACK" },
  );
});
