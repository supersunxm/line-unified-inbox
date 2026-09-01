import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAiInsight,
  buildCustomerSalesInformation,
  buildOperationalState,
  buildPurchaseInformation,
  normalizeProductDisplayName,
} from "./conversation-data-contract";

const manualProduct = {
  source: "MANUAL",
  productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } },
  productVariant: { id: "variant-1", ram: "16", rom: "512", color: "Stellar Titanium" },
};

const ruleProduct = {
  source: "RULE",
  confidence: 0.9,
  matchedPhrase: "Find N6",
  detectionMethod: "CLASSIFIER",
  sourceMessageId: "message-1",
  productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } },
  productVariant: null,
};

void test("manual product data is exposed as purchase information only", () => {
  const purchase = buildPurchaseInformation({ sourceChannels: ["STORE"], isInstallment: true, products: [manualProduct, ruleProduct], purchaseRecordedBy: { displayName: "BM Tester" }, purchaseRecordedAt: new Date("2026-08-16T10:00:00.000Z") });
  assert.equal(purchase.recordState, "VERIFIED");
  assert.deepEqual(purchase.purchaseChannel, ["STORE"]);
  assert.equal(purchase.paymentMethod, "INSTALLMENT");
  assert.deepEqual(purchase.products.map(({ source }) => source), ["MANUAL"]);
  assert.equal(purchase.products[0]?.model.name, "OPPO Find N6");
  assert.equal(purchase.products[0]?.variant?.color, "Stellar Titanium");
  assert.equal(purchase.recordedBy, "BM Tester");
  assert.equal(purchase.recordedAt, "2026-08-16T10:00:00.000Z");
});

void test("rule product data is exposed as insight and never as purchase data", () => {
  const insight = buildAiInsight({
    products: [manualProduct, ruleProduct],
    topics: [{ source: "RULE", confidence: 0.8, topic: { id: "topic-1", name: "Price Inquiry", category: "SALES" } }],
    productRelationship: "Interested",
    purchaseIntent: "High Intent",
  });
  assert.equal(insight.mentionedProducts.length, 1);
  assert.equal(insight.mentionedProducts[0]?.matchedPhrase, "Find N6");
  assert.equal(insight.topics[0]?.name, "Price Inquiry");
  assert.deepEqual(insight.classification, { productRelationship: "Interested", purchaseIntent: "High Intent" });
  assert.equal(buildPurchaseInformation({ products: [ruleProduct] }).products.length, 0);
});

void test("legacy manual data is explicit and never presented as verified purchase data", () => {
  const purchase = buildPurchaseInformation({
    sourceChannels: ["STORE"],
    isInstallment: true,
    products: [manualProduct],
  });
  assert.equal(purchase.recordState, "LEGACY_MANUAL");
  assert.deepEqual(purchase.purchaseChannel, []);
  assert.equal(purchase.paymentMethod, null);
  assert.deepEqual(purchase.products, []);
  assert.equal(purchase.recordedBy, null);
  assert.equal(purchase.recordedAt, null);
});

void test("modern explicit null sales status is not resurrected as purchased", () => {
  const sales = buildCustomerSalesInformation({
    customerSalesStatus: null,
    interestLevel: null,
    sourceChannels: [],
    isInstallment: false,
    paymentMethod: null,
    salesProducts: [],
    salesRecordedBy: { displayName: "BM Tester" },
    salesRecordedAt: new Date("2026-08-19T04:30:00.000Z"),
    purchaseRecordedBy: { displayName: "BM Tester" },
    purchaseRecordedAt: new Date("2026-08-19T04:30:00.000Z"),
  });

  assert.equal(sales.status, null);
  assert.equal(sales.interestLevel, null);
  assert.deepEqual(sales.purchaseChannel, []);
  assert.equal(sales.paymentMethod, null);
  assert.deepEqual(sales.products, []);
});

void test("legacy purchase provenance still falls back to purchased before modern sales state exists", () => {
  const sales = buildCustomerSalesInformation({
    customerSalesStatus: null,
    sourceChannels: ["STORE"],
    isInstallment: true,
    purchaseRecordedAt: new Date("2026-08-16T10:00:00.000Z"),
  });

  assert.equal(sales.status, "PURCHASED");
  assert.deepEqual(sales.purchaseChannel, ["STORE"]);
  assert.equal(sales.paymentMethod, "INSTALLMENT");
});

void test("Online sales status is preserved without purchase-only fields", () => {
  const sales = buildCustomerSalesInformation({
    customerSalesStatus: "ONLINE",
    interestLevel: "HOT",
    sourceChannels: ["STORE"],
    isInstallment: true,
    paymentMethod: "INSTALLMENT",
    salesRecordedAt: new Date("2026-08-28T04:30:00.000Z"),
  });

  assert.equal(sales.status, "ONLINE");
  assert.equal(sales.interestLevel, null);
  assert.deepEqual(sales.purchaseChannel, []);
  assert.equal(sales.paymentMethod, null);
});

void test("spaced catalog model tokens are normalized only for display", () => {
  assert.equal(normalizeProductDisplayName("OPPO Reno 1 6 5 G"), "OPPO Reno 16 5G");
  assert.equal(normalizeProductDisplayName("OPPO Reno 16 5G"), "OPPO Reno 16 5G");

  const sales = buildCustomerSalesInformation({
    customerSalesStatus: "INTERESTED",
    salesRecordedAt: new Date("2026-09-01T03:00:00.000Z"),
    salesProducts: [{
      id: "sales-product-1",
      productModelId: "reno-16-5g",
      productVariantId: null,
      productModel: {
        id: "reno-16-5g",
        name: "OPPO Reno 1 6 5 G",
        productSeries: { name: "Reno", productGroup: "SMARTPHONE" },
      },
      productVariant: null,
      quantity: 1,
      status: "INTERESTED",
    }],
  });

  assert.equal(sales.products[0]?.model.name, "OPPO Reno 16 5G");
});

void test("operational state stays separate from purchase and insight data", () => {
  assert.deepEqual(buildOperationalState({ replyStatus: "NOT_REPLIED", priority: "URGENT", unread: 2 }), {
    replyStatus: "NOT_REPLIED",
    priority: { level: "URGENT" },
    unread: 2,
  });
});
