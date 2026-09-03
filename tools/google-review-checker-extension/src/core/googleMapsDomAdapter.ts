/**
 * Isolated DOM Adapter for Google Maps Reviews Page.
 *
 * All Google Maps DOM-specific selectors are centralized here so that
 * when Google Maps updates its HTML class names or layout structure,
 * only this single file needs maintenance.
 */

export type PhotoEvidence =
  | "NONE"
  | "REVIEW_MEDIA_THUMBNAIL"
  | "REVIEW_MEDIA_BUTTON"
  | "REVIEW_MEDIA_GALLERY";

export type CustomerPhotoDetectionResult = {
  hasPhoto: boolean;
  evidence: PhotoEvidence;
};

export type ExtractedRawReview = {
  element: Element;
  reviewId: string | null;
  dateText: string | null;
  reviewText: string;
  hasCustomerPhoto: boolean;
  photoEvidence: PhotoEvidence;
};

export function cleanReviewText(rawText: string): string {
  if (!rawText) return "";
  let text = rawText;

  // Remove known Google Maps UI phrases (case-insensitive)
  const uiRegexes = [
    /\b(see\s+translation|translate|show\s+original|more|like|share|reply|new)\b/gi,
    /(อ่านเพิ่มเติม|ดูเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ข้อความต้นฉบับ|ถูกใจ|แชร์|ตอบกลับ)/g,
    /\(แปลโดย\s*Google\)/g,
    /\(ต้นฉบับ\)/g,
    /\(Original\)/gi,
  ];

  for (const regex of uiRegexes) {
    text = text.replace(regex, " ");
  }

  // Normalize whitespace
  return text.replace(/\s+/g, " ").trim();
}

export class GoogleMapsDomAdapter {
  /**
   * Attempts to detect the Store Name rendered on the current Google Maps place page.
   */
  static getStoreName(): string | null {
    const headerEl = document.querySelector("h1.DUwDvf, h1.header-title, h1[class*='fontHeadlineLarge']");
    if (headerEl?.textContent?.trim()) {
      return headerEl.textContent.trim();
    }

    const title = document.title;
    if (title && title.includes("- Google Maps")) {
      return title.replace("- Google Maps", "").trim();
    }

    return null;
  }

  /**
   * Finds all currently loaded review card DOM elements on the page.
   */
  static getReviewCardElements(): Element[] {
    // 1. Standard Google Maps review card container class
    const standardCards = Array.from(document.querySelectorAll(".jftiEf, div[data-review-id]"));
    if (standardCards.length > 0) {
      return standardCards;
    }

    // 2. Semantic ARIA / jsaction heuristic fallback
    const fallbackCards = Array.from(
      document.querySelectorAll("div[role='region'] div[jsaction*='review'], div[aria-label*='ดาว' i], div[aria-label*='star' i]")
    ).filter((el) => {
      // Must contain a rating or date element
      return el.querySelector("span[class*='date'], span.rsqaWe, span.wiI7Bm, div.MyEned") !== null;
    });

    return fallbackCards;
  }

  /**
   * Finds the scrollable container that holds Google Maps reviews.
   */
  static getReviewScrollContainer(): HTMLElement | null {
    if (typeof document === "undefined") return null;

    const firstCard = document.querySelector(".jftiEf, div[data-review-id]");
    if (firstCard) {
      let parent = firstCard.parentElement;
      while (parent && parent !== document.body) {
        try {
          const style = window.getComputedStyle(parent);
          const overflowY = style.overflowY;
          if (
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight
          ) {
            return parent;
          }
        } catch {
          // Ignore style errors in non-browser env
        }
        parent = parent.parentElement;
      }
    }

    // Fallback to standard Google Maps scroll panel selectors
    const container = document.querySelector(".m6QErb.DxyBCb, div[role='feed'], div.m6QErb[aria-label]") as HTMLElement | null;
    if (container && container.scrollHeight > container.clientHeight) {
      return container;
    }

    return null;
  }

  /**
   * Evaluates if the review pane has been physically scrolled to the bottom.
   * Tolerates a small pixel distance (<= 15px) for subpixel layout variances.
   */
  static isReviewScrollAtBottom(tolerance = 15): boolean {
    if (typeof document === "undefined") return false;

    // Check for Google Maps explicit end-of-list element
    const endIndicator = document.querySelector(".HlvSq, div.q63K9c, [aria-label*='end of list' i], [aria-label*='สิ้นสุด' i]");
    if (endIndicator) {
      const rect = endIndicator.getBoundingClientRect();
      if (rect.height > 0 && rect.top <= (window.innerHeight || 800)) {
        return true;
      }
    }

    const container = this.getReviewScrollContainer();
    if (!container) {
      if (typeof document.documentElement !== "undefined") {
        const docEl = document.documentElement;
        const dist = docEl.scrollHeight - ((window.scrollY || 0) + (window.innerHeight || 0));
        return dist <= tolerance;
      }
      return false;
    }

    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    return distanceFromBottom <= tolerance;
  }

  /**
   * Extracts raw date, text, and customer photo presence from a single review card DOM element.
   * STRICT ACCURACY:
   * - Retrieves COMPLETE visible review text, not just a single child <span> (which might only be an activity tag).
   * - Excludes owner responses (.CDe7pd).
   * - Strips UI action buttons ("อ่านเพิ่มเติม", "More", "See translation", etc.).
   * - Strictly verifies positive evidence for attached review media.
   */
  static extractReviewData(card: Element): ExtractedRawReview {
    const reviewId = card.getAttribute("data-review-id");

    // 1. Date text
    let dateText: string | null = null;
    const dateEl = card.querySelector("span.rsqaWe, span[class*='date'], span[class*='PublishDate']");
    if (dateEl?.textContent?.trim()) {
      dateText = dateEl.textContent.trim();
    }

    // 2. Review text
    let reviewText = "";

    // Identify owner response block to strictly exclude it
    const ownerResponse = card.querySelector(".CDe7pd, [jsaction*='reply'], [aria-label*='owner' i], [aria-label*='เจ้าของ' i]");

    // Primary review body selectors in Google Maps:
    // .wiI7Bm is the standard Google Maps review text element
    const wiI7BmEls = Array.from(card.querySelectorAll(".wiI7Bm, span[class*='review-full-text']"));
    const mainWiI7Bm = wiI7BmEls.find((el) => !ownerResponse || !ownerResponse.contains(el));

    let candidateEl: Element | null = mainWiI7Bm || null;
    if (!candidateEl) {
      // Secondary: .MyEned container
      const myEnedEls = Array.from(card.querySelectorAll(".MyEned"));
      const mainMyEned = myEnedEls.find((el) => !ownerResponse || !ownerResponse.contains(el));
      if (mainMyEned) {
        candidateEl = mainMyEned;
      }
    }

    if (candidateEl) {
      // Safe clone to remove UI buttons and chips without affecting the live Google Maps DOM
      try {
        const clone = candidateEl.cloneNode(true) as Element;
        const uiButtons = clone.querySelectorAll("button, [role='button'], .w8nwRe, [jsaction*='expand'], [jsaction*='translate']");
        uiButtons.forEach((btn) => btn.remove());
        reviewText = (clone.textContent || "").trim();
      } catch {
        reviewText = (candidateEl.textContent || "").trim();
      }
    } else {
      // Semantic fallback: collect all text elements in the card, excluding author info, rating, and owner response
      const excludedElements = card.querySelectorAll(".d4r55, .WNxzHc, .N3EgBe, .DU9Pgb, .kvMYJc, .rsqaWe, .CDe7pd, button");
      const candidates: Element[] = Array.from(card.querySelectorAll("div, span, p")).filter((el) => {
        for (const ex of Array.from(excludedElements)) {
          if (ex.contains(el)) return false;
        }
        return el.children.length === 0 && (el.textContent?.trim().length || 0) > 10;
      });

      reviewText = candidates.map((el) => el.textContent?.trim() || "").join(" ").trim();
    }

    // Clean UI noise strings from the text
    reviewText = cleanReviewText(reviewText);

    // 3. Customer photo positive evidence detection
    const photoDetection = this.detectCustomerPhotoEvidence(card);

    return {
      element: card,
      reviewId,
      dateText,
      reviewText,
      hasCustomerPhoto: photoDetection.hasPhoto,
      photoEvidence: photoDetection.evidence,
    };
  }

  /**
   * Strictly determines if a review card contains customer-uploaded review media.
   * POSITIVE EVIDENCE ONLY:
   * - Must NEVER count reviewer avatar or profile image.
   * - Must NEVER count contributor photo counts ("1 review · 1 photo", "5 reviews · 20 photos").
   * - Must NEVER count store/place photos, owner profile images, or action bar graphics.
   * - Requires genuine attached review media (gallery, button, or thumbnail).
   */
  static detectCustomerPhotoEvidence(card: Element): CustomerPhotoDetectionResult {
    // 1. Identify excluded regions within the review card
    // Reviewer header / contributor info container:
    const headerSelectors = [
      ".WNxzHc",
      ".d4r55",
      ".al6Kxe",
      "[data-href*='/contrib/']",
      "a[href*='/contrib/']",
      "button[data-href*='/contrib/']",
      ".RfnDt", // contributor stats ("1 review · 1 photo")
    ].join(", ");

    // Owner response block:
    const ownerSelector = ".CDe7pd, [jsaction*='reply'], [aria-label*='owner' i], [aria-label*='เจ้าของ' i]";

    // Action buttons bar (Like / Share):
    const actionsSelector = ".GBkF3d, [aria-label*='Like' i], [aria-label*='Share' i], [aria-label*='ถูกใจ' i], [aria-label*='แชร์' i]";

    // Helper: checks if el is inside reviewer header or owner response
    const isExcluded = (el: Element): boolean => {
      let cur: Element | null = el;
      while (cur && cur !== card) {
        if (cur.matches && cur.matches(`${headerSelectors}, ${ownerSelector}`)) {
          return true;
        }
        cur = cur.parentElement;
      }
      return false;
    };

    // POSITIVE EVIDENCE A: Review media gallery container (.KtCyie)
    const galleries = Array.from(card.querySelectorAll(".KtCyie, div[jsaction*='review.photo'], div.review-photos"));
    for (const g of galleries) {
      if (!isExcluded(g)) {
        const thumbnails = g.querySelectorAll("button, div[style*='background-image'], img");
        if (thumbnails.length > 0) {
          return { hasPhoto: true, evidence: "REVIEW_MEDIA_GALLERY" };
        }
      }
    }

    // POSITIVE EVIDENCE B: Explicit photo thumbnail buttons (.Tya61d, .KtRwe, button[data-photo-index])
    const thumbnails = Array.from(card.querySelectorAll("button.Tya61d, div.Tya61d, div.KtRwe, button[data-photo-index]"));
    for (const t of thumbnails) {
      if (!isExcluded(t)) {
        if (t.hasAttribute("data-photo-index")) {
          return { hasPhoto: true, evidence: "REVIEW_MEDIA_BUTTON" };
        }
        return { hasPhoto: true, evidence: "REVIEW_MEDIA_THUMBNAIL" };
      }
    }

    // POSITIVE EVIDENCE C: Elements with explicit Google Maps photo-action semantics
    const photoActionEls = Array.from(card.querySelectorAll("[jsaction*='review.photo'], [jsaction*='pane.review.photo'], [jsaction*='openPhoto']"));
    for (const el of photoActionEls) {
      if (!isExcluded(el)) {
        return { hasPhoto: true, evidence: "REVIEW_MEDIA_BUTTON" };
      }
    }

    // POSITIVE EVIDENCE D: Review body image thumbnail with customer photo storage URL (/p/)
    // Specifically outside header, outside owner response, and outside action buttons
    const candidateImages = Array.from(card.querySelectorAll("button[style*='background-image'], div[style*='background-image'], img"));
    for (const el of candidateImages) {
      if (isExcluded(el)) continue;
      if (el.closest && el.closest(actionsSelector)) continue;

      const style = el.getAttribute("style") || "";
      const src = el.getAttribute("src") || "";

      // Must be customer-uploaded photo storage path (/p/) and NOT user account avatar (/a/ or /a-/)
      const isCustomerPhotoUrl =
        (src.includes("googleusercontent.com/p/") || style.includes("googleusercontent.com/p/")) &&
        !src.includes("googleusercontent.com/a/") &&
        !style.includes("googleusercontent.com/a/");

      if (isCustomerPhotoUrl) {
        return { hasPhoto: true, evidence: "REVIEW_MEDIA_THUMBNAIL" };
      }
    }

    return { hasPhoto: false, evidence: "NONE" };
  }

  static detectCustomerPhotos(card: Element): boolean {
    return this.detectCustomerPhotoEvidence(card).hasPhoto;
  }

  /**
   * Detects if Google is presenting a CAPTCHA, bot challenge, or consent interceptor.
   */
  static detectGoogleChallenge(): boolean {
    if (typeof document === "undefined") return false;

    // 1. CAPTCHA forms / challenge iframes
    const challengeEl = document.querySelector(
      "form#captcha-form, iframe[src*='recaptcha'], iframe[src*='challenge'], #captcha, div[class*='captcha' i], div[class*='g-recaptcha' i]",
    );
    if (challengeEl) return true;

    // 2. Consent / unusual traffic notice
    const title = document.title.toLowerCase();
    if (
      title.includes("before you continue") ||
      title.includes("consent") ||
      title.includes("unusual traffic") ||
      title.includes("ยินยอม")
    ) {
      return true;
    }

    const heading = document.querySelector("h1, h2");
    if (heading?.textContent) {
      const hText = heading.textContent.toLowerCase();
      if (
        hText.includes("unusual traffic") ||
        hText.includes("our systems have detected unusual traffic") ||
        hText.includes("bot")
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if the reviews pane is currently open and visible.
   */
  static isReviewsPaneOpen(): boolean {
    if (typeof document === "undefined") return false;
    const cards = this.getReviewCardElements();
    if (cards.length > 0) return true;

    // Check if reviews scroll container or reviews tab is active
    const scrollContainer = this.getReviewScrollContainer();
    if (scrollContainer) return true;

    const reviewTab = document.querySelector(
      "button[role='tab'][aria-label*='Reviews' i][aria-selected='true'], button[role='tab'][aria-label*='รีวิว' i][aria-selected='true']",
    );
    return reviewTab !== null;
  }

  /**
   * Attempts to open the reviews pane by clicking the Reviews tab or Star Rating trigger.
   */
  static openReviewsPane(): boolean {
    if (typeof document === "undefined") return false;

    // 1. Dedicated Reviews tab
    const reviewTab = document.querySelector(
      "button[role='tab'][aria-label*='Reviews' i], button[role='tab'][aria-label*='รีวิว' i], div[role='tab'][aria-label*='Reviews' i], div[role='tab'][aria-label*='รีวิว' i]",
    ) as HTMLElement | null;
    if (reviewTab) {
      reviewTab.click();
      return true;
    }

    // 2. Star rating summary / reviews count button
    const starsButton = document.querySelector(
      "button[aria-label*='ดาว' i], button[aria-label*='stars' i], button[jsaction*='pane.rating' i], [aria-label*='รีวิว' i][role='button']",
    ) as HTMLElement | null;
    if (starsButton) {
      starsButton.click();
      return true;
    }

    return false;
  }

  /**
   * Checks or selects "Newest" / "ใหม่ที่สุด" review sorting mode.
   */
  static async ensureNewestSorting(): Promise<{ success: boolean; reason?: string }> {
    if (typeof document === "undefined") return { success: false, reason: "NO_DOM" };

    // Find sort trigger button
    const sortBtn = document.querySelector(
      "button[aria-label*='Sort reviews' i], button[aria-label*='Sort' i], button[aria-label*='เรียงตาม' i], button[aria-label*='จัดเรียง' i], button[data-value*='Sort' i], [jsaction*='reviewChart.sort' i]",
    ) as HTMLElement | null;

    if (!sortBtn) {
      // If reviews are present but no sort button, check if only a few reviews exist (< 5 reviews often has no sort button)
      const cards = this.getReviewCardElements();
      if (cards.length > 0 && cards.length <= 5) {
        return { success: true };
      }
      return { success: false, reason: "SORT_BUTTON_NOT_FOUND" };
    }

    // Check if already sorted by Newest
    const currentSortText = sortBtn.textContent?.trim().toLowerCase() || "";
    const currentSortAria = sortBtn.getAttribute("aria-label")?.toLowerCase() || "";
    const isAlreadyNewest =
      currentSortText.includes("newest") ||
      currentSortText.includes("ใหม่ที่สุด") ||
      currentSortText.includes("most recent") ||
      currentSortAria.includes("newest") ||
      currentSortAria.includes("ใหม่ที่สุด");

    if (isAlreadyNewest) {
      return { success: true };
    }

    // Open sort menu
    sortBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Look for menu item with Newest
    const menuItems = Array.from(
      document.querySelectorAll("[role='menuitemradio'], [role='menuitem'], div[role='menuitemradio']"),
    ) as HTMLElement[];

    const newestOption = menuItems.find((el) => {
      const text = (el.textContent || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return (
        text.includes("newest") ||
        text.includes("ใหม่ที่สุด") ||
        text.includes("most recent") ||
        aria.includes("newest") ||
        aria.includes("ใหม่ที่สุด")
      );
    });

    if (newestOption) {
      newestOption.click();
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { success: true };
    }

    // If second option in radio menu is typically Newest (Google Maps standard order: 0=Most relevant, 1=Newest, 2=Highest, 3=Lowest)
    if (menuItems.length >= 2) {
      const secondOption = menuItems[1];
      if (secondOption) {
        secondOption.click();
        await new Promise((resolve) => setTimeout(resolve, 800));
        return { success: true };
      }
    }

    return { success: false, reason: "NEWEST_OPTION_NOT_FOUND" };
  }
}
