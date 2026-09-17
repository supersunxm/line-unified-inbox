import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseTikTokProviderAdapter,
  PROVIDER_SOURCES,
  EXTRACTION_STATUS,
} from "./provider-adapter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distProbePath = path.resolve(__dirname, "../../../dist/tiktok/tiktok-public-profile.js");
const srcProbePath = path.resolve(__dirname, "../../../src/tiktok/tiktok-public-profile.ts");

let cachedProbeFn = null;
async function getProbeFn() {
  if (cachedProbeFn) return cachedProbeFn;
  if (fs.existsSync(distProbePath)) {
    const mod = await import(distProbePath);
    cachedProbeFn = mod.probeTikTokPublicProfile;
  } else {
    const mod = await import(srcProbePath);
    cachedProbeFn = mod.probeTikTokPublicProfile;
  }
  return cachedProbeFn;
}

export class TikTokDirectAdapter extends BaseTikTokProviderAdapter {
  constructor(options = {}) {
    super(PROVIDER_SOURCES.TIKTOK_DIRECT, {
      name: "TikTok Web Hydration Extractor",
      cooldownDurationMs: options.cooldownDurationMs || 300000,
      ...options,
    });
  }

  async extract(username, options = {}) {
    const startTime = Date.now();
    const cleanUser = username.replace(/^@+/, "").trim().toLowerCase();

    try {
      const probeTikTokPublicProfile = await getProbeFn();
      const probeResult = await probeTikTokPublicProfile(cleanUser);
      const durationMs = Date.now() - startTime;

      if (probeResult.status === "OK" && probeResult.profile) {
        const profile = probeResult.profile;
        if (profile.metricPrecision === "EXACT" && typeof profile.followerCount === "number") {
          this.markSuccess();
          return {
            status: EXTRACTION_STATUS.SUCCESS,
            source: this.source,
            username: profile.username || cleanUser,
            displayName: profile.displayName || null,
            followerCount: profile.followerCount,
            followingCount: profile.followingCount,
            likesCount: profile.likesCount,
            videoCount: profile.videoCount,
            followersRaw: String(profile.followerCount),
            followingRaw: profile.followingCount != null ? String(profile.followingCount) : null,
            likesRaw: profile.likesCount != null ? String(profile.likesCount) : null,
            videosRaw: profile.videoCount != null ? String(profile.videoCount) : null,
            precision: "EXACT",
            profileUrl: profile.profileUrl || `https://www.tiktok.com/@${cleanUser}`,
            durationMs,
          };
        }
      }

      const diag = probeResult.diagnostics || {};
      if (diag.category === "ACCOUNT_NOT_FOUND" || diag.category === "INVALID_USERNAME") {
        return {
          status: EXTRACTION_STATUS.PROFILE_NOT_FOUND,
          source: this.source,
          username: cleanUser,
          error: diag.message || "Account not found on TikTok",
          statusCode: diag.statusCode || null,
          category: diag.category,
          isDirectOfficialNotFound:
            diag.category === "ACCOUNT_NOT_FOUND" ||
            diag.statusCode === 10221 ||
            (typeof diag.message === "string" && /not found/i.test(diag.message)),
          durationMs,
        };
      }

      if (diag.captchaOrBlockDetected || diag.category === "BLOCKED_OR_CHANGED") {
        this.markFailure(EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, "TikTok anti-bot challenge or block");
        return {
          status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE,
          source: this.source,
          username: cleanUser,
          error: "TikTok anti-bot protection challenged request",
          durationMs,
        };
      }

      this.markFailure(EXTRACTION_STATUS.PROVIDER_UNAVAILABLE, diag.message || "Direct probe failed");
      return {
        status: EXTRACTION_STATUS.PROVIDER_UNAVAILABLE,
        source: this.source,
        username: cleanUser,
        error: diag.message || "Direct probe failed to extract exact metrics",
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.markFailure(EXTRACTION_STATUS.NETWORK_ERROR, err.message);
      return {
        status: EXTRACTION_STATUS.NETWORK_ERROR,
        source: this.source,
        username: cleanUser,
        error: err.message,
        durationMs,
      };
    }
  }
}
