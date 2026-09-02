"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { LanguageControl, useAppLanguage, type AppLanguage } from "./language";

export type LegacyI18nPhrase = Record<AppLanguage, string>;
export type LegacyI18nTemplate = Record<AppLanguage, string>;

const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
};

const ENGLISH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function templateRegex(template: string) {
  const escaped = template
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{\\\{value\\\}\\\}/g, "([\\s\\S]+?)");
  return new RegExp(`^${escaped}$`);
}

function normalizeYear(year: number) {
  return year >= 2400 ? year - 543 : year;
}

function formatLegacyDate(
  language: AppLanguage,
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
) {
  const year = normalizeYear(parts.year);
  const hasTime = parts.hour !== undefined && parts.minute !== undefined;
  const time = hasTime
    ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}${parts.second !== undefined ? `:${String(parts.second).padStart(2, "0")}` : ""}`
    : "";

  if (language === "th") {
    const month = Object.entries(THAI_MONTHS).find(([, value]) => value === parts.month)?.[0] ?? String(parts.month);
    return `${parts.day} ${month} ${year + 543}${hasTime ? ` ${time}` : ""}`;
  }
  if (language === "zh") return `${year}年${parts.month}月${parts.day}日${hasTime ? ` ${time}` : ""}`;
  return `${ENGLISH_MONTHS[parts.month - 1] ?? parts.month} ${parts.day}, ${year}${hasTime ? `, ${time}` : ""}`;
}

function translateLegacyDate(value: string, language: AppLanguage) {
  const thaiMedium = value.match(/^(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (thaiMedium) {
    return formatLegacyDate(language, {
      day: Number(thaiMedium[1]),
      month: THAI_MONTHS[thaiMedium[2]] ?? 1,
      year: Number(thaiMedium[3]),
      hour: thaiMedium[4] === undefined ? undefined : Number(thaiMedium[4]),
      minute: thaiMedium[5] === undefined ? undefined : Number(thaiMedium[5]),
      second: thaiMedium[6] === undefined ? undefined : Number(thaiMedium[6]),
    });
  }

  const thaiNumeric = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (thaiNumeric) {
    return formatLegacyDate(language, {
      day: Number(thaiNumeric[1]),
      month: Number(thaiNumeric[2]),
      year: Number(thaiNumeric[3]),
      hour: Number(thaiNumeric[4]),
      minute: Number(thaiNumeric[5]),
      second: thaiNumeric[6] === undefined ? undefined : Number(thaiNumeric[6]),
    });
  }

  const english = value.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})(?:,\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (english) {
    return formatLegacyDate(language, {
      day: Number(english[2]),
      month: ENGLISH_MONTHS.indexOf(english[1] as (typeof ENGLISH_MONTHS)[number]) + 1,
      year: Number(english[3]),
      hour: english[4] === undefined ? undefined : Number(english[4]),
      minute: english[5] === undefined ? undefined : Number(english[5]),
      second: english[6] === undefined ? undefined : Number(english[6]),
    });
  }

  const chinese = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (chinese) {
    return formatLegacyDate(language, {
      day: Number(chinese[3]),
      month: Number(chinese[2]),
      year: Number(chinese[1]),
      hour: chinese[4] === undefined ? undefined : Number(chinese[4]),
      minute: chinese[5] === undefined ? undefined : Number(chinese[5]),
      second: chinese[6] === undefined ? undefined : Number(chinese[6]),
    });
  }

  return null;
}

function translateLegacyRelativeTime(value: string, language: AppLanguage) {
  if (["เมื่อสักครู่", "Just now", "刚刚"].includes(value)) {
    return language === "th" ? "เมื่อสักครู่" : language === "zh" ? "刚刚" : "Just now";
  }

  const patterns: Array<{ regex: RegExp; unit: "minute" | "hour" | "day" | "week" }> = [
    { regex: /^(\d+) นาทีที่แล้ว$/, unit: "minute" },
    { regex: /^(\d+) minutes? ago$/, unit: "minute" },
    { regex: /^(\d+)分钟前$/, unit: "minute" },
    { regex: /^(\d+) ชั่วโมงที่แล้ว$/, unit: "hour" },
    { regex: /^(\d+) hours? ago$/, unit: "hour" },
    { regex: /^(\d+)小时前$/, unit: "hour" },
    { regex: /^(\d+) วันที่แล้ว$/, unit: "day" },
    { regex: /^(\d+) days? ago$/, unit: "day" },
    { regex: /^(\d+)天前$/, unit: "day" },
    { regex: /^(\d+) สัปดาห์ที่แล้ว$/, unit: "week" },
    { regex: /^(\d+) weeks? ago$/, unit: "week" },
    { regex: /^(\d+)周前$/, unit: "week" },
  ];

  for (const { regex, unit } of patterns) {
    const match = value.match(regex);
    if (!match) continue;
    const count = Number(match[1]);
    if (language === "th") {
      const unitText = unit === "minute" ? "นาที" : unit === "hour" ? "ชั่วโมง" : unit === "day" ? "วัน" : "สัปดาห์";
      return `${count} ${unitText}ที่แล้ว`;
    }
    if (language === "zh") {
      const unitText = unit === "minute" ? "分钟" : unit === "hour" ? "小时" : unit === "day" ? "天" : "周";
      return `${count}${unitText}前`;
    }
    const unitText = `${unit}${count === 1 ? "" : "s"}`;
    return `${count} ${unitText} ago`;
  }

  const combined = value.match(/^(\d+) ชั่วโมง (\d+) นาทีที่แล้ว$/)
    ?? value.match(/^(\d+) hours? (\d+) minutes? ago$/)
    ?? value.match(/^(\d+)小时(\d+)分钟前$/);
  if (combined) {
    const hours = Number(combined[1]);
    const minutes = Number(combined[2]);
    if (language === "th") return `${hours} ชั่วโมง ${minutes} นาทีที่แล้ว`;
    if (language === "zh") return `${hours}小时${minutes}分钟前`;
    return `${hours} ${hours === 1 ? "hour" : "hours"} ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }

  return null;
}

function translateLegacyLocaleValue(value: string, language: AppLanguage) {
  return translateLegacyRelativeTime(value, language) ?? translateLegacyDate(value, language);
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
      const localeValue = translateLegacyLocaleValue(trimmed, language);
      return localeValue ? preserveWhitespace(value, localeValue) : value;
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
