"use strict";
(() => {
  // src/core/googleMapsDomAdapter.ts
  function cleanReviewText(rawText) {
    if (!rawText) return "";
    let text = rawText;
    const uiRegexes = [
      /\b(see\s+translation|translate|show\s+original|more|like|share|reply|new)\b/gi,
      /(อ่านเพิ่มเติม|ดูเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ข้อความต้นฉบับ|ถูกใจ|แชร์|ตอบกลับ)/g,
      /\(แปลโดย\s*Google\)/g,
      /\(ต้นฉบับ\)/g,
      /\(Original\)/gi
    ];
    for (const regex of uiRegexes) {
      text = text.replace(regex, " ");
    }
    return text.replace(/\s+/g, " ").trim();
  }
  var GoogleMapsDomAdapter = class {
    /**
     * Attempts to detect the Store Name rendered on the current Google Maps place page.
     */
    static getStoreName() {
      var _a;
      const headerEl = document.querySelector("h1.DUwDvf, h1.header-title, h1[class*='fontHeadlineLarge']");
      if ((_a = headerEl == null ? void 0 : headerEl.textContent) == null ? void 0 : _a.trim()) {
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
    static getReviewCardElements() {
      const standardCards = Array.from(document.querySelectorAll(".jftiEf, div[data-review-id]"));
      if (standardCards.length > 0) {
        return standardCards;
      }
      const fallbackCards = Array.from(
        document.querySelectorAll("div[role='region'] div[jsaction*='review'], div[aria-label*='\u0E14\u0E32\u0E27' i], div[aria-label*='star' i]")
      ).filter((el) => {
        return el.querySelector("span[class*='date'], span.rsqaWe, span.wiI7Bm, div.MyEned") !== null;
      });
      return fallbackCards;
    }
    /**
     * Extracts raw review data for all currently rendered review cards.
     * Reuses the canonical extractReviewData implementation.
     */
    static extractReviews() {
      const cards = this.getReviewCardElements();
      return cards.map((c) => this.extractReviewData(c));
    }
    /**
     * Finds the scrollable container that holds Google Maps reviews.
     */
    static getReviewScrollContainer() {
      if (typeof document === "undefined") return null;
      const firstCard = document.querySelector(".jftiEf, div[data-review-id]");
      if (firstCard) {
        let parent = firstCard.parentElement;
        while (parent && parent !== document.body) {
          try {
            const style = window.getComputedStyle(parent);
            const overflowY = style.overflowY;
            if ((overflowY === "auto" || overflowY === "scroll") && parent.scrollHeight > parent.clientHeight) {
              return parent;
            }
          } catch {
          }
          parent = parent.parentElement;
        }
      }
      const container = document.querySelector(".m6QErb.DxyBCb, div[role='feed'], div.m6QErb[aria-label]");
      if (container && container.scrollHeight > container.clientHeight) {
        return container;
      }
      return null;
    }
    /**
     * Evaluates if the review pane has been physically scrolled to the bottom.
     * Tolerates a small pixel distance (<= 15px) for subpixel layout variances.
     */
    static isReviewScrollAtBottom(tolerance = 15) {
      if (typeof document === "undefined") return false;
      const endIndicator = document.querySelector(".HlvSq, div.q63K9c, [aria-label*='end of list' i], [aria-label*='\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14' i]");
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
    static extractReviewData(card) {
      var _a;
      const reviewId = card.getAttribute("data-review-id");
      let dateText = null;
      const dateEl = card.querySelector("span.rsqaWe, span[class*='date'], span[class*='PublishDate']");
      if ((_a = dateEl == null ? void 0 : dateEl.textContent) == null ? void 0 : _a.trim()) {
        dateText = dateEl.textContent.trim();
      }
      let reviewText = "";
      const ownerResponse = card.querySelector(".CDe7pd, [jsaction*='reply'], [aria-label*='owner' i], [aria-label*='\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07' i]");
      const wiI7BmEls = Array.from(card.querySelectorAll(".wiI7Bm, span[class*='review-full-text']"));
      const mainWiI7Bm = wiI7BmEls.find((el) => !ownerResponse || !ownerResponse.contains(el));
      let candidateEl = mainWiI7Bm || null;
      if (!candidateEl) {
        const myEnedEls = Array.from(card.querySelectorAll(".MyEned"));
        const mainMyEned = myEnedEls.find((el) => !ownerResponse || !ownerResponse.contains(el));
        if (mainMyEned) {
          candidateEl = mainMyEned;
        }
      }
      if (candidateEl) {
        try {
          const clone = candidateEl.cloneNode(true);
          const uiButtons = clone.querySelectorAll("button, [role='button'], .w8nwRe, [jsaction*='expand'], [jsaction*='translate']");
          uiButtons.forEach((btn) => btn.remove());
          reviewText = (clone.textContent || "").trim();
        } catch {
          reviewText = (candidateEl.textContent || "").trim();
        }
      } else {
        const excludedElements = card.querySelectorAll(".d4r55, .WNxzHc, .N3EgBe, .DU9Pgb, .kvMYJc, .rsqaWe, .CDe7pd, button");
        const candidates = Array.from(card.querySelectorAll("div, span, p")).filter((el) => {
          var _a2;
          for (const ex of Array.from(excludedElements)) {
            if (ex.contains(el)) return false;
          }
          return el.children.length === 0 && (((_a2 = el.textContent) == null ? void 0 : _a2.trim().length) || 0) > 10;
        });
        reviewText = candidates.map((el) => {
          var _a2;
          return ((_a2 = el.textContent) == null ? void 0 : _a2.trim()) || "";
        }).join(" ").trim();
      }
      reviewText = cleanReviewText(reviewText);
      const photoDetection = this.detectCustomerPhotoEvidence(card);
      return {
        element: card,
        reviewId,
        dateText,
        reviewText,
        hasCustomerPhoto: photoDetection.hasPhoto,
        photoEvidence: photoDetection.evidence
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
    static detectCustomerPhotoEvidence(card) {
      const headerSelectors = [
        ".WNxzHc",
        ".d4r55",
        ".al6Kxe",
        "[data-href*='/contrib/']",
        "a[href*='/contrib/']",
        "button[data-href*='/contrib/']",
        ".RfnDt"
        // contributor stats ("1 review · 1 photo")
      ].join(", ");
      const ownerSelector = ".CDe7pd, [jsaction*='reply'], [aria-label*='owner' i], [aria-label*='\u0E40\u0E08\u0E49\u0E32\u0E02\u0E2D\u0E07' i]";
      const actionsSelector = ".GBkF3d, [aria-label*='Like' i], [aria-label*='Share' i], [aria-label*='\u0E16\u0E39\u0E01\u0E43\u0E08' i], [aria-label*='\u0E41\u0E0A\u0E23\u0E4C' i]";
      const isExcluded = (el) => {
        let cur = el;
        while (cur && cur !== card) {
          if (cur.matches && cur.matches(`${headerSelectors}, ${ownerSelector}`)) {
            return true;
          }
          cur = cur.parentElement;
        }
        return false;
      };
      const galleries = Array.from(card.querySelectorAll(".KtCyie, div[jsaction*='review.photo'], div.review-photos"));
      for (const g of galleries) {
        if (!isExcluded(g)) {
          const thumbnails2 = g.querySelectorAll("button, div[style*='background-image'], img");
          if (thumbnails2.length > 0) {
            return { hasPhoto: true, evidence: "REVIEW_MEDIA_GALLERY" };
          }
        }
      }
      const thumbnails = Array.from(card.querySelectorAll("button.Tya61d, div.Tya61d, div.KtRwe, button[data-photo-index]"));
      for (const t of thumbnails) {
        if (!isExcluded(t)) {
          if (t.hasAttribute("data-photo-index")) {
            return { hasPhoto: true, evidence: "REVIEW_MEDIA_BUTTON" };
          }
          return { hasPhoto: true, evidence: "REVIEW_MEDIA_THUMBNAIL" };
        }
      }
      const photoActionEls = Array.from(card.querySelectorAll("[jsaction*='review.photo'], [jsaction*='pane.review.photo'], [jsaction*='openPhoto']"));
      for (const el of photoActionEls) {
        if (!isExcluded(el)) {
          return { hasPhoto: true, evidence: "REVIEW_MEDIA_BUTTON" };
        }
      }
      const candidateImages = Array.from(card.querySelectorAll("button[style*='background-image'], div[style*='background-image'], img"));
      for (const el of candidateImages) {
        if (isExcluded(el)) continue;
        if (el.closest && el.closest(actionsSelector)) continue;
        const style = el.getAttribute("style") || "";
        const src = el.getAttribute("src") || "";
        const isCustomerPhotoUrl = (src.includes("googleusercontent.com/p/") || style.includes("googleusercontent.com/p/")) && !src.includes("googleusercontent.com/a/") && !style.includes("googleusercontent.com/a/");
        if (isCustomerPhotoUrl) {
          return { hasPhoto: true, evidence: "REVIEW_MEDIA_THUMBNAIL" };
        }
      }
      return { hasPhoto: false, evidence: "NONE" };
    }
    static detectCustomerPhotos(card) {
      return this.detectCustomerPhotoEvidence(card).hasPhoto;
    }
    /**
     * Detects if Google is presenting a CAPTCHA, bot challenge, or consent interceptor.
     */
    static detectGoogleChallenge() {
      if (typeof document === "undefined") return false;
      const challengeEl = document.querySelector(
        "form#captcha-form, iframe[src*='recaptcha'], iframe[src*='challenge'], #captcha, div[class*='captcha' i], div[class*='g-recaptcha' i]"
      );
      if (challengeEl) return true;
      const title = document.title.toLowerCase();
      if (title.includes("before you continue") || title.includes("consent") || title.includes("unusual traffic") || title.includes("\u0E22\u0E34\u0E19\u0E22\u0E2D\u0E21")) {
        return true;
      }
      const heading = document.querySelector("h1, h2");
      if (heading == null ? void 0 : heading.textContent) {
        const hText = heading.textContent.toLowerCase();
        if (hText.includes("unusual traffic") || hText.includes("our systems have detected unusual traffic") || hText.includes("bot")) {
          return true;
        }
      }
      return false;
    }
    /**
     * Checks if the reviews pane is currently open and visible.
     */
    static isReviewsPaneOpen() {
      if (typeof document === "undefined") return false;
      const cards = this.getReviewCardElements();
      if (cards.length > 0) return true;
      const scrollContainer = this.getReviewScrollContainer();
      if (scrollContainer) return true;
      const reviewTab = document.querySelector(
        "button[role='tab'][aria-label*='Reviews' i][aria-selected='true'], button[role='tab'][aria-label*='\u0E23\u0E35\u0E27\u0E34\u0E27' i][aria-selected='true']"
      );
      return reviewTab !== null;
    }
    /**
     * Attempts to open the reviews pane by clicking the Reviews tab or Star Rating trigger.
     */
    static openReviewsPane() {
      if (typeof document === "undefined") return false;
      const reviewTab = document.querySelector(
        "button[role='tab'][aria-label*='Reviews' i], button[role='tab'][aria-label*='\u0E23\u0E35\u0E27\u0E34\u0E27' i], div[role='tab'][aria-label*='Reviews' i], div[role='tab'][aria-label*='\u0E23\u0E35\u0E27\u0E34\u0E27' i]"
      );
      if (reviewTab) {
        reviewTab.click();
        return true;
      }
      const starsButton = document.querySelector(
        "button[aria-label*='\u0E14\u0E32\u0E27' i], button[aria-label*='stars' i], button[jsaction*='pane.rating' i], [aria-label*='\u0E23\u0E35\u0E27\u0E34\u0E27' i][role='button']"
      );
      if (starsButton) {
        starsButton.click();
        return true;
      }
      return false;
    }
    /**
     * Checks or selects "Newest" / "ใหม่ที่สุด" review sorting mode.
     */
    static async ensureNewestSorting() {
      var _a, _b;
      if (typeof document === "undefined") return { success: false, reason: "NO_DOM" };
      const sortBtn = document.querySelector(
        "button[aria-label*='Sort reviews' i], button[aria-label*='Sort' i], button[aria-label*='\u0E40\u0E23\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21' i], button[aria-label*='\u0E08\u0E31\u0E14\u0E40\u0E23\u0E35\u0E22\u0E07' i], button[data-value*='Sort' i], [jsaction*='reviewChart.sort' i]"
      );
      if (!sortBtn) {
        const cards = this.getReviewCardElements();
        if (cards.length > 0 && cards.length <= 5) {
          return { success: true };
        }
        return { success: false, reason: "SORT_BUTTON_NOT_FOUND" };
      }
      const currentSortText = ((_a = sortBtn.textContent) == null ? void 0 : _a.trim().toLowerCase()) || "";
      const currentSortAria = ((_b = sortBtn.getAttribute("aria-label")) == null ? void 0 : _b.toLowerCase()) || "";
      const isAlreadyNewest = currentSortText.includes("newest") || currentSortText.includes("\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14") || currentSortText.includes("most recent") || currentSortAria.includes("newest") || currentSortAria.includes("\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14");
      if (isAlreadyNewest) {
        return { success: true };
      }
      sortBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const menuItems = Array.from(
        document.querySelectorAll("[role='menuitemradio'], [role='menuitem'], div[role='menuitemradio']")
      );
      const newestOption = menuItems.find((el) => {
        const text = (el.textContent || "").toLowerCase();
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        return text.includes("newest") || text.includes("\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14") || text.includes("most recent") || aria.includes("newest") || aria.includes("\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14");
      });
      if (newestOption) {
        newestOption.click();
        await new Promise((resolve) => setTimeout(resolve, 800));
        return { success: true };
      }
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
  };

  // src/core/thaiWordCounter.ts
  var THAI_COMPOUND_PREFIXES = /* @__PURE__ */ new Set([
    "\u0E01\u0E32\u0E23",
    "\u0E04\u0E27\u0E32\u0E21",
    "\u0E19\u0E48\u0E32",
    "\u0E1C\u0E39\u0E49",
    "\u0E19\u0E31\u0E01",
    "\u0E0A\u0E32\u0E27",
    "\u0E0A\u0E48\u0E32\u0E07"
  ]);
  var THAI_COMPOUND_DICTIONARY = [
    ["\u0E17\u0E48\u0E2D\u0E07", "\u0E40\u0E17\u0E35\u0E48\u0E22\u0E27"],
    ["\u0E15\u0E48\u0E32\u0E07", "\u0E0A\u0E32\u0E15\u0E34"],
    ["\u0E42\u0E23\u0E07", "\u0E1E\u0E22\u0E32\u0E1A\u0E32\u0E25"],
    ["\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07", "\u0E43\u0E0A\u0E49"],
    ["\u0E41\u0E21\u0E48", "\u0E1A\u0E49\u0E32\u0E19"]
  ];
  var EXCLUDED_UI_WORDS = /* @__PURE__ */ new Set([
    "new",
    "see",
    "translation",
    "translate",
    "like",
    "share",
    "reply",
    "more",
    "original",
    "google",
    "\u0E2D\u0E48\u0E32\u0E19\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21",
    "\u0E14\u0E39\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21",
    "\u0E14\u0E39\u0E04\u0E33\u0E41\u0E1B\u0E25",
    "\u0E41\u0E2A\u0E14\u0E07\u0E04\u0E33\u0E41\u0E1B\u0E25",
    "\u0E16\u0E39\u0E01\u0E43\u0E08",
    "\u0E41\u0E0A\u0E23\u0E4C",
    "\u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A",
    "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A",
    "\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A"
  ]);
  function cleanReviewText2(rawText) {
    if (!rawText) return "";
    let text = rawText;
    const uiRegexes = [
      /\b(see\s+translation|translation|translate|show\s+original|more|like|share|reply|new)\b/gi,
      /(อ่านเพิ่มเติม|ดูเพิ่มเติม|ดูคำแปล|แสดงคำแปล|ข้อความต้นฉบับ|ถูกใจ|แชร์|ตอบกลับ)/g,
      /\(แปลโดย\s*Google\)/g,
      /\(ต้นฉบับ\)/g,
      /\(Original\)/gi,
      /ฯลฯ/g
    ];
    for (const regex of uiRegexes) {
      text = text.replace(regex, " ");
    }
    return text.replace(/\s+/g, " ").trim();
  }
  function isMeaningfulToken(token) {
    const trimmed = token.trim();
    if (!trimmed) return false;
    const withoutThaiPunct = trimmed.replace(/ฯลฯ/g, "").replace(/[ๆฯ฿๏๚๛]/g, "").trim();
    if (!withoutThaiPunct) return false;
    const lower = withoutThaiPunct.toLowerCase();
    if (EXCLUDED_UI_WORDS.has(lower)) return false;
    if (/^[0-9๐-๙]+$/.test(withoutThaiPunct)) return false;
    if (!new RegExp("\\p{L}", "u").test(withoutThaiPunct)) return false;
    return true;
  }
  function mergeThaiCompoundPrefixes(tokens) {
    const result = [];
    let i = 0;
    while (i < tokens.length) {
      const cur = tokens[i];
      const next = tokens[i + 1];
      if (THAI_COMPOUND_PREFIXES.has(cur) && next) {
        result.push(cur + next);
        i += 2;
      } else {
        result.push(cur);
        i += 1;
      }
    }
    return result;
  }
  function applyCompoundDictionary(tokens, dictionary = THAI_COMPOUND_DICTIONARY) {
    const result = [];
    let i = 0;
    while (i < tokens.length) {
      let matched = false;
      for (const seq of dictionary) {
        if (seq.length === 0) continue;
        let matchSeq = true;
        for (let j = 0; j < seq.length; j++) {
          if (tokens[i + j] !== seq[j]) {
            matchSeq = false;
            break;
          }
        }
        if (matchSeq) {
          result.push(seq.join(""));
          i += seq.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        result.push(tokens[i]);
        i += 1;
      }
    }
    return result;
  }
  function segmentThaiWords(text) {
    if (!text || typeof text !== "string") {
      return { rawTokens: [], finalTokens: [], count: 0 };
    }
    const cleaned = cleanReviewText2(text);
    if (!cleaned) {
      return { rawTokens: [], finalTokens: [], count: 0 };
    }
    let rawExtracted = [];
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("th", { granularity: "word" });
      const segments = Array.from(segmenter.segment(cleaned));
      rawExtracted = segments.map((s) => s.segment);
    } else {
      const cleanChars = cleaned.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, " ");
      rawExtracted = cleanChars.split(/\s+/).filter(Boolean);
    }
    const rawTokens = rawExtracted.filter((tok) => isMeaningfulToken(tok)).map((t) => t.replace(/[ๆฯ]/g, "").trim()).filter(Boolean);
    const dictMerged = applyCompoundDictionary(rawTokens);
    const prefixMerged = mergeThaiCompoundPrefixes(dictMerged);
    const finalTokens = applyCompoundDictionary(prefixMerged);
    return {
      rawTokens,
      finalTokens,
      count: finalTokens.length
    };
  }

  // src/core/googleReviewDateParser.ts
  function isEditedReviewDateText(text) {
    return text.includes("edited") || text.includes("\u0E41\u0E01\u0E49\u0E44\u0E02\u0E40\u0E21\u0E37\u0E48\u0E2D") || text.includes("\u0E41\u0E01\u0E49\u0E44\u0E02");
  }
  function parseGoogleReviewDate(rawDateText, referenceDate = /* @__PURE__ */ new Date()) {
    if (!rawDateText || typeof rawDateText !== "string") {
      return { month: null, isEdited: false, status: "UNKNOWN_DATE" };
    }
    const text = rawDateText.trim().toLowerCase();
    if (!text) {
      return { month: null, isEdited: false, status: "UNKNOWN_DATE" };
    }
    const isEdited = isEditedReviewDateText(text);
    if (isEdited) {
      const explicitDateMatch = text.match(/\b(original|เดิม|โพสต์เมื่อ)\s*:\s*(\d{4}-\d{2})/i);
      if (explicitDateMatch) {
        return { month: explicitDateMatch[2], isEdited: true, status: "VALID" };
      }
      return {
        month: null,
        isEdited: true,
        status: "EDITED_ORIGINAL_UNKNOWN"
      };
    }
    const month = parseUneditedDateToMonth(text, referenceDate);
    return {
      month,
      isEdited: false,
      status: month ? "VALID" : "UNKNOWN_DATE"
    };
  }
  function parseUneditedDateToMonth(text, referenceDate) {
    const ref = new Date(referenceDate);
    const isoMatch = text.match(/^(\d{4})-(0[1-9]|1[0-2])(-\d{2})?/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }
    if (text.includes("hour") || text.includes("minute") || text.includes("second") || text.includes("today") || text.includes("\u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07") || text.includes("\u0E19\u0E32\u0E17\u0E35") || text.includes("\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35") || text.includes("\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49")) {
      return formatYearMonth(ref);
    }
    if (text.includes("yesterday") || text.includes("\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E27\u0E32\u0E19")) {
      const d = new Date(ref);
      d.setDate(d.getDate() - 1);
      return formatYearMonth(d);
    }
    const daysMatch = text.match(/(\d+)\s*(day|days|วัน)/) || (text.includes("a day ago") ? [null, "1"] : null);
    if (daysMatch) {
      const days = parseInt(daysMatch[1] ?? "1", 10);
      const d = new Date(ref);
      d.setDate(d.getDate() - days);
      return formatYearMonth(d);
    }
    const weeksMatch = text.match(/(\d+)\s*(week|weeks|สัปดาห์|อาทิตย์)/) || (text.includes("a week ago") || text.includes("\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C") ? [null, "1"] : null);
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1] ?? "1", 10);
      const d = new Date(ref);
      d.setDate(d.getDate() - weeks * 7);
      return formatYearMonth(d);
    }
    const monthsMatch = text.match(/(\d+)\s*(month|months|เดือน)/) || (text.includes("a month ago") || text.includes("\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E40\u0E14\u0E37\u0E2D\u0E19") ? [null, "1"] : null);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1] ?? "1", 10);
      const d = new Date(ref);
      d.setMonth(d.getMonth() - months);
      return formatYearMonth(d);
    }
    const yearsMatch = text.match(/(\d+)\s*(year|years|ปี)/) || (text.includes("a year ago") || text.includes("\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E1B\u0E35") ? [null, "1"] : null);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1] ?? "1", 10);
      const d = new Date(ref);
      d.setFullYear(d.getFullYear() - years);
      return formatYearMonth(d);
    }
    const englishMonths = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12"
    };
    for (const [mName, mNum] of Object.entries(englishMonths)) {
      const regex = new RegExp(`\\b${mName}\\b.*?(\\d{4})`, "i");
      const match = text.match(regex);
      if (match) {
        return `${match[1]}-${mNum}`;
      }
    }
    const thaiMonths = {
      "\u0E21.\u0E04.": "01",
      "\u0E21\u0E01\u0E23\u0E32\u0E04\u0E21": "01",
      "\u0E01.\u0E1E.": "02",
      "\u0E01\u0E38\u0E21\u0E20\u0E32\u0E1E\u0E31\u0E19\u0E18\u0E4C": "02",
      "\u0E21\u0E35.\u0E04.": "03",
      "\u0E21\u0E35\u0E19\u0E32\u0E04\u0E21": "03",
      "\u0E40\u0E21.\u0E22.": "04",
      "\u0E40\u0E21\u0E29\u0E32\u0E22\u0E19": "04",
      "\u0E1E.\u0E04.": "05",
      "\u0E1E\u0E24\u0E29\u0E20\u0E32\u0E04\u0E21": "05",
      "\u0E21\u0E34.\u0E22.": "06",
      "\u0E21\u0E34\u0E16\u0E38\u0E19\u0E32\u0E22\u0E19": "06",
      "\u0E01.\u0E04.": "07",
      "\u0E01\u0E23\u0E01\u0E0E\u0E32\u0E04\u0E21": "07",
      "\u0E2A.\u0E04.": "08",
      "\u0E2A\u0E34\u0E07\u0E2B\u0E32\u0E04\u0E21": "08",
      "\u0E01.\u0E22.": "09",
      "\u0E01\u0E31\u0E19\u0E22\u0E32\u0E22\u0E19": "09",
      "\u0E15.\u0E04.": "10",
      "\u0E15\u0E38\u0E25\u0E32\u0E04\u0E21": "10",
      "\u0E1E.\u0E22.": "11",
      "\u0E1E\u0E24\u0E28\u0E08\u0E34\u0E01\u0E32\u0E22\u0E19": "11",
      "\u0E18.\u0E04.": "12",
      "\u0E18\u0E31\u0E19\u0E27\u0E32\u0E04\u0E21": "12"
    };
    for (const [mName, mNum] of Object.entries(thaiMonths)) {
      if (text.includes(mName)) {
        const yearMatch = text.match(/\b(\d{4})\b/);
        if (yearMatch) {
          let year = parseInt(yearMatch[1], 10);
          if (year > 2400) year -= 543;
          return `${year}-${mNum}`;
        }
        return `${ref.getFullYear()}-${mNum}`;
      }
    }
    return null;
  }
  function formatYearMonth(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  // src/core/reviewFingerprint.ts
  function generateReviewFingerprint(domElement, reviewIndex) {
    var _a;
    const dataReviewId = domElement.getAttribute("data-review-id");
    if (dataReviewId) {
      return `review-id:${dataReviewId}`;
    }
    const jslog = domElement.getAttribute("jslog");
    const jsaction = domElement.getAttribute("jsaction");
    const textSnippet = ((_a = domElement.textContent) == null ? void 0 : _a.slice(0, 60).replace(/\s+/g, " ").trim()) || "";
    const photoCount = domElement.querySelectorAll("img, button[data-photo-index], div[style*='background-image']").length;
    const rawKey = `${textSnippet}|photo:${photoCount}|${jslog || ""}|${jsaction || ""}|idx:${reviewIndex}`;
    return `fp:${simpleHash(rawKey)}`;
  }
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  // src/core/qualificationEngine.ts
  function determineAuditCoverageStatus(params) {
    const hasOlder = params.reviews.some(
      (r) => r.month !== null && !r.isEdited && r.dateStatus === "VALID" && r.month < params.targetMonth
    );
    if (hasOlder) {
      return "OLDER_THAN_TARGET_REACHED";
    }
    if (params.isAtScrollBottom && params.reviews.length > 0) {
      return "END_OF_AVAILABLE_REVIEWS";
    }
    return "IN_PROGRESS";
  }
  var QualificationEngine = class {
    /**
     * Evaluates a single review against the monthly KPI criteria.
     * STRICT PRIVACY: Keeps only anonymous evaluation attributes.
     *
     * QUALIFICATION RULE:
     * 1. Date matches target audit month
     * 2. Has customer uploaded photo
     * 3. Final Thai word count >= 15 (0-14 = FAIL, 15+ = PASS)
     */
    static evaluateReview(raw, targetMonth, index, referenceDate = /* @__PURE__ */ new Date()) {
      const fingerprint = generateReviewFingerprint(raw.element, index);
      const dateParsed = parseGoogleReviewDate(raw.dateText, referenceDate);
      const estimatedMonth = dateParsed.month;
      const isDateInMonth = estimatedMonth === targetMonth;
      const hasPhoto = raw.hasCustomerPhoto;
      const segmentation = segmentThaiWords(raw.reviewText);
      const thaiWordCount = segmentation.count;
      const isAtLeast15Words = thaiWordCount >= 15;
      const isQualified = isDateInMonth && hasPhoto && isAtLeast15Words;
      return {
        fingerprint,
        rawDateText: raw.dateText,
        fullReviewText: raw.reviewText,
        month: estimatedMonth,
        isDateInMonth,
        isEdited: dateParsed.isEdited,
        dateStatus: dateParsed.status,
        hasPhoto,
        photoEvidence: raw.photoEvidence || (hasPhoto ? "REVIEW_MEDIA_THUMBNAIL" : "NONE"),
        rawTokens: segmentation.rawTokens,
        finalTokens: segmentation.finalTokens,
        thaiWordCount,
        wordTokens: segmentation.finalTokens,
        isAtLeast15Words,
        isOver15Words: isAtLeast15Words,
        isQualified
      };
    }
    /**
     * Evaluates a collection of extracted raw reviews, deduplicating elements by fingerprint.
     */
    static calculateScanSummary(rawReviews, targetMonth, referenceDate = /* @__PURE__ */ new Date(), isAtScrollBottom = false) {
      const seenFingerprints = /* @__PURE__ */ new Set();
      const evaluated = [];
      let reviewsChecked = 0;
      let reviewsWithPhoto = 0;
      let reviewsOver15ThaiWords = 0;
      let qualifiedReviews = 0;
      let unknownDateCount = 0;
      let editedReviewCount = 0;
      for (let i = 0; i < rawReviews.length; i++) {
        const raw = rawReviews[i];
        const evalItem = this.evaluateReview(raw, targetMonth, i, referenceDate);
        if (seenFingerprints.has(evalItem.fingerprint)) {
          continue;
        }
        seenFingerprints.add(evalItem.fingerprint);
        reviewsChecked++;
        if (evalItem.hasPhoto) reviewsWithPhoto++;
        if (evalItem.isAtLeast15Words) reviewsOver15ThaiWords++;
        if (evalItem.isQualified) qualifiedReviews++;
        if (evalItem.month === null) unknownDateCount++;
        if (evalItem.isEdited) editedReviewCount++;
        evaluated.push(evalItem);
      }
      const auditCoverageStatus = determineAuditCoverageStatus({
        targetMonth,
        reviews: evaluated,
        isAtScrollBottom
      });
      const hasReachedOlderReviews = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";
      return {
        targetMonth,
        reviewsChecked,
        reviewsWithPhoto,
        reviewsOver15ThaiWords,
        qualifiedReviews,
        unknownDateCount,
        editedReviewCount,
        hasReachedOlderReviews,
        isAtScrollBottom,
        auditCoverageStatus,
        reviews: evaluated
      };
    }
  };

  // src/batch/batchAuditRunner.ts
  var BatchAuditRunner = class {
    state = "IDLE";
    sessionInfo = null;
    attemptCount = 0;
    maxAttempts = 2;
    isRunning = false;
    statusListeners = [];
    constructor() {
    }
    onStatusChange(listener) {
      this.statusListeners.push(listener);
    }
    notify(state, details) {
      this.state = state;
      for (const l of this.statusListeners) {
        try {
          l(state, details);
        } catch (err) {
          console.error("[BatchAuditRunner] Listener error:", err);
        }
      }
    }
    getState() {
      return this.state;
    }
    async initFromStorage() {
      return new Promise((resolve) => {
        var _a, _b;
        (_b = (_a = chrome.storage) == null ? void 0 : _a.local) == null ? void 0 : _b.get(["batchAuditSession", "batchRunnerState"], (result) => {
          if (result == null ? void 0 : result.batchAuditSession) {
            this.sessionInfo = result.batchAuditSession;
            if (this.sessionInfo && this.sessionInfo.status === "RUNNING") {
              resolve(true);
              return;
            }
          }
          if (typeof window !== "undefined" && window.location) {
            const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
            const hashParams = new URLSearchParams(hash);
            const hashToken = hashParams.get("oppoToken");
            const hashSessionId = hashParams.get("oppoSessionId");
            if (hashToken && hashSessionId) {
              resolve(true);
              return;
            }
          }
          resolve(false);
        });
      });
    }
    setSession(session) {
      this.sessionInfo = session;
    }
    stop() {
      this.isRunning = false;
      this.notify("PAUSED", { reason: "USER_STOPPED" });
    }
    /**
     * Main entry point to run audit on the currently loaded Google Maps place page.
     */
    async runForCurrentStore(storeInfo) {
      if (this.isRunning) {
        console.warn("[BatchAuditRunner] Already running");
        return;
      }
      this.isRunning = true;
      this.attemptCount++;
      try {
        if (GoogleMapsDomAdapter.detectGoogleChallenge()) {
          await this.handleNeedsAttention(
            storeInfo.storeId,
            "GOOGLE_CHALLENGE_DETECTED",
            "Google Maps displayed a CAPTCHA or unusual traffic challenge",
            storeInfo.backendUrl
          );
          return;
        }
        this.notify("WAITING_FOR_MAPS", { storeName: storeInfo.storeName });
        await this.sleep(1200);
        this.notify("OPENING_REVIEWS");
        let reviewsOpen = GoogleMapsDomAdapter.isReviewsPaneOpen();
        if (!reviewsOpen) {
          GoogleMapsDomAdapter.openReviewsPane();
          await this.sleep(1500);
          reviewsOpen = GoogleMapsDomAdapter.isReviewsPaneOpen();
        }
        if (!reviewsOpen) {
          if (this.attemptCount < this.maxAttempts) {
            await this.sleep(1e3);
            return this.runForCurrentStore(storeInfo);
          }
          await this.handleNeedsAttention(
            storeInfo.storeId,
            "REVIEWS_PANE_NOT_FOUND",
            "Could not locate or open Google Maps reviews tab",
            storeInfo.backendUrl
          );
          return;
        }
        this.notify("SETTING_NEWEST");
        const sortRes = await GoogleMapsDomAdapter.ensureNewestSorting();
        if (!sortRes.success) {
          console.warn("[BatchAuditRunner] Could not confirm newest sorting:", sortRes.reason);
        }
        await this.sleep(800);
        this.notify("SCANNING");
        const auditResult = await this.scrollAndScanReviews(storeInfo.targetMonth);
        if (!auditResult) {
          await this.handleNeedsAttention(
            storeInfo.storeId,
            "SCAN_FAILED",
            "Failed to collect reviews from page",
            storeInfo.backendUrl
          );
          return;
        }
        this.notify("SUBMITTING_RESULT", auditResult);
        await this.submitAuditResult(storeInfo.storeId, auditResult, storeInfo.backendUrl);
        this.notify("MOVING_TO_NEXT_STORE");
        await this.navigateToNextStore(storeInfo.backendUrl);
      } catch (err) {
        console.error("[BatchAuditRunner] Error during run:", err);
        await this.handleNeedsAttention(
          storeInfo.storeId,
          "UNEXPECTED_ERROR",
          (err == null ? void 0 : err.message) || "Unexpected runner error",
          storeInfo.backendUrl
        );
      } finally {
        this.isRunning = false;
      }
    }
    /**
     * Controlled scrolling loop: scrolls down until coverage is complete or end of reviews.
     */
    async scrollAndScanReviews(targetMonth) {
      const scrollContainer = GoogleMapsDomAdapter.getReviewScrollContainer();
      let noNewReviewsCount = 0;
      let prevCardCount = 0;
      const maxScrolls = 40;
      for (let scrollIdx = 0; scrollIdx < maxScrolls; scrollIdx++) {
        if (!this.isRunning) return null;
        const rawReviews = GoogleMapsDomAdapter.extractReviews();
        const scanResult = QualificationEngine.calculateScanSummary(
          rawReviews,
          targetMonth,
          /* @__PURE__ */ new Date(),
          false
        );
        if (scanResult.auditCoverageStatus === "OLDER_THAN_TARGET_REACHED") {
          this.notify("AUDIT_COMPLETE", { coverageStatus: scanResult.auditCoverageStatus, reviews: scanResult.reviewsChecked });
          const oldest = scanResult.reviews[scanResult.reviews.length - 1];
          return {
            reviewsChecked: scanResult.reviewsChecked,
            reviewsWithPhoto: scanResult.reviewsWithPhoto,
            reviewsOver15ThaiWords: scanResult.reviewsOver15ThaiWords,
            qualifiedReviews: scanResult.qualifiedReviews,
            coverageStatus: scanResult.auditCoverageStatus,
            oldestReviewDateText: (oldest == null ? void 0 : oldest.rawDateText) || void 0
          };
        }
        if (rawReviews.length === prevCardCount) {
          noNewReviewsCount++;
          if (noNewReviewsCount >= 5) {
            const finalResult = QualificationEngine.calculateScanSummary(
              rawReviews,
              targetMonth,
              /* @__PURE__ */ new Date(),
              true
              // isAtScrollBottom = true
            );
            const oldest = finalResult.reviews[finalResult.reviews.length - 1];
            return {
              reviewsChecked: finalResult.reviewsChecked,
              reviewsWithPhoto: finalResult.reviewsWithPhoto,
              reviewsOver15ThaiWords: finalResult.reviewsOver15ThaiWords,
              qualifiedReviews: finalResult.qualifiedReviews,
              coverageStatus: finalResult.auditCoverageStatus,
              oldestReviewDateText: (oldest == null ? void 0 : oldest.rawDateText) || void 0
            };
          }
        } else {
          noNewReviewsCount = 0;
          prevCardCount = rawReviews.length;
        }
        this.notify("SCROLLING", { cardCount: rawReviews.length, scrollStep: scrollIdx + 1 });
        if (scrollContainer) {
          scrollContainer.scrollBy({ top: 900, behavior: "smooth" });
        } else {
          window.scrollBy({ top: 800, behavior: "smooth" });
        }
        this.notify("WAITING_FOR_LAZY_LOAD");
        await this.sleep(1400);
      }
      const finalRaw = GoogleMapsDomAdapter.extractReviews();
      const fallbackResult = QualificationEngine.calculateScanSummary(
        finalRaw,
        targetMonth,
        /* @__PURE__ */ new Date(),
        true
      );
      const oldestFallback = fallbackResult.reviews[fallbackResult.reviews.length - 1];
      return {
        reviewsChecked: fallbackResult.reviewsChecked,
        reviewsWithPhoto: fallbackResult.reviewsWithPhoto,
        reviewsOver15ThaiWords: fallbackResult.reviewsOver15ThaiWords,
        qualifiedReviews: fallbackResult.qualifiedReviews,
        coverageStatus: fallbackResult.auditCoverageStatus,
        oldestReviewDateText: (oldestFallback == null ? void 0 : oldestFallback.rawDateText) || void 0
      };
    }
    /**
     * Submits aggregate numbers to backend.
     */
    async submitAuditResult(storeId, result, backendUrl) {
      var _a;
      if (!((_a = this.sessionInfo) == null ? void 0 : _a.sessionId)) {
        throw new Error("No active session ID");
      }
      const payload = {
        reviewsChecked: result.reviewsChecked,
        reviewsWithPhoto: result.reviewsWithPhoto,
        reviewsOver15ThaiWords: result.reviewsOver15ThaiWords,
        qualifiedReviews: result.qualifiedReviews,
        targetQualifiedReviews: 10,
        auditCoverageStatus: result.coverageStatus === "OLDER_THAN_TARGET_REACHED" ? "OLDER_THAN_TARGET_REACHED" : "END_OF_AVAILABLE_REVIEWS",
        oldestReviewDateText: result.oldestReviewDateText || null,
        notes: "Auto-verified via Extension Batch Audit Runner"
      };
      const url = `${backendUrl}/google-review-kpi/audit-session/${this.sessionInfo.sessionId}/stores/${storeId}/complete`;
      const headers = this.buildAuthHeaders({ "Content-Type": "application/json" });
      console.debug("[BatchAuditRunner] fetch", { method: "POST", url, hasToken: !!this.sessionInfo.runnerToken });
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to submit audit result: ${res.status} ${errText}`);
      }
    }
    /**
     * Flags store as NEEDS_ATTENTION on backend and pauses runner.
     */
    async handleNeedsAttention(storeId, errorCode, errorMessage, backendUrl) {
      var _a;
      this.notify("NEEDS_ATTENTION", { errorCode, errorMessage });
      this.isRunning = false;
      if ((_a = this.sessionInfo) == null ? void 0 : _a.sessionId) {
        try {
          const url = `${backendUrl}/google-review-kpi/audit-session/${this.sessionInfo.sessionId}/stores/${storeId}/flag-attention`;
          const headers = this.buildAuthHeaders({ "Content-Type": "application/json" });
          console.debug("[BatchAuditRunner] fetch", { method: "POST", url, hasToken: !!this.sessionInfo.runnerToken });
          await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ errorCode, errorMessage })
          });
        } catch (err) {
          console.error("[BatchAuditRunner] Failed to flag needs attention on backend:", err);
        }
      }
    }
    /**
     * Fetches the next pending store from backend and navigates to its Google Maps URL.
     */
    async navigateToNextStore(backendUrl) {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (!((_a = this.sessionInfo) == null ? void 0 : _a.sessionId)) return;
      const url = `${backendUrl}/google-review-kpi/audit-session/${this.sessionInfo.sessionId}/next-store`;
      const headers = this.buildAuthHeaders();
      console.debug("[BatchAuditRunner] fetch", { method: "GET", url, hasToken: !!this.sessionInfo.runnerToken });
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch next store: ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.store) {
        this.notify("COMPLETED");
        (_c = (_b = chrome.storage) == null ? void 0 : _b.local) == null ? void 0 : _c.remove(["batchAuditSession"]);
        alert("\u{1F389} Monthly Google Review KPI Batch Audit completed for all stores!");
        return;
      }
      const nextStore = data.store;
      if (!nextStore.googleMapsUrl) {
        console.warn("[BatchAuditRunner] Next store lacks googleMapsUrl, moving past it");
        return this.navigateToNextStore(backendUrl);
      }
      const updatedSession = {
        ...this.sessionInfo,
        currentStore: {
          storeId: nextStore.storeId,
          storeName: nextStore.storeName,
          storeCode: nextStore.storeCode,
          googleMapsUrl: nextStore.googleMapsUrl,
          region: nextStore.region
        }
      };
      (_e = (_d = chrome.storage) == null ? void 0 : _d.local) == null ? void 0 : _e.set({ batchAuditSession: updatedSession });
      let navUrl = nextStore.googleMapsUrl;
      try {
        const parsed = new URL(navUrl);
        parsed.searchParams.set("oppoStoreId", nextStore.storeId);
        if (nextStore.storeCode) {
          parsed.searchParams.set("oppoCode", nextStore.storeCode);
          parsed.searchParams.set("oppoExtId", nextStore.storeCode);
        }
        parsed.searchParams.set("oppoName", nextStore.storeName);
        if ((_f = this.sessionInfo) == null ? void 0 : _f.targetMonth) {
          parsed.searchParams.set("oppoMonth", this.sessionInfo.targetMonth);
        }
        if (((_g = this.sessionInfo) == null ? void 0 : _g.runnerToken) || ((_h = this.sessionInfo) == null ? void 0 : _h.sessionId)) {
          const hashParams = new URLSearchParams();
          if (this.sessionInfo.runnerToken) hashParams.set("oppoToken", this.sessionInfo.runnerToken);
          if (this.sessionInfo.sessionId) hashParams.set("oppoSessionId", this.sessionInfo.sessionId);
          parsed.hash = hashParams.toString();
        }
        navUrl = parsed.toString();
      } catch {
      }
      await this.sleep(1e3);
      window.location.href = navUrl;
    }
    sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Builds fetch headers including the Authorization Bearer token when a
     * runner token is available. Never logs the token value itself.
     * Fails closed by throwing an Error if no token is present, preventing
     * silent 401 unauthenticated requests from breaking runner flows.
     */
    buildAuthHeaders(base = {}) {
      var _a;
      let token = (_a = this.sessionInfo) == null ? void 0 : _a.runnerToken;
      if (!token && typeof window !== "undefined" && window.location) {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const hashParams = new URLSearchParams(hash);
        const hashToken = hashParams.get("oppoToken");
        if (hashToken) {
          token = hashToken;
          if (this.sessionInfo) {
            this.sessionInfo.runnerToken = hashToken;
          }
        }
      }
      if (token) {
        return { ...base, Authorization: `Bearer ${token}` };
      }
      console.error("[BatchAuditRunner] Runner token missing \u2014 refusing unauthenticated request");
      throw new Error("Runner authentication token is missing. Please resume the session from the dashboard to acquire a fresh token.");
    }
  };

  // src/content_script.ts
  function getCurrentMonthString() {
    const d = /* @__PURE__ */ new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  function formatMonthLabel(monthStr) {
    try {
      const [y, m] = monthStr.split("-");
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return date.toLocaleString("en-US", { month: "long", year: "numeric" });
    } catch {
      return monthStr;
    }
  }
  var ReviewCheckerOverlay = class {
    container = null;
    selectedMonth = getCurrentMonthString();
    storeId = "";
    externalStoreId = "";
    storeCode = "";
    storeName = "";
    isStoreLocked = false;
    lastResult = null;
    isCollapsed = false;
    showDebugMode = true;
    backendUrl = "https://lineoppo.click";
    allEvaluatedReviews = [];
    seenFingerprints = /* @__PURE__ */ new Set();
    lastScanNewCount = null;
    batchRunner = new BatchAuditRunner();
    batchSession = null;
    isBatchMode = false;
    async init() {
      this.detectStoreContextFromUrl();
      await this.detectStoreContextFromStorage();
      const isBatchActive = await this.batchRunner.initFromStorage();
      if (isBatchActive) {
        await this.initBatchMode();
      } else {
        this.render();
      }
    }
    async initBatchMode() {
      var _a, _b;
      (_b = (_a = chrome.storage) == null ? void 0 : _a.local) == null ? void 0 : _b.get(["batchAuditSession"], (res) => {
        var _a2, _b2, _c, _d, _e, _f;
        this.batchSession = (res == null ? void 0 : res.batchAuditSession) || null;
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const hashParams = new URLSearchParams(hash);
        const hashToken = hashParams.get("oppoToken");
        const hashSessionId = hashParams.get("oppoSessionId");
        if (this.batchSession) {
          if (hashToken && !this.batchSession.runnerToken) {
            this.batchSession.runnerToken = hashToken;
            (_b2 = (_a2 = chrome.storage) == null ? void 0 : _a2.local) == null ? void 0 : _b2.set({ batchAuditSession: this.batchSession });
          }
          if (hashSessionId && !this.batchSession.sessionId) {
            this.batchSession.sessionId = hashSessionId;
            (_d = (_c = chrome.storage) == null ? void 0 : _c.local) == null ? void 0 : _d.set({ batchAuditSession: this.batchSession });
          }
        } else if (hashToken && hashSessionId) {
          this.batchSession = {
            sessionId: hashSessionId,
            targetMonth: this.selectedMonth,
            runnerToken: hashToken,
            status: "RUNNING",
            currentStore: {
              storeId: this.storeId,
              storeName: this.storeName,
              storeCode: this.storeCode,
              googleMapsUrl: window.location.href
            }
          };
          (_f = (_e = chrome.storage) == null ? void 0 : _e.local) == null ? void 0 : _f.set({ batchAuditSession: this.batchSession });
        }
        if (!this.batchSession || this.batchSession.status !== "RUNNING") {
          return;
        }
        this.batchRunner.setSession(this.batchSession);
        this.isBatchMode = true;
        this.renderBatchRunnerBar();
        this.startBatchStoreRun();
      });
    }
    renderBatchRunnerBar() {
      var _a, _b, _c, _d;
      let bar = document.getElementById("oppo-batch-runner-bar");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "oppo-batch-runner-bar";
        bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999999;
        background: linear-gradient(135deg, #064e3b, #047857);
        color: #fff;
        padding: 10px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      `;
        document.body.appendChild(bar);
      }
      const currentStore = (_a = this.batchSession) == null ? void 0 : _a.currentStore;
      const storeTitle = (currentStore == null ? void 0 : currentStore.storeName) || this.storeName || "Current Store";
      const storeCodeText = (currentStore == null ? void 0 : currentStore.storeCode) ? ` (${currentStore.storeCode})` : "";
      const targetMonth = ((_b = this.batchSession) == null ? void 0 : _b.targetMonth) || this.selectedMonth;
      bar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #34d399;"></span>
        <div>
          <strong style="font-size: 14px;">\u{1F916} Monthly Batch Audit Runner (${targetMonth})</strong>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
            Target: <strong>${storeTitle}${storeCodeText}</strong>
          </div>
        </div>
      </div>
      <div id="oppo-batch-status-text" style="background: rgba(0,0,0,0.25); padding: 5px 12px; border-radius: 6px; font-weight: 500;">
        Initializing runner...
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="oppo-batch-pause-btn" style="background: #f59e0b; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">
          Pause
        </button>
        <button id="oppo-batch-skip-btn" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
          Skip Store
        </button>
      </div>
    `;
      (_c = document.getElementById("oppo-batch-pause-btn")) == null ? void 0 : _c.addEventListener("click", () => {
        var _a2, _b2;
        this.batchRunner.stop();
        (_b2 = (_a2 = chrome.storage) == null ? void 0 : _a2.local) == null ? void 0 : _b2.set({
          batchAuditSession: { ...this.batchSession, status: "PAUSED" }
        });
        const statusText = document.getElementById("oppo-batch-status-text");
        if (statusText) statusText.textContent = "\u23F8 Paused by operator";
      });
      (_d = document.getElementById("oppo-batch-skip-btn")) == null ? void 0 : _d.addEventListener("click", async () => {
        var _a2, _b2, _c2;
        if (confirm("Skip this store and move to next in queue?")) {
          const storeId = ((_b2 = (_a2 = this.batchSession) == null ? void 0 : _a2.currentStore) == null ? void 0 : _b2.storeId) || this.storeId;
          if (storeId && ((_c2 = this.batchSession) == null ? void 0 : _c2.sessionId)) {
            await fetch(`${this.backendUrl}/google-review-kpi/audit-session/${this.batchSession.sessionId}/stores/${storeId}/skip`, {
              method: "POST"
            });
            window.location.reload();
          }
        }
      });
      this.batchRunner.onStatusChange((state, details) => {
        const statusText = document.getElementById("oppo-batch-status-text");
        if (!statusText) return;
        switch (state) {
          case "WAITING_FOR_MAPS":
            statusText.textContent = "\u23F3 Waiting for Google Maps to load...";
            break;
          case "OPENING_REVIEWS":
            statusText.textContent = "\u{1F4C2} Opening reviews pane...";
            break;
          case "SETTING_NEWEST":
            statusText.textContent = "\u{1F504} Setting sorting to Newest...";
            break;
          case "SCANNING":
            statusText.textContent = "\u{1F50D} Scanning reviews...";
            break;
          case "SCROLLING":
            statusText.textContent = `\u{1F4DC} Scrolling reviews (${(details == null ? void 0 : details.cardCount) || 0} loaded)...`;
            break;
          case "WAITING_FOR_LAZY_LOAD":
            statusText.textContent = "\u23F3 Loading more reviews...";
            break;
          case "AUDIT_COMPLETE":
            statusText.textContent = `\u2705 Audit complete! Evaluated ${(details == null ? void 0 : details.reviews) || 0} reviews (${details == null ? void 0 : details.coverageStatus})`;
            break;
          case "SUBMITTING_RESULT":
            statusText.textContent = "\u{1F4BE} Submitting KPI results to Dashboard...";
            break;
          case "MOVING_TO_NEXT_STORE":
            statusText.textContent = "\u{1F680} Transitioning to next store...";
            break;
          case "NEEDS_ATTENTION":
            statusText.textContent = `\u26A0 Attention needed: ${(details == null ? void 0 : details.errorMessage) || (details == null ? void 0 : details.errorCode)}`;
            statusText.style.background = "#dc2626";
            break;
          case "PAUSED":
            statusText.textContent = "\u23F8 Paused";
            break;
          case "COMPLETED":
            statusText.textContent = "\u{1F389} Batch Audit Completed!";
            break;
          default:
            statusText.textContent = state;
        }
      });
    }
    async startBatchStoreRun() {
      var _a, _b, _c, _d, _e;
      const storeId = ((_b = (_a = this.batchSession) == null ? void 0 : _a.currentStore) == null ? void 0 : _b.storeId) || this.storeId;
      const storeName = ((_d = (_c = this.batchSession) == null ? void 0 : _c.currentStore) == null ? void 0 : _d.storeName) || this.storeName || "Store";
      const targetMonth = ((_e = this.batchSession) == null ? void 0 : _e.targetMonth) || this.selectedMonth;
      if (!storeId) {
        console.warn("[ReviewCheckerOverlay] No storeId for batch audit");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      await this.batchRunner.runForCurrentStore({
        storeId,
        storeName,
        targetMonth,
        backendUrl: this.backendUrl
      });
    }
    detectStoreContextFromUrl() {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const q = (key) => searchParams.get(key) || hashParams.get(key);
      const storeId = q("oppoStoreId") || q("storeId");
      if (storeId) {
        this.storeId = storeId.trim();
        this.isStoreLocked = true;
      }
      const extId = q("oppoExtId") || q("externalStoreId");
      if (extId) this.externalStoreId = extId.trim();
      const code = q("oppoCode") || q("code");
      if (code) this.storeCode = code.trim();
      const name = q("oppoName") || q("storeName");
      if (name) this.storeName = decodeURIComponent(name).trim();
      const month = q("oppoMonth") || q("kpiMonth");
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        this.selectedMonth = month;
      }
    }
    async detectStoreContextFromStorage() {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        try {
          const stored = await chrome.storage.local.get("activeKpiStore");
          if (stored == null ? void 0 : stored.activeKpiStore) {
            const data = stored.activeKpiStore;
            if (data.storeId && !this.storeId) {
              this.storeId = data.storeId;
              this.isStoreLocked = true;
            }
            if (data.externalStoreId && !this.externalStoreId) this.externalStoreId = data.externalStoreId;
            if (data.code && !this.storeCode) this.storeCode = data.code;
            if (data.name && !this.storeName) this.storeName = data.name;
            if (data.month && /^\d{4}-\d{2}$/.test(data.month)) this.selectedMonth = data.month;
          }
        } catch {
        }
      }
    }
    render() {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (this.container) {
        this.container.remove();
      }
      const detectedStoreName = this.storeName || GoogleMapsDomAdapter.getStoreName() || "Google Maps Store";
      const reviews = this.allEvaluatedReviews;
      const hasReachedOlder = ((_a = this.lastResult) == null ? void 0 : _a.hasReachedOlderReviews) ?? false;
      this.container = document.createElement("div");
      this.container.id = "oppo-review-kpi-overlay";
      this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: ${this.isCollapsed ? "auto" : "360px"};
      max-height: 85vh;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      color: #0f172a;
      overflow-y: auto;
      transition: all 0.2s ease-in-out;
    `;
      if (this.isCollapsed) {
        this.container.innerHTML = `
        <button id="oppo-kpi-expand-btn" style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #059669;
          color: #ffffff;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        ">
          <span>\u2B50 OPPO Review KPI</span>
        </button>
      `;
        document.body.appendChild(this.container);
        (_b = document.getElementById("oppo-kpi-expand-btn")) == null ? void 0 : _b.addEventListener("click", () => {
          this.isCollapsed = false;
          this.render();
        });
        return;
      }
      this.container.innerHTML = `
      <div style="background: #059669; color: #ffffff; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-top-left-radius: 15px; border-top-right-radius: 15px;">
        <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <span>\u2B50</span>
          <span>Google Review KPI Checker</span>
        </div>
        <button id="oppo-kpi-collapse-btn" style="background: none; border: none; color: #ffffff; cursor: pointer; font-size: 16px; opacity: 0.85;">\u2715</button>
      </div>

      <div style="padding: 14px 16px; font-size: 12px; display: flex; flex-direction: column; gap: 12px;">

        <!-- Store Identification Header -->
        ${this.isStoreLocked ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-weight: 700; color: #166534; font-size: 11px;">\u{1F512} Linked Store:</span>
              <span style="background: #dcfce7; color: #15803d; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">DASHBOARD VERIFIED</span>
            </div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${detectedStoreName}
            </div>
            <div style="font-family: monospace; font-size: 10px; color: #475569; margin-top: 2px;">
              Store ID: ${this.storeId.slice(0, 18)}... ${this.storeCode ? `(${this.storeCode})` : ""}
            </div>
          </div>
        ` : `
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Store Name:</div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${detectedStoreName}</div>
          </div>

          <div>
            <label style="display: block; font-size: 10px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Store ID / Code *:</label>
            <input id="oppo-kpi-store-id" type="text" value="${this.storeId}" placeholder="e.g. 25610 or UUID" style="
              width: 100%;
              padding: 6px 8px;
              font-size: 12px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              box-sizing: border-box;
            " />
          </div>
        `}

        <div>
          <label style="display: block; font-size: 10px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Target Audit Month:</label>
          <input id="oppo-kpi-month" type="month" value="${this.selectedMonth}" style="
            width: 100%;
            padding: 6px 8px;
            font-size: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            box-sizing: border-box;
          " />
        </div>

        <div style="display: flex; gap: 6px;">
          <button id="oppo-kpi-scan-btn" style="
            flex: 2;
            padding: 8px 12px;
            background: #059669;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            \u{1F50D} Scan Loaded Reviews
          </button>
          <button id="oppo-kpi-reset-btn" style="
            flex: 1;
            padding: 8px 10px;
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            \u{1F504} Reset
          </button>
        </div>

        <!-- Incremental Scan Notification Banner -->
        ${this.lastScanNewCount !== null ? `
          <div style="
            background: ${this.lastScanNewCount > 0 ? "#ecfdf5" : "#f8fafc"};
            color: ${this.lastScanNewCount > 0 ? "#047857" : "#64748b"};
            border: 1px solid ${this.lastScanNewCount > 0 ? "#a7f3d0" : "#e2e8f0"};
            border-radius: 6px;
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 700;
            text-align: center;
          ">
            ${this.lastScanNewCount > 0 ? `\u2728 +${this.lastScanNewCount} new reviews detected` : "\u2139\uFE0F +0 new reviews (all visible reviews already added)"}
          </div>
        ` : ""}

        <!-- Metric Cards -->
        <div id="oppo-kpi-results" style="
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        ">
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Unique reviews detected:</span>
            <span style="font-weight: 700; font-family: monospace;">${((_c = this.lastResult) == null ? void 0 : _c.reviewsChecked) ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">With customer photo:</span>
            <span style="font-weight: 700; font-family: monospace;">${((_d = this.lastResult) == null ? void 0 : _d.reviewsWithPhoto) ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">15+ Thai words:</span>
            <span style="font-weight: 700; font-family: monospace;">${((_e = this.lastResult) == null ? void 0 : _e.reviewsOver15ThaiWords) ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Edited reviews (unverifiable):</span>
            <span style="font-weight: 700; font-family: monospace; color: #d97706;">${((_f = this.lastResult) == null ? void 0 : _f.editedReviewCount) ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Unknown date reviews:</span>
            <span style="font-weight: 700; font-family: monospace; color: #d97706;">${((_g = this.lastResult) == null ? void 0 : _g.unknownDateCount) ?? 0}</span>
          </div>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; font-size: 12px; color: #059669; font-weight: 800;">
            <span>Qualified Reviews:</span>
            <span style="font-size: 14px; font-family: monospace;">${((_h = this.lastResult) == null ? void 0 : _h.qualifiedReviews) ?? 0}</span>
          </div>
        </div>

        <!-- Scroll Boundary Guidance -->
        ${(() => {
        var _a2;
        const status = ((_a2 = this.lastResult) == null ? void 0 : _a2.auditCoverageStatus) ?? "IN_PROGRESS";
        if (status === "OLDER_THAN_TARGET_REACHED") {
          return `
              <div style="
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 8px;
                padding: 8px 10px;
                font-size: 11px;
                line-height: 1.3;
                display: flex;
                align-items: flex-start;
                gap: 6px;
              ">
                <span>\u{1F3C1}</span>
                <span style="color: #166534; font-weight: 600;">
                  Reached reviews older than ${formatMonthLabel(this.selectedMonth)}.<br/>
                  Audit coverage complete.
                </span>
              </div>
            `;
        }
        if (status === "END_OF_AVAILABLE_REVIEWS") {
          return `
              <div style="
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 8px;
                padding: 8px 10px;
                font-size: 11px;
                line-height: 1.3;
                display: flex;
                align-items: flex-start;
                gap: 6px;
              ">
                <span>\u2705</span>
                <span style="color: #166534; font-weight: 600;">
                  Reached the end of available Google Maps reviews.<br/>
                  ${formatMonthLabel(this.selectedMonth)} audit complete.
                </span>
              </div>
            `;
        }
        return `
            <div style="
              background: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 8px;
              padding: 8px 10px;
              font-size: 11px;
              line-height: 1.3;
              display: flex;
              align-items: flex-start;
              gap: 6px;
            ">
              <span>\u{1F4DC}</span>
              <span style="color: #92400e; font-weight: 600;">
                Scroll down the reviews pane to load older reviews.
              </span>
            </div>
          `;
      })()}

        <div style="display: flex; gap: 6px;">
          <button id="oppo-kpi-copy-btn" style="
            flex: 1;
            padding: 7px 10px;
            background: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            \u{1F4CB} Copy JSON
          </button>
          <button id="oppo-kpi-send-btn" style="
            flex: 1;
            padding: 7px 10px;
            background: #0284c7;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            \u{1F680} Send Result
          </button>
        </div>

        <div id="oppo-kpi-status-msg" style="font-size: 10px; text-align: center; color: #64748b; min-height: 14px;"></div>

        <!-- Live Validation Debug View -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 11px; color: #334155;">\u{1F41E} Live Validation Debug View</span>
            <button id="oppo-kpi-debug-toggle" style="background: none; border: none; font-size: 10px; color: #0284c7; cursor: pointer; text-decoration: underline;">
              ${this.showDebugMode ? "Hide Debug" : "Show Debug"}
            </button>
          </div>

          ${this.showDebugMode ? `
            <div id="oppo-kpi-debug-list" style="
              max-height: 260px;
              overflow-y: auto;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              font-family: monospace;
              font-size: 10px;
            ">
              ${reviews.length === 0 ? `<div style="color: #94a3b8; text-align: center; padding: 12px;">No reviews scanned yet. Scroll down and click "Scan Loaded Reviews".</div>` : reviews.map(
        (r, i) => `
                <div style="
                  background: #ffffff;
                  border: 1px solid ${r.isQualified ? "#86efac" : "#e2e8f0"};
                  border-left: 3px solid ${r.isQualified ? "#16a34a" : r.isEdited ? "#d97706" : "#94a3b8"};
                  border-radius: 6px;
                  padding: 8px 10px;
                  line-height: 1.4;
                ">
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Review #${i + 1}</div>
                  ${r.fullReviewText ? `<div style="margin-bottom: 3px; color: #334155; word-break: break-word;"><strong>Full review text:</strong> "${r.fullReviewText}"</div>` : ""}
                  ${r.rawTokens && r.rawTokens.length > 0 ? `<div style="color: #64748b; font-size: 9px; margin-bottom: 2px; word-break: break-word;"><strong>Raw tokens (${r.rawTokens.length}):</strong> [${r.rawTokens.join(", ")}]</div>` : ""}
                  ${r.finalTokens && r.finalTokens.length > 0 ? `<div style="color: #0284c7; font-size: 9px; margin-bottom: 3px; word-break: break-word;"><strong>Final counted tokens (${r.finalTokens.length}):</strong> [${r.finalTokens.join(", ")}]</div>` : ""}
                  <div><strong>Final word count:</strong> ${r.thaiWordCount}</div>
                  <div><strong>15+ words:</strong> ${r.isAtLeast15Words ? "Yes \u2705" : "No \u274C"}</div>
                  <div><strong>Photo evidence:</strong> ${r.photoEvidence ?? "NONE"}</div>
                  <div><strong>Has customer photo:</strong> ${r.hasPhoto ? "Yes \u2705" : "No \u274C"}</div>
                  <div><strong>Date:</strong> ${r.month ?? "ORIGINAL_DATE_UNKNOWN"} ${r.isDateInMonth ? "\u2705" : "\u274C"}</div>
                  ${r.isEdited ? `<div style="color: #d97706; font-weight: 700; font-size: 9px; margin: 1px 0;">
                          \u26A0\uFE0F EDITED REVIEW \u2014 Original creation date unknown. Excluded from monthly KPI.
                         </div>` : ""}
                  <div style="font-weight: 700; color: ${r.isQualified ? "#16a34a" : "#dc2626"}; margin-top: 3px;">
                    Qualified: ${r.isQualified ? "Yes \u2705" : "No \u274C"}
                  </div>
                </div>
              `
      ).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `;
      document.body.appendChild(this.container);
      this.attachEventListeners();
    }
    attachEventListeners() {
      var _a, _b, _c, _d, _e, _f;
      (_a = document.getElementById("oppo-kpi-collapse-btn")) == null ? void 0 : _a.addEventListener("click", () => {
        this.isCollapsed = true;
        this.render();
      });
      (_b = document.getElementById("oppo-kpi-debug-toggle")) == null ? void 0 : _b.addEventListener("click", () => {
        this.showDebugMode = !this.showDebugMode;
        this.render();
      });
      if (!this.isStoreLocked) {
        const storeInput = document.getElementById("oppo-kpi-store-id");
        storeInput == null ? void 0 : storeInput.addEventListener("input", (e) => {
          this.storeId = e.target.value;
        });
      }
      const monthInput = document.getElementById("oppo-kpi-month");
      monthInput == null ? void 0 : monthInput.addEventListener("change", (e) => {
        this.selectedMonth = e.target.value;
        this.recalculateCurrentReviews();
      });
      (_c = document.getElementById("oppo-kpi-scan-btn")) == null ? void 0 : _c.addEventListener("click", () => {
        this.performScan();
      });
      (_d = document.getElementById("oppo-kpi-reset-btn")) == null ? void 0 : _d.addEventListener("click", () => {
        this.resetScan();
      });
      (_e = document.getElementById("oppo-kpi-copy-btn")) == null ? void 0 : _e.addEventListener("click", () => {
        this.copyJson();
      });
      (_f = document.getElementById("oppo-kpi-send-btn")) == null ? void 0 : _f.addEventListener("click", () => {
        this.sendResult();
      });
    }
    resetScan() {
      this.allEvaluatedReviews = [];
      this.seenFingerprints.clear();
      this.lastResult = null;
      this.lastScanNewCount = null;
      this.render();
      this.showStatus("Cleared scanned reviews.", "#64748b");
    }
    recalculateCurrentReviews() {
      const targetMonth = this.selectedMonth;
      let withPhoto = 0;
      let over15 = 0;
      let qualified = 0;
      let unknownDate = 0;
      let editedCount = 0;
      for (const r of this.allEvaluatedReviews) {
        r.isDateInMonth = Boolean(r.month && r.month === targetMonth);
        r.isQualified = r.isDateInMonth && r.hasPhoto && r.isOver15Words;
        if (r.hasPhoto) withPhoto++;
        if (r.isOver15Words) over15++;
        if (r.isQualified) qualified++;
        if (r.month === null) unknownDate++;
        if (r.isEdited) editedCount++;
      }
      const isAtScrollBottom = GoogleMapsDomAdapter.isReviewScrollAtBottom();
      const auditCoverageStatus = determineAuditCoverageStatus({
        targetMonth,
        reviews: this.allEvaluatedReviews,
        isAtScrollBottom
      });
      const hasReachedOlder = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";
      this.lastResult = {
        targetMonth,
        reviewsChecked: this.allEvaluatedReviews.length,
        reviewsWithPhoto: withPhoto,
        reviewsOver15ThaiWords: over15,
        qualifiedReviews: qualified,
        unknownDateCount: unknownDate,
        editedReviewCount: editedCount,
        hasReachedOlderReviews: hasReachedOlder,
        isAtScrollBottom,
        auditCoverageStatus,
        reviews: this.allEvaluatedReviews
      };
      this.render();
    }
    performScan() {
      const cards = GoogleMapsDomAdapter.getReviewCardElements();
      const rawReviews = cards.map((c) => GoogleMapsDomAdapter.extractReviewData(c));
      const ref = /* @__PURE__ */ new Date();
      let newlyAdded = 0;
      for (let i = 0; i < rawReviews.length; i++) {
        const raw = rawReviews[i];
        const evaluated = QualificationEngine.evaluateReview(raw, this.selectedMonth, i, ref);
        if (!this.seenFingerprints.has(evaluated.fingerprint)) {
          this.seenFingerprints.add(evaluated.fingerprint);
          this.allEvaluatedReviews.push(evaluated);
          newlyAdded++;
        }
      }
      this.lastScanNewCount = newlyAdded;
      let withPhoto = 0;
      let over15 = 0;
      let qualified = 0;
      let unknownDate = 0;
      let editedCount = 0;
      for (const r of this.allEvaluatedReviews) {
        if (r.hasPhoto) withPhoto++;
        if (r.isOver15Words) over15++;
        if (r.isQualified) qualified++;
        if (r.month === null) unknownDate++;
        if (r.isEdited) editedCount++;
      }
      const isAtScrollBottom = GoogleMapsDomAdapter.isReviewScrollAtBottom();
      const auditCoverageStatus = determineAuditCoverageStatus({
        targetMonth: this.selectedMonth,
        reviews: this.allEvaluatedReviews,
        isAtScrollBottom
      });
      const hasReachedOlder = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";
      this.lastResult = {
        targetMonth: this.selectedMonth,
        reviewsChecked: this.allEvaluatedReviews.length,
        reviewsWithPhoto: withPhoto,
        reviewsOver15ThaiWords: over15,
        qualifiedReviews: qualified,
        unknownDateCount: unknownDate,
        editedReviewCount: editedCount,
        hasReachedOlderReviews: hasReachedOlder,
        isAtScrollBottom,
        auditCoverageStatus,
        reviews: this.allEvaluatedReviews
      };
      this.render();
      this.showStatus(
        `Scan complete: ${this.allEvaluatedReviews.length} total reviews (+${newlyAdded} new). Qualified: ${qualified}`,
        "#059669"
      );
    }
    copyJson() {
      var _a, _b, _c, _d;
      if (!this.lastResult) {
        this.performScan();
      }
      const payload = {
        storeId: this.storeId || "STORE_ID_REQUIRED",
        month: this.selectedMonth,
        reviewsChecked: ((_a = this.lastResult) == null ? void 0 : _a.reviewsChecked) ?? 0,
        reviewsWithPhoto: ((_b = this.lastResult) == null ? void 0 : _b.reviewsWithPhoto) ?? 0,
        reviewsOver15ThaiWords: ((_c = this.lastResult) == null ? void 0 : _c.reviewsOver15ThaiWords) ?? 0,
        qualifiedReviews: ((_d = this.lastResult) == null ? void 0 : _d.qualifiedReviews) ?? 0
      };
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
        this.showStatus("Copied result JSON to clipboard! Ready to paste into Dashboard.", "#0284c7");
      }).catch(() => {
        this.showStatus("Failed to copy to clipboard", "#e11d48");
      });
    }
    async sendResult() {
      var _a, _b, _c, _d;
      if (!this.storeId.trim()) {
        this.showStatus("Please enter Store ID before sending", "#e11d48");
        return;
      }
      if (!this.lastResult) {
        this.performScan();
      }
      const payload = {
        storeId: this.storeId.trim(),
        month: this.selectedMonth,
        reviewsChecked: ((_a = this.lastResult) == null ? void 0 : _a.reviewsChecked) ?? 0,
        reviewsWithPhoto: ((_b = this.lastResult) == null ? void 0 : _b.reviewsWithPhoto) ?? 0,
        reviewsOver15ThaiWords: ((_c = this.lastResult) == null ? void 0 : _c.reviewsOver15ThaiWords) ?? 0,
        qualifiedReviews: ((_d = this.lastResult) == null ? void 0 : _d.qualifiedReviews) ?? 0
      };
      this.showStatus("Submitting to lineoppo.click...", "#0284c7");
      try {
        const resp = await fetch(`${this.backendUrl}/google-review-kpi/check-result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          this.showStatus("Result saved successfully to Dashboard!", "#059669");
        } else {
          const data = await resp.json().catch(() => ({}));
          this.showStatus(data.message || `Server responded with ${resp.status}`, "#e11d48");
        }
      } catch {
        this.showStatus("Backend connection failed. Use 'Copy JSON' instead.", "#e11d48");
      }
    }
    showStatus(msg, color) {
      const el = document.getElementById("oppo-kpi-status-msg");
      if (el) {
        el.textContent = msg;
        el.style.color = color;
      }
    }
  };
  if (typeof window !== "undefined" && window.location.href.includes("google")) {
    if (!window.__OPPO_KPI_OVERLAY_INITIALIZED__) {
      window.__OPPO_KPI_OVERLAY_INITIALIZED__ = true;
      const overlay = new ReviewCheckerOverlay();
      setTimeout(() => overlay.init(), 1e3);
    }
  }
})();
