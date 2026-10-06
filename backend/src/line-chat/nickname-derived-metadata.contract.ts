import { createHash } from "node:crypto";
import type { ParserV3Result } from "./nickname-parser-v3.contract";

export const NICKNAME_DERIVED_PROVENANCE = "MANAGER_NICKNAME" as const;

export type NicknameDerivedValues = {
  source: string | null;
  customerType: string | null;
  productModelId: string | null;
  productName: string | null;
  paymentMethod: string | null;
  financeProvider: string | null;
  service: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  eventDate: string | null;
};

export type NicknameDerivedStateSnapshot = {
  sourceObservationId: string;
  parserVersion: string;
  observedAt: string;
  values: NicknameDerivedValues;
};

export type NicknameDerivedManifestRow = {
  conversationId: string;
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  sourceObservationId: string;
  observedAt: string;
  nicknameSha256: string;
  parserVersion: string;
  profileKey: string | null;
  values: NicknameDerivedValues;
  expectedCurrentState: NicknameDerivedStateSnapshot | null;
  salesFieldsSha256: string;
};

export type NicknameDerivedManifest = {
  parserVersion: string;
  createdAt: string;
  rows: NicknameDerivedManifestRow[];
  rowSetSha256: string;
  sha256: string;
};

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parserValuesToMetadata(parsed: ParserV3Result): NicknameDerivedValues {
  return {
    source: parsed.values.source,
    customerType: parsed.values.customerType,
    productModelId: parsed.values.product?.id ?? null,
    productName: parsed.values.product?.name ?? null,
    paymentMethod: parsed.values.paymentMethod,
    financeProvider: parsed.values.financeProvider,
    service: parsed.values.service,
    periodYear: parsed.values.period?.year ?? null,
    periodMonth: parsed.values.period?.month ?? null,
    eventDate: parsed.values.date
      ? `${String(parsed.values.date.year).padStart(4, "0")}-${String(parsed.values.date.month).padStart(2, "0")}-${String(parsed.values.date.day).padStart(2, "0")}`
      : null,
  };
}

export function stateSnapshotToValues(snapshot: NicknameDerivedStateSnapshot | null): NicknameDerivedValues | null {
  return snapshot ? snapshot.values : null;
}

export function canonicalValues(values: NicknameDerivedValues): string {
  return JSON.stringify({
    source: values.source,
    customerType: values.customerType,
    productModelId: values.productModelId,
    productName: values.productName,
    paymentMethod: values.paymentMethod,
    financeProvider: values.financeProvider,
    service: values.service,
    periodYear: values.periodYear,
    periodMonth: values.periodMonth,
    eventDate: values.eventDate,
  });
}

export function manifestRowsSha256(rows: readonly NicknameDerivedManifestRow[]): string {
  const canonicalRows = [...rows].sort((a, b) => a.conversationId.localeCompare(b.conversationId));
  return sha256(JSON.stringify(canonicalRows));
}

export function createManifest(rows: readonly NicknameDerivedManifestRow[], parserVersion: string, createdAt = new Date().toISOString()): NicknameDerivedManifest {
  const canonicalRows = [...rows].sort((a, b) => a.conversationId.localeCompare(b.conversationId));
  if (new Set(canonicalRows.map((row) => row.conversationId)).size !== canonicalRows.length) {
    throw new Error("DUPLICATE_CONVERSATION_IN_MANIFEST");
  }
  const rowSetSha256 = manifestRowsSha256(canonicalRows);
  const sha256Value = sha256(JSON.stringify({ parserVersion, createdAt, rowSetSha256, rowCount: canonicalRows.length }));
  return { parserVersion, createdAt, rows: canonicalRows, rowSetSha256, sha256: sha256Value };
}

export function validateManifest(manifest: NicknameDerivedManifest, expectedParserVersion: string): void {
  if (manifest.parserVersion !== expectedParserVersion) throw new Error("MANIFEST_PARSER_VERSION_MISMATCH");
  if (manifestRowsSha256(manifest.rows) !== manifest.rowSetSha256) throw new Error("MANIFEST_ROW_SET_CHANGED");
  const expected = sha256(JSON.stringify({
    parserVersion: manifest.parserVersion,
    createdAt: manifest.createdAt,
    rowSetSha256: manifest.rowSetSha256,
    rowCount: manifest.rows.length,
  }));
  if (expected !== manifest.sha256) throw new Error("MANIFEST_HASH_MISMATCH");
  for (const row of manifest.rows) {
    if (row.parserVersion !== manifest.parserVersion || !/^[a-f0-9]{64}$/.test(row.nicknameSha256)) {
      throw new Error("INVALID_MANIFEST_ROW");
    }
    if (!hasDerivedValue(row.values)) throw new Error("EMPTY_DERIVED_MANIFEST_ROW");
  }
}

export function hasDerivedValue(values: NicknameDerivedValues): boolean {
  return values.source !== null || values.customerType !== null || values.productModelId !== null ||
    values.paymentMethod !== null || values.financeProvider !== null || values.service !== null ||
    values.periodYear !== null || values.eventDate !== null;
}

export function equalValues(left: NicknameDerivedValues, right: NicknameDerivedValues): boolean {
  return canonicalValues(left) === canonicalValues(right);
}

function rowCoverage(row: NicknameDerivedManifestRow): Set<string> {
  const keys = new Set<string>();
  if (row.values.productModelId) keys.add("PRODUCT");
  if (row.values.customerType) keys.add("ONLINE");
  if (row.values.financeProvider === "SG_FINANCE") keys.add("SG_FINANCE");
  if (row.values.financeProvider === "UFUND") keys.add("UFUND");
  if (row.values.paymentMethod === "CASH") keys.add("CASH");
  if (row.values.paymentMethod === "INSTALLMENT") keys.add("INSTALLMENT");
  if (row.values.source) keys.add("SOURCE");
  if (row.values.periodYear !== null) keys.add("PERIOD");
  if (row.values.eventDate) keys.add("EVENT_DATE");
  if (row.values.service) keys.add("FILM");
  if (row.profileKey === "A") keys.add("PROFILE_A");
  if (row.profileKey === "B") keys.add("PROFILE_B");
  return keys;
}

/** Stable greedy set-cover with additional weight for Store and profile diversity. */
export function selectRepresentativeCanary(rows: readonly NicknameDerivedManifestRow[], maxRows = 20): NicknameDerivedManifestRow[] {
  const remaining = [...rows].sort((a, b) => sha256(a.conversationId).localeCompare(sha256(b.conversationId)));
  const selected: NicknameDerivedManifestRow[] = [];
  const covered = new Set<string>();
  const stores = new Set<string>();
  while (remaining.length > 0 && selected.length < maxRows) {
    let bestIndex = -1;
    let bestScore = -1;
    for (let index = 0; index < remaining.length; index++) {
      const row = remaining[index];
      const fresh = [...rowCoverage(row)].filter((key) => !covered.has(key)).length;
      const newProfile = row.profileKey !== null && !covered.has(`PROFILE_${row.profileKey}`);
      const newStore = !stores.has(row.storeId) && stores.size < 2;
      const score = fresh * 100 + (newProfile ? 250 : 0) + (newStore ? 200 : 0);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    }
    if (bestIndex < 0 || bestScore === 0) break;
    const [row] = remaining.splice(bestIndex, 1);
    selected.push(row);
    stores.add(row.storeId);
    for (const key of rowCoverage(row)) covered.add(key);
  }
  return selected;
}

export function summarizeManifestRows(rows: readonly NicknameDerivedManifestRow[]) {
  const dimensions = {
    ONLINE: rows.filter((row) => row.values.customerType === "ONLINE").length,
    SOURCE: rows.filter((row) => row.values.source !== null).length,
    PRODUCT: rows.filter((row) => row.values.productModelId !== null).length,
    CASH: rows.filter((row) => row.values.paymentMethod === "CASH").length,
    INSTALLMENT: rows.filter((row) => row.values.paymentMethod === "INSTALLMENT").length,
    SG_FINANCE: rows.filter((row) => row.values.financeProvider === "SG_FINANCE").length,
    UFUND: rows.filter((row) => row.values.financeProvider === "UFUND").length,
    FILM: rows.filter((row) => row.values.service === "FILM_INSTALLATION").length,
    PERIOD: rows.filter((row) => row.values.periodYear !== null).length,
    EVENT_DATE: rows.filter((row) => row.values.eventDate !== null).length,
  };
  const combinations = new Map<string, number>();
  for (const row of rows) {
    const fields = [row.values.customerType, row.values.source, row.values.productModelId ? "PRODUCT" : null,
      row.values.paymentMethod, row.values.financeProvider, row.values.service,
      row.values.periodYear !== null ? "PERIOD" : null, row.values.eventDate ? "EVENT_DATE" : null].filter(Boolean);
    const key = fields.length ? fields.join("+") : "EMPTY";
    combinations.set(key, (combinations.get(key) ?? 0) + 1);
  }
  return { dimensions, combinations: Object.fromEntries([...combinations.entries()].sort(([a], [b]) => a.localeCompare(b))) };
}
