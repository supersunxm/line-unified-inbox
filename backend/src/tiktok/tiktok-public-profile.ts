import { chromium } from "playwright";

export type TikTokPublicProbeStatus = "OK" | "PARTIAL" | "BLOCKED_OR_CHANGED";

export interface TikTokPublicProfile {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bioDescription: string | null;
  isVerified: boolean | null;
  followerCount: number | null;
  followingCount: number | null;
  likesCount: number | null;
  videoCount: number | null;
  profileUrl: string;
}

export interface TikTokPublicPost {
  id: string;
  description: string | null;
  createTime: string | null;
  coverImageUrl: string | null;
  shareUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
}

export interface TikTokPublicProbeResult {
  status: TikTokPublicProbeStatus;
  fetchedAt: string;
  profile: TikTokPublicProfile | null;
  recentPosts: TikTokPublicPost[];
  diagnostics: {
    finalUrl: string;
    pageTitle: string;
    hydrationPayloadCount: number;
    capturedApiPayloadCount: number;
    captchaOrBlockDetected: boolean;
    message: string | null;
  };
}

interface ExtractedPayloadData {
  profile: TikTokPublicProfile | null;
  posts: TikTokPublicPost[];
}

type JsonRecord = Record<string, unknown>;

const PROFILE_SCRIPT_IDS = [
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

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
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

function normalizeUsernameLoose(value: string): string {
  return value.trim().replace(/^@+/u, "").toLowerCase();
}

export function normalizeTikTokPublicUsername(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("TikTok username is required");

  let candidate = trimmed;
  if (/^https?:\/\//iu.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error("Invalid TikTok profile URL");
    }
    const match = url.pathname.match(/^\/@([^/?#]+)/u);
    if (!match?.[1]) throw new Error("TikTok URL must contain a profile username");
    candidate = match[1];
  }

  candidate = candidate.replace(/^@+/u, "").trim();
  if (!candidate || !/^[A-Za-z0-9._]{1,50}$/u.test(candidate)) {
    throw new Error("Invalid TikTok username");
  }
  return candidate.toLowerCase();
}

function getAvatarUrl(user: JsonRecord): string | null {
  for (const key of ["avatarLarger", "avatarMedium", "avatarThumb", "avatar_url", "avatar_url_100"]) {
    const value = user[key];
    const direct = asString(value);
    if (direct) return direct;
    if (isRecord(value)) {
      const urlList = value.urlList;
      if (Array.isArray(urlList)) {
        const first = urlList.map(asString).find((item): item is string => Boolean(item));
        if (first) return first;
      }
    }
  }
  return null;
}

function buildProfile(
  user: JsonRecord,
  stats: JsonRecord,
  targetUsername: string,
): TikTokPublicProfile | null {
  const uniqueId = firstString(user, ["uniqueId", "unique_id", "username"]);
  if (uniqueId && normalizeUsernameLoose(uniqueId) !== targetUsername) return null;

  const resolvedUsername = uniqueId ? normalizeUsernameLoose(uniqueId) : targetUsername;
  const followerCount = firstNumber(stats, ["followerCount", "follower_count"]);
  const followingCount = firstNumber(stats, ["followingCount", "following_count"]);
  const likesCount = firstNumber(stats, ["heartCount", "heart", "likesCount", "likes_count"]);
  const videoCount = firstNumber(stats, ["videoCount", "video_count"]);

  if (
    !uniqueId &&
    followerCount === null &&
    followingCount === null &&
    likesCount === null &&
    videoCount === null
  ) {
    return null;
  }

  return {
    username: resolvedUsername,
    displayName: firstString(user, ["nickname", "displayName", "display_name"]),
    avatarUrl: getAvatarUrl(user),
    bioDescription: firstString(user, ["signature", "bioDescription", "bio_description"]),
    isVerified: asBoolean(user.verified) ?? asBoolean(user.is_verified),
    followerCount,
    followingCount,
    likesCount,
    videoCount,
    profileUrl: `https://www.tiktok.com/@${resolvedUsername}`,
  };
}

function findProfileInRecord(record: JsonRecord, targetUsername: string): TikTokPublicProfile | null {
  const userInfo = isRecord(record.userInfo) ? record.userInfo : null;
  if (userInfo) {
    const user = isRecord(userInfo.user) ? userInfo.user : null;
    const stats = isRecord(userInfo.statsV2)
      ? userInfo.statsV2
      : isRecord(userInfo.stats)
        ? userInfo.stats
        : null;
    if (user && stats) {
      const profile = buildProfile(user, stats, targetUsername);
      if (profile) return profile;
    }
  }

  const directUser = isRecord(record.user) ? record.user : null;
  const directStats = isRecord(record.statsV2)
    ? record.statsV2
    : isRecord(record.stats)
      ? record.stats
      : null;
  if (directUser && directStats) {
    const profile = buildProfile(directUser, directStats, targetUsername);
    if (profile) return profile;
  }

  const users = isRecord(record.users) ? record.users : null;
  const statsMap = isRecord(record.stats) ? record.stats : null;
  if (users && statsMap) {
    for (const [key, userValue] of Object.entries(users)) {
      if (!isRecord(userValue)) continue;
      const username = firstString(userValue, ["uniqueId", "unique_id", "username"]);
      if (username && normalizeUsernameLoose(username) !== targetUsername) continue;
      const statsValue = statsMap[key];
      if (!isRecord(statsValue)) continue;
      const profile = buildProfile(userValue, statsValue, targetUsername);
      if (profile) return profile;
    }
  }

  return null;
}

function findProfileDeep(value: unknown, targetUsername: string): TikTokPublicProfile | null {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): TikTokPublicProfile | null => {
    if (depth > 25 || current === null || typeof current !== "object") return null;
    if (seen.has(current)) return null;
    seen.add(current);

    if (isRecord(current)) {
      const direct = findProfileInRecord(current, targetUsername);
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

function extractUrlFromUnknown(value: unknown): string | null {
  const direct = asString(value);
  if (direct) return direct;
  if (!isRecord(value)) return null;

  for (const key of ["urlList", "url_list"]) {
    const list = value[key];
    if (!Array.isArray(list)) continue;
    const first = list.map(asString).find((item): item is string => Boolean(item));
    if (first) return first;
  }
  return firstString(value, ["url", "uri"]);
}

function buildPost(record: JsonRecord, targetUsername: string): TikTokPublicPost | null {
  const id = firstString(record, ["id", "aweme_id", "itemId"]);
  if (!id) return null;

  const stats = isRecord(record.stats)
    ? record.stats
    : isRecord(record.statistics)
      ? record.statistics
      : null;
  if (!stats) return null;

  const author = isRecord(record.author) ? record.author : null;
  const authorUsername = author
    ? firstString(author, ["uniqueId", "unique_id", "username"])
    : firstString(record, ["authorUniqueId", "author_username"]);
  if (authorUsername && normalizeUsernameLoose(authorUsername) !== targetUsername) return null;

  const viewCount = firstNumber(stats, ["playCount", "play_count", "viewCount", "view_count"]);
  const likeCount = firstNumber(stats, ["diggCount", "digg_count", "likeCount", "like_count"]);
  const commentCount = firstNumber(stats, ["commentCount", "comment_count"]);
  const shareCount = firstNumber(stats, ["shareCount", "share_count"]);
  if (viewCount === null && likeCount === null && commentCount === null && shareCount === null) {
    return null;
  }

  const createTimeSeconds = firstNumber(record, ["createTime", "create_time"]);
  const video = isRecord(record.video) ? record.video : null;
  const shareInfo = isRecord(record.shareInfo) ? record.shareInfo : null;

  return {
    id,
    description: firstString(record, ["desc", "description", "video_description", "title"]),
    createTime:
      createTimeSeconds !== null
        ? new Date(createTimeSeconds * 1000).toISOString()
        : null,
    coverImageUrl: video
      ? extractUrlFromUnknown(video.cover) ??
        extractUrlFromUnknown(video.originCover) ??
        extractUrlFromUnknown(video.dynamicCover)
      : null,
    shareUrl:
      firstString(record, ["shareUrl", "share_url"]) ??
      (shareInfo ? firstString(shareInfo, ["shareUrl", "share_url"]) : null) ??
      `https://www.tiktok.com/@${targetUsername}/video/${id}`,
    viewCount,
    likeCount,
    commentCount,
    shareCount,
  };
}

function collectPostsDeep(value: unknown, targetUsername: string, output: Map<string, TikTokPublicPost>): void {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): void => {
    if (depth > 25 || current === null || typeof current !== "object") return;
    if (seen.has(current)) return;
    seen.add(current);

    if (isRecord(current)) {
      const post = buildPost(current, targetUsername);
      if (post && !output.has(post.id)) output.set(post.id, post);
      for (const nested of Object.values(current)) walk(nested, depth + 1);
      return;
    }

    if (Array.isArray(current)) {
      for (const nested of current) walk(nested, depth + 1);
    }
  };

  walk(value, 0);
}

export function extractTikTokPublicData(
  payloads: readonly unknown[],
  usernameInput: string,
): ExtractedPayloadData {
  const username = normalizeTikTokPublicUsername(usernameInput);
  let profile: TikTokPublicProfile | null = null;
  const postsById = new Map<string, TikTokPublicPost>();

  for (const payload of payloads) {
    profile ??= findProfileDeep(payload, username);
    collectPostsDeep(payload, username, postsById);
  }

  const posts = Array.from(postsById.values())
    .sort((a, b) => {
      const left = a.createTime ? Date.parse(a.createTime) : 0;
      const right = b.createTime ? Date.parse(b.createTime) : 0;
      return right - left;
    })
    .slice(0, 20);

  return { profile, posts };
}

function parseJsonPayload(text: string | null): unknown {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function shouldCaptureTikTokApiResponse(url: string, contentType: string | null): boolean {
  if (!contentType?.toLowerCase().includes("json")) return false;
  if (!url.includes("tiktok.com")) return false;
  return [
    "/api/user/detail/",
    "/api/post/item_list/",
    "/api/item/detail/",
    "/api/recommend/item_list/",
  ].some((fragment) => url.includes(fragment));
}

export async function probeTikTokPublicProfile(
  usernameInput: string,
  options?: { timeoutMs?: number; headless?: boolean },
): Promise<TikTokPublicProbeResult> {
  const username = normalizeTikTokPublicUsername(usernameInput);
  const profileUrl = `https://www.tiktok.com/@${username}`;
  const timeoutMs = Math.min(Math.max(options?.timeoutMs ?? 30_000, 5_000), 90_000);
  const capturedPayloads: unknown[] = [];
  const pendingResponses = new Set<Promise<void>>();

  const browser = await chromium.launch({ headless: options?.headless ?? true });
  try {
    const context = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Bangkok",
      viewport: { width: 1440, height: 1200 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9,th;q=0.8",
      },
    });
    const page = await context.newPage();

    page.on("response", (response) => {
      const contentType = response.headers()["content-type"] ?? null;
      if (!shouldCaptureTikTokApiResponse(response.url(), contentType)) return;

      const task = (async (): Promise<void> => {
        try {
          const payload = (await response.json()) as unknown;
          capturedPayloads.push(payload);
        } catch {
          // Ignore non-JSON/expired response bodies; hydration parsing remains available.
        }
      })();
      pendingResponses.add(task);
      void task.finally(() => pendingResponses.delete(task));
    });

    let navigationMessage: string | null = null;
    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    } catch (error: unknown) {
      navigationMessage = error instanceof Error ? error.message : "TikTok navigation failed";
    }

    await page.waitForTimeout(2_500);
    await page.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight * 0.45, 900)));
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_500);

    await Promise.allSettled(Array.from(pendingResponses));

    const pageSnapshot = await page.evaluate((scriptIds) => {
      const scripts = scriptIds.map((id) => ({
        id,
        text: document.getElementById(id)?.textContent ?? null,
      }));
      return {
        scripts,
        title: document.title,
        bodyText: (document.body?.innerText ?? "").slice(0, 8_000),
        finalUrl: location.href,
      };
    }, PROFILE_SCRIPT_IDS);

    const hydrationPayloads = pageSnapshot.scripts
      .map((script) => parseJsonPayload(script.text))
      .filter((payload) => payload !== null);
    const allPayloads = [...hydrationPayloads, ...capturedPayloads];
    const extracted = extractTikTokPublicData(allPayloads, username);

    const bodyLower = pageSnapshot.bodyText.toLowerCase();
    const captchaOrBlockDetected = [
      "captcha",
      "verify to continue",
      "security verification",
      "too many attempts",
      "access denied",
      "something went wrong",
    ].some((marker) => bodyLower.includes(marker));

    let status: TikTokPublicProbeStatus = "BLOCKED_OR_CHANGED";
    if (extracted.profile && extracted.posts.length > 0) status = "OK";
    else if (extracted.profile) status = "PARTIAL";

    const message = extracted.profile
      ? extracted.posts.length > 0
        ? null
        : "Profile metrics were extracted, but recent post payloads were not available."
      : captchaOrBlockDetected
        ? "TikTok presented a verification/block page to the collector."
        : navigationMessage ?? "No recognized public profile payload was found; TikTok page structure may have changed.";

    return {
      status,
      fetchedAt: new Date().toISOString(),
      profile: extracted.profile,
      recentPosts: extracted.posts,
      diagnostics: {
        finalUrl: pageSnapshot.finalUrl,
        pageTitle: pageSnapshot.title,
        hydrationPayloadCount: hydrationPayloads.length,
        capturedApiPayloadCount: capturedPayloads.length,
        captchaOrBlockDetected,
        message,
      },
    };
  } finally {
    await browser.close();
  }
}
