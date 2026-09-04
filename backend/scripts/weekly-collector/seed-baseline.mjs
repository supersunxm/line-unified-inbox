import playwright from "playwright";
const { chromium } = playwright;
import { PrismaClient } from "@prisma/client";
import { computeReviewFingerprint } from "./fingerprint-helper.mjs";
import { segmentThaiWords } from "../../../tools/google-review-checker-extension/src/core/thaiWordCounter.ts";
import { isEditedReviewDateText } from "../../../tools/google-review-checker-extension/src/core/googleReviewDateParser.ts";
import { classifyWeek2Date } from "../week1-backfill/store-auditor-week2.mjs";

const prisma = new PrismaClient();
const PERSISTENT_PROFILE_DIR = "/Users/chutisoa.nup/Library/Application Support/GoogleReviewKpiChromeProfile";

async function main() {
  console.log("================================================================================");
  console.log(" HISTORICAL BASELINE SEEDING FOR DAILY CONTINUOUS TRACKING");
  console.log(" Purpose: Seed existing reviews into GoogleReviewFingerprint table");
  console.log(" Invariant: Week 1 must remain 274, Week 2 must remain 92 (Sep 4 = 33)");
  console.log("================================================================================\n");

  const memberships = await prisma.googleReviewWeeklyStoreMembership.findMany({
    where: { isActive: true },
    orderBy: { storeCode: "asc" },
    include: {
      store: {
        include: {
          storeMaster: true,
        },
      },
    },
  });

  console.log(`Found ${memberships.length} Active Weekly Stores for Seeding.`);
  if (memberships.length !== 65) {
    throw new Error(`Expected 65 weekly stores, found ${memberships.length}!`);
  }

  const context = await chromium.launchPersistentContext(PERSISTENT_PROFILE_DIR, {
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());
  let totalFingerprintsSeeded = 0;
  let totalQualifiedSeeded = 0;

  for (let i = 0; i < memberships.length; i++) {
    const membership = memberships[i];
    const storeCode = membership.storeCode;
    const store = membership.store;
    const storeMaster = store?.storeMaster;
    const storeName = storeMaster?.storeName || store?.name || `Store ${storeCode}`;
    const googleMapsUrl = storeMaster?.googleMapsUrl?.trim();

    console.log(`\n[${i + 1}/65] Seeding Store Code: ${storeCode} (${storeName})`);
    if (!googleMapsUrl) {
      console.warn(`  [WARN] No Maps URL for store ${storeCode}. Skipping.`);
      continue;
    }

    try {
      await page.goto(googleMapsUrl, { waitUntil: "commit" });
      await page.waitForTimeout(3000);

      // Check reviews tab
      const hasReviewTab = await page.evaluate(() => {
        const reviewTab = Array.from(document.querySelectorAll("button[role='tab']")).find((t) => {
          const l = (t.getAttribute("aria-label") || t.textContent || "").toLowerCase();
          return l.includes("รีวิว") || l.includes("review");
        });
        if (reviewTab) {
          reviewTab.click();
          return true;
        }
        return false;
      });

      if (!hasReviewTab) {
        console.log(`  No reviews tab. Skipping.`);
        continue;
      }
      await page.waitForTimeout(2000);

      // Ensure Newest Sorting
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

      // Scan cards until chronology is older than Week 2 start (Sep 2) or end of reviews
      let currentCardIndex = 0;
      let storeSeededCount = 0;
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

        const dateClass = classifyWeek2Date(cardData.dateText);

        // Stop condition: definitively before Sep 2, 2026 (or 5 cards deep into older)
        if (dateClass.type === "OLDER_THAN_WEEK2") {
          // Seed this older card as seen before stopping so we establish boundary
          const fp = computeReviewFingerprint(storeCode, cardData.dataReviewId, {
            relativeDateText: cardData.dateText,
            wordCount: 0,
            hasPhoto: cardData.hasPhoto,
            cardIndex: currentCardIndex,
          });
          await prisma.googleReviewFingerprint.upsert({
            where: { fingerprint: fp },
            create: {
              storeCode,
              fingerprint: fp,
              reviewDate: dateClass.exactDate || null,
              isQualified: false,
              weekNumber: 2,
            },
            update: {},
          });
          totalFingerprintsSeeded++;
          storeSeededCount++;
          stopTriggered = true;
          break;
        }

        // Determine qualification
        let isQualified = false;
        let wordCount = 0;
        if (dateClass.type === "WEEK2_CANDIDATE" && !isEditedReviewDateText(cardData.dateText)) {
          const thaiSeg = segmentThaiWords(cardData.reviewText);
          wordCount = thaiSeg.count;
          isQualified = cardData.hasPhoto && wordCount >= 15;
        }

        const fp = computeReviewFingerprint(storeCode, cardData.dataReviewId, {
          relativeDateText: cardData.dateText,
          wordCount,
          hasPhoto: cardData.hasPhoto,
          cardIndex: currentCardIndex,
        });

        await prisma.googleReviewFingerprint.upsert({
          where: { fingerprint: fp },
          create: {
            storeCode,
            fingerprint: fp,
            reviewDate: dateClass.exactDate || null,
            isQualified,
            weekNumber: 2,
          },
          update: {
            isQualified,
            reviewDate: dateClass.exactDate || undefined,
          },
        });

        totalFingerprintsSeeded++;
        storeSeededCount++;
        if (isQualified) totalQualifiedSeeded++;

        currentCardIndex++;
      }

      console.log(`  Seeded ${storeSeededCount} review fingerprints for store ${storeCode}.`);
      await page.waitForTimeout(500);
    } catch (err) {
      console.error(`  Error seeding store ${storeCode}:`, err);
    }
  }

  await context.close();

  console.log(`\n================================================================================`);
  console.log(`BASELINE SEEDING COMPLETE!`);
  console.log(`Total fingerprints seeded: ${totalFingerprintsSeeded}`);
  console.log(`Total qualified fingerprints recorded: ${totalQualifiedSeeded}`);
  console.log(`================================================================================\n`);
}

main()
  .catch((err) => {
    console.error("Fatal error during baseline seeding:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
