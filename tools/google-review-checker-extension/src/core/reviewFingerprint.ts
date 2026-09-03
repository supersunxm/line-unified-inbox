/**
 * Creates a lightweight, local non-reversible fingerprint for a review DOM element
 * to deduplicate review cards loaded during user scrolling.
 *
 * PRIVACY GUARANTEE:
 * This fingerprint is stored only in ephemeral in-memory sets during the browser session
 * and is NEVER persisted to a database or transmitted to any server.
 */

export function generateReviewFingerprint(
  domElement: Element,
  reviewIndex: number,
): string {
  // 1. Stable review ID attribute if provided by Google Maps DOM
  const dataReviewId = domElement.getAttribute("data-review-id");
  if (dataReviewId) {
    return `review-id:${dataReviewId}`;
  }

  // 2. jslog or data-href or jsdata
  const jslog = domElement.getAttribute("jslog");
  const jsaction = domElement.getAttribute("jsaction");

  // 3. Extract text snippet & photo count for composite hash
  const textSnippet = domElement.textContent?.slice(0, 60).replace(/\s+/g, " ").trim() || "";
  const photoCount = domElement.querySelectorAll("img, button[data-photo-index], div[style*='background-image']").length;

  // Simple quick hash
  const rawKey = `${textSnippet}|photo:${photoCount}|${jslog || ""}|${jsaction || ""}|idx:${reviewIndex}`;
  return `fp:${simpleHash(rawKey)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
