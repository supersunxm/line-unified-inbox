# Google Maps Review KPI Checker

## 1. Overview & Purpose

The **Google Maps Review KPI Checker** is an internal retail operations feature in `lineoppo.click` for monthly store review verification.

Operations teams track the performance of OPPO retail branches on Google Maps by counting **Qualified Reviews** each month.

### Definition of a Qualified Review
A Google Maps review is classified as a **Qualified Review** if and only if it satisfies all 3 conditions:
1. **Target Month**: The review date falls within the selected monthly audit period (e.g. `August 2026`).
2. **Customer Media**: The review contains at least 1 customer-uploaded photo or image.
3. **Review Depth**: The review text contains more than 15 Thai words (`> 15` words counted using `Intl.Segmenter`).

---

## 2. Architecture & Design Principles

### Human-in-the-Loop Chrome Extension + Internal Dashboard
```
+---------------------------+        +-----------------------------------+
| Retail Staff on Chrome    |        | lineoppo.click Dashboard / API    |
| (Opens Store Google Maps) |        | (/google-review-kpi)              |
+-------------+-------------+        +-----------------+-----------------+
              |                                        ^
              | [Local DOM Inspection]                 |
              v                                        |
+-------------+-------------+                          |
| Chrome Extension MVP      |                          |
| - Intl.Segmenter Words    |                          |
| - Relative Date Parser    |                          |
| - Review Deduplication    | -- [POST Check Result] --+
| - Ephemeral Calculation   |    (or Copy/Paste JSON)
+---------------------------+
```

### Why NOT Google Maps Places API?
- Google Places API limits review retrieval to only 5 most helpful reviews per place.
- Full review scraping via official APIs is cost-prohibitive and violates API intent for internal staff auditing.

### Why NOT Server-Side Scraping or Headless Crawlers?
- Google Maps actively blocks automated server IPs, triggers CAPTCHAs, and rotates DOM structures.
- Running headless scrapers against hundreds of stores risks IP blacklisting and severe maintenance fragility.
- Human-in-the-loop ensures that staff open genuine user sessions, scroll at normal human speeds, and verify rendered content.

---

## 3. Privacy & Data Storage Policy

### What is NEVER Stored:
- ❌ Reviewer name, nickname, or handle
- ❌ Google user profile ID or avatar
- ❌ Review text content or customer commentary
- ❌ Review photos or customer images
- ❌ Personal Identifiable Information (PII)

### What IS Persisted in PostgreSQL:
Only aggregated monthly KPI totals in `GoogleReviewKpiResult`:
- `storeId` (Store reference)
- `month` (e.g. `2026-08`)
- `reviewsChecked` (total reviews loaded in scan)
- `reviewsWithPhoto` (count of reviews with image)
- `reviewsOver15ThaiWords` (count of reviews >15 words)
- `qualifiedReviews` (count passing all 3 criteria)
- `targetQualifiedReviews` (e.g. 10)
- `checkedAt` (audit timestamp)
- `checkedByUserId` (staff user ID)

---

## 4. Local Installation Guide for Chrome Extension

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** (โหลดส่วนขยายที่คลายการบีบอัด).
5. Select the directory:
   ```text
   /Users/chutisoa.nup/Projects/line-unified-inbox/tools/google-review-checker-extension
   ```
6. The **OPPO Google Maps Review KPI Checker** extension icon will now appear in your browser toolbar.

---

## 5. Step-by-Step Monthly Audit Workflow

1. Open `https://lineoppo.click/google-review-kpi`.
2. Select the target audit month (e.g. `สิงหาคม 2026 / 2026-08`).
3. Locate the store in the table and click **"เปิด Google Maps ↗"**.
4. On the Google Maps place page:
   - Click the **Reviews** tab.
   - Sort reviews by **Newest** (ล่าสุด).
   - Scroll down to load all reviews for the target month.
5. The floating **OPPO Review KPI** widget on the bottom right will show the detected store:
   - Verify the Store ID and selected Month.
   - Click **"🔍 Scan Loaded Reviews"**.
   - Review the live totals: Reviews checked, With photo, >15 Thai words, and Qualified count.
6. Click **"🚀 Send Result"** (or click **"📋 Copy JSON"** to paste into the Dashboard manual entry modal).
7. Return to the dashboard: the store row will now display **"ผ่านเกณฑ์ (Passed)"** or **"ยังไม่ถึงเป้า (Below Target)"** with audit timestamp.

---

## 6. DOM Adapter Maintenance Guide (`googleMapsDomAdapter.ts`)

Google Maps periodically modifies HTML class names. All Google Maps DOM selectors are strictly isolated in:
`tools/google-review-checker-extension/src/core/googleMapsDomAdapter.ts`

### Key Selectors:
| Target | Primary Selector | Semantic Fallback |
| :--- | :--- | :--- |
| **Review Card** | `.jftiEf`, `div[data-review-id]` | `div[role='region'] div[jsaction*='review']`, `div[aria-label*='star' i]` |
| **Review Text** | `span.wiI7Bm`, `div.MyEned span` | `span[class*='review-full-text']`, inner paragraph spans |
| **Review Photos** | `button[data-photo-index]`, `div.KtRwe` | `img[src*='googleusercontent.com/p/']` (excluding `.N3EgBe` avatars) |
| **Relative Date** | `span.rsqaWe`, `span[class*='date']` | `span[class*='PublishDate']` |
| **Store Name** | `h1.DUwDvf` | Document title prefix before `- Google Maps` |

---

## 7. Known Limitations & Fallbacks

1. **Lazy Loading**: Google Maps only renders reviews as the user scrolls. The extension scans all elements currently rendered in the DOM. Staff should scroll until reaching reviews older than the audit month.
2. **Relative Dates on Month Boundaries**: For reviews marked e.g. "4 weeks ago" near the 1st of a month, the relative date parser uses exact day calculations against Bangkok time. When a date is ambiguous, it returns `UNKNOWN_DATE` and fails closed (not qualified).
3. **Expanded Text**: Google Maps truncates long reviews with a "More" (เพิ่มเติม) button. `googleMapsDomAdapter.ts` reads the full text element rendered in the DOM even when visually collapsed.
