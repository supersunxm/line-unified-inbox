import playwright from "playwright";
const { chromium } = playwright;
import { PrismaClient, GoogleReviewPeriodStatus } from "@prisma/client";
import { computeReviewFingerprint } from "./fingerprint-helper.mjs";
import { segmentThaiWords } from "../../../tools/google-review-checker-extension/src/core/thaiWordCounter.ts";
import { isEditedReviewDateText } from "../../../tools/google-review-checker-extension/src/core/googleReviewDateParser.ts";
import { classifyWeek2Date } from "./date-classifier.mjs";
import { resolveGoogleReviewProfileDir } from "./browser-runtime-config.mjs";

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

/**
 * Runs a single continuous discovery cycle on a single store.
 * Stops immediately if 5 consecutive already-seen review fingerprints are encountered.
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
  let storeRating = null;
  let stopReason = "END_OF_AVAILABLE_REVIEWS";
  let consecutiveSeenCount = 0;

  try {
    await page.goto(googleMapsUrl, { waitUntil: "commit" });
    await page.waitForTimeout(3000);

    // 1. Extract place rating and review tab
    const placeInfo = await page.evaluate(() => {
      const title = document.querySelector("h1")?.textContent?.trim();
      const ratingEl = document.querySelector(".F7nice, span.ceNzKf");
      let rating = null;
      if (ratingEl) {
        const text = ratingEl.textContent?.trim() || ratingEl.getAttribute("aria-label") || "";
        const m = text.match(/(\d+\.\d+)/);
        if (m) rating = parseFloat(m[1]);
      }
      const reviewTab = Array.from(document.querySelectorAll("button[role='tab']")).find((t) => {
        const l = (t.getAttribute("aria-label") || t.textContent || "").toLowerCase();
        return l.includes("รีวิว") || l.includes("review");
      });

      return {
        title,
        rating,
        hasReviewTab: Boolean(reviewTab),
      };
    });

    storeRating = placeInfo.rating;
    console.log(`  Store Rating: ${storeRating ?? "N/A"}`);

    if (!placeInfo.hasReviewTab) {
      console.log(`  No reviews tab found for store ${storeCode}.`);
      return {
        storeCode,
        storeId,
        storeRating,
        reviewsChecked: 0,
        newReviewsDiscovered: 0,
        newQualifiedReviews: 0,
        stopReason: "ZERO_REVIEWS_PLACE",
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Open Reviews Tab
    await page.evaluate(() => {
      const reviewTab = Array.from(document.querySelectorAll("button[role='tab']")).find((t) => {
        const l = (t.getAttribute("aria-label") || t.textContent || "").toLowerCase();
        return l.includes("รีวิว") || l.includes("review");
      });
      if (reviewTab) reviewTab.click();
    });
    await page.waitForTimeout(2000);

    // 3. Ensure Newest Sorting
    const sortResult = await page.evaluate(async () => {
      let sortBtn = document.querySelector(
        "button.HQzyZ, button[aria-label*='Sort' i], button[aria-label*='เรียงตาม' i], button[aria-label*='จัดเรียง' i], button[aria-label*='เกี่ยวข้องที่สุด' i], button[aria-label*='ใหม่ที่สุด' i]"
      );
      if (!sortBtn) return { success: false, reason: "NO_SORT_BTN" };
      const textBefore = (sortBtn.textContent || "").trim();
      if (!textBefore.includes("ใหม่ที่สุด") && !textBefore.includes("ล่าสุด") && !textBefore.includes("Newest")) {
        sortBtn.click();
        await new Promise((r) => setTimeout(r, 600));
        const items = Array.from(document.querySelectorAll("[role='menuitemradio'], [role='menuitem']"));
        const newest = items.find((el) => el.textContent.includes("ใหม่ที่สุด") || el.textContent.includes("Newest")) || items[1];
        if (newest) newest.click();
        await new Promise((r) => setTimeout(r, 2000));
      }
      const textAfter = document.querySelector(
        "button.HQzyZ, button[aria-label*='Sort' i], button[aria-label*='เรียงตาม' i], button[aria-label*='ใหม่ที่สุด' i]"
      )?.textContent?.trim() || "";
      const isNewest = textAfter.includes("ใหม่ที่สุด") || textAfter.includes("ล่าสุด") || textAfter.includes("Newest");
      return { success: isNewest, textBefore, textAfter };
    });

    // 4. Scan Reviews from top down with 5-seen stop boundary
    let currentCardIndex = 0;
    let stopTriggered = false;

    while (!stopTriggered) {
      const renderedCardsCount = await page.evaluate(() => document.querySelectorAll(".jftiEf").length);

      if (currentCardIndex >= renderedCardsCount) {
        // Scroll down to load next batch
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

      // Extract card
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

      // Compute zero-PII fingerprint
      const fp = computeReviewFingerprint(storeCode, cardData.dataReviewId, {
        relativeDateText: cardData.dateText,
        wordCount,
        hasPhoto: cardData.hasPhoto,
        cardIndex: currentCardIndex,
      });

      // Check if fingerprint is already in database
      const existingFp = await prisma.googleReviewFingerprint.findUnique({
        where: { fingerprint: fp },
      });

      if (existingFp) {
        consecutiveSeenCount++;
        console.log(`  [SEEN ${consecutiveSeenCount}/5] Card #${currentCardIndex + 1}: previously processed (fp: ${fp.slice(0, 10)}...)`);

        if (consecutiveSeenCount >= 5) {
          console.log(`  🛑 [FAST STOP TRIGGERED] 5 consecutive previously-seen reviews reached. Store scan caught up to boundary!`);
          stopReason = "CONSECUTIVE_SEEN_BOUNDARY_5";
          stopTriggered = true;
          break;
        }

        currentCardIndex++;
        continue;
      }

      // If we reach here, this is a BRAND NEW review never seen before
      consecutiveSeenCount = 0;
      newReviewsDiscovered++;

      // Check if review is older than Week 2 start (Sep 2)
      const dateClass = classifyWeek2Date(cardData.dateText, todayBangkok);
      if (dateClass.type === "OLDER_THAN_WEEK2") {
        console.log(`  🛑 [STOP CONDITION] Card #${currentCardIndex + 1}: "${cardData.dateText}" is older than Week 2 start (Sep 2). Halting store scan immediately.`);
        stopReason = "STOP_CHRONOLOGY_OLDER_THAN_WEEK2";
        stopTriggered = true;
        break;
      }

      if (cardData.hasPhoto) reviewsWithPhoto++;
      if (wordCount >= 15) reviewsOver15ThaiWords++;

      // Qualification rules for Week 2 continuous discovery:
      // 1. Must be a Week 2 candidate (e.g. today / hours / minutes / 1-2 days ago)
      // 2. unedited (isEdited === false)
      // 3. has genuine customer photo
      // 4. wordCount >= 15
      // 5. store rating > 4.8 (checked for weekly rank eligibility)
      const isCandidate = dateClass.type === "WEEK2_CANDIDATE";
      const isQualified = isCandidate && !isEdited && cardData.hasPhoto && wordCount >= 15;

      console.log(`  ✨ [NEW REVIEW #${newReviewsDiscovered}] Date: "${cardData.dateText}" | Candidate: ${isCandidate} | Photo: ${cardData.hasPhoto ? "YES" : "NO"} | Words: ${wordCount} | Edited: ${isEdited} | Qualified: ${isQualified}`);

      if (isQualified) {
        newQualifiedReviews++;
      }

      // Persist new fingerprint immediately
      await prisma.googleReviewFingerprint.create({
        data: {
          storeCode,
          fingerprint: fp,
          reviewDate: isCandidate ? (dateClass.exactDate || todayBangkok) : todayBangkok,
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
  console.log(`  [Store ${storeCode} Collection Summary] Checked: ${reviewsChecked}, New Discovered: ${newReviewsDiscovered}, New Qualified: ${newQualifiedReviews}, Stop: ${stopReason}, Time: ${(durationMs / 1000).toFixed(1)}s`);

  return {
    storeCode,
    storeId,
    storeRating,
    reviewsChecked,
    reviewsWithPhoto,
    reviewsOver15ThaiWords,
    newReviewsDiscovered,
    newQualifiedReviews,
    stopReason,
    durationMs,
  };
}
