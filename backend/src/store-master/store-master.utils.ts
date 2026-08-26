export type ParsedMasterRow = {
  externalStoreId: string | null;
  storeName: string;
  accountName: string;
  normalizedAccountName: string;
  lineOaLink: string | null;
  lineId: string | null;
  lineManagerUrl: string | null;
  tiktokUsername: string | null;
  tiktokProfileUrl: string | null;
  googleMapsUrl: string | null;
  province: string | null;
  region: string | null;
  sourceRowNumber: number;
  dataQualityStatus: "COMPLETE" | "MISSING_STORE_ID" | "INVALID_MANAGER_URL" | "INCOMPLETE";
};

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function cleanTikTokUsername(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "#REF!" || trimmed.toLocaleLowerCase() === "none") return null;
  const stripped = trimmed.replace(/^@+/u, "").trim();
  return stripped || null;
}

export function isValidManagerUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "manager.line.biz" || url.hostname === "chat.line.biz") &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/account\/(?!xxx(?:\/|$))[^/]+\/?$/iu.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isValidLineOaUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "lin.ee" || url.hostname === "line.me" || url.hostname.endsWith(".line.me"))
    );
  } catch {
    return false;
  }
}

export function isValidTikTokProfileUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "www.tiktok.com" ||
        url.hostname === "tiktok.com" ||
        url.hostname === "vt.tiktok.com" ||
        url.hostname.endsWith(".tiktok.com"))
    );
  } catch {
    return false;
  }
}

export function isValidGoogleMapsUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "maps.app.goo.gl") return true;
    if (host === "goo.gl" && url.pathname.startsWith("/maps")) return true;
    if (host.startsWith("maps.google.")) return true;
    if (
      (host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "google.co.th" ||
        host.endsWith(".google.co.th") ||
        /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host)) &&
      url.pathname.startsWith("/maps")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function extractTikTokUsernameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/@?([^/?#]+)/u);
    return match ? match[1].toLocaleLowerCase() : null;
  } catch {
    return null;
  }
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted && char === '"' && csv[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizedHeader(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function clean(value?: string | null) {
  const result = value?.trim();
  return result && result !== "#REF!" ? result : null;
}

export function parseStoreMasterCsv(csv: string): ParsedMasterRow[] {
  const [headers, ...data] = parseCsv(csv);
  if (!headers) return [];
  const indexes = new Map(headers.map((header, index) => [normalizedHeader(header), index]));
  const at = (row: string[], ...names: string[]) =>
    clean(
      row[
        names
          .map(normalizedHeader)
          .map((name) => indexes.get(name))
          .find((index) => index !== undefined) ?? -1
      ]
    );

  return data.map((row, index) => {
    const rawStoreId = at(row, "STORE ID");
    const externalStoreId =
      rawStoreId && rawStoreId.toLocaleLowerCase() !== "xxx" ? rawStoreId : null;
    const storeName = at(row, "STORE NAME") ?? "";
    const accountName = at(row, "ACCOUNT NAME") ?? "";
    const lineManagerUrl = at(row, "URLS");
    const province = at(row, "Province / จังหวัด", "Province จังหวัด");
    const region = at(row, "Region / ภูมิภาค", "Region ภูมิภาค");

    // Column I (TikTok Username) & Column J (TikTok Profile URL)
    const rawTikTokUsername = at(
      row,
      "TikTok Username",
      "TIKTOK USERNAME",
      "TikTok User",
      "TikTok Account",
      "TikTok UserName",
      "tiktok"
    );
    const tiktokUsername = cleanTikTokUsername(rawTikTokUsername);

    const rawTikTokProfileUrl = at(
      row,
      "TikTok Profile URL",
      "TIKTOK PROFILE URL",
      "TikTok URL",
      "TikTok Link",
      "TikTok Profile",
      "TikTok Links",
      "tiktok link"
    );
    const tiktokProfileUrl = clean(rawTikTokProfileUrl);

    // Column K (Google Maps links)
    const rawGoogleMapsUrl = at(
      row,
      "Google Maps links",
      "Google Maps Link",
      "Google Maps URL",
      "googleMapsUrl",
      "Google Maps Links",
      "Google Maps",
      "google maps",
      "google maps link",
      "google maps url",
      "google maps links",
      "Google Map",
      "google map"
    );
    const googleMapsUrl = clean(rawGoogleMapsUrl);

    const incomplete = !storeName || !accountName;
    const dataQualityStatus = incomplete
      ? "INCOMPLETE"
      : !externalStoreId
      ? "MISSING_STORE_ID"
      : !isValidManagerUrl(lineManagerUrl)
      ? "INVALID_MANAGER_URL"
      : "COMPLETE";

    return {
      externalStoreId,
      storeName,
      accountName,
      normalizedAccountName: normalizeSearchText(accountName),
      lineOaLink: at(row, "Line OA Link"),
      lineId: at(row, "Line ID"),
      lineManagerUrl,
      tiktokUsername,
      tiktokProfileUrl,
      googleMapsUrl,
      province,
      region,
      sourceRowNumber: index + 2,
      dataQualityStatus,
    };
  });
}

export function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const pairs = (value: string) =>
    new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, i) => value.slice(i, i + 2)));
  const a = pairs(left);
  const b = pairs(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const pair of a) if (b.has(pair)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

const provinceRegions: Record<string, string> = {
  lamphun: "Northern",
  chiangmai: "Northern",
  nonthaburi: "Central",
  bangkok: "Central",
  khonkaen: "Northeastern",
  prachuapkhirikhan: "Western",
};

export function regionFromProvince(province: string | null): string | null {
  return province ? provinceRegions[normalizeSearchText(province)] ?? null : null;
}
