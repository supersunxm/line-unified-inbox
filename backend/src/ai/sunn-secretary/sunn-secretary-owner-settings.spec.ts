import assert from "node:assert/strict";
import test from "node:test";
import { assertSunnSecretaryOwner, sunnSecretarySetupStatus } from "./sunn-secretary-owner-settings";
import type { AuthUser } from "../../auth/auth.guard";

const admin = {id:"owner-id", role:"ADMIN",isActive:true} as AuthUser;
test("canonical owner ID and HQ admin required", () => {
  assert.doesNotThrow(()=>assertSunnSecretaryOwner(admin,"owner-id"));
  assert.throws(()=>assertSunnSecretaryOwner(admin,undefined),/denied/u);
  assert.throws(()=>assertSunnSecretaryOwner(admin,"different-user"),/denied/u);
  assert.throws(()=>assertSunnSecretaryOwner({...admin,role:"ASSISTANT"}, "owner-id"),/denied/u);
  assert.throws(()=>assertSunnSecretaryOwner({...admin,isActive:false}, "owner-id"),/denied/u);
  assert.throws(()=>assertSunnSecretaryOwner({...admin,storeContext:{mode:"STORE",storeId:"x",storeName:"X",storeCode:null}},"owner-id"),/denied/u);
});
test("status returns configuration booleans, not secret values", () => {
  const result = sunnSecretarySetupStatus({
    SUNN_SECRETARY_CHANNEL_ID:"12345", SUNN_SECRETARY_CHANNEL_SECRET:"should-never-leak",
    SUNN_SECRETARY_CHANNEL_ACCESS_TOKEN:"private-token",SUNN_SECRETARY_BOT_USER_ID:"U"+"a".repeat(32),
    SUNN_SECRETARY_WEBHOOK_ENABLED:"false",
  } as NodeJS.ProcessEnv);
  assert.equal(result.channelSecretConfigured,true);
  assert.equal(result.accessTokenConfigured,true);
  assert.equal(result.webhookEnabled,false);
  assert.doesNotMatch(JSON.stringify(result),/should-never-leak|private-token/u);
});
