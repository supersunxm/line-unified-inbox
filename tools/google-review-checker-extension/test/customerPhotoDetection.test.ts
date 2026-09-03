import test from "node:test";
import assert from "node:assert/strict";
import {
  GoogleMapsDomAdapter,
  type ExtractedRawReview,
  type PhotoEvidence,
} from "../src/core/googleMapsDomAdapter.ts";
import { QualificationEngine } from "../src/core/qualificationEngine.ts";

/**
 * Lightweight mock DOM node helper that implements the DOM traversal APIs
 * used by GoogleMapsDomAdapter (querySelectorAll, querySelector, matches, closest, getAttribute).
 */
function createMockDom(
  tagName: string,
  attrs: Record<string, string> = {},
  children: any[] = []
): Element {
  const node: any = {
    tagName: tagName.toUpperCase(),
    attributes: { ...attrs },
    children: [...children],
    parentElement: null,
    className: attrs.class || "",
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
    hasAttribute(name: string) {
      return name in this.attributes;
    },
    querySelectorAll(selector: string) {
      const results: any[] = [];
      function traverse(n: any) {
        for (const child of n.children) {
          child.parentElement = n;
          if (matchesSelector(child, selector)) {
            results.push(child);
          }
          traverse(child);
        }
      }
      traverse(this);
      return results;
    },
    querySelector(selector: string) {
      const all = this.querySelectorAll(selector);
      return all[0] || null;
    },
    matches(sel: string) {
      return matchesSelector(this, sel);
    },
    closest(sel: string) {
      let cur: any = this;
      while (cur) {
        if (matchesSelector(cur, sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    cloneNode(deep = true) {
      const clonedChildren = deep
        ? this.children.map((c: any) => c.cloneNode(true))
        : [];
      return createMockDom(this.tagName, this.attributes, clonedChildren);
    },
    remove() {
      if (this.parentElement) {
        const idx = this.parentElement.children.indexOf(this);
        if (idx !== -1) {
          this.parentElement.children.splice(idx, 1);
        }
      }
    },
  };

  for (const child of children) {
    child.parentElement = node;
  }
  return node as unknown as Element;
}

function matchesSelector(node: any, sel: string): boolean {
  const parts = sel.split(",").map((s) => s.trim());
  return parts.some((part) => {
    if (part.startsWith(".")) {
      const cls = part.slice(1);
      return (node.className || "").split(/\s+/).includes(cls);
    }
    if (part.startsWith("[") && part.endsWith("]")) {
      const inner = part.slice(1, -1);
      if (inner.includes("*=")) {
        const [k, v] = inner.split("*=");
        const cleanV = v.replace(/['"]/g, "").replace(/\s+i$/, "");
        const val = node.getAttribute(k.trim()) || "";
        return val.toLowerCase().includes(cleanV.toLowerCase());
      }
      if (inner.includes("=")) {
        const [k, v] = inner.split("=");
        const cleanV = v.replace(/['"]/g, "");
        return node.getAttribute(k.trim()) === cleanV;
      }
      return node.hasAttribute(inner);
    }
    if (part.includes(".")) {
      const [tag, cls] = part.split(".");
      return node.tagName === tag.toUpperCase() && (node.className || "").split(/\s+/).includes(cls);
    }
    if (part.includes("[")) {
      const tag = part.slice(0, part.indexOf("["));
      const attrPart = part.slice(part.indexOf("["));
      return node.tagName === tag.toUpperCase() && matchesSelector(node, attrPart);
    }
    return node.tagName === part.toUpperCase();
  });
}

test("Test 1 & Live Bug Regression: contributor text '1 review · 1 photo', no review media -> hasCustomerPhoto === false", () => {
  // Live Minions Card Fixture
  const avatar = createMockDom("img", {
    src: "https://lh3.googleusercontent.com/a/ACg8ocMinionAvatar",
    class: "q9qlue",
  });
  const headerBtn = createMockDom(
    "button",
    { "aria-label": "minions · 1 review · 1 photo", "data-href": "/maps/contrib/456" },
    [avatar]
  );
  const reviewerName = createMockDom("div", { class: "d4r55" });
  const contributorStats = createMockDom("div", { class: "RfnDt" });
  const header = createMockDom("div", { class: "WNxzHc" }, [headerBtn, reviewerName, contributorStats]);

  const ratingDate = createMockDom("div", { class: "DU9Pgb" }, [
    createMockDom("span", { class: "kvMYJc", "aria-label": "5 ดาว" }),
    createMockDom("span", { class: "rsqaWe" }), // 18 hours ago
  ]);

  const reviewText = createMockDom("div", { class: "MyEned" }, [
    createMockDom("span", { class: "wiI7Bm" }),
  ]);

  const translationLink = createMockDom("button", { class: "w8nwRe", "aria-label": "ดูคำแปล" });
  const actionToolbar = createMockDom("div", { class: "GBkF3d" }, [
    createMockDom("button", { "aria-label": "Like" }),
    createMockDom("button", { "aria-label": "Share" }),
  ]);

  const card = createMockDom("div", { class: "jftiEf", "data-review-id": "rev-minions-live-bug" }, [
    header,
    ratingDate,
    reviewText,
    translationLink,
    actionToolbar,
  ]);

  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, false, "Live bug review must NOT count contributor '1 photo'");
  assert.equal(result.evidence, "NONE");
});

test("Test 2: contributor text '10 reviews · 200 photos', no review media -> hasCustomerPhoto === false", () => {
  const avatar = createMockDom("img", { src: "https://lh3.googleusercontent.com/a/power-user" });
  const headerBtn = createMockDom(
    "button",
    { "aria-label": "Super Contributor · 10 reviews · 200 photos", "data-href": "/maps/contrib/999" },
    [avatar]
  );
  const stats = createMockDom("div", { class: "RfnDt" });
  const header = createMockDom("div", { class: "WNxzHc" }, [headerBtn, stats]);

  const reviewText = createMockDom("div", { class: "MyEned" }, [
    createMockDom("span", { class: "wiI7Bm" }),
  ]);

  const actions = createMockDom("div", { class: "GBkF3d" }, [
    createMockDom("button", { "aria-label": "ถูกใจ" }),
  ]);

  const card = createMockDom("div", { class: "jftiEf", "data-review-id": "rev-power-contributor" }, [
    header,
    reviewText,
    actions,
  ]);

  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, false, "High contributor photo count must not trigger hasCustomerPhoto");
  assert.equal(result.evidence, "NONE");
});

test("Test 3: reviewer avatar only -> hasCustomerPhoto === false", () => {
  const avatar = createMockDom("img", { src: "https://lh3.googleusercontent.com/a/avatar-url" });
  const header = createMockDom("div", { class: "WNxzHc" }, [avatar]);
  const text = createMockDom("div", { class: "wiI7Bm" });
  const actions = createMockDom("div", { class: "GBkF3d" });

  const card = createMockDom("div", { class: "jftiEf" }, [header, text, actions]);
  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, false);
  assert.equal(result.evidence, "NONE");
});

test("Test 4: Google CDN avatar only (ggpht.com / googleusercontent.com) -> hasCustomerPhoto === false", () => {
  const avatar = createMockDom("img", { src: "https://lh3.ggpht.com/avatar-custom" });
  const header = createMockDom("div", { class: "WNxzHc" }, [avatar]);
  const text = createMockDom("div", { class: "wiI7Bm" });

  const card = createMockDom("div", { class: "jftiEf" }, [header, text]);
  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, false);
  assert.equal(result.evidence, "NONE");
});

test("Test 5 & Positive Fixture: actual review thumbnail (.Tya61d / data-photo-index) -> hasCustomerPhoto === true", () => {
  const header = createMockDom("div", { class: "WNxzHc" });
  const text = createMockDom("div", { class: "wiI7Bm" });

  // Media button thumbnail
  const photoBtn = createMockDom("button", {
    class: "Tya61d",
    "data-photo-index": "0",
    style: "background-image: url('https://lh3.googleusercontent.com/p/AF1QipN_customer_pic=w300')",
  });

  const actions = createMockDom("div", { class: "GBkF3d" });
  const card = createMockDom("div", { class: "jftiEf" }, [header, text, photoBtn, actions]);

  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, true);
  assert.equal(result.evidence, "REVIEW_MEDIA_BUTTON");
});

test("Test 6: actual review media gallery (.KtCyie) -> hasCustomerPhoto === true", () => {
  const header = createMockDom("div", { class: "WNxzHc" });
  const text = createMockDom("div", { class: "wiI7Bm" });

  const photoGallery = createMockDom("div", { class: "KtCyie" }, [
    createMockDom("button", { class: "Tya61d" }),
    createMockDom("button", { class: "Tya61d" }),
  ]);

  const actions = createMockDom("div", { class: "GBkF3d" });
  const card = createMockDom("div", { class: "jftiEf" }, [header, text, photoGallery, actions]);

  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, true);
  assert.equal(result.evidence, "REVIEW_MEDIA_GALLERY");
});

test("Test 7: unrelated place image outside review -> hasCustomerPhoto === false", () => {
  const header = createMockDom("div", { class: "WNxzHc" });
  const text = createMockDom("div", { class: "wiI7Bm" });
  const card = createMockDom("div", { class: "jftiEf" }, [header, text]);

  // Place photo container outside card
  const placePhoto = createMockDom("img", { src: "https://lh3.googleusercontent.com/p/place-cover" });
  const container = createMockDom("div", {}, [card, placePhoto]);

  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, false);
  assert.equal(result.evidence, "NONE");
});

test("Test 8: review with no media, Like/Share immediately after text -> hasCustomerPhoto === false", () => {
  const text = createMockDom("div", { class: "wiI7Bm" });
  const actions = createMockDom("div", { class: "GBkF3d" }, [
    createMockDom("button", { "aria-label": "Like" }),
    createMockDom("button", { "aria-label": "Share" }),
  ]);
  const card = createMockDom("div", { class: "jftiEf" }, [text, actions]);

  const result = GoogleMapsDomAdapter.detectCustomerPhotoEvidence(card);
  assert.equal(result.hasPhoto, false);
  assert.equal(result.evidence, "NONE");
});

test("Qualification Regression: live review with 12 words, current month, no attached media -> Qualified === false", () => {
  const ref = new Date("2026-09-02T12:00:00Z");

  // 12 Thai words: "ร้านดูแลดีมาก ชอบมาก มาร่วมกิจกรรมกันเยอะ ๆ"
  // Words: ร้าน, ดูแล, ดี, มาก, ชอบ, มาก, มา, ร่วม, กิจกรรม, กัน, เยอะ, ๆ
  const raw: ExtractedRawReview = {
    element: createMockDom("div", { "data-review-id": "rev-live-12w" }),
    reviewId: "rev-live-12w",
    dateText: "18 hours ago", // Sep 2026
    reviewText: "ร้านดูแลดีมาก ชอบมาก มาร่วมกิจกรรมกันเยอะ ๆ",
    hasCustomerPhoto: false, // NO photo
    photoEvidence: "NONE",
  };

  const evalItem = QualificationEngine.evaluateReview(raw, "2026-09", 0, ref);
  assert.equal(evalItem.isDateInMonth, true);
  assert.equal(evalItem.isAtLeast15Words, false, "12 words must not pass 15+ threshold");
  assert.equal(evalItem.hasPhoto, false, "No attached media must report hasPhoto === false");
  assert.equal(evalItem.photoEvidence, "NONE");
  assert.equal(evalItem.isQualified, false, "Must NOT qualify");
});
