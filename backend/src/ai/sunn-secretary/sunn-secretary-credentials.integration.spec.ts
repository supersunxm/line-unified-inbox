import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma.service";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { SunnSecretaryCredentialsService, SECRETARY_CREDENTIAL_RECORD_ID } from "./sunn-secretary-credentials.service";

const databaseUrl = process.env.SECRETARY_SETTINGS_TEST_DATABASE_URL;
test("durable isolated credentials: database encryption, concurrent partial changes, reload and token rotation race", {skip:!databaseUrl}, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["127.0.0.1","localhost"].includes(url.hostname),"Only a local fixture database is allowed");
  assert.ok(["/ci","/sunn_owner_credentials_test_20261008"].includes(url.pathname),"Only an explicit fixture database is allowed");
  const oldKey=process.env.CREDENTIAL_ENCRYPTION_KEY;
  process.env.CREDENTIAL_ENCRYPTION_KEY=randomBytes(32).toString("base64");
  const encryption=new CredentialEncryptionService();encryption.onModuleInit();
  const db=new PrismaService({datasourceUrl:databaseUrl});
  const ownerId=randomUUID();
  const secret="c".repeat(32);const token="isolatedSyntheticToken".repeat(4);const bot="U"+"c".repeat(32);
  const originalFetch=globalThis.fetch;
  let reload: PrismaService | null=null;
  let createdRecord=false;
  try {
    await db.$connect();
    // Never reuse an existing integration record or fixture belonging to another test.
    assert.equal(await db.lineOfficialAccount.findUnique({where:{id:SECRETARY_CREDENTIAL_RECORD_ID}}),null);
    await db.user.create({data:{id:ownerId,email:`${ownerId}@example.test`,normalizedEmail:`${ownerId}@example.test`,displayName:"Isolated credential test",role:"ADMIN"}});
    const before=await Promise.all([db.store.count(),db.customer.count(),db.message.count(),db.historicalTimelineMessage.count()]);
    const service=new SunnSecretaryCredentialsService(db,encryption);
    await service.save(ownerId,{channelId:"1234567890",channelSecret:secret,accessToken:token,botUserId:bot});
    createdRecord=true;
    const row=await db.lineOfficialAccount.findUniqueOrThrow({where:{id:SECRETARY_CREDENTIAL_RECORD_ID}});
    assert.equal(row.isActive,false);assert.equal(row.storeId,null);assert.ok(row.archivedAt);
    assert.notEqual(row.encryptedChannelSecret,secret);assert.notEqual(row.encryptedChannelAccessToken,token);
    await Promise.all([service.save(ownerId,{channelSecret:"d".repeat(32)}),service.save(ownerId,{accessToken:token+"rotated"})]);
    const concurrent=await db.lineOfficialAccount.findUniqueOrThrow({where:{id:row.id}});
    assert.equal(encryption.decrypt(concurrent.encryptedChannelSecret!),"d".repeat(32));
    assert.equal(encryption.decrypt(concurrent.encryptedChannelAccessToken!),token+"rotated");
    await db.$disconnect();
    reload=new PrismaService({datasourceUrl:databaseUrl});await reload.$connect();
    const afterRestart=new SunnSecretaryCredentialsService(reload,encryption);
    assert.equal((await afterRestart.status()).accessTokenConfigured,true);
    globalThis.fetch=async()=>new Response(JSON.stringify({userId:bot}),{status:200});
    assert.equal((await afterRestart.testConnection(ownerId)).tokenAndBotValidated,true);
    globalThis.fetch=async()=>new Response(JSON.stringify({userId:"U"+"e".repeat(32)}),{status:200});
    assert.equal((await afterRestart.testConnection(ownerId)).tokenAndBotValidated,false);
    // An in-flight test must never stamp a token rotated during the external request as verified.
    globalThis.fetch=async()=>{
      await afterRestart.save(ownerId,{accessToken:token+"secondRotation"});
      return new Response(JSON.stringify({userId:bot}),{status:200});
    };
    await assert.rejects(afterRestart.testConnection(ownerId),/changed/u);
    assert.equal((await afterRestart.status()).validationState,"NOT_VALIDATED");
    await Promise.all(Array.from({length:5},()=>afterRestart.consumeLimit(ownerId,"test")));
    await assert.rejects(afterRestart.consumeLimit(ownerId,"test"),/Too many/u);
    const unchanged=await Promise.all([reload.store.count(),reload.customer.count(),reload.message.count(),reload.historicalTimelineMessage.count()]);
    assert.deepEqual(unchanged,before);
    const audits=await reload.auditLog.findMany({where:{actorUserId:ownerId}});
    assert.doesNotMatch(JSON.stringify(audits),new RegExp(secret+"|"+token,"u"));
  } finally {
    globalThis.fetch=originalFetch;
    const clean=reload??db;
    // Only this local disposable fixture database and this test's rows are cleaned up.
    await clean.auditLog.deleteMany({where:{actorUserId:ownerId}});
    await clean.authRateLimitBucket.deleteMany({where:{key:{startsWith:`sunn-secretary:${ownerId}:`}}});
    if(createdRecord)await clean.lineOfficialAccount.deleteMany({where:{id:SECRETARY_CREDENTIAL_RECORD_ID,webhookKey:"sunn-secretary-credentials-v1"}});
    await clean.user.deleteMany({where:{id:ownerId}});
    await clean.$disconnect();
    if(oldKey===undefined)delete process.env.CREDENTIAL_ENCRYPTION_KEY;else process.env.CREDENTIAL_ENCRYPTION_KEY=oldKey;
  }
});
