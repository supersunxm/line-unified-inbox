import { chromium } from "playwright";

type JsonRecord = Record<string, unknown>;

type PostMetrics = {
  id: string;
  url: string;
  description: string | null;
  createTime: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
};

const HYDRATION_IDS = [
  "__UNIVERSAL_DATA_FOR_REHYDRATION__",
  "SIGI_STATE",
  "__NEXT_DATA__",
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/gu, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstString(record: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(record: JsonRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeUsername(input: string): string {
  const trimmed = input.trim().replace(/^@+/u, "");
  if (!/^[A-Za-z0-9._]{1,50}$/u.test(trimmed)) throw new Error("Invalid TikTok username");
  return trimmed.toLowerCase();
}

function parseJson(text: string | null): unknown {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function statsRecord(record: JsonRecord): JsonRecord | null {
  return isRecord(record.statsV2)
    ? record.statsV2
    : isRecord(record.stats)
      ? record.stats
      : isRecord(record.statistics)
        ? record.statistics
        : null;
}

function authorUsername(record: JsonRecord): string | null {
  const author = isRecord(record.author) ? record.author : null;
  return author
    ? firstString(author, ["uniqueId", "unique_id", "username"])
    : firstString(record, ["authorUniqueId", "author_username"]);
}

function looksLikePostRecord(record: JsonRecord, username: string): boolean {
  const id = firstString(record, ["id", "aweme_id", "itemId"]);
  if (!id || !/^\d{10,}$/u.test(id)) return false;

  const author = authorUsername(record);
  if (author && author.toLowerCase() !== username) return false;

  const stats = statsRecord(record);
  if (!stats) return false;
  const hasPostStat = [
    "playCount",
    "play_count",
    "viewCount",
    "view_count",
    "diggCount",
    "digg_count",
    "likeCount",
    "like_count",
    "commentCount",
    "comment_count",
    "shareCount",
    "share_count",
  ].some((key) => stats[key] !== undefined);

  return hasPostStat;
}

function postFromRecord(record: JsonRecord, username: string, expectedId: string): PostMetrics | null {
  const id = firstString(record, ["id", "aweme_id", "itemId"]);
  if (id !== expectedId) return null;

  const author = authorUsername(record);
  if (author && author.toLowerCase() !== username) return null;

  const stats = statsRecord(record);
  if (!stats) return null;

  const createTimeSeconds = firstNumber(record, ["createTime", "create_time"]);
  return {
    id,
    url: `https://www.tiktok.com/@${username}/video/${id}`,
    description: firstString(record, ["desc", "description", "video_description", "title"]),
    createTime: createTimeSeconds !== null ? new Date(createTimeSeconds * 1000).toISOString() : null,
    viewCount: firstNumber(stats, ["playCount", "play_count", "viewCount", "view_count"]),
    likeCount: firstNumber(stats, ["diggCount", "digg_count", "likeCount", "like_count"]),
    commentCount: firstNumber(stats, ["commentCount", "comment_count"]),
    shareCount: firstNumber(stats, ["shareCount", "share_count"]),
  };
}

function findPostDeep(value: unknown, username: string, expectedId: string): PostMetrics | null {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): PostMetrics | null => {
    if (depth > 28 || current === null || typeof current !== "object") return null;
    if (seen.has(current)) return null;
    seen.add(current);

    if (isRecord(current)) {
      const direct = postFromRecord(current, username, expectedId);
      if (direct) return direct;
      for (const nested of Object.values(current)) {
        const found = walk(nested, depth + 1);
        if (found) return found;
      }
      return null;
    }

    if (Array.isArray(current)) {
      for (const nested of current) {
        const found = walk(nested, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(value, 0);
}

function collectStructuredPostIds(value: unknown, username: string, output: string[]): void {
  const seenObjects = new WeakSet<object>();
  const seenIds = new Set(output);

  const walk = (current: unknown, depth: number): void => {
    if (depth > 28 || current === null || typeof current !== "object") return;
    if (seenObjects.has(current)) return;
    seenObjects.add(current);

    if (isRecord(current)) {
      if (looksLikePostRecord(current, username)) {
        const id = firstString(current, ["id", "aweme_id", "itemId"]);
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          output.push(id);
        }
      }
      for (const nested of Object.values(current)) walk(nested, depth + 1);
      return;
    }

    if (Array.isArray(current)) {
      for (const nested of current) walk(nested, depth + 1);
    }
  };

  walk(value, 0);
}

function collectVideoIdsFromText(text: string, username: string, output: string[]): void {
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const patterns = [
    new RegExp(`(?:https?:\\/\\/www\\.tiktok\\.com)?\\/@${escapedUsername}\\/video\\/(\\d{10,})`, "giu"),
    new RegExp(`\\/@${escapedUsername}\\/video\\/(\\d{10,})`, "giu"),
  ];

  const seen = new Set(output);
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const id = match[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      output.push(id);
    }
  }
}

function collectObservedPostIds(value: unknown, username: string): string[] {
  const ids: string[] = [];
  collectStructuredPostIds(value, username, ids);
  return ids.slice(0, 10);
}

async function main(): Promise<void> {
  const username = normalizeUsername(process.argv[2] || "o_centralworld");
  const requestedLimit = Number(process.argv[3] || "3");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 5) : 3;
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Bangkok",
      viewport: { width: 1440, height: 1200 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
      extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9,th;q=0.8" },
    });

    const profilePage = await context.newPage();
    await profilePage.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await profilePage.waitForTimeout(2_500);
    await profilePage.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight * 0.6, 1000)));
    await profilePage.waitForTimeout(1_500);

    const discovery = await profilePage.evaluate(({ targetUsername, scriptIds }) => {
      const anchorUrls: string[] = [];
      const seen = new Set<string>();
      for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"]'))) {
        const href = anchor.href;
        if (!href.includes(`/@${targetUsername}/video/`)) continue;
        const normalized = href.split("?")[0]?.split("#")[0] ?? href;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        anchorUrls.push(normalized);
      }

      return {
        anchorUrls,
        hydrationTexts: scriptIds.map((id) => document.getElementById(id)?.textContent ?? ""),
        html: document.documentElement.outerHTML.slice(0, 2_000_000),
      };
    }, { targetUsername: username, scriptIds: HYDRATION_IDS });

    const structuredIds: string[] = [];
    const urlIds: string[] = [];
    for (const text of discovery.hydrationTexts) {
      const payload = parseJson(text);
      if (payload !== null) collectStructuredPostIds(payload, username, structuredIds);
      collectVideoIdsFromText(text, username, urlIds);
    }
    for (const url of discovery.anchorUrls) {
      const match = url.match(/\/video\/(\d{10,})/u);
      if (match?.[1] && !urlIds.includes(match[1])) urlIds.push(match[1]);
    }
    collectVideoIdsFromText(discovery.html, username, urlIds);

    const videoIds = [...structuredIds, ...urlIds.filter((id) => !structuredIds.includes(id))];
    const ids = videoIds.slice(0, limit);
    const urls = ids.map((id) => `https://www.tiktok.com/@${username}/video/${id}`);
    const posts: PostMetrics[] = [];
    const diagnostics: Array<{
      id: string;
      url: string;
      hydrationPayloadCount: number;
      found: boolean;
      blocked: boolean;
      observedPostIds: string[];
    }> = [];

    for (const url of urls) {
      const idMatch = url.match(/\/video\/(\d+)/u);
      const id = idMatch?.[1];
      if (!id) continue;

      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(2_000);

        const snapshot = await page.evaluate((scriptIds) => ({
          scripts: scriptIds.map((scriptId) => document.getElementById(scriptId)?.textContent ?? null),
          bodyText: (document.body?.innerText ?? "").slice(0, 4_000),
        }), HYDRATION_IDS);

        const payloads = snapshot.scripts.map(parseJson).filter((payload) => payload !== null);
        let found: PostMetrics | null = null;
        const observedPostIds: string[] = [];
        for (const payload of payloads) {
          found ??= findPostDeep(payload, username, id);
          for (const observedId of collectObservedPostIds(payload, username)) {
            if (!observedPostIds.includes(observedId)) observedPostIds.push(observedId);
          }
        }
        if (found) posts.push(found);

        const bodyLower = snapshot.bodyText.toLowerCase();
        const blocked = ["captcha", "verify to continue", "security verification", "access denied"]
          .some((marker) => bodyLower.includes(marker));
        diagnostics.push({
          id,
          url,
          hydrationPayloadCount: payloads.length,
          found: Boolean(found),
          blocked,
          observedPostIds: observedPostIds.slice(0, 10),
        });
      } catch {
        diagnostics.push({ id, url, hydrationPayloadCount: 0, found: false, blocked: false, observedPostIds: [] });
      } finally {
        await page.close();
      }
    }

    process.stdout.write(`${JSON.stringify({
      username,
      discovery: {
        anchorVideoUrls: discovery.anchorUrls.length,
        hydrationScripts: discovery.hydrationTexts.filter(Boolean).length,
        structuredPostIds: structuredIds.length,
        urlDerivedVideoIds: urlIds.length,
        candidateVideoIds: videoIds.length,
      },
      discoveredVideoUrls: urls.length,
      exactPostsFound: posts.length,
      posts,
      diagnostics,
      fetchedAt: new Date().toISOString(),
    }, null, 2)}\n`);

    if (posts.length === 0) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "TikTok public post probe failed");
  process.exitCode = 1;
});
