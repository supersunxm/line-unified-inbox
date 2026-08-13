import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { translations, getMassMessagesText } from "../src/app/mass-messages/mass-messages-translations.ts";

const viewCode = readFileSync(new URL("../src/app/mass-messages/mass-messages-view.tsx", import.meta.url), "utf8");
const topNavCode = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const routePageCode = readFileSync(new URL("../src/app/mass-messages/page.tsx", import.meta.url), "utf8");

test("Mass Message translations exist with identical keys in Thai, English, and Chinese", () => {
  const thKeys = Object.keys(translations.th).sort();
  const enKeys = Object.keys(translations.en).sort();
  const zhKeys = Object.keys(translations.zh).sort();

  assert.deepEqual(thKeys, enKeys, "Thai and English keys must match");
  assert.deepEqual(enKeys, zhKeys, "English and Chinese keys must match");

  const thText = getMassMessagesText("th");
  assert.equal(thText.pageTitle, "ส่งข้อความ");
  const enText = getMassMessagesText("en");
  assert.equal(enText.pageTitle, "Mass Message");
  const zhText = getMassMessagesText("zh");
  assert.equal(zhText.pageTitle, "群发消息");
});

test("TopNavigation renders Mass Message link for ADMIN and restricts for VIEWER", () => {
  // Verifies that /mass-messages link exists and is guarded by authUser?.role === 'ADMIN'
  assert.match(topNavCode, /authUser\?\.role === "ADMIN" && <Link [^>]*href="\/mass-messages"/);
  assert.match(topNavCode, /authUser\?\.role === "ADMIN" && <Link role="menuitem" [^>]*href="\/mass-messages"/);
});

test("Mass Message route entrypoint delegates to ApplicationWorkspace with mass-messages section", () => {
  assert.match(routePageCode, /ApplicationWorkspace initialSection="mass-messages"/);
  assert.match(pageCode, /initialSection === "mass-messages"/);
  assert.match(pageCode, /<MassMessagesView language=\{language\} userRole=\{authUser\.role\} \/>/);
});

test("MassMessagesView enforces ADMIN role check and displays restricted state for non-admins", () => {
  assert.match(viewCode, /const isAuthorized = userRole === "ADMIN"/);
  assert.match(viewCode, /if \(!isAuthorized\) \{[\s\S]*accessRestrictedTitle/);
});

test("Store Selection supports All Stores vs Selected Stores with compact selector", () => {
  assert.match(viewCode, /storeMode === "ALL"/);
  assert.match(viewCode, /storeMode === "MULTIPLE"/);
  assert.match(viewCode, /setStoreSearch/);
  assert.match(viewCode, /handleSelectAllStores/);
  assert.match(viewCode, /handleDeselectAllStores/);
  assert.match(viewCode, /handleToggleStore/);
});

test("Audience selection supports exact BM reply statuses without CRM/broadcast options", () => {
  assert.match(viewCode, /"ALL_KNOWN"/);
  assert.match(viewCode, /"NOT_REPLIED"/);
  assert.match(viewCode, /"NOTIFIED_BM"/);
  assert.match(viewCode, /"REPLIED"/);
  assert.doesNotMatch(viewCode, /ALL_FRIENDS|LINE_BROADCAST|narrowcast|crm/i);
});

test("Live Preview calls preview endpoint and renders estimated recipients and skipped store breakdown", () => {
  assert.match(viewCode, /api\.previewMassMessage/);
  assert.match(viewCode, /eligibleStoreCount/);
  assert.match(viewCode, /estimatedRecipientCount/);
  assert.match(viewCode, /skippedStoreCount/);
  assert.match(viewCode, /getSkipReasonLabel/);
  assert.match(viewCode, /MISSING_TOKEN/);
  assert.match(viewCode, /NO_RECIPIENTS/);
});

test("Zero recipients or zero eligible stores disable sending with clear explanation", () => {
  assert.match(viewCode, /zeroEligibleStoresAlert/);
  assert.match(viewCode, /zeroRecipientsAlert/);
  assert.match(viewCode, /preview\.eligibleStoreCount === 0 \|\| preview\.estimatedRecipientCount === 0/);
});

test("Confirmation modal includes quota warning, explicit confirmation, and double-click prevention", () => {
  assert.match(viewCode, /confirmModalTitle/);
  assert.match(viewCode, /confirmModalQuotaWarning/);
  assert.match(viewCode, /confirmModalConfirmButton/);
  assert.match(viewCode, /setActiveCampaignRequestId\(generateUUID\(\)\)/);
  assert.match(viewCode, /disabled=\{sending\}/);
});

test("Campaign progress polling monitors status and displays terminal banners", () => {
  assert.match(viewCode, /api\.getMassMessageCampaign/);
  assert.match(viewCode, /statusBannerCompletedTitle/);
  assert.match(viewCode, /statusBannerPartialTitle/);
  assert.match(viewCode, /statusBannerFailedTitle/);
  assert.match(viewCode, /acceptedRecipientCount/);
  assert.match(viewCode, /failedRecipientCount/);
  assert.match(viewCode, /processedRecipientCount/);
});

test("Mass Message Image Support: Upload UI, file input constraints, replace, and remove", () => {
  assert.match(viewCode, /api\.uploadMassMessageImage/);
  assert.match(viewCode, /accept="\.jpg,\.jpeg,\.png,image\/jpeg,image\/png"/);
  assert.match(viewCode, /handleFileSelect/);
  assert.match(viewCode, /handleReplaceImage/);
  assert.match(viewCode, /handleRemoveImage/);
  assert.match(viewCode, /10 \* 1024 \* 1024/); // 10MB limit
  assert.match(viewCode, /isUploadingImage/);

  // Translations
  const th = getMassMessagesText("th");
  const en = getMassMessagesText("en");
  const zh = getMassMessagesText("zh");
  assert.equal(th.imageUploadHelper, "รองรับ JPG และ PNG สูงสุด 10 MB");
  assert.equal(en.imageUploadHelper, "JPG or PNG, max 10 MB");
  assert.equal(zh.imageUploadHelper, "支持 JPG 和 PNG，最大 10 MB");
  assert.match(th.imageInvalidFormat, /JPG และ PNG/);
  assert.match(en.imageInvalidFormat, /JPG and PNG/);
});

test("Mass Message Image Support: Live Preview handles text-only, image-only, and text+image", () => {
  assert.match(viewCode, /attachedImage\.previewUrl \|\| attachedImage\.url/);
  assert.match(viewCode, /hasContent/);
  assert.match(viewCode, /messagePreviewEmptyPlaceholder/);
});

test("Mass Message Image Support: Validation allows text-only, image-only, text+image and blocks empty", () => {
  assert.match(viewCode, /const hasContent = Boolean\(messageText\.trim\(\) \|\| attachedImage\)/);
  assert.match(viewCode, /disabled=\{[^}]*!hasContent/);
});

test("Mass Message Image Support: Confirmation Modal and Campaign detail render content breakdown", () => {
  assert.match(viewCode, /confirmContentSummaryTitle/);
  assert.match(viewCode, /confirmTextMessageLabel/);
  assert.match(viewCode, /confirmImageLabel/);
  assert.match(viewCode, /confirmNoTextMessage/);
  assert.match(viewCode, /confirmNoImage/);
  assert.match(viewCode, /confirmImageAttached/);
});
