import playwright from "playwright";
const { chromium } = playwright;
import { extractAccountMetrics } from "../tokcounter-extractor.mjs";
import {
  BaseTikTokProviderAdapter,
  PROVIDER_SOURCES,
  EXTRACTION_STATUS,
} from "./provider-adapter.mjs";

export class TokCounterAdapter extends BaseTikTokProviderAdapter {
  constructor(options = {}) {
    super(PROVIDER_SOURCES.TOKCOUNTER, {
      name: "TokCounter Chromium Extractor",
      cooldownDurationMs: options.cooldownDurationMs || 600000, // 10 min cooldown on 403
      ...options,
    });
  }

  async extract(username, options = {}) {
    const cleanUser = username.replace(/^@+/, "").trim().toLowerCase();
    const providedPage = options.page || null;
    let localBrowser = null;
    let page = providedPage;

    try {
      if (!page) {
        localBrowser = await chromium.launch({
          headless: options.headless ?? true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const context = await localBrowser.newContext({
          viewport: { width: 1440, height: 900 },
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          locale: "en-US",
        });
        page = await context.newPage();
      }

      const extraction = await extractAccountMetrics(page, cleanUser, {
        timeoutMs: options.timeoutMs || 25000,
      });

      if (extraction.status === "RATE_LIMITED") {
        this.markFailure(EXTRACTION_STATUS.RATE_LIMITED, extraction.error || "TokCounter rate limited");
        return {
          status: EXTRACTION_STATUS.RATE_LIMITED,
          source: this.source,
          username: cleanUser,
          error: extraction.error || "TokCounter API returned 403 Forbidden / Rate Limit",
          durationMs: extraction.durationMs,
        };
      }

      if (extraction.status === "SUCCESS") {
        this.markSuccess();
        return {
          status: EXTRACTION_STATUS.SUCCESS,
          source: this.source,
          username: extraction.username || cleanUser,
          displayName: extraction.displayName || null,
          followerCount: extraction.followerCount,
          followingCount: extraction.followingCount,
          likesCount: extraction.likesCount,
          videoCount: extraction.videoCount,
          followersRaw: extraction.followersRaw,
          followingRaw: extraction.followingRaw,
          likesRaw: extraction.likesRaw,
          videosRaw: extraction.videosRaw,
          precision: extraction.precision || "EXACT",
          profileUrl: `https://www.tiktok.com/@${cleanUser}`,
          durationMs: extraction.durationMs,
        };
      }

      // Map failure statuses
      let mappedStatus = EXTRACTION_STATUS.PROVIDER_UNAVAILABLE;
      if (extraction.status === "PROFILE_NOT_FOUND") {
        mappedStatus = EXTRACTION_STATUS.PROFILE_NOT_FOUND;
      } else if (extraction.status === "PARSE_ERROR") {
        mappedStatus = EXTRACTION_STATUS.PARSE_ERROR;
      }

      this.markFailure(mappedStatus, extraction.error || "TokCounter extraction failed");

      return {
        status: mappedStatus,
        source: this.source,
        username: cleanUser,
        error: extraction.error || "TokCounter extraction failed",
        durationMs: extraction.durationMs,
      };
    } catch (err) {
      this.markFailure(EXTRACTION_STATUS.NETWORK_ERROR, err.message);
      return {
        status: EXTRACTION_STATUS.NETWORK_ERROR,
        source: this.source,
        username: cleanUser,
        error: err.message,
        durationMs: 0,
      };
    } finally {
      if (localBrowser) {
        await localBrowser.close().catch(() => {});
      }
    }
  }
}
