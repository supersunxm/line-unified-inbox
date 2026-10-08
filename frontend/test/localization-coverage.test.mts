import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { review15Translations, review15Text } from "../src/app/review15/review-15-translations.ts";
import { v2Translations, v2Text } from "../src/lib/v2/v2-translations.ts";
import { languageLocale, type AppLanguage } from "../src/app/language-utils.ts";
import { monthLongLabel, monthWindow, comparisonLabel } from "../src/lib/v2/month.ts";
import { targetLabel, targetState } from "../src/lib/v2/kpi.ts";
import { formatValue } from "../src/lib/v2/value-state.ts";
import { formatPublicRegion } from "../src/lib/public-regions.ts";
import { getCustomerSalesTagEditorText } from "../src/app/customer-sales-tag-editor-i18n.ts";
import { googleReviewKpiNonUiExamples, googleReviewKpiPhrases, googleReviewKpiText } from "../src/app/google-review-kpi/google-review-kpi-i18n.ts";
import { broadcastNonUiExamples, broadcastPhrases } from "../src/app/broadcast/broadcast-i18n.ts";
import { purchaseAnalyticsInsightText, purchaseAnalyticsPhrases } from "../src/app/admin/purchase-analytics/purchase-analytics-i18n.ts";
import { dashboardLegacyPhrases, dashboardLegacyTemplates } from "../src/app/dashboard/dashboard-legacy-i18n.ts";
import { needActionQueueFallbackText } from "../src/app/dashboard/need-action-queue-i18n.ts";
import { formatRiskProblemAge } from "../src/app/dashboard/dashboard-transformers.ts";
import { couponPhrases } from "../src/app/coupons/coupons-i18n.ts";
import { friendSourceLinksPhrases } from "../src/app/friend-source-links/friend-source-links-i18n.ts";
import { mobileChatsPhrases, mobileMassMessagesPhrases, mobileMassMessagesTemplates, mobileStoresPhrases } from "../src/app/mobile-route-i18n.ts";
import { registrationPhrases } from "../src/app/admin/registrations/registrations-i18n.ts";
import { hqPermissionSummaryLabels, hqRegistrationText } from "../src/app/admin/registrations/hq/hq-registrations-i18n.ts";
import { greetingManagementPhrases } from "../src/app/greeting-messages/greeting-management-i18n.ts";
import { getGreetingDict } from "../src/app/greeting-messages/greeting-i18n.ts";
import { monthlyOperationsReportPhrases } from "../src/app/monthly-operations-report/monthly-operations-report-i18n.ts";
import { storeLocatorPhrases, storeLocatorStepLabels, storeLocatorTemplates } from "../src/app/store-locator/store-locator-i18n.ts";
import { richMessagesText } from "../src/app/rich-messages/rich-messages-i18n.ts";
import { richMenuOverviewText } from "../src/app/rich-menus/overview/rich-menu-overview-i18n.ts";
import { sharedUiText } from "../src/app/shared-ui-i18n.ts";
import { messageTranslationText } from "../src/app/message-translation-i18n.ts";
import { themeControlLabels } from "../src/app/theme-i18n.ts";
import { lineChatPendingControlText } from "../src/app/operations/line-chat-health/line-chat-pending-control-i18n.ts";
import { RICH_MENU_I18N } from "../src/app/rich-menus/rich-menu-i18n.ts";
import { store360Phrases } from "../src/app/store-360/store-360-i18n.ts";
import { lineChatHealthPhrases, lineChatHealthTemplates } from "../src/app/operations/line-chat-health/line-chat-health-i18n.ts";
import { mainPagePhrases } from "../src/app/main-page-i18n.ts";
import { tiktokDashboardText, tiktokStoreDetailText } from "../src/app/tiktok/tiktok-dashboard-i18n.ts";
import { tiktokCallbackPhrases } from "../src/app/tiktok/callback/tiktok-callback-i18n.ts";
import { getMassMessagesText, translations as massMessageTranslations } from "../src/app/mass-messages/mass-messages-translations.ts";
import { followerInsightsTranslations } from "../src/app/follower-insights/follower-insights-translations.ts";

const locales: AppLanguage[] = ["th", "en", "zh"];

test("mobile store archive labels are localized", () => {
  const archiveLabel = mobileStoresPhrases.find((phrase) => phrase.en === "Archived" && phrase.zh === "已归档");
  assert.deepEqual(archiveLabel, { th: "เก็บถาวร", en: "Archived", zh: "已归档" });
});

test("coupon page language control shares the saved app locale", () => {
  const couponManager = readFileSync(new URL("../src/app/coupons/coupon-manager-aligned-view.tsx", import.meta.url), "utf8");
  assert.match(couponManager, /const \{ language, setLanguage \} = useAppLanguage\(\)/);
  assert.doesNotMatch(couponManager, /useState<Language>\("th"\)/);
});

test("message traffic title has Thai, English, and Chinese translations", () => {
  const messageTraffic = readFileSync(new URL("../src/app/dashboard/message-traffic/message-traffic-view.tsx", import.meta.url), "utf8");
  const mobileMessageTraffic = readFileSync(new URL("../src/app/dashboard/message-traffic/mobile-message-traffic-app.tsx", import.meta.url), "utf8");
  assert.match(messageTraffic, /title: "วิเคราะห์ปริมาณข้อความ"/);
  assert.match(messageTraffic, /title: "Message Traffic Analytics"/);
  assert.match(messageTraffic, /title: "消息流量分析"/);
  assert.match(mobileMessageTraffic, /eyebrow: "การวิเคราะห์ · ปริมาณข้อความ"/);
  assert.match(mobileMessageTraffic, /title: "ปริมาณข้อความ"/);
});

test("download center page title is localized in Thai and Chinese", () => {
  const downloadCenter = readFileSync(new URL("../src/app/download-center/page.tsx", import.meta.url), "utf8");
  assert.match(downloadCenter, /th:\s*\{[\s\S]*?title: "ศูนย์ดาวน์โหลด"/);
  assert.match(downloadCenter, /en:\s*\{[\s\S]*?title: "Download Center"/);
  assert.match(downloadCenter, /zh:\s*\{[\s\S]*?title: "下载中心"/);
});
const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

function translationRecords(source: string, exportedName: string) {
  const ast = ts.createSourceFile(`${exportedName}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const records: Array<Record<string, string>> = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === exportedName && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const entry of node.initializer.elements) {
        if (!ts.isObjectLiteralExpression(entry)) continue;
        const record: Record<string, string> = {};
        for (const property of entry.properties) {
          if (ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) {
            const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : "";
            if (name) record[name] = property.initializer.text;
          }
        }
        records.push(record);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return records;
}

function translationSourceValues(source: string, exportedName: string) {
  const values = new Set<string>();
  for (const record of translationRecords(source, exportedName)) {
    for (const value of Object.values(record)) values.add(value.trim().replace(/\s+/g, " "));
  }
  return values;
}

const normalizeUiText = (value: string) => value
  .replace(/&gt;/g, ">")
  .replace(/&lt;/g, "<")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, "\"")
  .replace(/&ldquo;|&rdquo;/g, "“")
  .replace(/&rarr;/g, "→")
  .trim()
  .replace(/\s+/g, " ");

function directUiStrings(source: string, filename: string) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];
  const isLocaleBranch = (node: ts.Node) => {
    let parent = node.parent;
    while (parent) {
      if (ts.isConditionalExpression(parent) && /language|locale/i.test(parent.condition.getText(ast))) {
        const inTrue = node.getStart(ast) >= parent.whenTrue.getStart(ast) && node.end <= parent.whenTrue.end;
        const inFalse = node.getStart(ast) >= parent.whenFalse.getStart(ast) && node.end <= parent.whenFalse.end;
        if (inTrue || inFalse) return true;
      }
      parent = parent.parent;
    }
    return false;
  };
  const isRenderedJsxString = (node: ts.Node) => {
    let current = node;
    while (current.parent && !ts.isJsxExpression(current.parent) && !ts.isJsxAttribute(current.parent)) {
      const parent = current.parent;
      if (ts.isConditionalExpression(parent) && parent.condition === current) return false;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
      if (ts.isCallExpression(parent) || ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) return false;
      current = parent;
    }
    const boundary = current.parent;
    if (boundary && ts.isJsxAttribute(boundary)) {
      return ["alt", "aria-label", "placeholder", "title"].includes(boundary.name.getText(ast));
    }
    return Boolean(boundary && ts.isJsxExpression(boundary)
      && (ts.isJsxElement(boundary.parent) || ts.isJsxFragment(boundary.parent)));
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tagName = ts.isIdentifier(node.openingElement.tagName) ? node.openingElement.tagName.text : "";
      if (tagName === "style" || tagName === "script") return;
    }
    if (ts.isJsxText(node) && !isLocaleBranch(node)) {
      const text = normalizeUiText(node.text);
      if (text && (/[A-Za-z]{2}/.test(text) || /[\u4e00-\u9fff]{2}/.test(text))) findings.push(text);
    } else if (ts.isStringLiteralLike(node) && !isLocaleBranch(node) && isRenderedJsxString(node) && (/[A-Za-z]{2}/.test(node.text) || /[\u4e00-\u9fff]{2}/.test(node.text))) {
      const text = normalizeUiText(node.text);
      if (/[A-Za-z]{2}/.test(text) || /[\u4e00-\u9fff]{2}/.test(text)) findings.push(text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}

test("every migrated resource has all three locales and identical interpolation parameters", () => {
  for (const [key, translations] of Object.entries({ ...review15Translations, ...v2Translations })) {
    assert.deepEqual(Object.keys(translations).sort(), [...locales].sort(), key);
    for (const language of locales) {
      assert.ok(translations[language].trim(), `${language}:${key}`);
      assert.deepEqual(placeholders(translations[language]), placeholders(translations.th), `${language}:${key}`);
    }
  }
});

test("dynamic purchase and dashboard fallback copy resolves in all three locales", () => {
  const purchaseInsight = locales.map((language) => purchaseAnalyticsInsightText[language]("Phones", 37));
  assert.equal(purchaseInsight[0], "Phones คิดเป็น 37% ของสินค้าที่บันทึกในช่วงเวลานี้");
  assert.equal(purchaseInsight[1], "Phones accounts for 37% of recorded products in this period.");
  assert.equal(purchaseInsight[2], "Phones 占本期已记录商品的 37%。");
  assert.doesNotMatch(purchaseInsight[1], /[\u0e00-\u0e7e]/);
  assert.doesNotMatch(purchaseInsight[2], /[\u0e00-\u0e7e]/);

  assert.equal(formatRiskProblemAge("2h 35m", "th"), "2 ชม. 35 นาที");
  assert.equal(formatRiskProblemAge("2h 35m", "en"), "2h 35m");
  assert.equal(formatRiskProblemAge("2h 35m", "zh"), "2 小时 35 分钟");
  assert.equal(formatRiskProblemAge("External age label", "zh"), "External age label");

  for (const language of locales) {
    const fallback = needActionQueueFallbackText[language];
    for (const value of [fallback.pendingChats(3), fallback.pendingConversations(3), fallback.highTrafficStore, fallback.highSlaRisk, fallback.reviewEveningManpower]) {
      assert.ok(value.trim());
      if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e7e]/);
    }
  }
});

test("customer sales tag editor resources cover every supported locale and visible Thai literal", async () => {
  const keys = Object.keys(getCustomerSalesTagEditorText("th")).sort();
  for (const language of locales) {
    const text = getCustomerSalesTagEditorText(language);
    assert.deepEqual(Object.keys(text).sort(), keys, `${language} sales-tag keys`);
    for (const [key, value] of Object.entries(text)) {
      assert.ok(value.trim(), `${language}:${key}`);
      if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e3e\u0e40-\u0e7e]/, `${language}:${key}`);
    }
  }
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const sourceFile = new URL("../src/app/customer-sales-tag-editor.tsx", import.meta.url);
  assert.deepEqual(findHardcodedThaiUi(readFileSync(sourceFile, "utf8"), sourceFile.pathname), []);
});

test("public phrase and template resources provide complete th/en/zh translations", () => {
  for (const [filename, name] of [
    ["public-landing-i18n.tsx", "publicLandingPhrases"],
    ["public-landing-i18n.tsx", "publicLandingTemplates"],
    ["public-store-i18n.tsx", "publicStorePhrases"],
    ["public-store-i18n.tsx", "publicStoreTemplates"],
    ["tiktok-public-i18n.tsx", "tiktokPublicPhrases"],
  ]) {
    const source = readFileSync(new URL(`../src/app/${filename}`, import.meta.url), "utf8");
    const records = translationRecords(source, name);
    assert.ok(records.length > 0, `No resources found for ${name}`);
    for (const [index, record] of records.entries()) {
      assert.deepEqual(Object.keys(record).sort(), [...locales].sort(), `${name}:${index}`);
      for (const language of locales) {
        assert.ok(record[language].trim(), `${name}:${index}:${language}`);
        assert.deepEqual(placeholders(record[language]), placeholders(record.th), `${name}:${index}:${language}`);
      }
    }
  }
  assert.equal(formatPublicRegion("ภาคกลาง", "th"), "ภาคกลาง");
  assert.equal(formatPublicRegion("Central", "en"), "Central Thailand");
  assert.equal(formatPublicRegion("Central", "zh"), "泰国中部");
});

test("Google Review KPI copy has complete keyed translations and explicit sample-data exclusions", () => {
  const keys = new Set<string>();
  const sources = new Set<string>();
  for (const phrase of googleReviewKpiPhrases) {
    assert.ok(phrase.key.trim());
    assert.equal(keys.has(phrase.key), false, `Duplicate Google Review KPI key: ${phrase.key}`);
    assert.equal(sources.has(normalizeUiText(phrase.th)), false, `Duplicate Google Review KPI source: ${phrase.th}`);
    keys.add(phrase.key);
    sources.add(normalizeUiText(phrase.th));
    for (const language of locales) {
      assert.ok(phrase[language].trim(), `${language}:${phrase.key}`);
      if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e7f]/, `${language}:${phrase.key}`);
    }
    assert.equal(googleReviewKpiText("en", phrase.key), phrase.en);
    assert.equal(googleReviewKpiText("zh", phrase.key), phrase.zh);
  }
  assert.ok(googleReviewKpiNonUiExamples.length > 0);
  assert.ok(googleReviewKpiNonUiExamples.every((entry) => entry.text.trim() && entry.reason.trim()));
});

test("Google Review KPI direct Thai candidates are covered by locale resources or classified as sample data", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const file = new URL("../src/app/google-review-kpi/google-review-kpi-view.tsx", import.meta.url);
  const source = readFileSync(file, "utf8");
  const resource = readFileSync(new URL("../src/app/google-review-kpi/google-review-kpi-i18n.ts", import.meta.url), "utf8");
  const resourceSources = translationSourceValues(resource, "googleReviewKpiPhrases");
  const exclusions = new Set(googleReviewKpiNonUiExamples.map((entry) => normalizeUiText(entry.text)));
  const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let translations: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "translations") translations = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(translations && ts.isObjectLiteralExpression(translations));
  const thaiLocale = translations.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText(ast) === "th");
  assert.ok(thaiLocale && ts.isPropertyAssignment(thaiLocale) && ts.isObjectLiteralExpression(thaiLocale.initializer));
  for (const property of thaiLocale.initializer.properties) {
    if (ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) {
      resourceSources.add(normalizeUiText(property.initializer.text));
    }
  }
  for (const finding of findHardcodedThaiUi(source, file.pathname)) {
    const text = normalizeUiText(finding.text);
    assert.ok(resourceSources.has(text) || exclusions.has(text), `Uncovered Google Review KPI copy at line ${finding.line}: ${text}`);
  }
});

test("Google Review KPI direct English and Chinese UI is localized or explicitly fixed sample content", () => {
  const file = new URL("../src/app/google-review-kpi/google-review-kpi-view.tsx", import.meta.url);
  const source = readFileSync(file, "utf8");
  const resourceValues = new Set(googleReviewKpiPhrases.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
  const intentional = new Set([
    "AI Audit / Antigravity",
    "OPPO Admin",
    "Chrome Runner (Legacy)",
    '{"month":"2026-09","stores":{"25610":{"definiteNewQualifiedReviews":2,"definiteNewSeptemberReviews":2}}}',
  ]);
  for (const text of directUiStrings(source, file.pathname)) {
    if (!/[A-Za-z]{2}|[\u4e00-\u9fff]{2}/.test(text)) continue;
    assert.ok(resourceValues.has(text) || intentional.has(text), `Unclassified Google Review KPI UI at ${text}`);
  }
});

test("TikTok dashboard and store detail provide matching three-locale presentation keys", () => {
  for (const resource of [tiktokDashboardText, tiktokStoreDetailText]) {
    const expected = Object.keys(resource.th).sort();
    for (const language of locales) {
      assert.deepEqual(Object.keys(resource[language]).sort(), expected, `${language} TikTok keys`);
      for (const [key, value] of Object.entries(resource[language])) {
        assert.ok(value.trim(), `${language}:${key}`);
        if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e7f]/, `${language}:${key}`);
      }
    }
  }
  const dashboard = readFileSync(new URL("../src/app/tiktok/tiktok-public-dashboard.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../src/app/tiktok/tiktok-public-store-detail.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /tiktokDashboardText\[language\]/);
  assert.match(detail, /tiktokStoreDetailText\[language\]/);
});

test("TikTok callback copy has complete th/en/zh coverage", () => {
  const expectedKeys = new Set(tiktokCallbackPhrases.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
  for (const phrase of tiktokCallbackPhrases) {
    for (const language of locales) {
      assert.ok(phrase[language].trim());
      if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e7f]/);
    }
  }
  const source = readFileSync(new URL("../src/app/tiktok/callback/tiktok-callback-view.tsx", import.meta.url), "utf8");
  const fixedTerms = new Set(["OPPO Retail TikTok Monitor"]);
  for (const text of directUiStrings(source, "tiktok-callback-view.tsx")) {
    assert.ok(expectedKeys.has(text) || fixedTerms.has(text), `Uncovered TikTok callback UI: ${text}`);
  }
  for (const relativePath of ["../src/app/tiktok/error.tsx", "../src/app/tiktok/stores/[storeMasterId]/error.tsx"]) {
    const errorSource = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const text of directUiStrings(errorSource, relativePath)) {
      assert.ok(expectedKeys.has(text), `Uncovered TikTok error UI in ${relativePath}: ${text}`);
    }
  }
});

test("Main page boundary has complete locale phrases for its remaining literal interface copy", () => {
  const keys = new Set<string>();
  for (const phrase of mainPagePhrases) {
    for (const language of locales) {
      assert.ok(phrase[language].trim());
      if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e7f]/);
    }
    const source = normalizeUiText(phrase.en);
    assert.equal(keys.has(source), false, `Duplicate main page phrase: ${source}`);
    keys.add(source);
  }
  const file = new URL("../src/app/page.tsx", import.meta.url);
  const source = readFileSync(file, "utf8");
  const phrases = new Set(mainPagePhrases.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
  const internal = new Set([
    "production", "chats", "ADMIN", "loading", "error", "success", "FUZZY_SUGGESTION", "COMPLETE", "FAILED",
    "COMPLETED_WITH_ERRORS", "all", "replied", "notReplied", "SUCCESS", "ngrok http", "OPPO LINE OA Monitor",
  ]);
  for (const text of directUiStrings(source, file.pathname)) {
    if (!/[A-Za-z]{2}|[\u4e00-\u9fff]{2}/.test(text)) continue;
    assert.ok(phrases.has(text) || internal.has(text), `Unclassified main page UI at ${text}`);
  }
});

test("Broadcast direct Thai copy is covered by its route-scoped th/en/zh resource", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const file = new URL("../src/app/broadcast/broadcast-view.tsx", import.meta.url);
  const findings = findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname);
  const sources = new Set(broadcastPhrases.map((phrase) => normalizeUiText(phrase.th)));
  const keys = new Set<string>();
  for (const phrase of broadcastPhrases) {
    assert.equal(keys.has(phrase.key), false, `Duplicate Broadcast key: ${phrase.key}`);
    keys.add(phrase.key);
    for (const language of locales) {
      assert.ok(phrase[language].trim(), `${language}:${phrase.key}`);
      if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e7f]/, `${language}:${phrase.key}`);
    }
  }
  for (const finding of findings) {
    assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered Broadcast UI at line ${finding.line}: ${finding.text}`);
  }
  const allLocaleSources = new Set(broadcastPhrases.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
  const nonUi = new Set(broadcastNonUiExamples.map((example) => normalizeUiText(example.text)));
  const fixedTerms = new Set(["LINE", "OPPO", "LINE OA Manager"]);
  const routeSource = readFileSync(new URL("../src/app/broadcast/broadcast-view.tsx", import.meta.url), "utf8");
  for (const text of directUiStrings(routeSource, "broadcast-view.tsx")) {
    assert.ok(allLocaleSources.has(text) || nonUi.has(text) || fixedTerms.has(text), `Uncovered Broadcast EN/ZH UI: ${text}`);
  }
});

test("Purchase analytics direct Thai copy is covered by the protected route resource", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const sources = new Set(purchaseAnalyticsPhrases.map((phrase) => normalizeUiText(phrase.th)));
  const allLocaleSources = new Set(purchaseAnalyticsPhrases.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
  const keys = new Set<string>();
  for (const phrase of purchaseAnalyticsPhrases) {
    if (phrase.key) {
      assert.equal(keys.has(phrase.key), false, `Duplicate purchase analytics key: ${phrase.key}`);
      keys.add(phrase.key);
    }
    for (const language of locales) {
      assert.ok(phrase[language].trim(), `${language}:${phrase.key ?? phrase.th}`);
      if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e7f]/, `${language}:${phrase.key ?? phrase.th}`);
    }
  }
  const desktopLabels = new Set([
    "desktopCustomerPurchaseActivity",
    "desktopProductsRecorded",
    "desktopActiveStores",
    "desktopCurrentFilteredView",
    "desktopWithRecordedPurchases",
    "desktopWithRecordedActivity",
    "desktopChartPurchases",
    "desktopChartProducts",
    "desktopChartCustomers",
    "desktopTopProductsDescription",
    "desktopProductFamiliesDescription",
    "desktopPurchaseChannelDescription",
    "desktopPaymentMethodDescription",
    "desktopTopStoresDescription",
    "desktopTopVariantsDescription",
    "desktopTopColorsDescription",
    "desktopOthers",
    "desktopBmRecordingActivityDescription",
    "desktopHeaderDescription",
  ]);
  for (const key of desktopLabels) {
    const phrase = purchaseAnalyticsPhrases.find((candidate) => candidate.key === key);
    assert.ok(phrase, `Missing purchase analytics desktop label: ${key}`);
    assert.doesNotMatch(phrase.th, /[A-Za-z]{3,}/, `Unexpected English in Thai label ${key}`);
    assert.doesNotMatch(phrase.zh, /[A-Za-z]{3,}/, `Unexpected English in Chinese label ${key}`);
  }
  const uncoveredEnglish: string[] = [];
  for (const relativePath of [
    "../src/app/admin/purchase-analytics/mobile-purchase-analytics-app.tsx",
    "../src/app/admin/purchase-analytics/purchase-intelligence-dashboard.tsx",
  ]) {
    const file = new URL(relativePath, import.meta.url);
    const source = readFileSync(file, "utf8");
    for (const finding of findHardcodedThaiUi(source, file.pathname)) {
      assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered purchase analytics UI at ${relativePath}:${finding.line}: ${finding.text}`);
    }
    const fixedTerms = new Set(["OPPO", "LINE", "BM", "ADMIN", "CSV", "API", "ID", "LINE OA Manager", "THB"]);
    for (const text of directUiStrings(source, file.pathname)) {
      if (!allLocaleSources.has(text) && !fixedTerms.has(text)) uncoveredEnglish.push(`${relativePath}: ${text}`);
    }
  }
  const desktopSource = readFileSync(new URL("../src/app/admin/purchase-analytics/purchase-intelligence-dashboard.tsx", import.meta.url), "utf8");
  assert.match(desktopSource, /const \{ language, setLanguage \} = useAppLanguage\(\)/);
  assert.match(desktopSource, /language=\{language\} changeLanguage=\{setLanguage\}/);
  assert.match(desktopSource, /UnifiedPeriodPicker[^\n]*language=\{language\}/);
  assert.deepEqual(uncoveredEnglish, [], `Uncovered purchase analytics EN/ZH UI:\n${uncoveredEnglish.join("\n")}`);
});

test("Dashboard and response panels route every direct Thai label through the dashboard boundary", async () => {
  const { auditDirectory } = await import("../scripts/audit-localization.mjs");
  const sources = new Set(dashboardLegacyPhrases.map((phrase) => normalizeUiText(phrase.th)));
  const findings = auditDirectory(new URL("../src/app/dashboard", import.meta.url).pathname);
  for (const finding of findings) {
    assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered dashboard UI at ${finding.file}:${finding.line}: ${finding.text}`);
  }
  const allLocaleSources = new Set(dashboardLegacyPhrases.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
  const templates = dashboardLegacyTemplates.flatMap((template) => locales.map((language) => normalizeUiText(template[language])));
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (filename.endsWith(".tsx") && !filename.includes(".test.")) files.push(filename);
    }
  };
  walk(new URL("../src/app/dashboard", import.meta.url).pathname);
  const internal = new Set(["BM", "KPI", "SLA", "OA", "AI", "LINE", "LINE OA Manager", "StoreMaster", "Reach", "Block", "Followers"]);
  for (const filename of files) {
    const source = readFileSync(filename, "utf8");
    for (const text of directUiStrings(source, filename)) {
      assert.ok(allLocaleSources.has(text) || templates.includes(text) || internal.has(text), `Uncovered dashboard EN/ZH UI at ${filename}: ${text}`);
    }
  }
});

test("admin, coupons, messaging, friend links, and greeting surfaces cover direct Thai UI in their scoped resources", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const cases = [
    { resource: couponPhrases, files: ["../src/app/coupons/mobile-coupons-app.tsx", "../src/app/coupons/coupon-manager-aligned-view.tsx"] },
    { resource: registrationPhrases, files: ["../src/app/admin/registrations/mobile-admin-registrations-app.tsx", "../src/app/admin/registrations/admin-registrations-desktop.tsx", "../src/app/admin/registrations/hq/page.tsx"] },
    { resource: friendSourceLinksPhrases, files: ["../src/app/friend-source-links/friend-source-links-view.tsx"] },
    { resource: friendSourceLinksPhrases, files: ["../src/app/friend-source-links/mobile-friend-source-links-app.tsx"] },
    { resource: mobileMassMessagesPhrases, files: ["../src/app/mass-messages/mobile-mass-messages-app.tsx", "../src/app/mass-messages/mobile-purchase-broadcast-composer.tsx", "../src/app/mass-messages/purchase-broadcast-composer.tsx"] },
    { resource: greetingManagementPhrases, files: ["../src/app/greeting-messages/greeting-management-view.tsx"] },
    { resource: monthlyOperationsReportPhrases, files: ["../src/app/monthly-operations-report/page.tsx"] },
    { resource: storeLocatorPhrases, files: ["../src/app/store-locator/store-locator-app.tsx"] },
    { resource: mobileChatsPhrases, files: ["../src/components/chats/mobile-chats-app.tsx", "../src/components/chats/mobile-chats-controller.tsx"] },
    { resource: mobileStoresPhrases, files: ["../src/app/stores/mobile-stores-app.tsx"] },
  ];
  const fixedTerms = new Set(["THB", "COUPON2026", "(UTC+07:00) Asia/Bangkok, Jakarta", "DELETE", "LIFF", "QR", "LINE", "OPPO LINE OA Monitor", "Retail Operations", "Sunn", "BM", "PC", "OPPO Brand Shop"]);
  const uncovered = [];
  for (const { resource, files } of cases) {
    const sources = new Set(resource.map((phrase) => normalizeUiText(phrase.th)));
    const allLocaleSources = new Set(resource.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language]))));
    for (const phrase of resource) {
      for (const language of locales) {
        assert.ok(phrase[language].trim());
        if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e3e\u0e40-\u0e7e]/);
      }
    }
    for (const relativePath of files) {
      const file = new URL(relativePath, import.meta.url);
      for (const finding of findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname)) {
        assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered UI at ${relativePath}:${finding.line}: ${finding.text}`);
      }
      for (const text of directUiStrings(readFileSync(file, "utf8"), file.pathname)) {
        if (!allLocaleSources.has(text) && !fixedTerms.has(text)) uncovered.push(`${relativePath}: ${text}`);
      }
    }
  }
  assert.deepEqual(uncovered, [], `Uncovered EN/ZH UI:\n${uncovered.join("\n")}`);
  const greetingSources = new Set(greetingManagementPhrases.map((phrase) => normalizeUiText(phrase.th)));
  assert.equal(greetingSources.size, greetingManagementPhrases.length, "Greeting management sources must remain unique");
  const couponSources = new Set(couponPhrases.map((phrase) => normalizeUiText(phrase.th)));
  assert.equal(couponSources.size, couponPhrases.length, "Coupon phrase sources must remain unique");
  for (const template of storeLocatorTemplates) {
    for (const language of locales) {
      assert.ok(template[language].includes("{{value}}"));
      if (language !== "th") assert.doesNotMatch(template[language], /[\u0e00-\u0e3e\u0e40-\u0e7e]/);
    }
  }
  for (const template of mobileMassMessagesTemplates) {
    for (const language of locales) assert.ok(template[language].includes("{{value}}"));
  }
  assert.equal(new Set(monthlyOperationsReportPhrases.map((phrase) => normalizeUiText(phrase.th))).size, monthlyOperationsReportPhrases.length, "Monthly report sources must remain unique");
});

test("HQ account role and password-reset controls provide complete Thai, English, and Chinese copy", async () => {
  const keys = Object.keys(hqRegistrationText.th).sort();
  const permissionKeys = Object.keys(hqPermissionSummaryLabels.th).sort();
  for (const language of locales) {
    assert.deepEqual(Object.keys(hqRegistrationText[language]).sort(), keys, `${language} HQ registration keys`);
    assert.deepEqual(Object.keys(hqPermissionSummaryLabels[language]).sort(), permissionKeys, `${language} HQ permission labels`);
    const copy = hqRegistrationText[language];
    const values = Object.values(copy).filter((value): value is string => typeof value === "string");
    values.push(
      copy.resetCompleted("Sam"),
      copy.generatePassword("Sam"),
      copy.roleUpdated("Sam"),
      copy.deactivatedNotice("Sam"),
      copy.reactivatedNotice("Sam"),
      copy.requestFailed(403),
      ...Object.values(hqPermissionSummaryLabels[language]),
    );
    for (const value of values) {
      assert.ok(value.trim(), `${language} HQ copy must be present`);
      if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e3e\u0e40-\u0e7e]/, `${language} HQ copy must not contain Thai text`);
    }
  }

  const sourcePath = "../src/app/admin/registrations/hq/page.tsx";
  const sourceFile = new URL(sourcePath, import.meta.url);
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const source = readFileSync(sourceFile, "utf8");
  assert.deepEqual(findHardcodedThaiUi(source, sourceFile.pathname), [], "HQ route has no unlocalized Thai UI literals");
  assert.deepEqual(directUiStrings(source, sourceFile.pathname), [], "HQ route has no hard-coded English or Chinese UI copy");
});

test("store locator step labels are explicitly localized in all supported languages", () => {
  assert.deepEqual(storeLocatorStepLabels.th, ["ภูมิภาค", "จังหวัด", "สาขา"]);
  assert.deepEqual(storeLocatorStepLabels.en, ["Region", "Province", "Stores"]);
  assert.deepEqual(storeLocatorStepLabels.zh, ["区域", "府", "门店"]);
  const app = readFileSync(new URL("../src/app/store-locator/store-locator-app.tsx", import.meta.url), "utf8");
  assert.match(app, /<StepIndicator currentStep=\{currentStep\} language=\{language\} \/>/);
  const loadError = storeLocatorPhrases.find((phrase) => phrase.th === "ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง");
  assert.deepEqual(loadError, {
    th: "ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง",
    en: "Unable to load store data. Please try again.",
    zh: "无法加载门店数据，请重试。",
  });
});

test("greeting editor accessibility labels and visible tips use its three-language dictionary", () => {
  const allLocaleSources = new Set(locales.flatMap((language) => Object.values(getGreetingDict(language))
    .filter((value): value is string => typeof value === "string")
    .map(normalizeUiText)));
  const intentionalExamples = new Set(["Sunn", "oppo", "greeting-image.jpg"]);
  for (const relativePath of ["../src/app/greeting-messages/greeting-messages-view.tsx", "../src/app/greeting-messages/greeting-image-block.tsx"]) {
    const file = new URL(relativePath, import.meta.url);
    for (const text of directUiStrings(readFileSync(file, "utf8"), file.pathname)) {
      assert.ok(allLocaleSources.has(text) || intentionalExamples.has(text), `Uncovered greeting EN/ZH copy at ${relativePath}: ${text}`);
    }
  }
});

test("desktop broadcast uses its complete three-locale dictionary for direct rendered copy", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const sourceFile = new URL("../src/app/mass-messages/mass-messages-view.tsx", import.meta.url);
  const sources = new Set(Object.values(massMessageTranslations.th).filter((value): value is string => typeof value === "string").map(normalizeUiText));
  const findings = findHardcodedThaiUi(readFileSync(sourceFile, "utf8"), sourceFile.pathname);
  const uncoveredThai = findings.filter((finding) => !sources.has(normalizeUiText(finding.text))).map((finding) => `line ${finding.line}: ${finding.text}`);
  assert.deepEqual(uncoveredThai, [], `Uncovered desktop broadcast Thai UI:\n${uncoveredThai.join("\n")}`);
  const allLocaleSources = new Set(locales.flatMap((language) => Object.values(getMassMessagesText(language)).filter((value): value is string => typeof value === "string").map(normalizeUiText)));
  const fixedTerms = new Set(["Mass Message", "ID:", "LINE", "IMG"]);
  const uncovered = directUiStrings(readFileSync(sourceFile, "utf8"), sourceFile.pathname).filter((text) => !allLocaleSources.has(text) && !fixedTerms.has(text));
  assert.deepEqual(uncovered, [], `Uncovered desktop broadcast EN/ZH UI: ${uncovered.join(" | ")}`);
});

test("follower insights resources are complete and Thai-versus-English branches include Chinese", () => {
  const keys = Object.keys(followerInsightsTranslations.th).sort();
  for (const language of locales) {
    assert.deepEqual(Object.keys(followerInsightsTranslations[language]).sort(), keys, `${language} follower-insights keys`);
    for (const value of Object.values(followerInsightsTranslations[language])) {
      if (typeof value === "string" && language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e7f]/);
    }
  }
  for (const relativePath of [
    "../src/app/follower-insights/daily-summary-table.tsx",
    "../src/app/follower-insights/trend-chart.tsx",
    "../src/app/follower-insights/store-analytics-overview.tsx",
    "../src/app/follower-insights/store-breakdown-table.tsx",
    "../src/app/follower-insights/follower-insights-view.tsx",
    "../src/app/follower-insights/daily-follower-growth-export-control.tsx",
  ]) {
    const file = new URL(relativePath, import.meta.url);
    const source = readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isConditionalExpression(node) && /\blanguage\b.*===\s*["']th["']/.test(node.condition.getText(ast)) && /[\u0e00-\u0e7f]/.test(node.whenTrue.getText(ast))) {
        assert.match(node.whenFalse.getText(ast), /language\s*===\s*["']zh["']/, `Chinese locale branch is missing in ${relativePath}: ${node.getText(ast)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});

test("shared inbox bulk actions use all three localized workspace labels", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  for (const key of ["markAllReplied", "notifyBmAll", "resetAllNotReplied"]) {
    const occurrences = [...source.matchAll(new RegExp(`${key}:`, "g"))];
    assert.equal(occurrences.length, 3, `${key} must exist for th, en, and zh`);
    const component = readFileSync(new URL("../src/components/shell/context-sidebar.tsx", import.meta.url), "utf8");
    assert.match(component, new RegExp(`text\\.${key}`));
  }
});

test("Rich Message and Rich Menu overview presentation dictionaries cover all supported locales", () => {
  for (const resource of [richMessagesText, richMenuOverviewText]) {
    const [firstLocale, ...otherLocales] = locales;
    const expectedKeys = Object.keys(resource[firstLocale]).sort();
    for (const language of locales) {
      const translations = resource[language];
      assert.deepEqual(Object.keys(translations).sort(), expectedKeys, `${language} keys`);
      for (const [key, value] of Object.entries(translations)) {
        assert.ok(value.trim(), `${language}:${key}`);
        if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e3e\u0e40-\u0e7e]/, `${language}:${key}`);
      }
    }
    assert.ok(otherLocales.length === 2);
  }
});

test("Rich Message and Rich Menu overview components render copy from locale resources", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  for (const relativePath of ["../src/app/rich-messages/rich-messages-view.tsx", "../src/app/rich-menus/overview/rich-menu-overview-view.tsx"]) {
    const file = new URL(relativePath, import.meta.url);
    const findings = findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname);
    assert.deepEqual(findings, [], `Thai UI literals remain in ${relativePath}: ${JSON.stringify(findings)}`);
  }
});

test("shared presentation, rich-menu editor, and pending-control resources cover all three locales", () => {
  for (const resource of [sharedUiText, lineChatPendingControlText]) {
    const keys = Object.keys(resource.th).sort();
    for (const language of locales) {
      assert.deepEqual(Object.keys(resource[language]).sort(), keys, `${language} resource keys`);
      for (const [key, value] of Object.entries(resource[language])) {
        assert.ok(value.trim(), `${language}:${key}`);
        if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e3e\u0e40-\u0e7e]/, `${language}:${key}`);
      }
    }
  }
  const richMenuKeys = Object.keys(RICH_MENU_I18N.th).sort();
  for (const language of locales) {
    assert.deepEqual(Object.keys(RICH_MENU_I18N[language]).sort(), richMenuKeys, `${language} rich menu keys`);
    assert.ok(RICH_MENU_I18N[language].overviewLink.trim());
    assert.ok(RICH_MENU_I18N[language].messageCount(2).trim());
  }
});

test("shared shell controls and message translation have complete th/en/zh copy", async () => {
  for (const resource of [messageTranslationText, themeControlLabels]) {
    const keys = Object.keys(resource.th).sort();
    for (const language of locales) {
      assert.deepEqual(Object.keys(resource[language]).sort(), keys, `${language} shared control keys`);
      for (const [key, value] of Object.entries(resource[language])) {
        assert.ok(value.trim(), `${language}:${key}`);
        if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e3e\u0e40-\u0e7e]/, `${language}:${key}`);
      }
    }
  }
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  for (const relativePath of [
    "../src/app/message-translation-action.tsx",
    "../src/components/shell/context-sidebar.tsx",
    "../src/components/ui/modal.tsx",
    "../src/app/theme.tsx",
  ]) {
    const file = new URL(relativePath, import.meta.url);
    assert.deepEqual(findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname), [], `Thai UI literals remain in ${relativePath}`);
  }
  const sharedLocaleValues = new Set([
    ...Object.values(sharedUiText).flatMap((entries) => Object.values(entries)),
    ...Object.values(messageTranslationText).flatMap((entries) => Object.values(entries)),
    ...Object.values(themeControlLabels).flatMap((entries) => Object.values(entries)),
  ].map(normalizeUiText));
  const intentionallyFixedShellCopy = new Set(["OPPO LINE OA Monitor", "Retail Operations", "🇹🇭 ไทย", "🇬🇧 English", "🇨🇳 中文"]);
  for (const relativePath of [
    "../src/app/message-translation-action.tsx",
    "../src/app/theme.tsx",
    "../src/components/ui/modal.tsx",
    "../src/components/shell/context-sidebar.tsx",
    "../src/components/shell/app-sidebar.tsx",
    "../src/components/shell/top-navigation.tsx",
  ]) {
    const file = new URL(relativePath, import.meta.url);
    const uncovered = directUiStrings(readFileSync(file, "utf8"), file.pathname)
      .filter((text) => !sharedLocaleValues.has(text) && !intentionallyFixedShellCopy.has(text));
    assert.deepEqual(uncovered, [], `Uncovered shared EN/ZH UI in ${relativePath}: ${uncovered.join(" | ")}`);
  }
});

test("remaining shared and route candidates use locale resources", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  for (const relativePath of [
    "../src/components/ui/error-state.tsx",
    "../src/components/ui/loading-state.tsx",
    "../src/app/message-media.tsx",
    "../src/app/rich-menus/page.tsx",
    "../src/app/rich-menus/rich-menus-view.tsx",
    "../src/app/mass-messages/drafts/[campaignId]/draft-responsive.tsx",
  ]) {
    const file = new URL(relativePath, import.meta.url);
    const findings = findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname);
    assert.deepEqual(findings, [], `Thai UI literals remain in ${relativePath}: ${JSON.stringify(findings)}`);
  }
  const replyPage = readFileSync(new URL("../src/app/replymessage/page.tsx", import.meta.url), "utf8");
  const dashboardSources = new Set(dashboardLegacyPhrases.map((phrase) => normalizeUiText(phrase.th)));
  for (const finding of findHardcodedThaiUi(replyPage)) {
    assert.ok(dashboardSources.has(normalizeUiText(finding.text)), `Uncovered reply page text: ${finding.text}`);
  }
  const successText = readFileSync(new URL("../src/app/tiktok/connect/success/success-content.tsx", import.meta.url), "utf8");
  assert.match(successText, /\{t\.linkedStatus\}/);
  const inbox = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  for (const key of ["systemManagementTag", "failedSend", "retrySending", "replyPlaceholder", "viewerReplyPlaceholder", "replyShortcutHint", "bulkRepliedPrompt", "waitingStatusLabel", "bulkActionsFor"]) {
    assert.equal([...inbox.matchAll(new RegExp(`${key}:`, "g"))].length, 3, `${key} must exist for all locales`);
  }
});

test("LINE Chat Health labels and help text resolve in all supported locales", async () => {
  const { getBrowserBusyHelpText, getBrowserStatusHelpText } = await import("../src/app/operations/line-chat-health/line-chat-health-status.ts");
  for (const phrase of lineChatHealthPhrases) {
    for (const language of locales) {
      assert.ok(phrase[language].trim(), `${language}: ${phrase.en}`);
      if (language !== "th") assert.doesNotMatch(phrase[language], /[\u0e00-\u0e7f]/, `${language}: ${phrase.en}`);
    }
  }
  for (const language of locales) {
    assert.ok(getBrowserBusyHelpText(language).trim());
    assert.ok(getBrowserStatusHelpText(language).includes("\n"));
    if (language !== "th") {
      assert.doesNotMatch(getBrowserBusyHelpText(language), /[\u0e00-\u0e3e\u0e40-\u0e7e]/);
      assert.doesNotMatch(getBrowserStatusHelpText(language), /[\u0e00-\u0e3e\u0e40-\u0e7e]/);
    }
  }
  const statusFile = new URL("../src/app/operations/line-chat-health/line-chat-health-status.ts", import.meta.url);
  const source = readFileSync(statusFile, "utf8");
  const ast = ts.createSourceFile(statusFile.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const translatedSources = new Set(lineChatHealthPhrases.map((phrase) => normalizeUiText(phrase.en)));
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "guidance") {
      for (const argument of node.arguments) {
        if (ts.isStringLiteralLike(argument)) assert.ok(translatedSources.has(normalizeUiText(argument.text)), `Untranslated LINE Chat Health guidance: ${argument.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  for (const label of ["Ready", "Needs setup", "Login required", "Degraded", "Blocked", "Recovering", "Unknown"]) {
    assert.ok(translatedSources.has(label), `Untranslated LINE Chat Health status: ${label}`);
  }
});

test("LINE Chat Health interactive component tree has complete EN/ZH phrase coverage", () => {
  const root = new URL("../src/app/operations/line-chat-health/", import.meta.url).pathname;
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = join(directory, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (filename.endsWith(".tsx") && !filename.includes(".test.")) files.push(filename);
    }
  };
  walk(root);
  const resources = [lineChatHealthPhrases, Object.entries(lineChatPendingControlText.th).map(([key, th]) => ({
    th,
    en: lineChatPendingControlText.en[key as keyof typeof lineChatPendingControlText.en],
    zh: lineChatPendingControlText.zh[key as keyof typeof lineChatPendingControlText.zh],
  }))];
  const allLocaleSources = new Set(resources.flatMap((resource) => resource.flatMap((phrase) => locales.map((language) => normalizeUiText(phrase[language])))));
  const fixedTerms = new Set(["LINE", "LINE OA", "LINE OA Manager", "LINE Chat", "Chromium", "noVNC", "Profile B", "ID", "OA", "API"]);
  const uncovered: string[] = [];
  for (const filename of files) {
    for (const text of directUiStrings(readFileSync(filename, "utf8"), filename)) {
      if (!allLocaleSources.has(text) && !fixedTerms.has(text)) uncovered.push(`${filename}: ${text}`);
    }
  }
  assert.deepEqual(uncovered, [], `Uncovered LINE Chat Health EN/ZH UI:\n${uncovered.join("\n")}`);
});

test("Store 360 and LINE Chat Health direct UI copy has route-scoped th/en/zh coverage", () => {
  const scopes = [
    {
      name: "Store 360",
      phrases: store360Phrases,
      files: [
        "../src/app/store-360/customer-voice/customer-voice-view.tsx",
        "../src/app/store-360/response/response-view.tsx",
        "../src/app/store-360/store-360-export-control.tsx",
      ],
    },
    {
      name: "LINE Chat Health",
      phrases: lineChatHealthPhrases,
      files: [
        "../src/app/operations/line-chat-health/line-chat-health-view.tsx",
        "../src/app/operations/line-chat-health/line-chat-pending-control-action.tsx",
      ],
    },
  ];
  for (const scope of scopes) {
    const sources = new Set(scope.phrases.flatMap((phrase) => [phrase.th, phrase.en, phrase.zh].map(normalizeUiText)));
    const fixedTerms = new Set(["中文"]);
    for (const phrase of scope.phrases) {
      for (const language of locales) assert.ok(phrase[language].trim(), `${scope.name}:${language}`);
    }
    for (const relativePath of scope.files) {
      const file = new URL(relativePath, import.meta.url);
      for (const text of directUiStrings(readFileSync(file, "utf8"), file.pathname)) {
        assert.ok(sources.has(text) || fixedTerms.has(text), `${scope.name} uncovered direct UI in ${relativePath}: ${text}`);
      }
    }
  }
  for (const template of lineChatHealthTemplates) {
    assert.deepEqual(placeholders(template.th), placeholders(template.en));
    assert.deepEqual(placeholders(template.th), placeholders(template.zh));
  }
});

for (const language of locales) {
  test(`${language}: dynamic copy and presentation helpers resolve without raw keys or placeholders`, () => {
    const review = review15Text(language);
    const v2 = v2Text(language);
    const frame = monthWindow("2026-10", Date.parse("2026-10-07T07:30:00Z"));
    const values = [
      review("remaining", { count: 3 }),
      review("extracted", { count: 2, total: 4 }),
      review("missingWarning", { count: 2, total: 4 }),
      v2("overviewTitle", { month: monthLongLabel("2026-10", language) }),
      comparisonLabel(frame, language),
      targetLabel(targetState({ kind: "value", value: 80, n: 100 }, 90), 90, language),
      formatValue({ kind: "not-collected" }, "count", language).reason!,
    ];
    for (const value of values) {
      assert.doesNotMatch(value, /\{\w+\}|undefined|overviewTitle|missingWarning/);
      if (language !== "th") assert.doesNotMatch(value, /[\u0e00-\u0e7f]/);
    }
    assert.equal(frame.current.dateFrom, "2026-10-01");
    assert.equal(frame.current.dateTo, "2026-10-07");
    assert.equal(frame.previous.dateTo, "2026-09-07");
    assert.equal(languageLocale(language), language === "th" ? "th-TH" : language === "en" ? "en-US" : "zh-CN");
  });
}

test("review checker contains no Thai literals outside the three intentional word-count examples", () => {
  const file = new URL("../src/app/review15/review-15-checker.tsx", import.meta.url);
  const source = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const examples = new Set(["ดี มาก ดี มาก", "ความ + สะอาด", "โปรโมชั่น"]);
  const seen = new Set<string>();
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && /[\u0e00-\u0e7f]/.test(node.text)) {
      assert.ok(ts.isJsxText(node) && examples.has(node.text.trim()), `Unlocalized text: ${node.text.trim()}`);
      seen.add(node.text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.deepEqual([...seen].sort(), [...examples].sort());
});

test("public landing Thai UI literals are covered by its three-language boundary", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const file = new URL("../src/app/public-landing-page.tsx", import.meta.url);
  const findings = findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname);
  const resources = readFileSync(new URL("../src/app/public-landing-i18n.tsx", import.meta.url), "utf8");
  const sources = translationSourceValues(resources, "publicLandingPhrases");
  for (const template of translationSourceValues(resources, "publicLandingTemplates")) sources.add(template);
  const fixedTerms = new Set(["OPPO Brand Shop", "LINE", "TikTok"]);
  for (const finding of findings) {
    assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered public landing UI at line ${finding.line}: ${finding.text}`);
  }
  for (const text of directUiStrings(readFileSync(file, "utf8"), file.pathname)) {
    assert.ok(sources.has(text) || fixedTerms.has(text), `Uncovered public landing EN/ZH UI: ${text}`);
  }
});

test("TikTok public Thai UI literals are covered by a three-language boundary", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const resourceFile = new URL("../src/app/tiktok-public-i18n.tsx", import.meta.url);
  const sources = translationSourceValues(readFileSync(resourceFile, "utf8"), "tiktokPublicPhrases");
  const fixedTerms = new Set(["OPPO Brand Shop", "TikTok", "LINE", "TikTok Login Kit (Web OAuth 2.0)", "TikTok Login Kit v2", "user.info.basic", "user.info.profile", "user.info.stats", "obsthailand@gmail.com", "(Direct Messages)"]);
  for (const relativePath of ["../src/app/tiktok-integration/page.tsx", "../src/app/connect/tiktok/page.tsx"]) {
    const file = new URL(relativePath, import.meta.url);
    const findings = findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname);
    for (const finding of findings) {
      assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered TikTok UI at ${relativePath}:${finding.line}: ${finding.text}`);
    }
    for (const text of directUiStrings(readFileSync(file, "utf8"), file.pathname)) {
      assert.ok(sources.has(text) || fixedTerms.has(text), `Uncovered TikTok EN/ZH UI at ${relativePath}: ${text}`);
    }
  }
});

test("public store directory and profile Thai UI literals are covered by a three-language boundary", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const resourceFile = new URL("../src/app/public-store-i18n.tsx", import.meta.url);
  const resources = readFileSync(resourceFile, "utf8");
  const sources = translationSourceValues(resources, "publicStorePhrases");
  const templates = translationSourceValues(resources, "publicStoreTemplates");
  const fixedTerms = new Set(["OPPO Brand Shop", "LINE", "TikTok", "LINE Official Account", "LINE ID", "TT"]);
  for (const relativePath of ["../src/app/stores/public-stores-directory.tsx", "../src/app/stores/[identifier]/public-store-profile.tsx"]) {
    const file = new URL(relativePath, import.meta.url);
    const findings = findHardcodedThaiUi(readFileSync(file, "utf8"), file.pathname);
    for (const finding of findings) {
      assert.ok(sources.has(normalizeUiText(finding.text)), `Uncovered public store UI at ${relativePath}:${finding.line}: ${finding.text}`);
    }
    for (const text of directUiStrings(readFileSync(file, "utf8"), file.pathname)) {
      assert.ok(sources.has(text) || fixedTerms.has(text), `Uncovered public store EN/ZH UI at ${relativePath}: ${text}`);
    }
  }
  for (const template of [
    "พบ {{value}} สาขา",
    "แอด LINE {{value}}",
    "เปิด TikTok {{value}}",
    "เปิดแผนที่ Google Maps {{value}}",
    "© {{value}} ทำเนียบสาขา OPPO Brand Shop · ประเทศไทย",
  ]) assert.ok(templates.has(template), `Missing dynamic template: ${template}`);
});

test("lightweight UI audit ignores logs, comments, dictionaries and internal enum values", async () => {
  const { findHardcodedThaiUi } = await import("../scripts/audit-localization.mjs");
  const source = `
    // ความคิดเห็น
    console.log("บันทึกภายใน");
    const status = "ค่าภายใน";
    const copy = { th: "โหลด", en: "Load", zh: "加载" };
    const view = <div><button title="บันทึก">บันทึก</button><input placeholder="ค้นหา" /></div>;
    const styles = <style>{"/* หน้าหลัก */ .app { color: red; }"}</style>;
  `;
  assert.deepEqual(findHardcodedThaiUi(source).map((item: { text: string }) => item.text), ["บันทึก", "บันทึก", "ค้นหา"]);
  assert.deepEqual(findHardcodedThaiUi('<input placeholder="Pay ฿1,000 or more" />'), []);
});

test("classified Thai UI audit requires a reviewed one-to-one source record and a fixed translation key for bugs", async () => {
  const { classifyCurrentFindings } = await import("../scripts/audit-localization.mjs");
  const repositoryRoot = "/repo";
  const reviewed = {
    findings: [
      {
        file: "frontend/src/app/page.tsx",
        text: "บันทึก",
        classification: "BUG",
        reason: "Previously untranslated UI copy is now backed by a locale resource.",
        translationKey: "mainPagePhrases.save",
        status: "FIXED",
      },
      {
        file: "frontend/src/app/page.tsx",
        text: "ตัวอย่าง",
        classification: "NON_UI",
        reason: "This string is a fixed sample value.",
      },
    ],
  };
  const current = [
    { file: "/repo/frontend/src/app/page.tsx", line: 10, text: "บันทึก" },
    { file: "/repo/frontend/src/app/page.tsx", line: 11, text: "ตัวอย่าง" },
    { file: "/repo/frontend/src/app/page.tsx", line: 12, text: "ข้อความใหม่" },
  ];
  const result = classifyCurrentFindings(current, reviewed, repositoryRoot);
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.deepEqual(result.metrics, {
    currentCandidates: 3,
    BUGFixed: 1,
    NON_UI: 1,
    INTENTIONAL_UI: 0,
    unclassified: 1,
    unfixedBugs: 0,
  });
  assert.equal(result.findings[0].auditStatus, "FIXED");
  assert.equal(result.findings[1].auditStatus, "REVIEWED");
  assert.equal(result.findings[2].auditStatus, "NO_REVIEWED_SOURCE_MATCH");

  const invalid = classifyCurrentFindings([current[0]], {
    findings: [{ ...reviewed.findings[0], status: "REVIEW_REQUIRED", translationKey: undefined }],
  }, repositoryRoot);
  assert.equal(invalid.status, "REVIEW_REQUIRED");
  assert.equal(invalid.findings[0].auditStatus, "BUG_NOT_PROVEN_FIXED");
});

test("current full-source Thai sweep matches the reviewed classifications with no open candidates", async () => {
  const { auditDirectory, classifyCurrentFindings } = await import("../scripts/audit-localization.mjs");
  const repositoryRoot = join(process.cwd(), "..");
  const audit = JSON.parse(readFileSync(join(repositoryRoot, "docs/localization/FINAL_THAI_CLASSIFICATION.json"), "utf8"));
  const result = classifyCurrentFindings(auditDirectory(join(process.cwd(), "src")), audit, repositoryRoot);
  assert.equal(result.status, "PASS", JSON.stringify(result.metrics));
  assert.equal(result.metrics.unclassified, 0);
  assert.equal(result.metrics.unfixedBugs, 0);
  assert.equal(result.metrics.currentCandidates, audit.liveSweep.currentThaiUiCandidates);
  assert.equal(audit.liveFindings.length, audit.liveSweep.additionalOccurrencesNotInOriginalQueue);
  assert.equal(audit.metrics.BUG, audit.metrics.BUGFixed);
  assert.equal(audit.metrics.unclassified, 0);
});
