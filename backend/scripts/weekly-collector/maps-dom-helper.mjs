/**
 * maps-dom-helper.mjs
 * Resilient DOM navigation and state verification for Google Maps place review pages.
 */

/**
 * Checks place header and reviews availability.
 * Resolves place title, rating, whether Limited View is present, whether reviews controls exist,
 * or whether the place is confirmed to have zero reviews.
 */
export async function evaluatePlaceStatus(page, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await page.evaluate(() => {
        const text = document.body?.innerText || "";

        // 1. Check Limited View / Auth Wall
        const hasLimitedView =
          text.includes("มุมมองแบบจำกัด") ||
          text.includes("limited view") ||
          Boolean(document.querySelector("[aria-label*='มุมมองแบบจำกัด'], [aria-label*='limited view']"));
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
    } catch (err) {
      const isContextError =
        err.message.includes("Execution context was destroyed") ||
        err.message.includes("Cannot find context with specified id") ||
        err.message.includes("navigating");

      if (isContextError && attempt < maxRetries) {
        await page.waitForTimeout(1500);
        continue;
      }
      throw err;
    }
  }
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
 *
 * Railway occasionally receives a slightly different Google Maps DOM where the generic
 * .HQzyZ class can match a non-sort button and the menu renders more slowly than local Chrome.
 * This implementation therefore:
 * - chooses the sort control semantically (accessible label/text), never by class alone;
 * - waits/polls for the menu for up to ~4 seconds;
 * - clicks ONLY an option whose text/aria explicitly means Newest;
 * - re-opens the menu and verifies aria-checked/aria-selected when the button label does not update;
 * - returns compact diagnostics on failure while preserving fail-safe behavior.
 */
export async function ensureNewestSort(page) {
  return await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    const isNewestText = (value) => {
      const text = normalize(value);
      return (
        text.includes("newest") ||
        text.includes("most recent") ||
        text.includes("ใหม่ที่สุด") ||
        text.includes("ใหม่ล่าสุด") ||
        text.includes("ล่าสุด")
      );
    };
    const isSortControlText = (value) => {
      const text = normalize(value);
      return (
        text.includes("sort") ||
        text.includes("เรียง") ||
        text.includes("จัดเรียง") ||
        text.includes("most relevant") ||
        text.includes("relevant") ||
        text.includes("เกี่ยวข้องที่สุด") ||
        isNewestText(text)
      );
    };
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    };
    const accessibleText = (el) => {
      if (!el) return "";
      return [
        el.getAttribute?.("aria-label") || "",
        el.getAttribute?.("data-value") || "",
        el.getAttribute?.("title") || "",
        el.textContent || "",
      ].join(" ");
    };

    const findSortButton = () => {
      const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
      const semantic = buttons.find((el) => isVisible(el) && isSortControlText(accessibleText(el)));
      if (semantic) return semantic;

      // Conservative fallback: only accept HQzyZ when its own accessible text also looks sort-related.
      return buttons.find(
        (el) =>
          isVisible(el) &&
          el.matches?.("button.HQzyZ") &&
          isSortControlText(accessibleText(el)),
      ) || null;
    };

    const collectMenuCandidates = () => {
      const selectors = [
        "[role='menuitemradio']",
        "[role='menuitem']",
        "[role='option']",
        "[role='radio']",
        "[aria-checked]",
      ].join(",");

      const seen = new Set();
      const items = [];
      for (const el of Array.from(document.querySelectorAll(selectors))) {
        if (!isVisible(el)) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        const label = accessibleText(el);
        const normalized = normalize(label);
        if (!normalized) continue;
        items.push({
          el,
          label: label.replace(/\s+/g, " ").trim().slice(0, 160),
          checked: el.getAttribute?.("aria-checked"),
          selected: el.getAttribute?.("aria-selected"),
        });
      }
      return items;
    };

    const getSortLabel = () => {
      const button = findSortButton();
      return button ? accessibleText(button).replace(/\s+/g, " ").trim().slice(0, 200) : "";
    };

    let sortBtn = findSortButton();
    if (!sortBtn) {
      const cards = document.querySelectorAll(".jftiEf, div[data-review-id]").length;
      if (cards > 0 && cards <= 3) {
        return { success: true, reason: "FEW_CARDS_NO_SORT_BTN", diagnostic: { cards } };
      }
      return {
        success: false,
        reason: "ERROR_SORT_BUTTON_NOT_FOUND",
        diagnostic: { cards },
      };
    }

    const beforeLabel = accessibleText(sortBtn).replace(/\s+/g, " ").trim().slice(0, 200);
    if (isNewestText(beforeLabel)) {
      return { success: true, reason: "ALREADY_NEWEST", currentSort: beforeLabel };
    }

    // Retry opening the menu because Railway/headless DOM rendering can lag behind click dispatch.
    let lastCandidates = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      sortBtn = findSortButton();
      if (!sortBtn) break;

      sortBtn.scrollIntoView?.({ block: "center", inline: "center" });
      sortBtn.click();

      let newestItem = null;
      for (let poll = 0; poll < 16; poll++) {
        await sleep(250);
        const candidates = collectMenuCandidates();
        lastCandidates = candidates.map((item) => item.label).slice(0, 12);
        newestItem = candidates.find((item) => isNewestText(item.label)) || null;
        if (newestItem) break;
      }

      if (!newestItem) {
        // A stale/incorrect control may have been clicked. Close any popup and try again.
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await sleep(350);
        continue;
      }

      newestItem.el.click();
      await sleep(1400);

      const afterLabel = getSortLabel();
      if (isNewestText(afterLabel)) {
        return {
          success: true,
          reason: "SORTED_TO_NEWEST",
          currentSort: afterLabel,
          diagnostic: { attempt },
        };
      }

      // Some Google Maps variants leave the button label as "Sort reviews" even after selection.
      // Re-open and verify the Newest option itself is selected instead of guessing by position.
      const verifyBtn = findSortButton();
      if (verifyBtn) {
        verifyBtn.click();
        let selectedNewest = null;
        for (let poll = 0; poll < 12; poll++) {
          await sleep(250);
          const candidates = collectMenuCandidates();
          lastCandidates = candidates.map((item) => item.label).slice(0, 12);
          selectedNewest = candidates.find(
            (item) =>
              isNewestText(item.label) &&
              (item.checked === "true" || item.selected === "true"),
          ) || null;
          if (selectedNewest) break;
        }

        if (selectedNewest) {
          verifyBtn.click();
          await sleep(250);
          return {
            success: true,
            reason: "SORTED_TO_NEWEST_MENU_STATE",
            currentSort: selectedNewest.label,
            diagnostic: { attempt },
          };
        }

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await sleep(350);
      }
    }

    return {
      success: false,
      reason: lastCandidates.length > 0 ? "ERROR_NEWEST_OPTION_NOT_FOUND" : "ERROR_NEWEST_MENU_NOT_RENDERED",
      currentSort: getSortLabel(),
      diagnostic: {
        beforeLabel,
        menuCandidates: lastCandidates,
        reviewCards: document.querySelectorAll(".jftiEf, div[data-review-id]").length,
      },
    };
  });
}
