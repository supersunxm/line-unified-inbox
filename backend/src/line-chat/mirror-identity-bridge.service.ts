import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import { BRIDGE_CLASSES, bridgeHash, classifyMirrorBridge, MIRROR_IDENTITY_PROOF_VERSION, MIRROR_IDENTITY_PROVENANCE, type BridgeConversation, type BridgeGroup, type BridgeRow } from "./mirror-identity-contract";
import { resolveConfiguredMirrorFleetScope } from "./line-chat-mirror-fleet-scope";
import { configuredLineChatMirrorStoreCodes } from "./line-chat-mirror.service";

type BridgeDb = Prisma.TransactionClient;
const conversationSelect = { id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true, lineChatMappingSource: true, lineChatMappedAt: true, lineChatMappedById: true, latestMessageAt: true } as const;
export type BridgeManifest = { version: typeof MIRROR_IDENTITY_PROOF_VERSION; createdAt: string; eligibleOaIds: string[]; rows: BridgeRow[]; rowSetSha256: string };
export function canonicalBridgeRows(rows: readonly BridgeRow[]): string { return JSON.stringify([...rows].sort((a,b) => (a.canonicalConversationId ?? "").localeCompare(b.canonicalConversationId ?? ""))); }
export function validateBridgeManifest(m: BridgeManifest): void {
  if (m.version !== MIRROR_IDENTITY_PROOF_VERSION || !Number.isFinite(new Date(m.createdAt).getTime()) || m.eligibleOaIds.length !== 144 || new Set(m.eligibleOaIds).size !== 144 || bridgeHash(canonicalBridgeRows(m.rows)) !== m.rowSetSha256 || new Set(m.rows.map(r => r.canonicalConversationId)).size !== m.rows.length || new Set(m.rows.map(r => `${r.lineOfficialAccountId}:${r.lineChatUserId}`)).size !== m.rows.length || m.rows.some(r => r.classification !== "SAFE_BRIDGE_CANDIDATE" || r.previousLineChatUserId !== null || !r.canonicalConversationId || !r.storeId || !r.lineChatUserId || !/^U[0-9a-f]{32}$/u.test(r.lineChatUserId) || !m.eligibleOaIds.includes(r.lineOfficialAccountId) || !r.proofIds.length || r.proofDigest !== bridgeHash(JSON.stringify(r.proofIds)))) throw new Error("INVALID_BRIDGE_MANIFEST");
}

/** No Manager request, browser lease, canonical-message or Source Tag mutation. */
export class MirrorIdentityBridgeService {
  constructor(private readonly db: PrismaService) {}
  private async snapshot(tx: BridgeDb, eligibleOaIds: readonly string[]) {
    if (!eligibleOaIds.length) return [];
    const groups = await tx.$queryRaw<BridgeGroup[]>(Prisma.sql`
      SELECT m."lineOfficialAccountId", m."lineChatUserId", m."canonicalConversationId", COUNT(*)::int AS "rowCount",
        COALESCE(array_agg(json_build_array(m.id,m."canonicalMessageId",m."canonicalConversationId",m."managerMessageId",m.direction::text,m."reconcileStatus"::text,m."reconcileSource",m."reconciledAt"::text,p."externalMessageId",p.direction::text,p."deliveryStatus"::text,p."rawPayload"->>'source',p."rawPayload"->>'managerMessageId',p."rawPayload"->>'providerMessageId',p."conversationId",c."storeId",c."lineOfficialAccountId")::text ORDER BY m.id) FILTER (WHERE
          m."reconciledAt" IS NOT NULL AND m."reconcileError" IS NULL
          AND ((m."reconcileStatus"::text='DUPLICATE' AND m."reconcileSource"='EXACT_EXTERNAL_ID')
            OR (m."reconcileStatus"::text='IMPORTED' AND m."reconcileSource"='IMPORTED_OUTBOUND' AND m.direction::text='OUTBOUND'))
          AND p.id IS NOT NULL AND p."conversationId"=m."canonicalConversationId"
          AND p.direction::text=m.direction::text AND p."deliveryStatus"::text='DELIVERED'
          AND (p."externalMessageId" IN (m."managerMessageId",'line-chat-manager:'||m."managerMessageId")
            OR p."rawPayload"->>'managerMessageId' IN (m."managerMessageId",'line-chat-manager:'||m."managerMessageId")
            OR p."rawPayload"->>'providerMessageId' IN (m."managerMessageId",'line-chat-manager:'||m."managerMessageId"))
          AND COALESCE(p."rawPayload"->>'source','') NOT ILIKE '%HISTORICAL%'
          AND c."lineOfficialAccountId"=m."lineOfficialAccountId" AND c."storeId"=o."storeId"
        ), ARRAY[]::text[]) AS proofs,
        bool_or(m."canonicalConversationId" IS NOT NULL AND (c.id IS NULL OR c."lineOfficialAccountId"<>m."lineOfficialAccountId" OR c."storeId" IS DISTINCT FROM o."storeId" OR NOT o."isActive" OR o."archivedAt" IS NOT NULL OR o."accountType"::text<>'STORE' OR NOT s."isActive" OR s."archivedAt" IS NOT NULL)) AS "invalidScope"
      FROM "LineChatMirrorMessage" m LEFT JOIN "Conversation" c ON c.id=m."canonicalConversationId"
      LEFT JOIN "Message" p ON p.id=m."canonicalMessageId"
      LEFT JOIN "LineOfficialAccount" o ON o.id=m."lineOfficialAccountId" LEFT JOIN "Store" s ON s.id=o."storeId"
      WHERE m."lineOfficialAccountId" IN (${Prisma.join(eligibleOaIds)}) OR c."lineOfficialAccountId" IN (${Prisma.join(eligibleOaIds)})
      GROUP BY m."lineOfficialAccountId",m."lineChatUserId",m."canonicalConversationId"`);
    const referenced = [...new Set(groups.map(g=>g.canonicalConversationId).filter((id): id is string=>id!==null))];
    const conversations: BridgeConversation[] = await tx.conversation.findMany({ where: { OR: [{ lineOfficialAccountId: { in: [...eligibleOaIds] } }, { id: { in: referenced } }] }, select: conversationSelect });
    return classifyMirrorBridge(groups, conversations, eligibleOaIds);
  }
  async audit() {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const scope = await resolveConfiguredMirrorFleetScope(tx, configuredLineChatMirrorStoreCodes());
      if (scope.eligibleOaIds.length !== 144 || scope.unconfiguredActiveStoreCodes.length) throw new Error("BRIDGE_FLEET_SCOPE_NOT_PROVEN");
      const rows = await this.snapshot(tx, scope.eligibleOaIds);
      const counts = Object.fromEntries(BRIDGE_CLASSES.map(k=>[k,rows.filter(r=>r.classification===k).length]));
      return { eligibleOaIds: scope.eligibleOaIds.sort(), rows, report: { eligibleOas: scope.eligibleOaIds.length, mirrorIdentitiesExamined: rows.filter(r=>r.classification!=="NO_MIRROR_BRIDGE_EVIDENCE").length, conversationOnlyRows: counts.NO_MIRROR_BRIDGE_EVIDENCE, counts, unexplained: rows.length-Object.values(counts).reduce((a,b)=>a+b,0) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 });
  }
  async buildManifest(): Promise<BridgeManifest> {
    const audit = await this.audit();
    const rows = audit.rows.filter(r=>r.classification==="SAFE_BRIDGE_CANDIDATE");
    return { version: MIRROR_IDENTITY_PROOF_VERSION, createdAt: new Date().toISOString(), eligibleOaIds: audit.eligibleOaIds, rows, rowSetSha256: bridgeHash(canonicalBridgeRows(rows)) };
  }
  private async row(tx: BridgeDb, expected: BridgeRow, apply: boolean, fleet?: readonly string[]) {
    if (!expected.canonicalConversationId || !expected.lineChatUserId || !expected.storeId) return "INSUFFICIENT_RECONCILIATION_EVIDENCE";
    const indexes = await tx.$queryRaw<Array<{ valid:boolean }>>`SELECT i.indisvalid AS valid FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_class tbl ON tbl.oid=i.indrelid WHERE idx.relname='Conversation_oa_chat_identity_key' AND tbl.relname='Conversation' AND i.indisunique`;
    if (indexes.length!==1 || !indexes[0].valid) return "UNIQUENESS_CONSTRAINT_REQUIRED";
    const scope = await resolveConfiguredMirrorFleetScope(tx, configuredLineChatMirrorStoreCodes());
    if (scope.eligibleOaIds.length !== 144 || scope.unconfiguredActiveStoreCodes.length || !scope.eligibleOaIds.includes(expected.lineOfficialAccountId) || (fleet && JSON.stringify([...scope.eligibleOaIds].sort()) !== JSON.stringify([...fleet].sort()))) return "SCOPE_CHANGED";
    if (fleet) {
      const health = await tx.lineChatMirrorStoreState.findMany({ where: { lineOfficialAccountId: { in: [...fleet] } }, select: { enabled:true,status:true,lastSuccessfulSyncAt:true,lastErrorCode:true } });
      if (health.length!==144 || health.some(h=>!h.enabled || h.status!=="SUCCESS" || h.lastErrorCode!==null || !h.lastSuccessfulSyncAt || Date.now()-h.lastSuccessfulSyncAt.getTime()>2*60*60*1000)) return "LIVE_MIRROR_HEALTH_HELD";
    }
    const current = await tx.conversation.findUnique({ where: { id: expected.canonicalConversationId }, select: conversationSelect });
    if (!current || current.storeId!==expected.storeId || current.lineOfficialAccountId!==expected.lineOfficialAccountId) return "SCOPE_CHANGED";
    const rows = await this.snapshot(tx,[expected.lineOfficialAccountId]);
    const actual = rows.find(r=>r.lineChatUserId===expected.lineChatUserId && r.classification!=="NO_MIRROR_BRIDGE_EVIDENCE");
    if (!actual) return "STALE_PROOF";
    if (actual.classification !== "SAFE_BRIDGE_CANDIDATE" && actual.classification !== "ALREADY_LINKED") return actual.classification;
    if (actual.canonicalConversationId!==expected.canonicalConversationId) return "STALE_PROOF";
    if (actual.classification === "ALREADY_LINKED") return "ALREADY_LINKED";
    if (fleet && (actual.proofDigest!==expected.proofDigest || actual.previousMappingSource!==expected.previousMappingSource || actual.previousMappedAt!==expected.previousMappedAt || actual.previousMappedById!==expected.previousMappedById || actual.activityAt!==expected.activityAt)) return "STALE_PROOF";
    // Mapping must not unlock an existing queued LINE write. Never change those jobs here.
    const [nicknameJobs, sendJobs] = await Promise.all([
      tx.lineChatNicknameSyncJob.count({ where: { conversationId: current.id, status: { in: ["PENDING","PROCESSING"] } } }),
      tx.lineChatMessageSendJob.count({ where: { conversationId: current.id, status: { in: ["QUEUED","PROCESSING","VERIFY_PENDING"] } } }),
    ]);
    if (nicknameJobs || sendJobs) return "ACTIVE_MANAGER_WRITE_JOB_HELD";
    if (!apply) return "WOULD_APPLY";
    const changed = await tx.conversation.updateMany({ where: { id: current.id, storeId: current.storeId, lineOfficialAccountId: current.lineOfficialAccountId, lineChatUserId: null, lineChatMappingSource: current.lineChatMappingSource, lineChatMappedAt: current.lineChatMappedAt, lineChatMappedById: current.lineChatMappedById }, data: { lineChatUserId: expected.lineChatUserId, lineChatMappingSource: MIRROR_IDENTITY_PROVENANCE, lineChatMappedAt: new Date() } });
    return changed.count===1 ? "APPLIED" : "CONCURRENT_MAPPING_CONFLICT";
  }
  async processManifest(m: BridgeManifest, apply: boolean, offset=0, limit=25) {
    validateBridgeManifest(m);
    if (!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100) throw new Error("INVALID_BRIDGE_BATCH");
    const results=[];
    for (const expected of m.rows.slice(offset,offset+limit)) {
      const result = await this.transactionRow(expected,apply,m.eligibleOaIds);
      results.push({ conversationId: expected.canonicalConversationId, result });
      if (!["APPLIED","ALREADY_LINKED","WOULD_APPLY"].includes(result)) break;
    }
    return { considered: results.length, outsideScope: 0, writes: results.filter(r=>r.result==="APPLIED").length, results };
  }
  private async transactionRow(expected: BridgeRow, apply: boolean, fleet?: readonly string[]) {
    try { return await this.db.$transaction(tx=>this.row(tx,expected,apply,fleet),{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable,timeout:30000 }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2002","P2034","P2028"].includes(e.code)) return "CONCURRENT_MAPPING_CONFLICT"; throw e; }
  }
  /** Called only after a successful reconciliation receipt; never raw collection. */
  async linkReconciled(mirrorId: string) {
    const receipt = await this.db.lineChatMirrorMessage.findUnique({ where: { id: mirrorId }, select: { lineOfficialAccountId:true,lineChatUserId:true,canonicalConversationId:true,reconcileStatus:true,reconcileSource:true,reconciledAt:true,reconcileError:true } });
    if (!receipt?.canonicalConversationId || !receipt.reconciledAt || receipt.reconcileError!==null || !((receipt.reconcileStatus==="IMPORTED" && receipt.reconcileSource==="IMPORTED_OUTBOUND") || (receipt.reconcileStatus==="DUPLICATE" && receipt.reconcileSource==="EXACT_EXTERNAL_ID"))) return "INSUFFICIENT_RECONCILIATION_EVIDENCE";
    const c = await this.db.conversation.findUnique({ where: { id:receipt.canonicalConversationId }, select:conversationSelect });
    if (!c) return "INSUFFICIENT_RECONCILIATION_EVIDENCE";
    if (c.lineChatUserId===receipt.lineChatUserId) return "ALREADY_LINKED";
    const expected: BridgeRow = { lineOfficialAccountId: receipt.lineOfficialAccountId,lineChatUserId:receipt.lineChatUserId,canonicalConversationId:c.id,storeId:c.storeId,classification:"SAFE_BRIDGE_CANDIDATE",reason:"CONTINUOUS_RECEIPT",proofIds:[],proofDigest:"",previousLineChatUserId:c.lineChatUserId,previousMappingSource:c.lineChatMappingSource,previousMappedAt:c.lineChatMappedAt?.toISOString()??null,previousMappedById:c.lineChatMappedById,activityAt:c.latestMessageAt.toISOString() };
    return this.transactionRow(expected,true);
  }
}
