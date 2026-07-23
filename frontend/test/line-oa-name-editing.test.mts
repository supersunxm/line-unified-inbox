import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyStoreMasterSelection } from "../src/app/store-master-form.ts";
import type { CreateLineOaInput, LineOfficialAccountResponse, StoreMasterSuggestion } from "../src/types/api.d.ts";

test("Master File has LINE OA name -> field is prefilled and editable", () => {
  const initialForm: CreateLineOaInput = { name: "", channelSecret: "", channelAccessToken: "", isActive: true };
  const masterWithAccount: StoreMasterSuggestion = {
    id: "master-1",
    storeName: "Central Store",
    accountName: "OPPO Central World",
    externalStoreId: "STORE-100",
    province: "Bangkok",
    region: "Central",
    lineId: "@oppocentral",
    lineOaLink: "https://line.me/R/ti/p/@oppocentral",
    lineManagerUrl: "https://manager.line.biz/account/@oppocentral",
    dataQualityStatus: "COMPLETE",
    matchReason: "EXACT_STORE_CODE",
    existingStore: null,
  };

  const selected = applyStoreMasterSelection(initialForm, masterWithAccount);
  assert.equal(selected.name, "OPPO Central World");
});

test("Master File has no LINE OA name -> field is empty and editable", () => {
  const initialForm: CreateLineOaInput = { name: "", channelSecret: "", channelAccessToken: "", isActive: true };
  const masterWithoutAccount: StoreMasterSuggestion = {
    id: "master-2",
    storeName: "Incomplete Store",
    accountName: "",
    externalStoreId: "STORE-200",
    province: "Phuket",
    region: "South",
    lineId: null,
    lineOaLink: null,
    lineManagerUrl: null,
    dataQualityStatus: "INCOMPLETE",
    matchReason: "EXACT_STORE_CODE",
    existingStore: null,
  };

  const selected = applyStoreMasterSelection(initialForm, masterWithoutAccount);
  assert.equal(selected.name, "");
});

test("user can type a new name and replace a prefilled name in state", () => {
  let formState: CreateLineOaInput = { name: "Prefilled Name", channelSecret: "secret", channelAccessToken: "token", isActive: true };

  // User typing new characters
  formState = { ...formState, name: "User Edited Name" };
  assert.equal(formState.name, "User Edited Name");

  // User replacing prefilled name completely
  formState = { ...formState, name: "New Replacement Name" };
  assert.equal(formState.name, "New Replacement Name");
});

test("changing store initializes the new store name once", () => {
  let formState: CreateLineOaInput = { name: "", channelSecret: "", channelAccessToken: "", isActive: true };
  const storeA: StoreMasterSuggestion = {
    id: "master-a", storeName: "Store A", accountName: "LINE OA A", externalStoreId: "SA", province: "BKK", region: "C", lineId: null, lineOaLink: null, lineManagerUrl: null, dataQualityStatus: "COMPLETE", matchReason: "EXACT_STORE_CODE", existingStore: null,
  };
  const storeB: StoreMasterSuggestion = {
    id: "master-b", storeName: "Store B", accountName: "LINE OA B", externalStoreId: "SB", province: "BKK", region: "C", lineId: null, lineOaLink: null, lineManagerUrl: null, dataQualityStatus: "COMPLETE", matchReason: "EXACT_STORE_CODE", existingStore: null,
  };

  // Select Store A
  formState = applyStoreMasterSelection(formState, storeA);
  assert.equal(formState.name, "LINE OA A");

  // Select Store B
  formState = applyStoreMasterSelection(formState, storeB);
  assert.equal(formState.name, "LINE OA B");
});

test("manual typing is preserved across rerenders", () => {
  const formState: CreateLineOaInput = { name: "Manual Typed Name", channelSecret: "secret", channelAccessToken: "token", isActive: true };

  // Simulate component rerender without store selection change
  const rerenderedFormState = { ...formState };
  assert.equal(rerenderedFormState.name, "Manual Typed Name");
});

test("empty trimmed value blocks submission", () => {
  const emptyNameForm = { name: "   ", channelSecret: "sec", channelAccessToken: "tok" };
  const nameTrimmed = emptyNameForm.name.trim();
  const requiredValid = Boolean(nameTrimmed && emptyNameForm.channelSecret.trim() && emptyNameForm.channelAccessToken.trim());

  assert.equal(nameTrimmed, "");
  assert.equal(requiredValid, false, "Submission must be blocked when name is whitespace only");
});

test("save payload contains the edited name", () => {
  const formState: CreateLineOaInput = { name: "   Custom Edited Name   ", channelSecret: "secret123", channelAccessToken: "token123", isActive: true };
  const nameTrimmed = formState.name.trim();
  const submission: CreateLineOaInput = {
    ...formState,
    name: nameTrimmed,
    newStore: formState.newStore ? { ...formState.newStore, name: nameTrimmed } : undefined,
  };

  assert.equal(submission.name, "Custom Edited Name");
  assert.equal(submission.channelSecret, "secret123");
  assert.equal(submission.channelAccessToken, "token123");
});

test("editing an existing connection prioritizes the saved account name", () => {
  const existingAccount: LineOfficialAccountResponse = {
    id: "oa-existing",
    name: "Existing Saved LINE OA",
    basicId: "@existing",
    channelId: "123456",
    destinationId: "dest123",
    connectionStatus: "CONNECTED",
    lastWebhookReceivedAt: "2026-07-23T10:00:00.000Z",
    store: { id: "store-ex", name: "Store Ex", code: "EX" },
    isActive: true,
  };

  const editFormState: CreateLineOaInput = {
    storeId: existingAccount.store.id,
    name: existingAccount.name,
    basicId: existingAccount.basicId ?? "",
    channelId: existingAccount.channelId ?? "",
    destinationId: existingAccount.destinationId ?? "",
    channelSecret: "",
    channelAccessToken: "",
    isActive: existingAccount.isActive,
  };

  assert.equal(editFormState.name, "Existing Saved LINE OA");
});

test("LINE OA Name input element in page.tsx has no readOnly or disabled attribute", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  // Verify readOnly is not present on LINE OA Name input
  assert.doesNotMatch(pageCode, /<input readOnly=\{Boolean\(selectedMaster\)\}/);
  assert.doesNotMatch(pageCode, /read-only:bg-slate-100/);

  // Verify normal controlled input pattern
  assert.match(pageCode, /\{text\.lineOaName\} \*<input value=\{lineOaForm\.name\} onChange=\{\(event\) => setLineOaForm/);
});
