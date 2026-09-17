import {
  BaseTikTokProviderAdapter,
  PROVIDER_SOURCES,
  EXTRACTION_STATUS,
} from "./provider-adapter.mjs";

export class CountikAdapter extends BaseTikTokProviderAdapter {
  constructor(options = {}) {
    super(PROVIDER_SOURCES.COUNTIK, {
      name: "Countik Public API",
      cooldownDurationMs: options.cooldownDurationMs || 300000, // 5 min cooldown on 403
      ...options,
    });
    this.apiBase = options.apiBase || "https://countik.com/api/exist";
  }

  async extract(username, options = {}) {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || 15000;
    const cleanUser = username.replace(/^@+/, "").trim().toLowerCase();
    const url = `${this.apiBase}/${encodeURIComponent(cleanUser)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://countik.com/",
          "Accept": "application/json, text/plain, */*",
        },
      });

      clearTimeout(timer);
      const durationMs = Date.now() - startTime;

      if (res.status === 403 || res.status === 429) {
        this.markFailure(EXTRACTION_STATUS.RATE_LIMITED, `Countik HTTP ${res.status} Rate Limited`);
        return {
          status: EXTRACTION_STATUS.RATE_LIMITED,
          source: this.source,
          username: cleanUser,
          error: `Countik API returned HTTP ${res.status}`,
          durationMs,
        };
      }

      if (res.status === 404) {
        return {
          status: EXTRACTION_STATUS.PROFILE_NOT_FOUND,
          source: this.source,
          username: cleanUser,
          error: "Account not found on Countik",
          durationMs,
        };
      }

      if (!res.ok) {
        this.markFailure(EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, `HTTP ${res.status}`);
        return {
          status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE,
          source: this.source,
          username: cleanUser,
          error: `Countik API returned HTTP ${res.status}`,
          durationMs,
        };
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        this.markFailure(EXTRACTION_STATUS.PARSE_ERROR, "Invalid JSON from Countik");
        return {
          status: EXTRACTION_STATUS.PARSE_ERROR,
          source: this.source,
          username: cleanUser,
          error: "Failed to parse JSON response from Countik",
          durationMs,
        };
      }

      if (data.status === "error" || data.message === "User Not Found") {
        return {
          status: EXTRACTION_STATUS.PROFILE_NOT_FOUND,
          source: this.source,
          username: cleanUser,
          error: data.message || "User Not Found",
          durationMs,
        };
      }

      if (
        typeof data.followerCount !== "number" ||
        !Number.isSafeInteger(data.followerCount) ||
        data.followerCount < 0
      ) {
        this.markFailure(EXTRACTION_STATUS.PARSE_ERROR, "Missing or invalid followerCount integer");
        return {
          status: EXTRACTION_STATUS.PARSE_ERROR,
          source: this.source,
          username: cleanUser,
          error: `Invalid followerCount integer: ${data.followerCount}`,
          durationMs,
        };
      }

      this.markSuccess();

      return {
        status: EXTRACTION_STATUS.SUCCESS,
        source: this.source,
        username: data.uniqueId || cleanUser,
        displayName: data.nickname || null,
        followerCount: data.followerCount,
        followingCount: typeof data.followingCount === "number" ? data.followingCount : null,
        likesCount: typeof data.heartCount === "number" ? data.heartCount : null,
        videoCount: typeof data.videoCount === "number" ? data.videoCount : null,
        followersRaw: String(data.followerCount),
        followingRaw: data.followingCount != null ? String(data.followingCount) : null,
        likesRaw: data.heartCount != null ? String(data.heartCount) : null,
        videosRaw: data.videoCount != null ? String(data.videoCount) : null,
        precision: "EXACT",
        profileUrl: `https://www.tiktok.com/@${cleanUser}`,
        durationMs,
      };
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const isAbort = err.name === "AbortError";
      const errorType = isAbort ? EXTRACTION_STATUS.PROVIDER_UNAVAILABLE : EXTRACTION_STATUS.NETWORK_ERROR;
      this.markFailure(errorType, err.message);
      return {
        status: errorType,
        source: this.source,
        username: cleanUser,
        error: isAbort ? `Countik request timed out after ${timeoutMs}ms` : err.message,
        durationMs,
      };
    }
  }
}
