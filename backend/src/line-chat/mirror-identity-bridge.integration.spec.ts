import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { LineChatMirrorReconcilerService } from "./line-chat-mirror-reconciler.service";
import { ConversationsController } from "../conversations.controller";
import type { AuthRequest } from "../auth/auth.guard";
import { MirrorIdentityBridgeService, validateBridgeManifest, type BridgeManifest } from "./mirror-identity-bridge.service";
import { bridgeHash } from "./mirror-identity-contract";

const url=process.env.MIRROR_IDENTITY_TEST_DATABASE_URL;
test("real PostgreSQL: strong proof, bidirectional conflicts, race, provenance, stale skip, idempotency and direct redirects",{skip:!url},async()=>{
  const db=new PrismaService({datasources:{db:{url}}});
  const prefix=randomUUID();const codes=Array.from({length:144},(_,i)=>`${prefix}-${i}`);const oldCodes=process.env.LINE_CHAT_MIRROR_STORE_CODES;
  const stores=codes.map((code,i)=>({id:`${prefix}-s${i}`,name:`Synthetic bridge ${i}`,code}));
  const bot=`U${"f".repeat(32)}`;
  const oas=stores.map((s,i)=>({id:`${prefix}-oa${i}`,storeId:s.id,name:s.name,basicId:`@${prefix}-${i}`,webhookKey:`${prefix}-wh${i}`,chatBotId:bot}));
  let serial=0;
  const chat=()=>`U${(++serial).toString(16).padStart(32,"0")}`;
  const service=new MirrorIdentityBridgeService(db);
  const request={user:{id:"synthetic"}} as AuthRequest;
  const controller=new ConversationsController({} as never,db,{} as never,{} as never,{assertConversationAccess:async()=>{}} as never,{} as never,{} as never);
  try {
    await db.store.createMany({data:stores});await db.lineOfficialAccount.createMany({data:oas});
    await db.lineChatMirrorStoreState.createMany({data:oas.map((o,i)=>({lineOfficialAccountId:o.id,storeId:stores[i].id,storeCode:codes[i],enabled:true,status:"SUCCESS",lastSuccessfulSyncAt:new Date()}))});
    process.env.LINE_CHAT_MIRROR_STORE_CODES=codes.join(",");
    const customer=await db.customer.create({data:{id:prefix,displayName:"Same synthetic name for all customers"}});
    const fixture=async(options:{oa?:number;status?:"IMPORTED"|"DUPLICATE"|"PENDING"|"WAITING_CANONICAL"|"SKIPPED";source?:string;historical?:boolean;existing?:string;wrongStore?:boolean;manager?:string}={})=>{
      const i=options.oa??0;const manager=options.manager??chat();const event=`${prefix}-event-${serial}-${randomUUID()}`;
      const c=await db.conversation.create({data:{customerId:customer.id,storeId:stores[options.wrongStore?i+1:i].id,lineOfficialAccountId:oas[i].id,latestMessageAt:new Date(),lineChatUserId:options.existing??null,customerSalesStatus:"ONLINE",onlineSource:"Facebook"}});
      const p=await db.message.create({data:{conversationId:c.id,externalMessageId:`line-chat-manager:${event}`,direction:"OUTBOUND",messageType:"TEXT",originalText:"Synthetic fixture only",sentAt:new Date(),rawPayload:{source:options.historical?"HISTORICAL":"LINE_MANAGER_MIRROR",managerMessageId:event}}});
      const m=await db.lineChatMirrorMessage.create({data:{lineOfficialAccountId:oas[i].id,lineChatUserId:manager,managerMessageId:event,eventType:"messageSent",direction:"OUTBOUND",sentAt:p.sentAt,reconcileStatus:options.status??"IMPORTED",reconcileSource:options.source??"IMPORTED_OUTBOUND",reconciledAt:new Date(),canonicalConversationId:c.id,canonicalMessageId:p.id}});
      return {c,p,m,manager,i};
    };
    const proven=await fixture();
    const manifest=await service.buildManifest();validateBridgeManifest(manifest);
    assert.equal(manifest.rows.length,1);
    assert.equal(manifest.rows[0].previousLineChatUserId,null);
    assert.throws(()=>validateBridgeManifest({...manifest,rowSetSha256:bridgeHash("tampered")}),/INVALID_BRIDGE_MANIFEST/);
    assert.equal((await service.processManifest(manifest,false)).results[0].result,"WOULD_APPLY");
    assert.equal((await service.processManifest(manifest,true)).writes,1);
    const saved=await db.conversation.findUniqueOrThrow({where:{id:proven.c.id}});
    assert.equal(saved.lineChatUserId,proven.manager);assert.equal(saved.lineChatMappingSource,"LIVE_MIRROR_RECONCILED");assert.equal(saved.lineChatMappedById,null);assert.ok(saved.lineChatMappedAt);
    assert.equal(saved.onlineSource,"Facebook");assert.equal(saved.customerSalesStatus,"ONLINE");assert.equal(saved.bmReplyStatus,proven.c.bmReplyStatus);assert.equal(saved.ownerUserId,proven.c.ownerUserId);
    assert.equal((await service.processManifest(manifest,true)).writes,0);
    assert.deepEqual(await controller.lineOaManagerUrl(saved.id,request),{url:`https://chat.line.biz/${bot}/chat/${proven.manager}`,direct:true});
    assert.deepEqual(await controller.openLineOaManager(saved.id,request),{url:`https://chat.line.biz/${bot}/chat/${proven.manager}`,statusCode:302});
    assert.equal(await service.linkReconciled(proven.m.id),"ALREADY_LINKED");
    const before=await db.conversation.findUniqueOrThrow({where:{id:saved.id}});
    assert.deepEqual(before,saved,"no-op does not change provenance or timestamps");

    const continuous=await fixture({oa:1,manager:proven.manager,status:"PENDING"});
    const reconciler=new LineChatMirrorReconcilerService(db);
    await (reconciler as unknown as {markMirror:(id:string,input:{status:"IMPORTED";conversationId:string;messageId:string;source:string},apply:boolean)=>Promise<void>}).markMirror(continuous.m.id,{status:"IMPORTED",conversationId:continuous.c.id,messageId:continuous.p.id,source:"IMPORTED_OUTBOUND"},true);
    assert.equal((await db.conversation.findUniqueOrThrow({where:{id:continuous.c.id}})).lineChatUserId,proven.manager,"continuous hook links same chat ID independently under another OA");
    assert.equal(await service.linkReconciled(continuous.m.id),"ALREADY_LINKED");
    const different=await fixture({existing:chat()});
    assert.equal(await service.linkReconciled(different.m.id),"EXISTING_MAPPING_CONFLICT");
    assert.equal((await db.conversation.findUniqueOrThrow({where:{id:different.c.id}})).lineChatUserId,different.c.lineChatUserId);
    const owned=await fixture();
    await db.conversation.create({data:{customerId:customer.id,storeId:stores[0].id,lineOfficialAccountId:oas[0].id,lineChatUserId:owned.manager,latestMessageAt:new Date()}});
    assert.equal(await service.linkReconciled(owned.m.id),"EXISTING_MAPPING_CONFLICT");
    const twoIds=await fixture();
    await db.lineChatMirrorMessage.create({data:{lineOfficialAccountId:oas[0].id,lineChatUserId:chat(),managerMessageId:randomUUID(),eventType:"messageSent",direction:"OUTBOUND",sentAt:new Date(),canonicalConversationId:twoIds.c.id,reconcileStatus:"WAITING_CANONICAL"}});
    assert.equal(await service.linkReconciled(twoIds.m.id),"MULTIPLE_MANAGER_IDS_FOR_CONVERSATION");
    const twoConvs=await fixture();const another=await fixture({manager:twoConvs.manager});
    assert.equal(await service.linkReconciled(another.m.id),"MULTIPLE_CONVERSATIONS_FOR_MANAGER_ID");
    const cases=[{status:"PENDING" as const},{status:"WAITING_CANONICAL" as const},{status:"SKIPPED" as const},{status:"DUPLICATE" as const,source:"CONTENT_TIME_MATCH"},{status:"DUPLICATE" as const,source:"EXACT_EXTERNAL_ID",historical:true},{wrongStore:true}];
    for(const options of cases){const f=await fixture(options);assert.notEqual(await service.linkReconciled(f.m.id),"APPLIED");assert.equal((await db.conversation.findUniqueOrThrow({where:{id:f.c.id}})).lineChatUserId,null);}

    const stale=await fixture({oa:2});const frozen=await service.buildManifest();
    const justStale:BridgeManifest={...frozen,rows:frozen.rows.filter(r=>r.canonicalConversationId===stale.c.id),rowSetSha256:""};
    const {canonicalBridgeRows}=await import("./mirror-identity-bridge.service");justStale.rowSetSha256=bridgeHash(canonicalBridgeRows(justStale.rows));
    await db.lineChatMirrorMessage.update({where:{id:stale.m.id},data:{reconcileStatus:"FAILED"}});
    assert.equal((await service.processManifest(justStale,true)).writes,0);
    assert.equal((await db.conversation.findUniqueOrThrow({where:{id:stale.c.id}})).lineChatUserId,null);

    const race=await fixture({oa:3});let injected=false;
    const racing=db.$extends({query:{conversation:{async updateMany({args,query}){if(!injected){injected=true;await db.conversation.create({data:{customerId:customer.id,storeId:stores[3].id,lineOfficialAccountId:oas[3].id,lineChatUserId:race.manager,latestMessageAt:new Date()}});}return query(args);}}}});
    assert.equal(await new MirrorIdentityBridgeService(racing as unknown as PrismaService).linkReconciled(race.m.id),"CONCURRENT_MAPPING_CONFLICT");
    assert.equal((await db.conversation.findUniqueOrThrow({where:{id:race.c.id}})).lineChatUserId,null,"legacy competing writer cannot race bridge uniqueness");
    const index=await db.$queryRaw<Array<{indisvalid:boolean}>>`SELECT indisvalid FROM pg_index JOIN pg_class ON pg_class.oid=indexrelid WHERE relname='Conversation_oa_chat_identity_key'`;
    assert.equal(index[0]?.indisvalid,true);
    const queued=await fixture({oa:4});
    const job=await db.lineChatNicknameSyncJob.create({data:{conversationId:queued.c.id,lineOfficialAccountId:oas[4].id,nickname:"Synthetic local fixture",status:"PENDING"}});
    assert.equal(await service.linkReconciled(queued.m.id),"ACTIVE_MANAGER_WRITE_JOB_HELD");
    assert.deepEqual(await db.lineChatNicknameSyncJob.findUniqueOrThrow({where:{id:job.id}}),job,"bridge cannot modify or unlock queued Manager jobs");
    await db.lineChatNicknameSyncJob.delete({where:{id:job.id}});
    const unguarded=await fixture({oa:5});
    await db.$executeRawUnsafe('DROP INDEX "Conversation_oa_chat_identity_key"');
    try { assert.equal(await service.linkReconciled(unguarded.m.id),"UNIQUENESS_CONSTRAINT_REQUIRED");assert.equal((await db.conversation.findUniqueOrThrow({where:{id:unguarded.c.id}})).lineChatUserId,null); }
    finally { await db.$executeRawUnsafe('CREATE UNIQUE INDEX "Conversation_oa_chat_identity_key" ON "Conversation" ("lineOfficialAccountId","lineChatUserId")'); }
    assert.equal(await db.nicknameSourceApplication.count(),0,"identity bridge never applies a Source Tag");

    const fallbackController=new ConversationsController({} as never,db,{} as never,{} as never,{assertConversationAccess:async()=>{}} as never,{} as never,{} as never);
    Object.defineProperty(fallbackController,"resolveDirectLineOaManagerUrlOnDemand",{value:async()=>null});
    const fallback=await fixture({status:"PENDING"});
    assert.deepEqual(await fallbackController.lineOaManagerUrl(fallback.c.id,request),{url:null,direct:false});
    const redirected=await fallbackController.openLineOaManager(fallback.c.id,request);
    assert.equal(redirected.statusCode,302);assert.ok(redirected.url.startsWith("https://"));
  } finally {
    await db.lineChatMirrorMessage.deleteMany({where:{lineOfficialAccountId:{in:oas.map(o=>o.id)}}});
    await db.conversation.deleteMany({where:{customerId:prefix}});await db.customer.deleteMany({where:{id:prefix}});
    await db.lineChatMirrorStoreState.deleteMany({where:{lineOfficialAccountId:{in:oas.map(o=>o.id)}}});await db.lineOfficialAccount.deleteMany({where:{id:{in:oas.map(o=>o.id)}}});await db.store.deleteMany({where:{id:{in:stores.map(s=>s.id)}}});
    if(oldCodes===undefined)delete process.env.LINE_CHAT_MIRROR_STORE_CODES;else process.env.LINE_CHAT_MIRROR_STORE_CODES=oldCodes;
    await db.$disconnect();
  }
});
