import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";

export type TranslationGlossaryRule = {
  canonical: string;
  variants: readonly string[];
};

export const OPPO_PROTECTED_SOURCE_TERMS = ["SUPERVOOC", "AI Eraser", "AI Studio", "Find Series", "ColorOS", "Reno16", "OPPO"] as const;

export const OPPO_TRANSLATION_GLOSSARY: Record<TranslationTargetLanguage, readonly TranslationGlossaryRule[]> = {
  en: [
    { canonical: "Find X9 Ultra", variants: ["Find X9Ultra", "Find X9 Ultra Edition"] },
    { canonical: "Find X9 Pro", variants: ["Find X9Pro", "Find X9 Professional"] },
    { canonical: "Find Series", variants: ["OPPO Find Series"] },
    { canonical: "Reno16 Pro", variants: ["Reno 16 Pro", "Reno-16 Pro"] },
    { canonical: "OPPO Watch", variants: ["Oppo Watch"] },
    { canonical: "OPPO Pad", variants: ["Oppo Pad"] },
    { canonical: "AI Eraser", variants: ["AI eraser", "AI-Eraser"] },
    { canonical: "AI Studio", variants: ["AI studio", "AI-Studio"] },
    { canonical: "SUPERVOOC", variants: ["SuperVOOC", "Super Vooc", "SUPER VOOC"] },
    { canonical: "AirVOOC", variants: ["Air Vooc", "Air VOOC"] },
    { canonical: "ColorOS", variants: ["Color OS", "Color Os"] },
    { canonical: "Reno16", variants: ["Reno 16", "Reno-16"] },
    { canonical: "AMOLED", variants: ["Amoled", "AMO LED"] },
    { canonical: "OPPO", variants: ["Oppo"] },
    { canonical: "UFS", variants: ["Ufs"] },
  ],
  zh: [
    { canonical: "Find X9 Ultra", variants: ["Find X9至尊版"] },
    { canonical: "Find X9 Pro", variants: ["Find X9专业版"] },
    { canonical: "Find Series", variants: ["OPPO Find系列", "Find系列"] },
    { canonical: "Reno16 Pro", variants: ["Reno 16 Pro", "Reno16专业版"] },
    { canonical: "OPPO Watch", variants: ["OPPO手表"] },
    { canonical: "OPPO Pad", variants: ["OPPO平板"] },
    { canonical: "AI Eraser", variants: ["AI 消除", "AI消除", "AI 擦除", "AI擦除", "AI 橡皮擦", "AI橡皮擦", "人工智能橡皮擦"] },
    { canonical: "AI Studio", variants: ["AI 工作室", "AI工作室", "人工智能工作室"] },
    { canonical: "SUPERVOOC", variants: ["超级闪充"] },
    { canonical: "AirVOOC", variants: ["Air VOOC"] },
    { canonical: "ColorOS", variants: ["Color OS"] },
    { canonical: "Reno16", variants: ["Reno 16", "Reno-16"] },
    { canonical: "AMOLED", variants: [] },
    { canonical: "OPPO", variants: ["Oppo", "欧珀"] },
    { canonical: "UFS", variants: [] },
    { canonical: "到店取货", variants: ["门店取货", "门店提货", "到店提货", "到店自提", "到店自取", "店内取货", "店内自取", "自取", "取货", "提货", "pickup"] },
    { canonical: "分期付款", variants: ["分期支付", "分期", "installment"] },
    { canonical: "首付", variants: ["首付款", "down payment"] },
    { canonical: "促销", variants: ["推广", "promotion"] },
    { canonical: "保修", variants: ["质保", "warranty"] },
    { canonical: "维修", variants: ["修理", "repair"] },
    { canonical: "库存", variants: ["存货", "stock"] },
  ],
};
