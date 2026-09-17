/**
 * TokCounter Playwright Extraction Engine
 * Navigates to a given account on tokcounter.com, verifies identity,
 * waits for odometer counter stabilization, and extracts exact metrics.
 */

/**
 * Parses numeric string into integer and precision indicator.
 * Handles commas, spaces, and abbreviations (K, M, B).
 */
export function parseMetricValue(rawStr) {
  if (rawStr === null || rawStr === undefined) {
    return { rawValue: null, parsedValue: null, precision: "UNKNOWN" };
  }

  const cleaned = String(rawStr).trim();
  if (!cleaned) {
    return { rawValue: cleaned, parsedValue: null, precision: "UNKNOWN" };
  }

  // Abbreviated formats
  const kMatch = cleaned.match(/^([0-9.,]+)\s*K$/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, ""));
    return {
      rawValue: cleaned,
      parsedValue: Math.round(num * 1000),
      precision: "ABBREVIATED",
    };
  }

  const mMatch = cleaned.match(/^([0-9.,]+)\s*M$/i);
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/,/g, ""));
    return {
      rawValue: cleaned,
      parsedValue: Math.round(num * 1000000),
      precision: "ABBREVIATED",
    };
  }

  const bMatch = cleaned.match(/^([0-9.,]+)\s*B$/i);
  if (bMatch) {
    const num = parseFloat(bMatch[1].replace(/,/g, ""));
    return {
      rawValue: cleaned,
      parsedValue: Math.round(num * 1000000000),
      precision: "ABBREVIATED",
    };
  }

  // Exact integer format (e.g. "4,477", "11 035", "86")
  const digitsOnly = cleaned.replace(/[, \s]/g, "");
  if (/^\d+$/.test(digitsOnly)) {
    return {
      rawValue: cleaned,
      parsedValue: parseInt(digitsOnly, 10),
      precision: "EXACT",
    };
  }

  return {
    rawValue: cleaned,
    parsedValue: null,
    precision: "UNKNOWN",
  };
}

/**
 * Reads DOM state within the browser context.
 */
async function extractDomSnapshot(page, targetUsername) {
  return await page.evaluate((targetUser) => {
    const normTarget = targetUser.toLowerCase();
    const allElements = Array.from(document.querySelectorAll("p, div, h1, h2"));

    let userElem = null;
    let displayName = null;

    // Strict identity match: find paragraph element whose text is exactly @<username>
    for (const el of allElements) {
      const txt = (el.textContent || "").trim().toLowerCase();
      if (txt === `@${normTarget}`) {
        userElem = el;
        if (el.previousElementSibling) {
          displayName = (el.previousElementSibling.textContent || "").trim();
        }
        break;
      }
    }

    const bodyText = document.body ? document.body.innerText : "";
    const isNotFound =
      bodyText.includes("couldn't find user with this ID") ||
      bodyText.includes("could not find user");
    const isRateLimited =
      bodyText.includes("Too Many Requests") ||
      bodyText.includes("rate limit") ||
      bodyText.includes("429");

    if (!userElem) {
      let error = "ACCOUNT_IDENTITY_UNVERIFIED";
      if (isNotFound) error = "PROFILE_NOT_FOUND";
      else if (isRateLimited) error = "RATE_LIMITED";

      return {
        identityVerified: false,
        error,
        username: null,
        displayName: null,
        rawFollowers: null,
        rawLikes: null,
        rawFollowing: null,
        rawVideos: null,
      };
    }

    // Helper: read odometer value from container
    function readOdometer(container) {
      if (!container) return null;
      const odo = container.querySelector(".odometer");
      if (!odo) return null;

      const inside = odo.querySelector(".odometer-inside") || odo;
      let str = "";
      for (const child of inside.children) {
        if (child.classList.contains("odometer-formatting-mark")) {
          str += child.textContent.trim();
        } else if (child.classList.contains("odometer-digit")) {
          const valEl =
            child.querySelector(".odometer-ribbon-inner .odometer-value") ||
            child.querySelector(".odometer-value");
          if (valEl) {
            str += valEl.textContent.trim();
          }
        }
      }

      if (str.length > 0) return str;

      const fallback = (odo.innerText || "").replace(/[\r\n\s]+/g, "");
      return fallback || null;
    }

    // Followers card is the card containing userElem
    const profileCard = userElem.closest("div.bg-gray-800") || userElem.parentElement;
    const rawFollowers = profileCard ? readOdometer(profileCard) : null;

    // Sub-metric cards for Likes, Following, Videos
    let rawLikes = null;
    let rawFollowing = null;
    let rawVideos = null;

    const allP = Array.from(document.querySelectorAll("p"));
    for (const p of allP) {
      const text = (p.textContent || "").trim();
      const card = p.closest("div.bg-gray-800");
      if (!card) continue;

      if (text.startsWith("Likes")) {
        rawLikes = readOdometer(card);
      } else if (text.startsWith("Following")) {
        rawFollowing = readOdometer(card);
      } else if (text.startsWith("Videos")) {
        rawVideos = readOdometer(card);
      }
    }

    return {
      identityVerified: true,
      error: null,
      username: targetUser,
      displayName: displayName || null,
      rawFollowers,
      rawLikes,
      rawFollowing,
      rawVideos,
    };
  }, targetUsername);
}

/**
 * Extracts TikTok metrics for a single account from an existing Playwright Page.
 * Performs navigation, identity verification, and multi-read stabilization.
 */
export async function extractAccountMetrics(page, username, options = {}) {
  const timeoutMs = options.timeoutMs || 25000;
  const targetUrl = `https://tokcounter.com/?user=${encodeURIComponent(username)}`;
  const startTime = Date.now();
  let retryCount = 0;

  // Background network response tracking for target user
  let apiResolved = false;
  let apiFound = true;
  let isRateLimited = false;
  let apiExpectedFollowers = null;

  const responseHandler = async (response) => {
    const url = response.url();
    if (url.includes(`tiktok-api.tokcounter.com/user/data/${username}`)) {
      apiResolved = true;
      const status = response.status();
      if (status === 403 || status === 429) {
        isRateLimited = true;
        apiFound = false;
        return;
      }
      try {
        const body = await response.json();
        if (body && (body.success === false || body.message === "Forbidden")) {
          if (body.message === "Forbidden" || status === 403) {
            isRateLimited = true;
          }
          apiFound = false;
        } else if (body && body.stats && typeof body.stats.followers === "number") {
          apiExpectedFollowers = body.stats.followers;
        }
      } catch {}
    }
  };

  page.on("response", responseHandler);

  // Filter out third-party ads and unrelated background user lookups to conserve rate limits
  const routeHandler = (route) => {
    const reqUrl = route.request().url();
    if (
      reqUrl.includes("doubleclick.net") ||
      reqUrl.includes("googlesyndication.com") ||
      reqUrl.includes("google-analytics.com") ||
      reqUrl.includes("adsbygoogle") ||
      reqUrl.includes("boost-api.tokcounter.com") ||
      (reqUrl.includes("tiktok-api.tokcounter.com/user/data/") &&
        !reqUrl.toLowerCase().includes(`/user/data/${username.toLowerCase()}`))
    ) {
      return route.abort();
    }
    return route.continue();
  };

  try {
    await page.route("**/*", routeHandler);

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const deadline = startTime + timeoutMs;
    let read1 = null;

    while (Date.now() < deadline) {
      if (isRateLimited) {
        return {
          status: "RATE_LIMITED",
          username,
          displayName: null,
          followerCount: null,
          followingCount: null,
          likesCount: null,
          videoCount: null,
          followersRaw: null,
          followingRaw: null,
          likesRaw: null,
          videosRaw: null,
          precision: "UNKNOWN",
          durationMs: Date.now() - startTime,
          retryCount,
          error: "TokCounter API returned 403 Forbidden / Rate Limit",
        };
      }

      // Check if API already replied with user not found
      if (apiResolved && !apiFound) {
        return {
          status: "PROFILE_NOT_FOUND",
          username,
          displayName: null,
          followerCount: null,
          followingCount: null,
          likesCount: null,
          videoCount: null,
          followersRaw: null,
          followingRaw: null,
          likesRaw: null,
          videosRaw: null,
          precision: "UNKNOWN",
          durationMs: Date.now() - startTime,
          retryCount,
          error: "TikTok account not found on TokCounter (API reported not found)",
        };
      }

      const snapshot = await extractDomSnapshot(page, username);

      if (!snapshot.identityVerified) {
        if (snapshot.error === "PROFILE_NOT_FOUND") {
          return {
            status: "PROFILE_NOT_FOUND",
            username,
            displayName: null,
            followerCount: null,
            followingCount: null,
            likesCount: null,
            videoCount: null,
            followersRaw: null,
            followingRaw: null,
            likesRaw: null,
            videosRaw: null,
            precision: "UNKNOWN",
            durationMs: Date.now() - startTime,
            retryCount,
            error: "TikTok account not found on TokCounter",
          };
        }

        if (snapshot.error === "RATE_LIMITED") {
          return {
            status: "RATE_LIMITED",
            username,
            displayName: null,
            followerCount: null,
            followingCount: null,
            likesCount: null,
            videoCount: null,
            followersRaw: null,
            followingRaw: null,
            likesRaw: null,
            videosRaw: null,
            precision: "UNKNOWN",
            durationMs: Date.now() - startTime,
            retryCount,
            error: "TokCounter rate limit or 429 encountered",
          };
        }

        await page.waitForTimeout(500);
        continue;
      }

      // Check if follower count is non-placeholder
      const parsedFollowers = parseMetricValue(snapshot.rawFollowers);
      if (parsedFollowers.parsedValue === null) {
        await page.waitForTimeout(500);
        continue;
      }

      // If API expects a positive follower count, but DOM still shows placeholder zeros, wait
      if (apiExpectedFollowers !== null && apiExpectedFollowers > 0 && parsedFollowers.parsedValue === 0) {
        await page.waitForTimeout(500);
        continue;
      }

      // If rawFollowers is "0,000" or placeholder zeros, wait for real count
      if (snapshot.rawFollowers === "0,000" || snapshot.rawFollowers === "00,000") {
        await page.waitForTimeout(500);
        continue;
      }

      if (!read1) {
        read1 = { snapshot, timestamp: Date.now() };
        await page.waitForTimeout(2500);
        continue;
      }

      // Read 2
      const read2Snapshot = await extractDomSnapshot(page, username);
      const f1 = parseMetricValue(read1.snapshot.rawFollowers).parsedValue;
      const f2 = parseMetricValue(read2Snapshot.rawFollowers).parsedValue;

      // Check stabilization: follower count should be stable within live movement delta (<= 20)
      const isFollowerStable = Math.abs(f1 - f2) <= 20;

      const finalFollowers = parseMetricValue(read2Snapshot.rawFollowers);
      const finalFollowing = parseMetricValue(read2Snapshot.rawFollowing);
      const finalLikes = parseMetricValue(read2Snapshot.rawLikes);
      const finalVideos = parseMetricValue(read2Snapshot.rawVideos);

      if (isFollowerStable && finalFollowers.parsedValue !== null) {
        return {
          status: "SUCCESS",
          username,
          displayName: read2Snapshot.displayName,
          followerCount: finalFollowers.parsedValue,
          followingCount: finalFollowing.parsedValue,
          likesCount: finalLikes.parsedValue,
          videoCount: finalVideos.parsedValue,
          followersRaw: finalFollowers.rawValue,
          followingRaw: finalFollowing.rawValue,
          likesRaw: finalLikes.rawValue,
          videosRaw: finalVideos.rawValue,
          precision: finalFollowers.precision,
          durationMs: Date.now() - startTime,
          retryCount,
          error: null,
        };
      }

      // If unstable, retry read1
      retryCount++;
      if (retryCount > 2) {
        // Exceeded retries, accept the latest read if non-null
        if (finalFollowers.parsedValue !== null) {
          return {
            status: "SUCCESS",
            username,
            displayName: read2Snapshot.displayName,
            followerCount: finalFollowers.parsedValue,
            followingCount: finalFollowing.parsedValue,
            likesCount: finalLikes.parsedValue,
            videoCount: finalVideos.parsedValue,
            followersRaw: finalFollowers.rawValue,
            followingRaw: finalFollowing.rawValue,
            likesRaw: finalLikes.rawValue,
            videosRaw: finalVideos.rawValue,
            precision: finalFollowers.precision,
            durationMs: Date.now() - startTime,
            retryCount,
            error: null,
          };
        }
      }

      read1 = { snapshot: read2Snapshot, timestamp: Date.now() };
      await page.waitForTimeout(2000);
    }

    return {
      status: "TIMEOUT",
      username,
      displayName: null,
      followerCount: null,
      followingCount: null,
      likesCount: null,
      videoCount: null,
      followersRaw: null,
      followingRaw: null,
      likesRaw: null,
      videosRaw: null,
      precision: "UNKNOWN",
      durationMs: Date.now() - startTime,
      retryCount,
      error: "Timed out waiting for metric stabilization",
    };
  } catch (err) {
    return {
      status: "OTHER_ERROR",
      username,
      displayName: null,
      followerCount: null,
      followingCount: null,
      likesCount: null,
      videoCount: null,
      followersRaw: null,
      followingRaw: null,
      likesRaw: null,
      videosRaw: null,
      precision: "UNKNOWN",
      durationMs: Date.now() - startTime,
      retryCount,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    page.off("response", responseHandler);
    await page.unroute("**/*", routeHandler).catch(() => {});
  }
}
