import { chromium } from "playwright";

/**
 * Parses CLI arguments.
 * Supports:
 *   --username <username> (default: o_seaconsquaresrinakarin)
 *   --storeId <id>       (default: 109)
 *   --headless <bool>   (default: true)
 *   --timeout <ms>      (default: 30000)
 */
function parseArgs(argv) {
  let username = "o_seaconsquaresrinakarin";
  let storeId = "109";
  let headless = true;
  let timeoutMs = 30000;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--username" && argv[i + 1]) {
      username = argv[i + 1].trim();
      i++;
    } else if (arg === "--storeId" && argv[i + 1]) {
      storeId = argv[i + 1].trim();
      i++;
    } else if (arg === "--headless" && argv[i + 1]) {
      headless = argv[i + 1].toLowerCase() !== "false";
      i++;
    } else if (arg === "--timeout" && argv[i + 1]) {
      timeoutMs = parseInt(argv[i + 1], 10) || 30000;
      i++;
    }
  }

  // Normalize username
  username = username.replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, "")
                     .replace(/^https?:\/\/tokcounter\.com\/\?user=/i, "")
                     .replace(/^@+/, "")
                     .trim()
                     .toLowerCase();

  return { username, storeId, headless, timeoutMs };
}

/**
 * Parses numeric string into integer and precision indicator.
 */
function parseMetricValue(rawStr) {
  if (rawStr === null || rawStr === undefined) {
    return { rawValue: null, parsedValue: null, precision: "UNKNOWN" };
  }

  const cleaned = String(rawStr).trim();
  if (!cleaned) {
    return { rawValue: cleaned, parsedValue: null, precision: "UNKNOWN" };
  }

  // Check for abbreviations: K, M, B
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

  // Plain numbers with commas or spaces
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
 * Extracts metrics from the active DOM.
 */
async function extractDomSnapshot(page, targetUsername) {
  return await page.evaluate((targetUser) => {
    // 1. Identity check:
    // Look for paragraph element with @targetUser
    const paragraphs = Array.from(document.querySelectorAll("p, div, h1, h2"));
    let userElem = null;
    let displayName = null;

    for (const p of paragraphs) {
      const txt = (p.textContent || "").trim();
      if (txt.toLowerCase() === `@${targetUser}`) {
        userElem = p;
        if (p.previousElementSibling) {
          displayName = (p.previousElementSibling.textContent || "").trim();
        }
        break;
      }
    }

    // Check for error text
    const bodyText = document.body ? document.body.innerText : "";
    const isNotFound =
      bodyText.includes("couldn't find user with this ID") ||
      bodyText.includes("could not find user");

    if (!userElem) {
      return {
        identityVerified: false,
        error: isNotFound ? "ACCOUNT_NOT_FOUND" : "ACCOUNT_IDENTITY_UNVERIFIED",
        username: null,
        displayName: null,
        rawFollowers: null,
        rawLikes: null,
        rawFollowing: null,
        rawVideos: null,
      };
    }

    // Helper to read odometer value
    function readOdometer(container) {
      if (!container) return null;
      const odo = container.querySelector(".odometer");
      if (!odo) return null;

      // Primary extraction: read .odometer-formatting-mark and .odometer-value inside .odometer-inside
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

      // Fallback: strip newlines and spaces from innerText
      const cleaned = (odo.innerText || "").replace(/[\r\n\s]+/g, "");
      return cleaned || null;
    }

    // Find main follower card (contains userElem)
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

export async function collectTokCounterStore(options) {
  const { username, storeId, headless, timeoutMs } = options;
  const targetUrl = `https://tokcounter.com/?user=${encodeURIComponent(username)}`;
  const startTime = Date.now();

  const networkObservations = {
    userDataEndpoint: null,
    userStatsEndpoint: null,
    userDataResponse: null,
    userStatsResponse: null,
  };

  const browser = await chromium.launch({
    headless: headless ?? true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    const page = await context.newPage();

    // Monitor background network requests for public endpoints
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes(`tiktok-api.tokcounter.com/user/data/${username}`)) {
        networkObservations.userDataEndpoint = url;
        try {
          networkObservations.userDataResponse = await response.json();
        } catch {}
      } else if (url.includes("tiktok-api.tokcounter.com/user/stats/")) {
        // Also capture the user stats endpoint if it corresponds to our user
        networkObservations.userStatsEndpoint = url;
        try {
          networkObservations.userStatsResponse = await response.json();
        } catch {}
      }
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // Polling loop to wait for:
    // 1. Account identity resolved
    // 2. Follower counter non-placeholder
    // 3. Stable across 2 reads separated by 2-5 seconds
    const deadline = startTime + timeoutMs;
    let read1 = null;
    let read2 = null;
    let retryNeeded = false;

    while (Date.now() < deadline) {
      const snapshot = await extractDomSnapshot(page, username);

      if (!snapshot.identityVerified) {
        if (snapshot.error === "ACCOUNT_NOT_FOUND") {
          return {
            storeId,
            username,
            source: "TOKCOUNTER",
            identityVerified: false,
            error: "ACCOUNT_IDENTITY_UNVERIFIED",
            diagnosticReason: "Account not found on TokCounter",
            collectedAt: new Date().toISOString(),
            loadDurationMs: Date.now() - startTime,
            retryNeeded,
          };
        }
        await page.waitForTimeout(1000);
        continue;
      }

      // Check if follower count is non-placeholder (non-null and has digits)
      const parsedFollowers = parseMetricValue(snapshot.rawFollowers);
      if (parsedFollowers.parsedValue === null) {
        await page.waitForTimeout(1000);
        continue;
      }

      if (!read1) {
        read1 = { snapshot, timestamp: Date.now() };
        // Wait 3 seconds before read 2
        await page.waitForTimeout(3000);
        continue;
      }

      // We have read1, now get read2
      read2 = { snapshot, timestamp: Date.now() };

      const f1 = parseMetricValue(read1.snapshot.rawFollowers).parsedValue;
      const f2 = parseMetricValue(read2.snapshot.rawFollowers).parsedValue;

      // Allow minor follower movement (e.g. within 20)
      const isFollowerStable = Math.abs(f1 - f2) <= 20;

      // Following, likes, videos should be non-null
      const l2 = parseMetricValue(read2.snapshot.rawLikes).parsedValue;
      const fol2 = parseMetricValue(read2.snapshot.rawFollowing).parsedValue;
      const v2 = parseMetricValue(read2.snapshot.rawVideos).parsedValue;

      if (isFollowerStable && l2 !== null && fol2 !== null && v2 !== null) {
        // Success!
        const parsedLikes = parseMetricValue(read2.snapshot.rawLikes);
        const parsedFollowing = parseMetricValue(read2.snapshot.rawFollowing);
        const parsedVideos = parseMetricValue(read2.snapshot.rawVideos);
        const finalFollowers = parseMetricValue(read2.snapshot.rawFollowers);

        return {
          storeId,
          username,
          displayName: read2.snapshot.displayName,
          source: "TOKCOUNTER",
          followerCount: finalFollowers.parsedValue,
          followingCount: parsedFollowing.parsedValue,
          likesCount: parsedLikes.parsedValue,
          videoCount: parsedVideos.parsedValue,
          collectedAt: new Date().toISOString(),
          identityVerified: true,
          precision: {
            followers: finalFollowers.precision,
            following: parsedFollowing.precision,
            likes: parsedLikes.precision,
            videos: parsedVideos.precision,
          },
          rawMetrics: {
            followers: finalFollowers.rawValue,
            following: parsedFollowing.rawValue,
            likes: parsedLikes.rawValue,
            videos: parsedVideos.rawValue,
          },
          loadDurationMs: Date.now() - startTime,
          retryNeeded,
          networkObservation: {
            userDataEndpoint: networkObservations.userDataEndpoint,
            userStatsEndpoint: networkObservations.userStatsEndpoint,
            publicJsonAvailable: Boolean(networkObservations.userDataResponse?.success),
            requiresAuth: false,
            apiMetrics: networkObservations.userDataResponse?.stats || null,
          },
        };
      }

      // If unstable, retry read1
      retryNeeded = true;
      read1 = read2;
      read2 = null;
      await page.waitForTimeout(2000);
    }

    // Timed out
    return {
      storeId,
      username,
      source: "TOKCOUNTER",
      identityVerified: false,
      error: "ACCOUNT_IDENTITY_UNVERIFIED",
      diagnosticReason: "Timed out waiting for stable metric reads",
      collectedAt: new Date().toISOString(),
      loadDurationMs: Date.now() - startTime,
      retryNeeded,
    };
  } finally {
    await browser.close();
  }
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].endsWith("test-tokcounter-store.mjs")) {
  const options = parseArgs(process.argv.slice(2));
  collectTokCounterStore(options)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.identityVerified) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Execution error:", err);
      process.exit(1);
    });
}
