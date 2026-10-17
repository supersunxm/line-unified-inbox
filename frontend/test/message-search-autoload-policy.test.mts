import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoLoadNextMessagePage } from "../src/components/chats/message-search/message-search-autoload-policy.ts";
import type { MessageSearchState } from "../src/components/chats/message-search/message-search-state.ts";

function state(overrides: Partial<MessageSearchState> = {}): MessageSearchState {
  return {
    status: "loaded", items: [], hasMore: true, nextCursor: "next-page",
    loadingMore: false, error: null, requestId: 4, ...overrides,
  };
}

test("embedded search auto-loads each bounded cursor page instead of requiring a button", () => {
  assert.equal(shouldAutoLoadNextMessagePage(state(), 5000), true);
  assert.equal(shouldAutoLoadNextMessagePage(state({items: Array(49).fill({})}), 5000), true);
});

test("auto-loading stops on completion, in-flight state, failed append, missing cursor and budget", () => {
  assert.equal(shouldAutoLoadNextMessagePage(state({hasMore: false, nextCursor: null}), 5000), false);
  assert.equal(shouldAutoLoadNextMessagePage(state({loadingMore: true}), 5000), false);
  assert.equal(shouldAutoLoadNextMessagePage(state({error: "Search failed"}), 5000), false);
  assert.equal(shouldAutoLoadNextMessagePage(state({nextCursor: null}), 5000), false);
  assert.equal(shouldAutoLoadNextMessagePage(state({status: "loading"}), 5000), false);
  assert.equal(shouldAutoLoadNextMessagePage(state({items: Array(5000).fill({})}), 5000), false);
});

test("multiple partial pages eventually produce a complete count without manual pagination", () => {
  const loaded = state();
  for (let index = 0; index < 7; index += 1) {
    assert.equal(shouldAutoLoadNextMessagePage(loaded, 5000), true);
    loaded.items = [...loaded.items, ...Array(50).fill({})];
    loaded.nextCursor = String(index + 1);
  }
  loaded.items = [...loaded.items, ...Array(13).fill({})];
  loaded.hasMore = false;
  loaded.nextCursor = null;
  assert.equal(loaded.items.length, 363);
  assert.equal(shouldAutoLoadNextMessagePage(loaded, 5000), false);
});
