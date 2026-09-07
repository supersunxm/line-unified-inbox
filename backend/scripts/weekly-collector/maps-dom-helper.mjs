/**
 * maps-dom-helper.mjs
 * Resilient DOM navigation and state verification for Google Maps place review pages.
 */

/**
 * Checks place header and reviews availability.
 * Resolves place title, rating, whether Limited View is present, whether reviews controls exist,
 * or whether the place is confirmed to have zero reviews.
 */
export async function evaluatePlaceStatus(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText || "";

    // 1. Check Limited View / Auth Wall
    const hasLimitedView =
      text.includes("มุมมองแบบจำกัด") ||
      text.includes("limited view") ||
      Boolean(document.querySelector(".kyuRq, [aria-label*='มุมมองแบบจำกัด'], [aria-label*='limited view']"));
    const hasSignInPrompt =
      (text.includes("ลงชื่อเข้าใช้") || text.includes("Sign in")) && hasLimitedView;

    // 2. Title
    const title = document.querySelector("h1")?.textContent?.trim() || null;

    // 3. Rating & Total Review Count
    const ratingEl = document.querySelector(".F7nice, span.ceNzKf");
    let rating = null;
    let reviewCountText = null;
    if (ratingEl) {
      const rText = ratingEl.textContent?.trim() || ratingEl.getAttribute("aria-label") || "";
      const m = rText.match(/(\d+\.\d+)/);
      if (m) rating = parseFloat(m[1]);
      const parent = ratingEl.closest(".LBgpqf, .skqShb, div");
      const cMatch = parent?.textContent?.match(/\(([\d,]+)\)/);
      if (cMatch) reviewCountText = cMatch[1];
    }

    // 4. Look for Review Tab
    const tabs = Array.from(document.querySelectorAll("[role='tab']"));
    const reviewTab = tabs.find((t) => {
      const l = ((t.getAttribute("aria-label") || "") + " " + (t.textContent || "")).toLowerCase();
      return l.includes("รีวิว") || l.includes("review");
    });

    // 5. Look for alternative review triggers
    const reviewTriggerBtn = document.querySelector(
      "button[aria-label*='รีวิว' i], button[aria-label*='review' i], button[jsaction*='pane.rating' i], [aria-label*='รีวิว' i][role='button']"
    );

    // 6. Look for Write a review button
    const writeReviewBtn = document.querySelector(
      "button[aria-label*='เขียนรีวิว' i], button[aria-label*='Write a review' i], [jsaction*='pane.review.write' i]"
    );

    // 7. Cards & Feed
    const cardsCount = document.querySelectorAll(".jftiEf, div[data-review-id]").length;
    const feed = document.querySelector("div[role='feed']");

    return {
      title,
      rating,
      reviewCountText,
      hasLimitedView,
      hasSignInPrompt,
      hasReviewTab: Boolean(reviewTab),
      reviewTabSelected: reviewTab ? reviewTab.getAttribute("aria-selected") === "true" : false,
      hasReviewTriggerBtn: Boolean(reviewTriggerBtn),
      hasWriteReviewBtn: Boolean(writeReviewBtn),
      cardsCount,
      hasFeed: Boolean(feed),
    };
  });
}

/**
 * Attempts to open the reviews pane via multiple fallback strategies.
 * Returns { success: boolean, reason?: string, status: any }
 */
export async function openReviewsPane(page) {
  const status = await evaluatePlaceStatus(page);

  // If Limited View is active and no reviews tab/cards exist, Google has restricted review access
  if (status.hasLimitedView && !status.hasReviewTab && status.cardsCount === 0) {
    return {
      success: false,
      reason: "ERROR_MAPS_LIMITED_VIEW_DETECTED",
      status,
    };
  }

  // If review tab is already selected and feed is visible
  if (status.reviewTabSelected && (status.cardsCount > 0 || status.hasFeed)) {
    return { success: true, reason: "ALREADY_OPEN", status };
  }

  // Strategy 1: Click review tab [role='tab']
  const clickedTab = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("[role='tab']"));
    const reviewTab = tabs.find((t) => {
      const l = ((t.getAttribute("aria-label") || "") + " " + (t.textContent || "")).toLowerCase();
      return l.includes("รีวิว") || l.includes("review");
    });
    if (reviewTab) {
      reviewTab.click();
      return true;
    }
    return false;
  });

  if (clickedTab) {
    await page.waitForTimeout(2000);
    const postStatus = await evaluatePlaceStatus(page);
    if (postStatus.cardsCount > 0 || postStatus.hasFeed || postStatus.reviewTabSelected) {
      return { success: true, reason: "CLICKED_REVIEW_TAB", status: postStatus };
    }
  }

  // If cards or feed are already visible and active
  if (status.cardsCount > 0 || status.hasFeed) {
    return { success: true, reason: "ALREADY_OPEN", status };
  }

  // Strategy 2: Click review button or star rating trigger
  const clickedTrigger = await page.evaluate(() => {
    const btn = document.querySelector(
      "button[aria-label*='รีวิว' i], button[aria-label*='review' i], button[jsaction*='pane.rating' i], [aria-label*='รีวิว' i][role='button']"
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });

  if (clickedTrigger) {
    await page.waitForTimeout(2000);
    const postStatus = await evaluatePlaceStatus(page);
    if (postStatus.cardsCount > 0 || postStatus.hasFeed) {
      return { success: true, reason: "CLICKED_TRIGGER_BTN", status: postStatus };
    }
  }

  // Check if place has confirmed zero reviews:
  // Explicit rating is absent or 0, no review tab, but "write a review" exists
  if (!status.hasLimitedView && !status.rating && !status.hasReviewTab && status.hasWriteReviewBtn) {
    return {
      success: false,
      reason: "CONFIRMED_ZERO_REVIEWS",
      status,
    };
  }

  // If place has rating (e.g. 4.9) or review count but we could not open reviews pane:
  if (status.rating !== null && status.rating > 0) {
    if (status.hasLimitedView) {
      return { success: false, reason: "ERROR_MAPS_LIMITED_VIEW_DETECTED", status };
    }
    return { success: false, reason: "ERROR_REVIEW_CONTROL_NOT_FOUND", status };
  }

  if (status.hasLimitedView) {
    return { success: false, reason: "ERROR_MAPS_LIMITED_VIEW_DETECTED", status };
  }

  return { success: false, reason: "ERROR_REVIEW_PANEL_NOT_LOADED", status };
}

/**
 * Ensures the reviews pane is sorted by "Newest" / "ใหม่ที่สุด".
 * Returns { success: boolean, reason?: string, currentSort?: string }
 */
export async function ensureNewestSort(page) {
  return await page.evaluate(async () => {
    const sortBtn = document.querySelector(
      "button.HQzyZ, button[aria-label*='Sort' i], button[aria-label*='เรียงตาม' i], button[aria-label*='จัดเรียง' i], button[aria-label*='เกี่ยวข้องที่สุด' i], button[aria-label*='ใหม่ที่สุด' i]"
    );
    if (!sortBtn) {
      // If there are only a few cards (e.g. <= 3), sort button might not be rendered
      const cards = document.querySelectorAll(".jftiEf, div[data-review-id]").length;
      if (cards > 0 && cards <= 3) {
        return { success: true, reason: "FEW_CARDS_NO_SORT_BTN" };
      }
      return { success: false, reason: "ERROR_SORT_BUTTON_NOT_FOUND" };
    }

    const textBefore = (sortBtn.textContent || "").trim();
    const ariaBefore = (sortBtn.getAttribute("aria-label") || "").trim();
    const isAlreadyNewest =
      textBefore.includes("ใหม่ที่สุด") ||
      textBefore.includes("ล่าสุด") ||
      textBefore.includes("Newest") ||
      ariaBefore.includes("ใหม่ที่สุด") ||
      ariaBefore.includes("ล่าสุด") ||
      ariaBefore.includes("Newest");

    if (isAlreadyNewest) {
      return { success: true, reason: "ALREADY_NEWEST", currentSort: textBefore || ariaBefore };
    }

    sortBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    const items = Array.from(
      document.querySelectorAll("[role='menuitemradio'], [role='menuitem'], div[role='menuitemradio'], [role='option']")
    );
    const newestOption =
      items.find((el) => {
        const t = (el.textContent || "").toLowerCase();
        const a = (el.getAttribute("aria-label") || "").toLowerCase();
        return (
          t.includes("ใหม่ที่สุด") ||
          t.includes("ล่าสุด") ||
          t.includes("newest") ||
          a.includes("ใหม่ที่สุด") ||
          a.includes("ล่าสุด") ||
          a.includes("newest")
        );
      }) || items[1];

    if (!newestOption) {
      return { success: false, reason: "ERROR_NEWEST_OPTION_NOT_FOUND" };
    }

    newestOption.click();
    await new Promise((r) => setTimeout(r, 1500));

    const sortBtnAfter = document.querySelector(
      "button.HQzyZ, button[aria-label*='Sort' i], button[aria-label*='เรียงตาม' i], button[aria-label*='ใหม่ที่สุด' i]"
    );
    const textAfter = (sortBtnAfter?.textContent || "").trim();
    const ariaAfter = (sortBtnAfter?.getAttribute("aria-label") || "").trim();
    const isNowNewest =
      textAfter.includes("ใหม่ที่สุด") ||
      textAfter.includes("ล่าสุด") ||
      textAfter.includes("Newest") ||
      ariaAfter.includes("ใหม่ที่สุด") ||
      ariaAfter.includes("ล่าสุด") ||
      ariaAfter.includes("Newest");

    if (isNowNewest) {
      return { success: true, reason: "SORTED_TO_NEWEST", currentSort: textAfter || ariaAfter };
    }

    return {
      success: false,
      reason: "ERROR_NEWEST_SORT_UNVERIFIED",
      currentSort: textAfter || ariaAfter,
    };
  });
}
