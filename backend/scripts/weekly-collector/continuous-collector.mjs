import playwright from "playwright";
const { chromium } = playwright;
import { PrismaClient, GoogleReviewPeriodStatus } from "@prisma/client";
import { computeReviewFingerprint } from "./fingerprint-helper.mjs";
import { segmentThaiWords } from "../../../tools/google-review-checker-extension/src/core/thaiWordCounter.ts";
import { isEditedReviewDateText } from "../../../tools/google-review-checker-extension/src/core/googleReviewDateParser.ts";
import { classifyWeek2Date } from "./date-classifier.mjs";
import { resolveGoogleReviewProfileDir } from "./browser-runtime-config.mjs";
import { openReviewsPane, ensureNewestSort } from "./maps-dom-helper.mjs";

const prisma = new PrismaClient();
export const PERSISTENT_PROFILE_DIR = resolveGoogleReviewProfileDir();

export function getTodayBangkokDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()); // YYYY-MM-DD
}

function ensureDateStats(statsByDate, reviewDate) {
  if (!statsByDate[reviewDate]) {
    statsByDate[reviewDate] = {
      reviewsChecked: 0,
      reviewsWithPhoto: 0,
      reviewsOver15ThaiWords: 0,
      newReviewsDiscovered: 0,
      newQualifiedReviews: 0,
    };
  }
  return statsByDate[reviewDate];
}

/**
 * Runs a single continuous discovery cycle on a single store.
 * Stops immediately if 5 consecutive already-seen review fingerprints are encountered.
 * New Week 2 reviews are attributed to the review's resolved Bangkok calendar date,
 * not the date on which the collector happens to run.
 */
export async function collectStoreContinuous(page, store, options = {}) {
  const { storeCode, storeId, storeName, googleMapsUrl } = store;
  const todayBangkok = options.todayBangkok || getTodayBangkokDate();
  const startTime = Date.now();

  console.log(`\n================================================================================`);
  console.log(`[Collector Store ${storeCode}] ${storeName} (Today: ${todayBangkok})`);
  console.log(`Maps URL: ${googleMapsUrl}`);
  console.log(`================================================================================`);

  let reviewsChecked = 0;
  let reviewsWithPhoto = 0;
  let reviewsOver15ThaiWords = 0;
  let newReviewsDiscovered = 0;
  let newQualifiedReviews = 0;
  const newReviewStatsByDate = {};
  let storeRating = null;
  let stopReason = "END_OF_AVAILABLE_REVIEWS";
  let consecutiveSeenCount = 0;

  try {
    await page.goto(googleMapsUrl, { waitUntil: "commit" });
    await page.waitForTimeout(3000);

    const openResult = await openReviewsPane(page);
    storeRating = openResult.status?.rating ?? null;
    console.log(`  Store Rating: ${storeRating ?? "N/A"}`);

    if (!openResult.success) {
      if (openResult.reason === "CONFIRMED_ZERO_REVIEWS") {
        console.log(`  Store ${storeCode} confirmed zero reviews place.`);
        return {
          storeCode,
          storeId,
          storeRating,
          reviewsChecked: 0,
          reviewsWithPhoto: 0,
          reviewsOver15ThaiWords: 0,
          newReviewsDiscovered: 0,
          newQualifiedReviews: 0,
          newReviewStatsByDate: {},
          stopReason: "CONFIRMED_ZERO_REVIEWS",
          durationMs: Date.now() - startTime,
        };
      }

      console.warn(`  [ERROR] Failed to open reviews pane for store ${storeCode}: ${openResult.reason}`);
      return {
        storeCode,
        storeId,
        storeRating,
        reviewsChecked: 0,
        reviewsWithPhoto: 0,
        reviewsOver15ThaiWords: 0,
        newReviewsDiscovered: 0,
        newQualifiedReviews: 0,
        newReviewStatsByDate: {},
        stopReason: openResult.reason || "ERROR_REVIEW_PANEL_NOT_LOADED",
        durationMs: Date.now() - startTime,
      };
    }

    const sortResult = await ensureNewestSort(page);
    if (!sortResult.success) {
      console.warn(`  [ERROR] Failed to verify Newest sort for store ${storeCode}: ${sortResult.reason}`);
      return {
        storeCode,
        storeId,
        storeRating,
        reviewsChecked: 0,
        reviewsWithPhoto: 0,
        reviewsOver15ThaiWords: 0,
        newReviewsDiscovered: 0,
        newQualifiedReviews: 0,
        newReviewStatsByDate: {},
        stopReason: sortResult.reason || "ERROR_NEWEST_SORT_UNVERIFIED",
        durationMs: Date.now() - startTime,
      };
    }

    // Verify review cards or feed exist after opening and sorting
    const initialCardsCount = await page.evaluate(() => document.querySelectorAll(".jftiEf, div[data-review-id]").length);
    if (initialCardsCount === 0) {
      console.warn(`  [ERROR] No review cards found after opening pane for store ${storeCode}.`);
      return {
        storeCode,
        storeId,
        storeRating,
        reviewsChecked: 0,
        reviewsWithPhoto: 0,
        reviewsOver15ThaiWords: 0,
        newReviewsDiscovered: 0,
        newQualifiedReviews: 0,
        newReviewStatsByDate: {},
        stopReason: "ERROR_REVIEW_CARDS_NOT_FOUND",
        durationMs: Date.now() - startTime,
      };
    }

    let currentCardIndex = 0;
    let stopTriggered = false;

    while (!stopTriggered) {
      const renderedCardsCount = await page.evaluate(() => document.querySelectorAll(".jftiEf").length);

      if (currentCardIndex >= renderedCardsCount) {
        await page.evaluate(() => {
          const container = document.querySelector(".m6QErb.DxyBCb, div[role='feed'], div.m6QErb[aria-label]");
          if (container) container.scrollTop += 2500;
        });
        await page.waitForTimeout(1500);
        const newCount = await page.evaluate(() => document.querySelectorAll(".jftiEf").length);
        if (newCount === renderedCardsCount) {
          stopReason = "END_OF_AVAILABLE_REVIEWS";
          break;
        }
        continue;
      }

      const cardData = await page.evaluate(async (idx) => {
        const cards = Array.from(document.querySelectorAll(".jftiEf"));
        const card = cards[idx];
        if (!card) return null;

        card.scrollIntoView({ behavior: "smooth", block: "center" });
        await new Promise((r) => setTimeout(r, 80));

        const moreBtn = card.querySelector("button.w8nwRe, button[aria-label*='more' i], button[aria-label*='เพิ่มเติม' i]");
        if (moreBtn) {
          moreBtn.click();
          await new Promise((r) => setTimeout(r, 40));
        }

        const dataReviewId = card.getAttribute("data-review-id") || "";
        const dateText = card.querySelector("span.rsqaWe, span[class*='date']")?.textContent?.trim() || "";
        const reviewText = card.querySelector(".wiI7Bm, .MyEned")?.textContent?.trim() || "";
        const photoButtons = Array.from(
          card.querySelectorAll("button.Tya61d, div.KtCyie button, [jsaction*='review.photo'], button[data-photo-index]")
        );

        return {
          idx,
          dataReviewId,
          dateText,
          reviewText,
          hasPhoto: photoButtons.length > 0,
        };
      }, currentCardIndex);

      if (!cardData) {
        currentCardIndex++;
        continue;
      }

      reviewsChecked++;
      const isEdited = isEditedReviewDateText(cardData.dateText);
      const thaiSeg = segmentThaiWords(cardData.reviewText);
      const wordCount = thaiSeg.count;

      const fp = computeReviewFingerprint(storeCode, cardData.dataReviewId, {
        relativeDateText: cardData.dateText,
        wordCount,
        hasPhoto: cardData.hasPhoto,
        cardIndex: currentCardIndex,
      });

      const existingFp = await prisma.googleReviewFingerprint.findUnique({
        where: { fingerprint: fp },
      });

      if (existingFp) {
        consecutiveSeenCount++;
        console.log(`  [SEEN ${consecutiveSeenCount}/5] Card #${currentCardIndex + 1}: previously processed (fp: ${fp.slice(0, 10)}...)`);

        if (consecutiveSeenCount >= 5) {
          console.log(`  [FAST STOP TRIGGERED] 5 consecutive previously-seen reviews reached. Store scan caught up to boundary!`);
          stopReason = "CONSECUTIVE_SEEN_BOUNDARY_5";
          stopTriggered = true;
          break;
        }

        currentCardIndex++;
        continue;
      }

      consecutiveSeenCount = 0;
      newReviewsDiscovered++;

      const dateClass = classifyWeek2Date(cardData.dateText, todayBangkok);
      if (dateClass.type === "OLDER_THAN_WEEK2") {
        console.log(`  [STOP CONDITION] Card #${currentCardIndex + 1}: "${cardData.dateText}" is older than Week 2 start (Sep 2). Halting store scan immediately.`);
        stopReason = "STOP_CHRONOLOGY_OLDER_THAN_WEEK2";
        stopTriggered = true;
        break;
      }

      if (cardData.hasPhoto) reviewsWithPhoto++;
      if (wordCount >= 15) reviewsOver15ThaiWords++;

      const isCandidate = dateClass.type === "WEEK2_CANDIDATE";
      const reviewDate = isCandidate ? (dateClass.exactDate || todayBangkok) : null;
      const isQualified = isCandidate && !isEdited && cardData.hasPhoto && wordCount >= 15;

      console.log(`  [NEW REVIEW #${newReviewsDiscovered}] Date: "${cardData.dateText}" -> ${reviewDate ?? dateClass.type} | Candidate: ${isCandidate} | Photo: ${cardData.hasPhoto ? "YES" : "NO"} | Words: ${wordCount} | Edited: ${isEdited} | Qualified: ${isQualified}`);

      if (reviewDate) {
        const dateStats = ensureDateStats(newReviewStatsByDate, reviewDate);
        dateStats.reviewsChecked++;
        dateStats.newReviewsDiscovered++;
        if (cardData.hasPhoto) dateStats.reviewsWithPhoto++;
        if (wordCount >= 15) dateStats.reviewsOver15ThaiWords++;
        if (isQualified) dateStats.newQualifiedReviews++;
      }

      if (isQualified) {
        newQualifiedReviews++;
      }

      await prisma.googleReviewFingerprint.create({
        data: {
          storeCode,
          fingerprint: fp,
          reviewDate: reviewDate || todayBangkok,
          isQualified,
          weekNumber: 2,
        },
      });

      currentCardIndex++;
    }
  } catch (err) {
    console.error(`  Error during store ${storeCode} continuous collection:`, err);
    stopReason = `ERROR: ${err.message}`;
  }

  const durationMs = Date.now() - startTime;
  console.log(`  [Store ${storeCode} Collection Summary] Checked: ${reviewsChecked}, New Discovered: ${newReviewsDiscovered}, New Qualified: ${newQualifiedReviews}, By Date: ${JSON.stringify(newReviewStatsByDate)}, Stop: ${stopReason}, Time: ${(durationMs / 1000).toFixed(1)}s`);

  return {
    storeCode,
    storeId,
    storeRating,
    reviewsChecked,
    reviewsWithPhoto,
    reviewsOver15ThaiWords,
    newReviewsDiscovered,
    newQualifiedReviews,
    newReviewStatsByDate,
    stopReason,
    durationMs,
  };
}
