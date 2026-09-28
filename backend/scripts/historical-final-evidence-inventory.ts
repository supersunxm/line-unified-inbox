import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { verifyArchiveSnapshot } from "./historical-timeline-backfill";

const ROOT = path.resolve(__dirname, "../local-data/mirror-historical");
const PRIOR_COPY_ROOT = path.join(ROOT, "../mirror-historical-20260925-evidence");
const REPORT_ROOT = path.join(ROOT, "final-completion");
const TARGET_START = Date.parse("2026-08-31T17:00:00.000Z");
const REQUIRED_FILES = ["manifest.json", "inventory.ndjson", "conversations.ndjson", "events.ndjson", "checkpoints.json", "validation.json", "run-summary.json"] as const;

type JsonRecord = Record<string, unknown>;
type ArchiveEvent = {
  storeId?: string;
  conversationId?: string;
  sourceEventId?: string;
  timestamp?: string;
  type?: string;
  direction?: string;
  messageType?: string | null;
  text?: string | null;
  rawMetadata?: JsonRecord;
  staffMetadata?: JsonRecord;
};
type ArchiveStore = ReturnType<typeof verifyArchiveSnapshot>["stores"][number];
type NameEvidence = { path: string; observedAt: string | null; sourceArchiveKey: string; sourceEventId: string | null };

function readJson(file: string): JsonRecord {
  return JSON.parse(readFileSync(file, "utf8")) as JsonRecord;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function messageEvent(row: ArchiveEvent): boolean {
  return ["message", "messagesent", "messagereceived"].includes((row.type ?? "").toLowerCase())
    && typeof row.messageType === "string";
}

function validIdentity(row: ArchiveEvent): boolean {
  return Boolean(row.sourceEventId?.trim())
    && /^U[a-f0-9]{32}$/iu.test(row.conversationId ?? "")
    && Number.isFinite(Date.parse(row.timestamp ?? ""))
    && ["INBOUND", "OUTBOUND"].includes(row.direction ?? "");
}

async function* readNdjson(file: string): AsyncGenerator<JsonRecord> {
  const stream = createReadStream(file, { encoding: "utf8" });
  let remainder = "";
  let lineNumber = 0;
  for await (const chunk of stream) {
    const lines = `${remainder}${chunk}`.split("\n");
    remainder = lines.pop() ?? "";
    for (const rawLine of lines) {
      lineNumber += 1;
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as JsonRecord;
      } catch {
        throw new Error(`INVALID_NDJSON_${path.relative(ROOT, file)}_LINE_${lineNumber}_CHARS_${line.length}`);
      }
      yield parsed as JsonRecord;
    }
  }
  if (remainder) {
    lineNumber += 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(remainder) as JsonRecord;
    } catch {
      throw new Error(`INVALID_NDJSON_${path.relative(ROOT, file)}_LINE_${lineNumber}_CHARS_${remainder.length}`);
    }
    yield parsed as JsonRecord;
  }
}

function collectNameEvidence(value: unknown, pathParts: string[], found: Array<{ path: string; value: string }>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectNameEvidence(item, pathParts, found);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const nextPath = [...pathParts, key];
    const nameField = /^(?:name|nickname|displayname|chatname|ownername|sendername|staffname)$/iu.test(key);
    if (nameField && typeof child === "string" && child.trim()) {
      found.push({ path: nextPath.join("."), value: child.trim() });
    }
    collectNameEvidence(child, nextPath, found);
  }
}

function collectResponderBizId(row: ArchiveEvent): string | null {
  const metadata = record(row.rawMetadata);
  const value = metadata.bizId;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function containsAutoEvidence(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAutoEvidence);
  if (typeof value !== "object" || value === null) return false;
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    if (/^(?:isAutoReply|isAutoResponse|autoResponse)$/iu.test(key) && child === true) return true;
    if (containsAutoEvidence(child)) return true;
  }
  return false;
}

function findFileNames(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...findFileNames(target));
    else if (entry.isFile()) result.push(entry.name);
  }
  return result;
}

async function inventoryApprovedArchives(stores: readonly ArchiveStore[]) {
  const mediaTypes = ["sticker", "image", "video", "file"] as const;
  const media = Object.fromEntries(mediaTypes.map((type) => [type, {
    total: 0, withStableEventIdentity: 0, withTypeMetadata: 0, withMessageReference: 0,
    withBinaryPayload: 0, withoutSourceMetadata: 0, duplicateIdentityRows: 0, fields: {},
  }])) as Record<typeof mediaTypes[number], {
    total: number; withStableEventIdentity: number; withTypeMetadata: number; withMessageReference: number;
    withBinaryPayload: number; withoutSourceMetadata: number; duplicateIdentityRows: number; fields: Record<string, number>;
  }>;
  const mediaIdentitySeen = new Set<string>();
  const uniqueChats = new Set<string>();
  const outbound = { total: 0, knownManagerResponder: 0, autoResponse: 0, unknownResponder: 0 };
  const responderKeys = new Set<string>();
  const namesByIdentity = new Map<string, Map<string, NameEvidence>>();
  const nameFields: Record<string, number> = {};
  let approvedEventRows = 0;
  let approvedTargetEventRows = 0;
  let namelessHistoricalIdentities = 0;
  const archiveBinaryFiles: string[] = [];
  const archiveMetadataSidecars: string[] = [];

  for (const store of stores) {
    const storeDir = path.join(ROOT, `store-${store.storeCode}`);
    const manifest = readJson(path.join(storeDir, "manifest.json"));
    const sourceArchiveKey = typeof manifest.archiveKey === "string"
      ? manifest.archiveKey
      : typeof manifest.archiveId === "string"
        ? manifest.archiveId
        : `store-${store.storeCode}`;
    const sourceChatNameRecords = new Map<string, ArchiveEvent>();
    for await (const raw of readNdjson(path.join(storeDir, "conversations.ndjson"))) {
      const row = raw as ArchiveEvent;
      if (row.conversationId) sourceChatNameRecords.set(row.conversationId, row);
    }
    for (const [chatId, row] of sourceChatNameRecords) {
      const found: Array<{ path: string; value: string }> = [];
      collectNameEvidence(row, ["conversations.ndjson"], found);
      for (const item of found) {
        const key = `${store.storeId}\u0000${chatId}`;
        const names = namesByIdentity.get(key) ?? new Map<string, NameEvidence>();
        const observedAt = typeof row.timestamp === "string" && Number.isFinite(Date.parse(row.timestamp)) ? new Date(row.timestamp).toISOString() : null;
        names.set(item.value, { path: item.path, observedAt, sourceArchiveKey, sourceEventId: row.sourceEventId ?? null });
        namesByIdentity.set(key, names);
        nameFields[item.path] = (nameFields[item.path] ?? 0) + 1;
      }
    }

    for await (const raw of readNdjson(path.join(storeDir, "events.ndjson"))) {
      approvedEventRows += 1;
      const row = raw as ArchiveEvent;
      const timestamp = Date.parse(row.timestamp ?? "");
      if (!Number.isFinite(timestamp) || timestamp < TARGET_START) continue;
      approvedTargetEventRows += 1;
      if (!row.conversationId) continue;
      const identity = `${store.storeId}\u0000${row.conversationId}`;
      uniqueChats.add(identity);
      const found: Array<{ path: string; value: string }> = [];
      collectNameEvidence({ rawMetadata: row.rawMetadata, staffMetadata: row.staffMetadata }, ["events.ndjson"], found);
      for (const item of found) {
        const names = namesByIdentity.get(identity) ?? new Map<string, NameEvidence>();
        names.set(item.value, { path: item.path, observedAt: new Date(timestamp).toISOString(), sourceArchiveKey, sourceEventId: row.sourceEventId ?? null });
        namesByIdentity.set(identity, names);
        nameFields[item.path] = (nameFields[item.path] ?? 0) + 1;
      }

      if (!messageEvent(row)) continue;
      const type = row.messageType?.toLowerCase();
      if (type && mediaTypes.includes(type as typeof mediaTypes[number])) {
        const current = media[type as typeof mediaTypes[number]];
        current.total += 1;
        const sourceIdentity = `${store.storeId}\u0000${row.sourceEventId ?? ""}`;
        if (validIdentity(row)) current.withStableEventIdentity += 1;
        if (mediaIdentitySeen.has(sourceIdentity)) current.duplicateIdentityRows += 1;
        else mediaIdentitySeen.add(sourceIdentity);
        const rawMetadata = record(row.rawMetadata);
        const message = record(rawMetadata.message);
        for (const field of Object.keys(message)) current.fields[field] = (current.fields[field] ?? 0) + 1;
        const hasReference = typeof message.id === "string" && message.id.trim().length > 0;
        const hasSticker = type !== "sticker" || (typeof message.packageId === "string" && Boolean(message.packageId) && typeof message.stickerId === "string" && Boolean(message.stickerId));
        const hasFileName = type !== "file" || (typeof message.fileName === "string" && message.fileName.trim().length > 0);
        const typeSpecific = hasSticker && hasFileName && Object.keys(message).some((key) => ["packageId", "stickerId", "fileName", "duration", "id"].includes(key));
        if (typeSpecific) current.withTypeMetadata += 1;
        if (hasReference) current.withMessageReference += 1;
        if (Object.keys(message).some((key) => /^(?:bytes|contentBase64|base64|binary)$/iu.test(key))) current.withBinaryPayload += 1;
        if (!typeSpecific && !hasReference) current.withoutSourceMetadata += 1;
      }

      if (row.direction !== "OUTBOUND") continue;
      outbound.total += 1;
      const bizId = collectResponderBizId(row);
      if (containsAutoEvidence({ rawMetadata: row.rawMetadata, staffMetadata: row.staffMetadata }) || bizId === "__AUTO_RESPONSE") {
        outbound.autoResponse += 1;
      } else if (bizId) {
        outbound.knownManagerResponder += 1;
        responderKeys.add(bizId);
      } else {
        outbound.unknownResponder += 1;
      }
    }
    for (const fileName of findFileNames(storeDir)) {
      if (REQUIRED_FILES.includes(fileName as typeof REQUIRED_FILES[number])) continue;
      if (fileName.toLowerCase().endsWith(".json")) archiveMetadataSidecars.push(`${store.storeCode}/${fileName}`);
      else archiveBinaryFiles.push(`${store.storeCode}/${fileName}`);
    }
  }

  const nameSnapshots = [...namesByIdentity.entries()].flatMap(([identity, names]) => {
    const [storeId, chatId] = identity.split("\u0000");
    return [...names.entries()].map(([name, evidence]) => ({ storeId, historicalLineChatUserId: chatId, name, ...evidence }));
  });
  const nameEvidenceIdentityCount = namesByIdentity.size;
  namelessHistoricalIdentities = Math.max(0, uniqueChats.size - nameEvidenceIdentityCount);
  return {
    approvedArchives: stores.length,
    approvedEventRows,
    approvedTargetEventRows,
    historicalChatIdentities: uniqueChats.size,
    media,
    binaryFiles: archiveBinaryFiles,
    metadataSidecarCount: archiveMetadataSidecars.length,
    mediaAmbiguousRows: mediaTypes.reduce((sum, type) => sum + media[type].total - media[type].withStableEventIdentity, 0),
    mediaMissingRows: mediaTypes.reduce((sum, type) => sum + media[type].withoutSourceMetadata, 0),
    duplicateMediaIdentityRows: mediaTypes.reduce((sum, type) => sum + media[type].duplicateIdentityRows, 0),
    nameEvidence: {
      identitiesWithName: nameEvidenceIdentityCount,
      identitiesWithoutName: namelessHistoricalIdentities,
      nameSnapshotConflicts: [...namesByIdentity.values()].filter((names) => names.size > 1).length,
      nameFields,
      snapshots: nameSnapshots,
    },
    outboundResponderEvidence: {
      ...outbound,
      distinctKnownResponders: responderKeys.size,
    },
  };
}

function compareStoreArchive(storeCode: string, ledger: JsonRecord, candidateRoot: string) {
  const archives = ledger.archives as Array<JsonRecord>;
  const entry = archives.find((item) => item.storeCode === storeCode);
  if (!entry) throw new Error(`LEDGER_STORE_MISSING_${storeCode}`);
  const approvedFiles = record(entry.files);
  const files = REQUIRED_FILES.map((file) => {
    const filePath = path.join(candidateRoot, `store-${storeCode}`, file);
    const approved = record(approvedFiles[file]);
    try {
      const bytes = readFileSync(filePath);
      return {
        file,
        exists: true,
        bytes: bytes.length,
        sha256: sha256(bytes),
        matchesLedger: bytes.length === approved.bytes && sha256(bytes) === approved.sha256,
        ledgerBytes: approved.bytes ?? null,
        ledgerSha256: approved.sha256 ?? null,
      };
    } catch {
      return { file, exists: false, bytes: null, sha256: null, matchesLedger: false, ledgerBytes: approved.bytes ?? null, ledgerSha256: approved.sha256 ?? null };
    }
  });
  return { storeCode, archiveKey: entry.archiveKey, files, matchedFiles: files.filter((item) => item.matchesLedger).length };
}

async function countHistoricalTexts(storeCode: string, archiveRoot: string): Promise<{ rows: number; chats: number; duplicateSourceIds: number; eventIdentityMissing: number }> {
  const file = path.join(archiveRoot, `store-${storeCode}/events.ndjson`);
  const sources = new Set<string>();
  const chats = new Set<string>();
  let rows = 0;
  let duplicateSourceIds = 0;
  let eventIdentityMissing = 0;
  for await (const raw of readNdjson(file)) {
    const row = raw as ArchiveEvent;
    const timestamp = Date.parse(row.timestamp ?? "");
    if (!messageEvent(row) || row.messageType?.toLowerCase() !== "text" || !row.text?.trim() || !Number.isFinite(timestamp) || timestamp < TARGET_START) continue;
    rows += 1;
    if (!validIdentity(row)) eventIdentityMissing += 1;
    const identity = row.sourceEventId ?? "";
    if (sources.has(identity)) duplicateSourceIds += 1;
    sources.add(identity);
    if (row.conversationId) chats.add(row.conversationId);
  }
  return { rows, chats: chats.size, duplicateSourceIds, eventIdentityMissing };
}

async function main(): Promise<void> {
  const verified = verifyArchiveSnapshot();
  const evidence = await inventoryApprovedArchives(verified.stores);
  const ledger = readJson(path.join(ROOT, "FULL_FLEET_ARCHIVE_HASH_LEDGER.json"));
  const approvedStoreCodes = verified.stores.map((store) => store.storeCode);
  const store28326Archive = compareStoreArchive("28326", ledger, ROOT);
  const store30606Current = compareStoreArchive("30606", ledger, ROOT);
  const store28326Prior = compareStoreArchive("28326", ledger, PRIOR_COPY_ROOT);
  const store30606Prior = compareStoreArchive("30606", ledger, PRIOR_COPY_ROOT);
  const heldData = {
    store28326: {
      changedArchiveText: await countHistoricalTexts("28326", ROOT),
      priorLedgerApprovedText: await countHistoricalTexts("28326", PRIOR_COPY_ROOT),
    },
    store30606: {
      currentArchiveText: await countHistoricalTexts("30606", ROOT),
      priorLedgerApprovedText: await countHistoricalTexts("30606", PRIOR_COPY_ROOT),
    },
  };

  mkdirSync(REPORT_ROOT, { recursive: true, mode: 0o700 });
  const report = {
    computedAt: new Date().toISOString(),
    targetStart: new Date(TARGET_START).toISOString(),
    archiveRegistrySha256: verified.registrySha256,
    archiveLedgerSha256: verified.ledgerSha256,
    approvedStoreCodes,
    h2: { store28326Archive, store28326Prior, store30606Current, store30606Prior, heldData },
    h3h4: evidence,
  };
  const outputPath = path.join(REPORT_ROOT, "H3_H4_PRIVATE_EVIDENCE_INVENTORY.json");
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  chmodSync(outputPath, 0o600);
  console.log(JSON.stringify({
    event: "HISTORICAL_FINAL_EVIDENCE_INVENTORY_COMPLETE",
    approvedArchives: evidence.approvedArchives,
    approvedTargetEventRows: evidence.approvedTargetEventRows,
    historicalChatIdentities: evidence.historicalChatIdentities,
    media: evidence.media,
    archiveMediaBinaryFiles: evidence.binaryFiles.length,
    archiveMetadataSidecars: evidence.metadataSidecarCount,
    nameEvidence: {
      identitiesWithName: evidence.nameEvidence.identitiesWithName,
      identitiesWithoutName: evidence.nameEvidence.identitiesWithoutName,
      nameSnapshotConflicts: evidence.nameEvidence.nameSnapshotConflicts,
      nameFields: evidence.nameEvidence.nameFields,
    },
    outboundResponderEvidence: evidence.outboundResponderEvidence,
    heldData,
    store28326LedgerFiles: store28326Archive.matchedFiles,
    store28326PriorLedgerFiles: store28326Prior.matchedFiles,
    store30606CurrentLedgerFiles: store30606Current.matchedFiles,
    store30606PriorLedgerFiles: store30606Prior.matchedFiles,
    privateDetailPath: outputPath,
  }));
}

void main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message.split("\n")[0] : "UNKNOWN_FAILURE";
  console.error(JSON.stringify({ event: "HISTORICAL_FINAL_EVIDENCE_INVENTORY_FAILED", code }));
  process.exitCode = 1;
});
