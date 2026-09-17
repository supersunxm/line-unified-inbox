import https from "node:https";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1rUYhol7ASlgRy_QTBezUkQi9e-AR-_LwPcNRgZGKtKw/export?format=csv";

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchCsv(res.headers.location));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
  });
}

function parseFullCsv(csvText) {
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
      if (currentRow.some(val => val.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some(val => val.trim().length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function normalizeUsername(raw) {
  if (!raw) return null;
  let cleaned = raw.trim();
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const u = new URL(cleaned);
      const match = u.pathname.match(/^\/@([^/?#]+)/);
      if (match) cleaned = match[1];
    } catch {}
  }
  cleaned = cleaned.replace(/^@+/, "").trim().toLowerCase();
  return cleaned || null;
}

async function main() {
  const csvText = await fetchCsv(SHEET_URL);
  const rows = parseFullCsv(csvText);

  const header = rows[0].map(h => h.trim().toUpperCase());
  console.error("Header parsed:", header);

  const storeIdIdx = header.findIndex(h => h === "STORE ID");
  const storeNameIdx = header.findIndex(h => h === "STORE NAME");
  const tiktokUserIdx = header.findIndex(h => h.includes("TIKTOK USERNAME") || h === "TIKTOK USERNAME");
  const tiktokUrlIdx = header.findIndex(h => h.includes("TIKTOK PROFILE URL") || h === "TIKTOK PROFILE URL");

  console.error(`Indices: storeId=${storeIdIdx}, storeName=${storeNameIdx}, tiktokUser=${tiktokUserIdx}, tiktokUrl=${tiktokUrlIdx}`);

  let totalDataRows = rows.length - 1;
  let rowsWithTiktok = 0;
  let blankOrInvalid = 0;

  const usernameToStores = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const storeId = row[storeIdIdx]?.trim();
    const storeName = row[storeNameIdx]?.trim();
    const rawUser = row[tiktokUserIdx]?.trim();
    const rawUrl = row[tiktokUrlIdx]?.trim();

    const candidate = rawUser || rawUrl;
    const normalized = normalizeUsername(candidate);

    if (normalized) {
      rowsWithTiktok++;
      if (!usernameToStores.has(normalized)) {
        usernameToStores.set(normalized, []);
      }
      usernameToStores.get(normalized).push({ storeId, storeName, rawUser, rawUrl });
    } else {
      blankOrInvalid++;
    }
  }

  const uniqueUsernames = usernameToStores.size;
  const duplicateGroups = [];
  for (const [uname, list] of usernameToStores.entries()) {
    if (list.length > 1) {
      duplicateGroups.push({
        username: uname,
        count: list.length,
        stores: list
      });
    }
  }

  console.log(JSON.stringify({
    totalDataRows,
    rowsWithTiktok,
    blankOrInvalid,
    uniqueUsernames,
    duplicateGroupsCount: duplicateGroups.length,
    duplicateGroups
  }, null, 2));
}

main().catch(console.error);
