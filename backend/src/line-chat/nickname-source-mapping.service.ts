import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { resolveConfiguredMirrorFleetScope } from "./line-chat-mirror-fleet-scope";
import { configuredLineChatMirrorStoreCodes } from "./line-chat-mirror.service";
import { AUDIT_CLASSES, classifyNickname, evidenceHash, NICKNAME_SOURCE_RULE_VERSION, parseNicknameSource, SOURCE_TAGS } from "./nickname-source-contract";

export type NicknameManifestRow = {
  storeId: string; lineOfficialAccountId: string; lineChatUserId: string; conversationId: string;
  observationId: string; observedAt: string; nicknameHash: string; nickname: string | null;
  previousTag: string | null; expectedTag: string; ruleId: string; ruleVersion: string;
};
export type NicknameManifest = {
  format: "nickname-source-manifest-v1"; createdAt: string; auditSince: string;
  ruleVersion: string; rows: NicknameManifestRow[];
  rowCount: number; oaCount: number; storeCount: number; rowSetSha256: string;
};
export function canonicalManifestRows(rows: readonly NicknameManifestRow[]): string {
  return JSON.stringify([...rows].sort((a, b) => a.observationId.localeCompare(b.observationId)).map(r => ({
    storeId: r.storeId, lineOfficialAccountId: r.lineOfficialAccountId, lineChatUserId: r.lineChatUserId,
    conversationId: r.conversationId, observationId: r.observationId, observedAt: r.observedAt,
    nicknameHash: r.nicknameHash, nickname: r.nickname, previousTag: r.previousTag,
    expectedTag: r.expectedTag, ruleId: r.ruleId, ruleVersion: r.ruleVersion,
  })));
}
export function validateManifest(manifest: NicknameManifest): void {
  if (manifest.format !== "nickname-source-manifest-v1" || manifest.ruleVersion !== NICKNAME_SOURCE_RULE_VERSION
    || !Number.isFinite(new Date(manifest.createdAt).getTime()) || !Number.isFinite(new Date(manifest.auditSince).getTime())
    || manifest.rowCount !== manifest.rows.length || manifest.oaCount !== new Set(manifest.rows.map(r => r.lineOfficialAccountId)).size
    || manifest.storeCount !== new Set(manifest.rows.map(r => r.storeId)).size
    || manifest.rowSetSha256 !== evidenceHash(canonicalManifestRows(manifest.rows))
    || new Set(manifest.rows.map(r => r.conversationId)).size !== manifest.rows.length
    || new Set(manifest.rows.map(r => r.observationId)).size !== manifest.rows.length) throw new Error("INVALID_IMMUTABLE_MANIFEST");
  for (const row of manifest.rows) {
    const parsed = parseNicknameSource(row.nickname, true);
    if (row.ruleVersion !== manifest.ruleVersion || parsed.kind !== "SIGNAL" || parsed.tag !== row.expectedTag
      || parsed.ruleId !== row.ruleId || row.nicknameHash !== evidenceHash(JSON.stringify(row.nickname))
      || !Number.isFinite(new Date(row.observedAt).getTime()) || new Date(row.observedAt) > new Date(manifest.createdAt)) {
      throw new Error("INVALID_MANIFEST_SIGNAL");
    }
  }
}

@Injectable()
export class NicknameSourceMappingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Database-enforced read-only snapshot. No Manager/browser or source-state writes. */
  async audit(since: Date) {
    if (!Number.isFinite(since.getTime()) || since > new Date()) throw new Error("INVALID_AUDIT_WATERMARK");
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const scope = await resolveConfiguredMirrorFleetScope(tx, configuredLineChatMirrorStoreCodes());
      const ids = scope.eligibleOaIds;
      const captures = await tx.nicknameSourceCapture.findMany({ where: { lineOfficialAccountId: { in: ids }, observedAt: { gte: since }, ruleVersion: NICKNAME_SOURCE_RULE_VERSION }, select: { lineOfficialAccountId: true, coverage: true, observedAt: true, durationMs: true, profileKey: true } });
      const observations = ids.length ? await tx.$queryRaw<Array<{
        id: string; storeId: string; lineOfficialAccountId: string; lineChatUserId: string; conversationId: string | null;
        nickname: string | null; nicknameReadStatus: string; observedAt: Date; parsedTag: string | null; ruleId: string | null;
      }>>(Prisma.sql`SELECT DISTINCT ON ("lineOfficialAccountId", "lineChatUserId")
        "id", "storeId", "lineOfficialAccountId", "lineChatUserId", "conversationId", "nickname", "nicknameReadStatus", "observedAt", "parsedTag", "ruleId"
        FROM "NicknameSourceObservation" WHERE "lineOfficialAccountId" IN (${Prisma.join(ids)}) AND "observedAt" >= ${since}
        AND "ruleVersion" = ${NICKNAME_SOURCE_RULE_VERSION}
        ORDER BY "lineOfficialAccountId", "lineChatUserId", "observedAt" DESC, "id" DESC`) : [];
      const destinations = await tx.conversation.findMany({ where: { lineOfficialAccountId: { in: ids }, lineChatUserId: { not: null } }, select: {
        id: true, storeId: true, lineOfficialAccountId: true, lineChatUserId: true, nicknameSourceState: { select: { tag: true } },
      } });
      const oaStores = await tx.lineOfficialAccount.findMany({ where: { id: { in: ids } }, select: { id: true, storeId: true } });
      const stores = new Map(oaStores.map(oa => [oa.id, oa.storeId]));
      const indexed = new Map<string, typeof destinations>();
      for (const d of destinations) {
        const key = `${d.lineOfficialAccountId}:${d.lineChatUserId}`;
        indexed.set(key, [...(indexed.get(key) ?? []), d]);
      }
      const rows = observations.map(o => {
        const result = classifyNickname({ ...o, readable: o.nicknameReadStatus === "READ",
          destinations: stores.get(o.lineOfficialAccountId) === o.storeId
            ? (indexed.get(`${o.lineOfficialAccountId}:${o.lineChatUserId}`) ?? []).map(d => ({ ...d, tag: d.nicknameSourceState?.tag ?? null })) : [],
        });
        return { observation: o, ...result };
      });
      const counts = Object.fromEntries(AUDIT_CLASSES.map(c => [c, rows.filter(r => r.classification === c).length]));
      const mirrorStates = await tx.lineChatMirrorStoreState.findMany({ where: { lineOfficialAccountId: { in: ids } }, select: { lineOfficialAccountId: true, status: true, lastErrorCode: true } });
      const report = {
        eligibleOas: ids.length, scannedOas: new Set(captures.map(c => c.lineOfficialAccountId)).size,
        observedChats: rows.length, identitiesMatched: rows.filter(r => r.conversationId !== null).length,
        classifications: counts, unexplained: rows.length - Object.values(counts).reduce((a, b) => a + b, 0),
        tagDistribution: Object.fromEntries(SOURCE_TAGS.map(t => [t, rows.filter(r => r.parsed.tag === t).length])),
        unscannedOas: ids.filter(id => !captures.some(c => c.lineOfficialAccountId === id)).map(id => {
          const state = mirrorStates.find(s => s.lineOfficialAccountId === id);
          const code = /^[A-Z0-9_]+$/u.test(state?.lastErrorCode ?? "") ? state?.lastErrorCode : null;
          return { oaHash: evidenceHash(id), mirrorStatus: state?.status ?? "UNKNOWN", reason: code ?? "NO_PASSIVE_CAPTURE_SINCE_WATERMARK" };
        }),
        profileCoverage: Object.fromEntries(["A", "B", "UNKNOWN"].map(key => [key,
          new Set(captures.filter(c => (c.profileKey ?? "UNKNOWN") === key).map(c => c.lineOfficialAccountId)).size])),
        coverage: "BOUNDED_RECENT_MANAGER_WINDOW", ruleVersion: NICKNAME_SOURCE_RULE_VERSION,
        captureCount: captures.length, maxCapturePreparationMs: Math.max(0, ...captures.map(c => c.durationMs)), incrementalProfileMs: 0,
      };
      return { report, rows };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  }

  async buildManifest(since: Date): Promise<NicknameManifest> {
    const audit = await this.audit(since);
    if (audit.report.eligibleOas !== 144 || audit.report.scannedOas !== 144 || audit.report.unexplained !== 0) throw new Error("FLEET_AUDIT_GATE_NOT_PASSED");
    const rows = audit.rows.filter(r => r.classification === "TAG_NEEDS_UPDATE" && r.conversationId !== null && r.parsed.tag !== null && r.parsed.ruleId !== null)
      .map(r => ({ storeId: r.observation.storeId, lineOfficialAccountId: r.observation.lineOfficialAccountId,
        lineChatUserId: r.observation.lineChatUserId, conversationId: r.conversationId!, observationId: r.observation.id,
        observedAt: r.observation.observedAt.toISOString(), nickname: r.observation.nickname,
        nicknameHash: evidenceHash(JSON.stringify(r.observation.nickname)), previousTag: r.previousTag,
        expectedTag: r.parsed.tag!, ruleId: r.parsed.ruleId!, ruleVersion: NICKNAME_SOURCE_RULE_VERSION,
      })).sort((a, b) => a.observationId.localeCompare(b.observationId));
    return { format: "nickname-source-manifest-v1", createdAt: new Date().toISOString(), auditSince: since.toISOString(),
      ruleVersion: NICKNAME_SOURCE_RULE_VERSION, rows, rowCount: rows.length,
      oaCount: new Set(rows.map(r => r.lineOfficialAccountId)).size, storeCount: new Set(rows.map(r => r.storeId)).size,
      rowSetSha256: evidenceHash(canonicalManifestRows(rows)) };
  }

  /** Trusted operator/CLI only; there is no automatic apply or public write endpoint. */
  async processManifest(manifest: NicknameManifest, fileSha256: string, apply: boolean, offset = 0, limit = 25) {
    validateManifest(manifest);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("INVALID_BATCH_BOUNDS");
    if (!/^[0-9a-f]{64}$/u.test(fileSha256)) throw new Error("INVALID_FILE_DIGEST");
    const scope = await resolveConfiguredMirrorFleetScope(this.prisma, configuredLineChatMirrorStoreCodes());
    if (scope.eligibleOaIds.length !== 144 || manifest.rows.some(r => !scope.eligibleOaIds.includes(r.lineOfficialAccountId))) throw new Error("MANIFEST_SCOPE_CHANGED");
    const results: Array<{ observationId: string; result: string }> = [];
    const health = await this.prisma.lineChatMirrorStoreState.findMany({ where: { enabled: true, lineOfficialAccountId: { in: scope.eligibleOaIds } }, select: { status: true, lastSuccessfulSyncAt: true } });
    if (health.length !== 144 || health.some(s => !["SUCCESS", "RUNNING"].includes(s.status) || !s.lastSuccessfulSyncAt || Date.now() - s.lastSuccessfulSyncAt.getTime() > 7200000)) throw new Error("LIVE_MIRROR_HEALTH_GATE_FAILED");
    for (const row of manifest.rows.slice(offset, offset + limit)) {
      const result = await this.prisma.$transaction(async tx => {
        if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const healthy = await tx.lineChatMirrorStoreState.count({ where: { enabled: true,
          lineOfficialAccountId: { in: scope.eligibleOaIds }, status: { in: ["SUCCESS", "RUNNING"] },
          lastSuccessfulSyncAt: { gte: new Date(Date.now() - 7200000) },
        } });
        if (healthy !== 144) return "LIVE_MIRROR_HEALTH_DEGRADED";
        const currentScope = await resolveConfiguredMirrorFleetScope(tx, configuredLineChatMirrorStoreCodes());
        if (currentScope.eligibleOaIds.length !== 144
          || currentScope.eligibleOaIds.some(id => !scope.eligibleOaIds.includes(id))
          || currentScope.unconfiguredActiveStoreCodes.slice().sort().join("\n") !== scope.unconfiguredActiveStoreCodes.slice().sort().join("\n")) return "SCOPE_CHANGED";
        const oa = await tx.lineOfficialAccount.findFirst({ where: { id: row.lineOfficialAccountId, storeId: row.storeId,
          isActive: true, archivedAt: null, store: { isActive: true, archivedAt: null } }, select: { id: true } });
        if (!oa) return "SCOPE_CHANGED";
        const destinations = await tx.conversation.findMany({ where: { lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId },
          select: { id: true, storeId: true, nicknameSourceState: true } });
        if (destinations.length !== 1 || destinations[0].id !== row.conversationId || destinations[0].storeId !== row.storeId) return "IDENTITY_CONFLICT";
        const frozen = await tx.nicknameSourceObservation.findUnique({ where: { id: row.observationId } });
        if (!frozen || frozen.conversationId !== row.conversationId || frozen.storeId !== row.storeId
          || frozen.lineOfficialAccountId !== row.lineOfficialAccountId || frozen.lineChatUserId !== row.lineChatUserId
          || frozen.classification !== "TAG_NEEDS_UPDATE" || frozen.ruleVersion !== row.ruleVersion
          || frozen.parsedTag !== row.expectedTag || frozen.ruleId !== row.ruleId
          || frozen.nickname !== row.nickname || frozen.observedAt.toISOString() !== row.observedAt
          || frozen.previousTag !== row.previousTag) return "MANIFEST_EVIDENCE_CONFLICT";
        const latest = await tx.nicknameSourceObservation.findFirst({ where: { lineOfficialAccountId: row.lineOfficialAccountId, lineChatUserId: row.lineChatUserId },
          orderBy: [{ observedAt: "desc" }, { id: "desc" }] });
        if (!latest || latest.nicknameReadStatus !== "READ" || latest.conversationId !== row.conversationId
          || latest.ruleVersion !== row.ruleVersion || evidenceHash(JSON.stringify(latest.nickname)) !== row.nicknameHash) return "STALE_OBSERVATION";
        const parsed = parseNicknameSource(latest.nickname, true);
        if (parsed.kind !== "SIGNAL" || parsed.tag !== row.expectedTag || parsed.ruleId !== row.ruleId) return "STALE_OBSERVATION";
        const current = destinations[0].nicknameSourceState;
        if (current?.tag === row.expectedTag) return "ALREADY_CORRECT";
        if ((current?.tag ?? null) !== row.previousTag) return "UNEXPECTED_TAG";
        // A naturally captured authoritative read AFTER the manifest freeze is mandatory.
        if (latest.observedAt <= new Date(manifest.createdAt) || Date.now() - latest.observedAt.getTime() > 7200000) return "AWAITING_FRESH_OBSERVATION";
        if (!apply) return "WOULD_APPLY";
        await tx.nicknameSourceState.upsert({ where: { conversationId: row.conversationId },
          create: { conversationId: row.conversationId, tag: row.expectedTag, ruleVersion: row.ruleVersion, sourceObservationId: latest.id, lastObservedAt: latest.observedAt },
          update: { tag: row.expectedTag, ruleVersion: row.ruleVersion, sourceObservationId: latest.id, lastObservedAt: latest.observedAt } });
        await tx.nicknameSourceApplication.create({ data: { observationId: row.observationId, conversationId: row.conversationId,
          manifestSha256: fileSha256, previousTag: row.previousTag, resultingTag: row.expectedTag } });
        const saved = await tx.nicknameSourceState.findUniqueOrThrow({ where: { conversationId: row.conversationId } });
        if (saved.tag !== row.expectedTag || saved.sourceObservationId !== latest.id) throw new Error("NICKNAME_SOURCE_READBACK_FAILED");
        return "APPLIED";
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 5000 });
      results.push({ observationId: row.observationId, result });
      if (["SCOPE_CHANGED", "IDENTITY_CONFLICT", "MANIFEST_EVIDENCE_CONFLICT", "UNEXPECTED_TAG", "LIVE_MIRROR_HEALTH_DEGRADED"].includes(result)) break;
    }
    return { apply, offset, remainingRows: Math.max(0, manifest.rows.length - offset - results.length), considered: results.length, outsideManifestConsidered: 0,
      counts: Object.fromEntries([...new Set(results.map(r => r.result))].map(s => [s, results.filter(r => r.result === s).length])), results };
  }
}
