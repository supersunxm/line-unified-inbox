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
  return [
    "playCount", "play_count", "viewCount", "view_count",
    "diggCount", "digg_count", "likeCount", "like_count",
    "commentCount", "comment_count", "shareCount", "share_count",
  ].some((key) => stats[key] !== undefined);
}

function postFromRecord(record: JsonRecord, username: string): PostMetrics | null {
  const id = firstString(record, ["id", "aweme_id", "itemId"]);
  if (!id) return null;

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

function findSecUidDeep(value: unknown, username: string): string | null {
  const seen = new WeakSet<object>();
  const walk = (current: unknown, depth: number): string | null => {
    if (depth > 25 || current === null || typeof current !== "object") return null;
    if (seen.has(current)) return null;
    seen.add(current);

    if (isRecord(current)) {
      const uniqueId = firstString(current, ["uniqueId", "unique_id", "username"]);
      const secUid = firstString(current, ["secUid", "sec_uid"]);
      if (secUid && (!uniqueId || uniqueId.toLowerCase() === username)) return secUid;
      for (const nested of Object.values(current)) {
        const found = walk(nested, depth + 1);
        if (found) return found;
      }
      return null;
    }

    for (const nested of current as unknown[]) {
      const found = walk(nested, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(value, 0);
}

function collectPostsDeep(value: unknown, username: string, output: Map<string, PostMetrics>): void {
  const seen = new WeakSet<object>();
  const walk = (current: unknown, depth: number): void => {
    if (depth > 28 || current === null || typeof current !== "object") return;
    if (seen.has(current)) return;
    seen.add(current);

    if (isRecord(current)) {
      if (looksLikePostRecord(current, username)) {
        const post = postFromRecord(current, username);
        if (post && !output.has(post.id)) output.set(post.id, post);
      }
      for (const nested of Object.values(current)) walk(nested, depth + 1);
      return;
    }

    for (const nested of current as unknown[]) walk(nested, depth + 1);
  };
  walk(value, 0);
}

function sanitizePrefix(text: string): string {
  return text.slice(0, 240).replace(/[\r\n\t]+/gu, " ").replace(/\s{2,}/gu, " ").trim();
}

async function main(): Promise<void> {
  const username = normalizeUsername(process.argv[2] || "o_centralworld");
  const requestedLimit = Number(process.argv[3] || "3");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 10) : 3;
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
    await profilePage.waitForTimeout(2_000);

    const hydrationTexts = await profilePage.evaluate((scriptIds) =>
      scriptIds.map((id) => document.getElementById(id)?.textContent ?? ""), HYDRATION_IDS);
    const hydrationPayloads = hydrationTexts.map(parseJson).filter((value) => value !== null);

    let secUid: string | null = null;
    for (const payload of hydrationPayloads) secUid ??= findSecUidDeep(payload, username);

    let apiStatus: number | null = null;
    let apiContentType: string | null = null;
    let apiPayload: unknown = null;
    let apiError: string | null = null;
    let apiBodyLength = 0;
    let apiBodyPrefix = "";

    if (secUid) {
      const apiResult = await profilePage.evaluate(async ({ userSecUid, count }) => {
        const params = new URLSearchParams({
          aid: "1988",
          count: String(count),
          cursor: "0",
          secUid: userSecUid,
        });
        try {
          const response = await fetch(`/api/post/item_list/?${params.toString()}`, {
            credentials: "include",
            headers: { accept: "application/json, text/plain, */*" },
          });
          const text = await response.text();
          return {
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get("content-type"),
            text: text.slice(0, 2_000_000),
            error: null as string | null,
          };
        } catch (error: unknown) {
          return {
            ok: false,
            status: 0,
            contentType: null,
            text: "",
            error: error instanceof Error ? error.message : "fetch failed",
          };
        }
      }, { userSecUid: secUid, count: Math.max(limit, 10) });

      apiStatus = apiResult.status;
      apiContentType = apiResult.contentType;
      apiError = apiResult.error;
      apiBodyLength = apiResult.text.length;
      apiBodyPrefix = sanitizePrefix(apiResult.text);
      apiPayload = parseJson(apiResult.text);
    }

    const postsById = new Map<string, PostMetrics>();
    for (const payload of hydrationPayloads) collectPostsDeep(payload, username, postsById);
    if (apiPayload !== null) collectPostsDeep(apiPayload, username, postsById);

    const posts = Array.from(postsById.values())
      .sort((a, b) => {
        const left = a.createTime ? Date.parse(a.createTime) : 0;
        const right = b.createTime ? Date.parse(b.createTime) : 0;
        return right - left;
      })
      .slice(0, limit);

    process.stdout.write(`${JSON.stringify({
      username,
      profileHydrationPayloadCount: hydrationPayloads.length,
      secUidFound: Boolean(secUid),
      postListApi: {
        attempted: Boolean(secUid),
        status: apiStatus,
        contentType: apiContentType,
        bodyLength: apiBodyLength,
        bodyPrefix: apiBodyPrefix,
        parsedJson: apiPayload !== null,
        error: apiError,
      },
      exactPostsFound: posts.length,
      posts,
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
