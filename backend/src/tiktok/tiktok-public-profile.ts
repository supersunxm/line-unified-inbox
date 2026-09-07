import { chromium } from "playwright";

export type TikTokPublicProbeStatus = "OK" | "BLOCKED_OR_CHANGED";
export type TikTokPublicMetricSource = "statsV2" | "stats";
export type TikTokPublicMetricPrecision = "EXACT" | "DISPLAY_ROUNDED";
export type TikTokPublicDiagnosticCategory =
  | "OK_EXACT"
  | "AUDIENCE_CONTROLLED"
  | "ACCOUNT_NOT_FOUND"
  | "BLOCKED_OR_CHANGED"
  | "PARSE_FAILED";

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
  metricSource: TikTokPublicMetricSource;
  metricPrecision: TikTokPublicMetricPrecision;
}

export interface TikTokPublicProbeResult {
  status: TikTokPublicProbeStatus;
  fetchedAt: string;
  profile: TikTokPublicProfile | null;
  diagnostics: {
    finalUrl: string;
    pageTitle: string;
    hydrationPayloadCount: number;
    capturedApiPayloadCount: number;
    captchaOrBlockDetected: boolean;
    category: TikTokPublicDiagnosticCategory;
    statusCode: number | null;
    message: string | null;
  };
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
  metricSource: TikTokPublicMetricSource,
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
    metricSource,
    metricPrecision: metricSource === "statsV2" ? "EXACT" : "DISPLAY_ROUNDED",
  };
}

function findProfileInRecord(record: JsonRecord, targetUsername: string): TikTokPublicProfile | null {
  const userInfo = isRecord(record.userInfo) ? record.userInfo : null;
  if (userInfo) {
    const user = isRecord(userInfo.user) ? userInfo.user : null;
    const exactStats = isRecord(userInfo.statsV2) ? userInfo.statsV2 : null;
    const displayStats = isRecord(userInfo.stats) ? userInfo.stats : null;
    const stats = exactStats ?? displayStats;
    if (user && stats) {
      const profile = buildProfile(user, stats, targetUsername, exactStats ? "statsV2" : "stats");
      if (profile) return profile;
    }
  }

  const directUser = isRecord(record.user) ? record.user : null;
  const exactDirectStats = isRecord(record.statsV2) ? record.statsV2 : null;
  const displayDirectStats = isRecord(record.stats) ? record.stats : null;
  const directStats = exactDirectStats ?? displayDirectStats;
  if (directUser && directStats) {
    const profile = buildProfile(
      directUser,
      directStats,
      targetUsername,
      exactDirectStats ? "statsV2" : "stats",
    );
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
      const profile = buildProfile(userValue, statsValue, targetUsername, "stats");
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

export function extractTikTokPublicProfile(
  payloads: readonly unknown[],
  usernameInput: string,
): TikTokPublicProfile | null {
  const username = normalizeTikTokPublicUsername(usernameInput);
  for (const payload of payloads) {
    const profile = findProfileDeep(payload, username);
    if (profile) return profile;
  }
  return null;
}

function parseJsonPayload(text: string | null): unknown {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function shouldCaptureTikTokProfileResponse(url: string, contentType: string | null): boolean {
  return Boolean(
    contentType?.toLowerCase().includes("json") &&
    url.includes("tiktok.com") &&
    url.includes("/api/user/detail/"),
  );
}

export function extractTikTokStatusCode(payloads: readonly unknown[]): number | null {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): number | null => {
    if (depth > 10 || current === null || typeof current !== "object") return null;
    if (seen.has(current)) return null;
    seen.add(current);

    if (isRecord(current)) {
      if (typeof current.statusCode === "number") {
        return current.statusCode;
      }
      for (const nested of Object.values(current)) {
        const found = walk(nested, depth + 1);
        if (found !== null) return found;
      }
    } else if (Array.isArray(current)) {
      for (const nested of current) {
        const found = walk(nested, depth + 1);
        if (found !== null) return found;
      }
    }
    return null;
  };

  for (const payload of payloads) {
    const code = walk(payload, 0);
    if (code !== null) return code;
  }
  return null;
}

export function classifyTikTokDiagnostics(params: {
  profile: TikTokPublicProfile | null;
  statusCode: number | null;
  bodyText: string;
  pageTitle: string;
  captchaOrBlockDetected: boolean;
  hydrationCount: number;
  navigationMessage: string | null;
}): { category: TikTokPublicDiagnosticCategory; message: string | null } {
  const {
    profile,
    statusCode,
    bodyText,
    pageTitle,
    captchaOrBlockDetected,
    hydrationCount,
    navigationMessage,
  } = params;

  if (profile) {
    return {
      category: "OK_EXACT",
      message: null,
    };
  }

  const textLower = `${pageTitle} ${bodyText}`.toLowerCase();

  if (
    statusCode === 209002 ||
    textLower.includes("audience controls") ||
    textLower.includes("log in to make the most of your tiktok experience")
  ) {
    return {
      category: "AUDIENCE_CONTROLLED",
      message: "Audience controls enabled on TikTok creator profile; login required.",
    };
  }

  if (
    statusCode === 10221 ||
    textLower.includes("couldn't find this account") ||
    textLower.includes("could not find this account")
  ) {
    return {
      category: "ACCOUNT_NOT_FOUND",
      message: "TikTok account not found.",
    };
  }

  if (captchaOrBlockDetected) {
    return {
      category: "BLOCKED_OR_CHANGED",
      message: "TikTok presented a verification/block page to the collector.",
    };
  }

  if (hydrationCount > 0) {
    return {
      category: "PARSE_FAILED",
      message: "No recognized public profile payload was found in page hydration.",
    };
  }

  return {
    category: "BLOCKED_OR_CHANGED",
    message: navigationMessage ?? "No recognized public profile payload was found; TikTok page structure may have changed.",
  };
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
      if (!shouldCaptureTikTokProfileResponse(response.url(), contentType)) return;

      const task = (async (): Promise<void> => {
        try {
          capturedPayloads.push((await response.json()) as unknown);
        } catch {
          // Hydration parsing remains the primary profile source.
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
    await Promise.allSettled(Array.from(pendingResponses));

    const pageSnapshot = await page.evaluate((scriptIds) => ({
      scripts: scriptIds.map((id) => ({
        id,
        text: document.getElementById(id)?.textContent ?? null,
      })),
      title: document.title,
      bodyText: (document.body?.innerText ?? "").slice(0, 8_000),
      finalUrl: location.href,
    }), PROFILE_SCRIPT_IDS);

    const hydrationPayloads = pageSnapshot.scripts
      .map((script) => parseJsonPayload(script.text))
      .filter((payload) => payload !== null);
    const allPayloads = [...hydrationPayloads, ...capturedPayloads];
    const profile = extractTikTokPublicProfile(allPayloads, username);
    const statusCode = extractTikTokStatusCode(allPayloads);

    const bodyLower = pageSnapshot.bodyText.toLowerCase();
    const captchaOrBlockDetected = [
      "captcha",
      "verify to continue",
      "security verification",
      "too many attempts",
      "access denied",
      "something went wrong",
    ].some((marker) => bodyLower.includes(marker));

    const classification = classifyTikTokDiagnostics({
      profile,
      statusCode,
      bodyText: pageSnapshot.bodyText,
      pageTitle: pageSnapshot.title,
      captchaOrBlockDetected,
      hydrationCount: hydrationPayloads.length,
      navigationMessage,
    });

    return {
      status: profile ? "OK" : "BLOCKED_OR_CHANGED",
      fetchedAt: new Date().toISOString(),
      profile,
      diagnostics: {
        finalUrl: pageSnapshot.finalUrl,
        pageTitle: pageSnapshot.title,
        hydrationPayloadCount: hydrationPayloads.length,
        capturedApiPayloadCount: capturedPayloads.length,
        captchaOrBlockDetected,
        category: classification.category,
        statusCode,
        message: classification.message,
      },
    };
  } finally {
    await browser.close();
  }
}
