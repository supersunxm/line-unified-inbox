import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { assertSunnSecretaryOwner } from "./sunn-secretary-owner-settings";
import { assertSecretaryMutation } from "./sunn-secretary-owner-settings.controller";
import { parseSecretaryCredentials, SECRETARY_CREDENTIAL_RECORD_ID, SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import type { PrismaService } from "../../prisma.service";
import type { AuthUser } from "../../auth/auth.guard";
import { LineOfficialAccountsService } from "../../line-official-accounts/line-official-accounts.service";

const secret = "a".repeat(32);
const token = "dedicatedSyntheticTokenOnly".repeat(3);
const bot = "U" + "b".repeat(32);
const valid = { channelId: "1234567890", channelSecret: secret, accessToken: token, botUserId: bot };

test("credential validation rejects unknown fields, invalid types, controls, URLs and missing changes", () => {
  assert.deepEqual(parseSecretaryCredentials(valid), valid);
  assert.deepEqual(parseSecretaryCredentials({ channelSecret: " ", accessToken: token }), { accessToken: token });
  for (const input of [null, [], {}, {oaId:"foreign"}, {accessToken:123}, {channelId:"https://example.com"}, {channelSecret:"x"}, {botUserId:"owner"}, {accessToken:"text\ncontent"}, {accessToken:"a".repeat(4097)}]) {
    assert.throws(() => parseSecretaryCredentials(input), /credential/u);
  }
});
test("owner gate rejects unauthenticated, other admin, inactive, assistant and impersonation", () => {
  const owner = { id: "canonical-owner", role: "ADMIN", isActive: true } as AuthUser;
  assert.doesNotThrow(() => assertSunnSecretaryOwner(owner, owner.id));
  for (const user of [undefined, {...owner,id:"other"}, {...owner,role:"ASSISTANT" as const}, {...owner,isActive:false}, {...owner,status:"SUSPENDED"}, {...owner,storeContext:{mode:"STORE" as const,storeId:"x",storeName:"X",storeCode:null}}]) {
    assert.throws(() => assertSunnSecretaryOwner(user, owner.id), /denied/u);
  }
  assert.throws(() => assertSunnSecretaryOwner(owner, undefined), /denied/u);
});
test("mutations require same-origin JSON, authenticated cookie, custom header and bounded payload", () => {
  const old = process.env.FRONTEND_URL; process.env.FRONTEND_URL = "https://lineoppo.click";
  const request = { headers: { origin:"https://lineoppo.click",cookie:"oppo_session=synthetic", "content-type":"application/json", "x-sunn-secretary-settings":"1" },query:{},rawBody:Buffer.from("{}") } satisfies Parameters<typeof assertSecretaryMutation>[0];
  try {
    assert.doesNotThrow(() => assertSecretaryMutation(request));
    for (const headers of [{...request.headers,origin:"https://evil.example"},{...request.headers,cookie:undefined},{...request.headers,"content-type":"text/plain"},{...request.headers,"x-sunn-secretary-settings":undefined},{...request.headers,"sec-fetch-site":"cross-site"}]) {
      assert.throws(() => assertSecretaryMutation({...request,headers}));
    }
    assert.throws(() => assertSecretaryMutation({...request,rawBody:Buffer.alloc(8193)}));
    assert.throws(() => assertSecretaryMutation({...request,query:{accessToken:token}}));
  } finally { if (old === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = old; }
});

test("encrypted save, partial preservation, rotation, generic error redaction and read-only bot test", async () => {
  const previous = process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const encryption = new CredentialEncryptionService(); encryption.onModuleInit();
  let row: Record<string, unknown> | null = null;
  const audits: unknown[] = [];
  const stored = (): Record<string, unknown> => row ?? {};
  const account = {
    findUnique: async () => row,
    create: async ({data}: {data:Record<string,unknown>}) => {row={...data,updatedAt:new Date()};return row;},
    update: async ({data}: {data:Record<string,unknown>}) => {row={...row,...data,updatedAt:new Date()};return row;},
    updateMany: async ({data}: {data:Record<string,unknown>}) => {row={...row,...data};return {count:1};},
  };
  const tx = { lineOfficialAccount:account, auditLog:{create:async (data:unknown)=>{audits.push(data);}} };
  const prisma = { ...tx, $transaction:async (fn:(client:typeof tx)=>Promise<unknown>) => fn(tx) } as unknown as PrismaService;
  const service = new SunnSecretaryCredentialsService(prisma,encryption);
  const previousFetch = globalThis.fetch;
  try {
    await assert.rejects(service.save("owner",{channelId:valid.channelId}), /four credentials/u);
    let status = await service.save("owner",valid);
    assert.equal(status.storage,"ENCRYPTED_DATABASE"); assert.equal(status.validationState,"NOT_VALIDATED");
    assert.equal(stored().isActive,false); assert.equal(stored().accountType,"HEAD_OFFICE"); assert.equal(stored().storeId,null);
    assert.doesNotMatch(JSON.stringify(row),new RegExp(secret+"|"+token,"u"));
    assert.doesNotMatch(JSON.stringify(status)+JSON.stringify(audits),new RegExp(secret+"|"+token,"u"));
    const storedSecret = stored().encryptedChannelSecret;
    const rotated = token + "new";
    await service.save("owner",{channelSecret:"",accessToken:rotated});
    assert.equal(stored().encryptedChannelSecret,storedSecret);
    assert.equal(encryption.decrypt(String(stored().encryptedChannelAccessToken)),rotated);
    globalThis.fetch = async (url,init) => {
      assert.equal(url,"https://api.line.me/v2/bot/info"); assert.equal(init?.method,undefined);
      assert.equal((init?.headers as Record<string,string>).Authorization,`Bearer ${rotated}`);
      return new Response(JSON.stringify({userId:bot}),{status:200});
    };
    const tested=await service.testConnection("owner"); assert.equal(tested.tokenAndBotValidated,true); assert.equal(tested.channelSecretValidated,false);
    assert.equal((await service.status()).validationState,"VALIDATED");
    globalThis.fetch = async () => new Response(JSON.stringify({message:token}),{status:401});
    status=await service.testConnection("owner"); assert.equal(status.validationState,"FAILED");
    assert.doesNotMatch(JSON.stringify(status)+JSON.stringify(audits),new RegExp(token,"u"));
    globalThis.fetch = async () => {throw new Error(token);};
    assert.equal((await service.testConnection("owner")).validationState,"FAILED");
    const reloaded = new SunnSecretaryCredentialsService(prisma,encryption);
    assert.equal((await reloaded.status()).accessTokenConfigured,true);
    row={...stored(),encryptedChannelAccessToken:"damaged"};
    await assert.rejects(service.status(),/cannot be read securely/u);
    await assert.rejects(service.save("owner",{channelId:valid.channelId}),error=>error instanceof Error && !error.message.includes(token));
  } finally {
    globalThis.fetch=previousFetch;
    if(previous===undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY; else process.env.CREDENTIAL_ENCRYPTION_KEY=previous;
  }
});
test("missing encryption key fails closed; generic OA APIs cannot operate on the dedicated record", async () => {
  const old=process.env.CREDENTIAL_ENCRYPTION_KEY; const oldLine=process.env.LINE_CREDENTIAL_ENCRYPTION_KEY;
  delete process.env.CREDENTIAL_ENCRYPTION_KEY; delete process.env.LINE_CREDENTIAL_ENCRYPTION_KEY;
  try { assert.throws(()=>new CredentialEncryptionService().onModuleInit(),/32 bytes/u); }
  finally {if(old!==undefined) process.env.CREDENTIAL_ENCRYPTION_KEY=old;if(oldLine!==undefined)process.env.LINE_CREDENTIAL_ENCRYPTION_KEY=oldLine;}
  const service = new LineOfficialAccountsService({} as PrismaService,{} as CredentialEncryptionService);
  for (const call of [() => service.remove(SECRETARY_CREDENTIAL_RECORD_ID), () => service.testConnection(SECRETARY_CREDENTIAL_RECORD_ID), () => service.credentialHealth(SECRETARY_CREDENTIAL_RECORD_ID), () => service.webhookInfo(SECRETARY_CREDENTIAL_RECORD_ID)]) await assert.rejects(call, /not found/u);
});
