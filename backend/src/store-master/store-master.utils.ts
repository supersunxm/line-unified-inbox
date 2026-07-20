export type ParsedMasterRow = {
  externalStoreId: string | null;
  storeName: string;
  accountName: string;
  normalizedAccountName: string;
  lineOaLink: string | null;
  lineId: string | null;
  lineManagerUrl: string | null;
  province: string | null;
  region: string | null;
  sourceRowNumber: number;
  dataQualityStatus: "COMPLETE" | "MISSING_STORE_ID" | "INVALID_MANAGER_URL" | "INCOMPLETE";
};

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function isValidManagerUrl(value: string | null): boolean {
  if (!value) return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "manager.line.biz" && !url.username && !url.password && !url.search && !url.hash && /^\/account\/(?!xxx(?:\/|$))[^/]+\/?$/iu.test(url.pathname); } catch { return false; }
}

export function isValidLineOaUrl(value: string | null): boolean {
  if (!value) return false;
  try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "lin.ee" || url.hostname === "line.me" || url.hostname.endsWith(".line.me")); } catch { return false; }
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted && char === '"' && csv[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && csv[index + 1] === "\n") index += 1; row.push(field); if (row.some((value) => value.length > 0)) rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function normalizedHeader(value: string) { return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase(); }
function clean(value?: string) { const result = value?.trim(); return result || null; }

export function parseStoreMasterCsv(csv: string): ParsedMasterRow[] {
  const [headers, ...data] = parseCsv(csv); if (!headers) return [];
  const indexes = new Map(headers.map((header, index) => [normalizedHeader(header), index]));
  const at = (row: string[], ...names: string[]) => clean(row[names.map(normalizedHeader).map((name) => indexes.get(name)).find((index) => index !== undefined) ?? -1]);
  return data.map((row, index) => {
    const rawStoreId = at(row, "STORE ID"); const externalStoreId = rawStoreId && rawStoreId.toLocaleLowerCase() !== "xxx" ? rawStoreId : null;
    const storeName = at(row, "STORE NAME") ?? ""; const accountName = at(row, "ACCOUNT NAME") ?? "";
    const lineManagerUrl = at(row, "URLS"); const province = at(row, "Province / จังหวัด", "Province จังหวัด"); const region = at(row, "Region / ภูมิภาค", "Region ภูมิภาค");
    const incomplete = !storeName || !accountName;
    const dataQualityStatus = incomplete ? "INCOMPLETE" : !externalStoreId ? "MISSING_STORE_ID" : !isValidManagerUrl(lineManagerUrl) ? "INVALID_MANAGER_URL" : "COMPLETE";
    return { externalStoreId, storeName, accountName, normalizedAccountName: normalizeSearchText(accountName), lineOaLink: at(row, "Line OA Link"), lineId: at(row, "Line ID"), lineManagerUrl, province, region, sourceRowNumber: index + 2, dataQualityStatus };
  });
}

export function similarity(left: string, right: string): number {
  if (!left || !right) return 0; if (left === right) return 1; if (left.includes(right) || right.includes(left)) return 0.9;
  const pairs = (value: string) => new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, i) => value.slice(i, i + 2)));
  const a = pairs(left); const b = pairs(right); if (!a.size || !b.size) return 0;
  let overlap = 0; for (const pair of a) if (b.has(pair)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

const provinceRegions: Record<string, string> = { lamphun: "Northern", chiangmai: "Northern", nonthaburi: "Central", bangkok: "Central", khonkaen: "Northeastern", prachuapkhirikhan: "Western" };
export function regionFromProvince(province: string | null): string | null { return province ? provinceRegions[normalizeSearchText(province)] ?? null : null; }
