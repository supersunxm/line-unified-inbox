"use client";

import type { ReactNode } from "react";
import { normalizeMessageSearchKeyword } from "./message-search-query.ts";

type MatchRange = { start: number; end: number };

/** Mirrors the backend's bounded ASCII product-name spacing fallback. */
function compactProductRange(value: string, keyword: string): MatchRange | null {
  const folded = keyword.toLocaleLowerCase("en-US");
  if (!/^[a-z0-9][a-z0-9\s._-]*$/u.test(folded)) return null;
  const needle = folded.replace(/[\s._-]+/gu, "");
  if (needle.length < 3 || !/[a-z]/u.test(needle) || !/[0-9]/u.test(needle)) return null;

  let haystack = "";
  const offsets: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (/[\s._-]/u.test(char)) continue;
    // Keep one character per UTF-16 offset; Latin case folding mirrors SQL
    // for product codes without altering positions in neighboring Thai text.
    haystack += /[A-Z]/u.test(char) ? char.toLowerCase() : char;
    offsets.push(index);
  }
  const startAt = haystack.indexOf(needle);
  if (startAt < 0) return null;
  return { start: offsets[startAt], end: offsets[startAt + needle.length - 1] + 1 };
}

/** Mark a literal or spacing-equivalent case-insensitive match without injecting HTML. */
export function highlightedSearchText(value: string, rawKeyword: string): ReactNode {
  const keyword = normalizeMessageSearchKeyword(rawKeyword);
  if (!keyword) return value;
  const lower = value.toLocaleLowerCase("en-US");
  const needle = keyword.toLocaleLowerCase("en-US");
  const exactAt = lower.indexOf(needle);
  const range = exactAt >= 0
    ? { start: exactAt, end: exactAt + keyword.length }
    : compactProductRange(value, keyword);
  if (!range) return value;
  return <>
    {value.slice(0, range.start)}
    <mark data-chat-search-highlight className="rounded-sm bg-amber-200 px-0.5 text-slate-900">
      {value.slice(range.start, range.end)}
    </mark>
    {value.slice(range.end)}
  </>;
}
