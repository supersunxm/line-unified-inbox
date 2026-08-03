import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";
import { TranslationBenchmarkCategory } from "./translation-benchmark.types";

export const TRANSLATION_BENCHMARK_CATEGORY_WEIGHTS: Record<TranslationBenchmarkCategory, number> = {
  "product-inquiry": 25,
  "promotion-payment": 25,
  "service-warranty": 20,
  "stock-pickup": 15,
  "casual-mixed": 15,
};

export const TRANSLATION_BENCHMARK_CASE_CATEGORIES: Record<string, TranslationBenchmarkCategory> = {
  "stock-color-find-x9-pro": "stock-pickup",
  "price-reno16": "promotion-payment",
  "installment-a6-pro-5g": "promotion-payment",
  "storage-pad3": "product-inquiry",
  "accessory-supervooc": "product-inquiry",
  "after-sales-screen": "service-warranty",
  warranty: "service-warranty",
  "promotion-enco-air4": "promotion-payment",
  "store-pickup": "stock-pickup",
  "mixed-language-trade-in": "casual-mixed",
  "down-payment-only": "promotion-payment",
  "availability-only": "stock-pickup",
  "oppo-technology-suite": "product-inquiry",
  "find-x9-ultra-display": "product-inquiry",
  "reno16-pro-watch": "casual-mixed",
};

export type TranslationIntentExpectation = {
  concept: string;
  acceptedTargets: Record<TranslationTargetLanguage, string[]>;
};

export const TRANSLATION_BENCHMARK_INTENTS: Record<string, TranslationIntentExpectation> = {
  "down-payment-only": { concept: "down payment", acceptedTargets: { en: ["down payment"], zh: ["首付", "首付款"] } },
  "availability-only": { concept: "availability/stock", acceptedTargets: { en: ["available", "availability", "in stock"], zh: ["有货", "现货", "库存"] } },
};
