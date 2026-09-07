import assert from "node:assert/strict";
import test from "node:test";
import {
  getLineChatManagerRelayEnabledStoreCodes,
  getLineChatManagerRelayStoreConfig,
  isLineChatManagerRelayStoreEnabled,
} from "./line-chat-pilot.constants";

test("manager relay defaults to Chonburi only", () => {
  assert.deepEqual([...getLineChatManagerRelayEnabledStoreCodes("")], ["28375"]);
  assert.equal(isLineChatManagerRelayStoreEnabled("28375", ""), true);
  assert.equal(isLineChatManagerRelayStoreEnabled("25610", ""), false);
});

test("manager relay enables only known rollout stores from CSV config", () => {
  const raw = "28375,25610,27627,unknown, 25391 ";
  assert.deepEqual(
    [...getLineChatManagerRelayEnabledStoreCodes(raw)],
    ["28375", "25610", "27627", "25391"],
  );
  assert.equal(isLineChatManagerRelayStoreEnabled("25610", raw), true);
  assert.equal(isLineChatManagerRelayStoreEnabled("unknown", raw), false);
});

test("Phase 2 stores use account-1 while Chonburi remains profile-b", () => {
  assert.equal(getLineChatManagerRelayStoreConfig("28375")?.sessionKey, "profile-b");
  assert.equal(getLineChatManagerRelayStoreConfig("25610")?.sessionKey, "account-1");
  assert.equal(getLineChatManagerRelayStoreConfig("27627")?.sessionKey, "account-1");
  assert.equal(getLineChatManagerRelayStoreConfig("25391")?.sessionKey, "account-1");
  assert.equal(getLineChatManagerRelayStoreConfig("24804")?.sessionKey, "account-1");
  assert.equal(getLineChatManagerRelayStoreConfig("27789")?.sessionKey, "account-1");
  assert.equal(getLineChatManagerRelayStoreConfig("3791")?.sessionKey, "account-1");
});
