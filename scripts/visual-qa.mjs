import pkg from "../backend/node_modules/playwright/index.js";
const { chromium } = pkg;
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const ARTIFACT_DIR = "/Users/chutisoa.nup/.gemini/antigravity/brain/a5c9f27e-a0e8-42c5-8f4c-9e12f252e869";
const LOCAL_SCREENSHOTS_DIR = "/Users/chutisoa.nup/Projects/line-unified-inbox-rich-message-template/.runtime/qa-screenshots";

mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const localPath = join(LOCAL_SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  const artifactPath = join(ARTIFACT_DIR, filename);
  copyFileSync(localPath, artifactPath);
  console.log(`Saved screenshot: ${filename}`);
}

async function runVisualQA() {
  const browser = await chromium.launch({ headless: true });

  const mockLibrary = [
    {
      id: "rm-1",
      name: "Super Deal 10.10 Promo",
      description: "Square 4 quadrants campaign",
      altText: "Special 10.10 deals",
      mediaObjectKey: "mock-media-1",
      previewObjectKey: "mock-preview-1",
      imageUrl: "https://placehold.co/1040x1040/06c755/ffffff.png?text=1040x1040+Square",
      previewUrl: "https://placehold.co/1040x1040/06c755/ffffff.png?text=1040x1040+Square",
      baseWidth: 1040,
      baseHeight: 1040,
      actions: [
        { id: "A", type: "URI", value: "https://oppo.com/deal1", area: { x: 0, y: 0, width: 520, height: 520 } },
        { id: "B", type: "URI", value: "https://oppo.com/deal2", area: { x: 520, y: 0, width: 520, height: 520 } },
        { id: "C", type: "MESSAGE", value: "Claim Deal 3", area: { x: 0, y: 520, width: 520, height: 520 } },
        { id: "D", type: "URI", value: "https://oppo.com/deal4", area: { x: 520, y: 520, width: 520, height: 520 } },
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rm-2",
      name: "Find X9 Launch Banner",
      description: "Landscape 1040x350 banner",
      altText: "Find X9 Now Available",
      mediaObjectKey: "mock-media-2",
      previewObjectKey: "mock-preview-2",
      imageUrl: "https://placehold.co/1040x350/0070f3/ffffff.png?text=1040x350+Banner",
      previewUrl: "https://placehold.co/1040x350/0070f3/ffffff.png?text=1040x350+Banner",
      baseWidth: 1040,
      baseHeight: 350,
      actions: [
        { id: "A", type: "URI", value: "https://oppo.com/find-x9", area: { x: 0, y: 0, width: 1040, height: 350 } },
      ],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  async function setupMockRoutes(context) {
    await context.route("**/*auth/me*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "admin-1",
          email: "admin@oppo.com",
          displayName: "HQ Admin",
          role: "ADMIN",
          mustChangePassword: false,
          memberships: [],
        }),
      });
    });

    await context.route("**/*auth/setup-status*", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ isInitialized: true }),
      });
    });

    await context.route("**/api-backend/rich-messages*", async (route) => {
      const request = route.request();
      if (request.method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockLibrary),
        });
      }
      if (request.method() === "POST") {
        const body = JSON.parse(request.postData() || "{}");
        const created = {
          ...body,
          id: `rm-${Date.now()}`,
          imageUrl: "https://placehold.co/1040x1040/06c755/ffffff.png",
          previewUrl: "https://placehold.co/1040x1040/06c755/ffffff.png",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockLibrary.push(created);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
      }
      return route.continue();
    });

    await context.route("**/api-backend/greeting-messages/media", async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mediaObjectKey: "uploaded-mock-key",
          previewObjectKey: "uploaded-mock-preview-key",
          imageUrl: "https://placehold.co/1040x1040/06c755/ffffff.png",
          previewUrl: "https://placehold.co/1040x1040/06c755/ffffff.png",
          width: 1040,
          height: 1040,
        }),
      });
    });
  }

  // 1. Desktop Visual QA (1280x800)
  console.log("Starting Desktop QA...");
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await setupMockRoutes(desktopContext);
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto("http://localhost:3000/rich-messages", { waitUntil: "domcontentloaded" });
  await desktopPage.waitForTimeout(1000);

  // Initial Desktop view
  await saveScreenshot(desktopPage, "desktop-01-initial-view.png");

  // Select Super Deal 10.10 Promo from library
  const libraryItem1 = desktopPage.locator('button:has-text("Super Deal 10.10 Promo")').first();
  await libraryItem1.click();
  await desktopPage.waitForTimeout(500);

  // Capture selected item with 4 quadrant live overlay
  await saveScreenshot(desktopPage, "desktop-02-live-preview-quadrants.png");

  // Open Template Modal via Select template button
  const templateButton = desktopPage.locator('button:has-text("Select template"), button:has-text("เลือกเทมเพลต")').first();
  await templateButton.click();
  await desktopPage.waitForTimeout(500);

  const dialog = desktopPage.locator('div[role="dialog"]');

  // Capture Square Templates (All 12 Arrangements A-L)
  await saveScreenshot(desktopPage, "desktop-03-modal-square-templates.png");

  // Click Landscape Tab
  const landscapeTab = dialog.locator('button:has-text("Landscape"), button:has-text("แนวนอน")').first();
  await landscapeTab.click();
  await desktopPage.waitForTimeout(300);
  await saveScreenshot(desktopPage, "desktop-04-modal-landscape-templates.png");

  // Click Portrait Tab
  const portraitTab = dialog.locator('button:has-text("Portrait"), button:has-text("แนวตั้ง")').first();
  await portraitTab.click();
  await desktopPage.waitForTimeout(300);
  await saveScreenshot(desktopPage, "desktop-05-modal-portrait-templates.png");

  // Click Custom Tab
  const customTab = dialog.locator('button:has-text("Custom"), button:has-text("กำหนดเอง")').first();
  await customTab.click();
  await desktopPage.waitForTimeout(300);
  await saveScreenshot(desktopPage, "desktop-06-modal-custom-tab.png");

  // Switch back to Square Tab
  const squareTab = dialog.locator('button:has-text("Square"), button:has-text("จัตุรัส")').first();
  await squareTab.click();
  await desktopPage.waitForTimeout(300);

  // Select Square Template E: 3 areas (top 1, bottom 2)
  const templateTileE = dialog.locator('button:has-text("3 areas (top 1, bottom 2)"), button:has-text("1 บน + 2 ล่าง")').first();
  await templateTileE.click();
  await desktopPage.waitForTimeout(300);

  // Click Apply template in modal footer
  const applyButton = dialog.locator('button:has-text("Apply template"), button:has-text("ใช้เทมเพลตนี้")').first();
  await applyButton.click();
  await desktopPage.waitForTimeout(500);

  // Since Super Deal had configured actions, the warning modal should appear!
  await saveScreenshot(desktopPage, "desktop-07-template-switch-warning-modal.png");

  // Confirm template switch
  const confirmButton = desktopPage.locator('button:has-text("Confirm change"), button:has-text("ยืนยันการเปลี่ยน")').first();
  await confirmButton.click();
  await desktopPage.waitForTimeout(500);

  // Now editor has switched to Template E (3 regions: A, B, C)
  await saveScreenshot(desktopPage, "desktop-08-editor-switched-to-template-e.png");

  // Expand Advanced Coordinates for Area A
  const toggleCoordA = desktopPage.locator('button:has-text("Advanced coordinates"), button:has-text("พิกัดขั้นสูง")').first();
  await toggleCoordA.click();
  await desktopPage.waitForTimeout(300);
  await saveScreenshot(desktopPage, "desktop-09-advanced-coordinates-expanded.png");

  await desktopContext.close();

  // 2. Mobile Visual QA (375x812 - iPhone X/12)
  console.log("Starting Mobile QA...");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
  });
  await setupMockRoutes(mobileContext);
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto("http://localhost:3000/rich-messages", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(1000);

  // Select Find X9 Launch Banner in mobile library
  const mobileLibraryItem2 = mobilePage.locator('button:has-text("Find X9 Launch Banner")').first();
  await mobileLibraryItem2.click();
  await mobilePage.waitForTimeout(500);

  // Mobile banner view
  await saveScreenshot(mobilePage, "mobile-01-banner-editor.png");

  // Mobile open template modal
  const mobileTemplateButton = mobilePage.locator('button:has-text("Select template"), button:has-text("เลือกเทมเพลต")').first();
  await mobileTemplateButton.click();
  await mobilePage.waitForTimeout(500);
  await saveScreenshot(mobilePage, "mobile-02-template-modal.png");

  // Mobile select Square Tab and pick Template C (2 horizontal rows)
  const mobileDialog = mobilePage.locator('div[role="dialog"]');
  const mobileTileC = mobileDialog.locator('button:has-text("2 areas (horizontal split)"), button:has-text("2 แถวนอน")').first();
  await mobileTileC.click();
  await mobilePage.waitForTimeout(300);

  const mobileApplyButton = mobileDialog.locator('button:has-text("Apply template"), button:has-text("ใช้เทมเพลตนี้")').first();
  await mobileApplyButton.click();
  await mobilePage.waitForTimeout(500);

  // Confirm change
  const mobileConfirmBtn = mobilePage.locator('button:has-text("Confirm change"), button:has-text("ยืนยันการเปลี่ยน")').first();
  if (await mobileConfirmBtn.isVisible()) {
    await mobileConfirmBtn.click();
    await mobilePage.waitForTimeout(500);
  }

  await saveScreenshot(mobilePage, "mobile-03-switched-to-square.png");

  await mobileContext.close();
  await browser.close();

  console.log("Visual QA completed successfully with all screenshots captured!");
}

runVisualQA().catch((err) => {
  console.error("Visual QA failed:", err);
  process.exit(1);
});
