import { Injectable } from "@nestjs/common";
import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";
import { OPPO_PROTECTED_SOURCE_TERMS, OPPO_TRANSLATION_GLOSSARY } from "./oppo-translation-glossary";

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePhrase(text: string, phrase: string, replacement: string, targetLanguage: TranslationTargetLanguage) {
  const escaped = escapeRegularExpression(phrase);
  if (targetLanguage === "zh" || /\p{Script=Han}/u.test(phrase)) return text.replace(new RegExp(escaped, "giu"), replacement);
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"), replacement);
}

export function applyTranslationGlossary(translatedText: string, targetLanguage: TranslationTargetLanguage) {
  const rules = [...OPPO_TRANSLATION_GLOSSARY[targetLanguage]].sort((left, right) => right.canonical.length - left.canonical.length);
  const placeholders = new Map<string, string>();
  let normalizedText = translatedText;

  for (const [index, rule] of rules.entries()) {
    const placeholder = `\uE000${index}\uE001`;
    const phrases = [rule.canonical, ...rule.variants].sort((left, right) => right.length - left.length);
    for (const phrase of phrases) {
      const replaced = replacePhrase(normalizedText, phrase, placeholder, targetLanguage);
      if (replaced !== normalizedText) placeholders.set(placeholder, rule.canonical);
      normalizedText = replaced;
    }
  }

  for (const [placeholder, canonical] of placeholders) normalizedText = normalizedText.replaceAll(placeholder, canonical);
  return normalizedText;
}

export type ProtectedTranslationText = {
  text: string;
  restore: (translatedText: string) => string;
};

export function protectTranslationGlossaryTerms(sourceText: string): ProtectedTranslationText {
  const restorations = new Map<string, string>();
  let protectedText = sourceText;
  const terms = [...OPPO_PROTECTED_SOURCE_TERMS].sort((left, right) => right.length - left.length);

  for (const [index, term] of terms.entries()) {
    let placeholder = `ZXQG${index}QXZ`;
    while (sourceText.toUpperCase().includes(placeholder)) placeholder = `${placeholder}X`;
    const replaced = replacePhrase(protectedText, term, placeholder, "en");
    if (replaced !== protectedText) restorations.set(placeholder, term);
    protectedText = replaced;
  }

  return {
    text: protectedText,
    restore: (translatedText: string) => {
      let restoredText = translatedText;
      for (const [placeholder, term] of restorations) restoredText = restoredText.replace(new RegExp(placeholder, "giu"), term);
      return restoredText;
    },
  };
}

@Injectable()
export class TranslationGlossaryService {
  apply(translatedText: string, targetLanguage: TranslationTargetLanguage) {
    return applyTranslationGlossary(translatedText, targetLanguage);
  }

  protect(sourceText: string): ProtectedTranslationText {
    return protectTranslationGlossaryTerms(sourceText);
  }
}
