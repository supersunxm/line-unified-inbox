"use client";

import type { ReactNode } from "react";
import { normalizeMessageSearchKeyword } from "./message-search-query.ts";

/** Mark a literal, case-insensitive match without injecting HTML. */
export function highlightedSearchText(value: string, rawKeyword: string): ReactNode {
  const keyword = normalizeMessageSearchKeyword(rawKeyword);
  if (!keyword) return value;
  const lower = value.toLocaleLowerCase("en-US");
  const needle = keyword.toLocaleLowerCase("en-US");
  const start = lower.indexOf(needle);
  if (start === -1) return value;
  const end = start + keyword.length;
  return <>
    {value.slice(0, start)}
    <mark data-chat-search-highlight className="rounded-sm bg-amber-200 px-0.5 text-slate-900">{value.slice(start, end)}</mark>
    {value.slice(end)}
  </>;
}
