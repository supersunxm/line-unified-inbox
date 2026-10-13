import { createHash } from "node:crypto";

export type StoreMasterCsvSnapshot = Readonly<{
  csv: string;
  bytes: Uint8Array;
  sha256: string;
  sourceUrl: string;
  fetchedAt: string;
}>;

export function resolveStoreMasterCsvExportUrl(configuredUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(configuredUrl.trim());
  } catch {
    throw new Error("Invalid STORE_MASTER_GOOGLE_SHEET_URL");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "docs.google.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Invalid STORE_MASTER_GOOGLE_SHEET_URL");
  }

  const match = parsed.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/.*)?$/u);
  if (!match) throw new Error("Invalid STORE_MASTER_GOOGLE_SHEET_URL");

  const queryGids = parsed.searchParams.getAll("gid");
  if (queryGids.length > 1) throw new Error("Ambiguous Google Sheets gid configuration");

  let fragmentGid: string | undefined;
  if (parsed.hash) {
    const fragmentParams = new URLSearchParams(parsed.hash.slice(1));
    const fragmentKeys = [...fragmentParams.keys()];
    const fragmentGids = fragmentParams.getAll("gid");
    if (fragmentKeys.length !== 1 || fragmentKeys[0] !== "gid" || fragmentGids.length !== 1) {
      throw new Error("Ambiguous Google Sheets fragment configuration");
    }
    fragmentGid = fragmentGids[0];
  }

  const queryGid = queryGids[0];
  if (queryGid !== undefined && fragmentGid !== undefined && queryGid !== fragmentGid) {
    throw new Error("Conflicting Google Sheets gid configuration");
  }
  const gid = queryGid ?? fragmentGid;
  if (gid !== undefined && !/^\d+$/u.test(gid)) {
    throw new Error("Invalid Google Sheets gid configuration");
  }

  const exportUrl = new URL(`/spreadsheets/d/${match[1]}/export`, parsed.origin);
  exportUrl.searchParams.set("format", "csv");
  if (gid !== undefined) exportUrl.searchParams.set("gid", gid);
  return exportUrl.toString();
}

export function createStoreMasterCsvSnapshot(
  sourceBytes: Uint8Array,
  sourceUrl: string,
  fetchedAt = new Date(),
): StoreMasterCsvSnapshot {
  const bytes = new Uint8Array(sourceBytes);
  let csv: string;
  try {
    csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Google Sheets CSV is not valid UTF-8");
  }

  return {
    csv,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceUrl,
    fetchedAt: fetchedAt.toISOString(),
  };
}

export function assertStoreMasterCsvSnapshot(snapshot: StoreMasterCsvSnapshot): void {
  if (!/^[a-f0-9]{64}$/u.test(snapshot.sha256)) {
    throw new Error("Invalid Store Master source snapshot digest");
  }
  if (!(snapshot.bytes instanceof Uint8Array)) {
    throw new Error("Store Master source snapshot is missing its original bytes");
  }
  const actual = createHash("sha256").update(snapshot.bytes).digest("hex");
  if (actual !== snapshot.sha256) {
    throw new Error("Store Master source changed after validation; no data was changed");
  }
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(snapshot.bytes);
  } catch {
    throw new Error("Store Master source snapshot is not valid UTF-8");
  }
  if (decoded !== snapshot.csv) {
    throw new Error("Store Master source text does not match its original bytes; no data was changed");
  }
}

export async function fetchStoreMasterCsvSnapshot(
  configuredUrl = process.env.STORE_MASTER_GOOGLE_SHEET_URL,
  fetcher: typeof fetch = fetch,
): Promise<StoreMasterCsvSnapshot> {
  if (!configuredUrl?.trim()) {
    throw new Error("STORE_MASTER_GOOGLE_SHEET_URL is not configured");
  }
  const sourceUrl = resolveStoreMasterCsvExportUrl(configuredUrl);
  const response = await fetcher(sourceUrl);
  if (!response.ok) throw new Error(`Google Sheets export failed (${response.status})`);
  if (response.headers.get("content-type")?.toLocaleLowerCase().includes("text/html")) {
    throw new Error("Google Sheets returned HTML instead of CSV");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return createStoreMasterCsvSnapshot(bytes, sourceUrl, new Date());
}
