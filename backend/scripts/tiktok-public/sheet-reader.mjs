import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1rUYhol7ASlgRy_QTBezUkQi9e-AR-_LwPcNRgZGKtKw/export?format=csv";

/**
 * Normalizes a raw TikTok username or profile URL into a clean lowercase handle.
 * Rejects invalid tokens like #REF!, blank, or non-alphanumeric formats.
 */
export function normalizeTikTokUsername(input) {
  if (!input || typeof input !== "string") return null;

  let candidate = input.trim();
  if (!candidate) return null;

  // Reject spreadsheet error values
  if (candidate.startsWith("#") || candidate.toUpperCase() === "NULL" || candidate.toUpperCase() === "UNDEFINED") {
    return null;
  }

  // Handle URL format: https://www.tiktok.com/@username
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsedUrl = new URL(candidate);
      const match = parsedUrl.pathname.match(/^\/@([^/?#]+)/);
      if (match && match[1]) {
        candidate = match[1];
      }
    } catch {
      return null;
    }
  }

  // Strip leading @ and whitespace
  candidate = candidate.replace(/^@+/, "").trim().toLowerCase();

  // TikTok usernames can contain alphanumeric, dots, underscores, and hyphens
  if (!/^[a-z0-9._-]{1,50}$/.test(candidate)) {
    return null;
  }

  return candidate;
}

/**
 * Robust CSV parser that handles newlines and quotes inside quoted fields.
 */
export function parseCsv(csvText) {
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && csvText[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentVal);
      currentVal = "";
      if (currentRow.some((val) => val.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some((val) => val.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Downloads the CSV from Google Sheets with redirect following.
 */
export function fetchSheetCsv(url = DEFAULT_SHEET_CSV_URL, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchSheetCsv(res.headers.location, timeoutMs));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch Google Sheet CSV: HTTP ${res.statusCode}`));
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout while fetching Google Sheet CSV"));
    });
  });
}

/**
 * Parses the raw CSV text and extracts deduplicated TikTok accounts with associated stores.
 */
export function extractAccountsFromCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("Sheet contains insufficient rows");
  }

  const header = rows[0].map((h) => h.trim().toUpperCase());
  const storeIdIdx = header.findIndex((h) => h === "STORE ID");
  const storeNameIdx = header.findIndex((h) => h === "STORE NAME");
  const tiktokUserIdx = header.findIndex((h) => h.includes("TIKTOK USERNAME"));
  const tiktokUrlIdx = header.findIndex((h) => h.includes("TIKTOK PROFILE URL"));

  if (storeIdIdx === -1 || storeNameIdx === -1) {
    throw new Error("Missing required STORE ID or STORE NAME columns in CSV");
  }

  let totalStoreRows = 0;
  let rowsWithTiktok = 0;
  let blankOrInvalid = 0;

  // Map normalized username -> { username, profileUrl, stores: [{ storeId, storeName, rawUsername, rawUrl }] }
  const accountMap = new Map();
  const blankStores = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const storeId = row[storeIdIdx]?.trim();
    const storeName = row[storeNameIdx]?.trim();
    if (!storeId && !storeName) continue;

    totalStoreRows++;

    const rawUser = tiktokUserIdx !== -1 ? row[tiktokUserIdx]?.trim() : "";
    const rawUrl = tiktokUrlIdx !== -1 ? row[tiktokUrlIdx]?.trim() : "";

    const candidate = rawUser || rawUrl;
    const normalized = normalizeTikTokUsername(candidate);

    if (normalized) {
      rowsWithTiktok++;
      const profileUrl = `https://www.tiktok.com/@${normalized}`;

      if (!accountMap.has(normalized)) {
        accountMap.set(normalized, {
          username: normalized,
          profileUrl,
          stores: [],
        });
      }

      accountMap.get(normalized).stores.push({
        storeId,
        storeName,
        rawUser: rawUser || null,
        rawUrl: rawUrl || null,
      });
    } else {
      blankOrInvalid++;
      blankStores.push({ storeId, storeName });
    }
  }

  const uniqueAccounts = Array.from(accountMap.values());
  const duplicateGroups = uniqueAccounts.filter((acc) => acc.stores.length > 1);

  return {
    totalStoreRows,
    rowsWithTiktok,
    blankOrInvalid,
    uniqueAccountsCount: uniqueAccounts.length,
    uniqueAccounts,
    duplicateGroupsCount: duplicateGroups.length,
    duplicateGroups,
    blankStores,
  };
}

/**
 * Convenience function: fetches CSV and returns parsed unique target accounts.
 */
export async function loadTargetTikTokAccounts(options = {}) {
  const csvUrl = options.sheetUrl || DEFAULT_SHEET_CSV_URL;
  const timeoutMs = options.timeoutMs || 30000;

  const csvText = await fetchSheetCsv(csvUrl, timeoutMs);
  return extractAccountsFromCsv(csvText);
}
