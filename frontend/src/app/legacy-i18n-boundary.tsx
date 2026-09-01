"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { LanguageControl, useAppLanguage, type AppLanguage } from "./language";

export type LegacyI18nPhrase = Record<AppLanguage, string>;
export type LegacyI18nTemplate = Record<AppLanguage, string>;

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function templateRegex(template: string) {
  const escaped = template
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{\\\{value\\\}\\\}/g, "(.+?)");
  return new RegExp(`^${escaped}$`);
}

export function LegacyI18nBoundary({
  children,
  phrases,
  templates = [],
  showControl = true,
}: {
  children: ReactNode;
  phrases: LegacyI18nPhrase[];
  templates?: LegacyI18nTemplate[];
  showControl?: boolean;
}) {
  const { language } = useAppLanguage();
  const rootRef = useRef<HTMLDivElement>(null);

  const phraseLookup = useMemo(() => {
    const map = new Map<string, LegacyI18nPhrase>();
    for (const phrase of phrases) {
      map.set(phrase.th.trim(), phrase);
      map.set(phrase.en.trim(), phrase);
      map.set(phrase.zh.trim(), phrase);
    }
    return map;
  }, [phrases]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const translateValue = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return value;
      const direct = phraseLookup.get(trimmed);
      if (direct) return preserveWhitespace(value, direct[language]);
      for (const template of templates) {
        for (const sourceLanguage of ["th", "en", "zh"] as AppLanguage[]) {
          const match = trimmed.match(templateRegex(template[sourceLanguage]));
          if (match) return preserveWhitespace(value, template[language].replace("{{value}}", match[1] ?? ""));
        }
      }
      return value;
    };

    const translateElement = (element: Element) => {
      for (const attribute of ["placeholder", "title", "aria-label"]) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        const translated = translateValue(current);
        if (translated !== current) element.setAttribute(attribute, translated.trim());
      }
    };

    const translateTree = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const current = node.nodeValue ?? "";
        const translated = translateValue(current);
        if (translated !== current) node.nodeValue = translated;
        return;
      }
      if (!(node instanceof Element)) return;
      translateElement(node);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let current: Node | null = walker.currentNode;
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
          const value = current.nodeValue ?? "";
          const translated = translateValue(value);
          if (translated !== value) current.nodeValue = translated;
        } else if (current instanceof Element) {
          translateElement(current);
        }
        current = walker.nextNode();
      }
    };

    translateTree(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateTree(mutation.target);
        if (mutation.type === "attributes" && mutation.target instanceof Element) translateElement(mutation.target);
        mutation.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });

    const originalConfirm = window.confirm.bind(window);
    const originalPrompt = window.prompt.bind(window);
    const originalAlert = window.alert.bind(window);
    window.confirm = (message?: string) => originalConfirm(translateValue(String(message ?? "")).trim());
    window.prompt = (message?: string, defaultValue?: string) => originalPrompt(translateValue(String(message ?? "")).trim(), defaultValue);
    window.alert = (message?: unknown) => originalAlert(translateValue(String(message ?? "")).trim());

    return () => {
      observer.disconnect();
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
      window.alert = originalAlert;
    };
  }, [language, phraseLookup, templates]);

  return (
    <div ref={rootRef} className="contents">
      {showControl ? <div className="fixed right-3 top-3 z-[120]"><LanguageControl /></div> : null}
      {children}
    </div>
  );
}
