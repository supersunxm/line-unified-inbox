"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_LAYOUT_STORAGE_KEY, DEFAULT_CHAT_PANE_WIDTHS, parseSavedChatPaneWidths, resizeChatPanes } from "./resizable-panes";
import type { ChatPaneWidths, ChatSeparator } from "./resizable-panes";

export function useResizablePanes(enabled: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widths, setWidths] = useState<ChatPaneWidths>(DEFAULT_CHAT_PANE_WIDTHS);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      const saved = parseSavedChatPaneWidths(localStorage.getItem(CHAT_LAYOUT_STORAGE_KEY));
      if (saved) setWidths(saved);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !restored) return;
    localStorage.setItem(CHAT_LAYOUT_STORAGE_KEY, JSON.stringify(widths));
  }, [enabled, restored, widths]);

  const resize = useCallback((separator: ChatSeparator, delta: number) => {
    const availableWidth = containerRef.current?.clientWidth ?? Number.POSITIVE_INFINITY;
    setWidths((current) => resizeChatPanes(current, separator, delta, availableWidth));
  }, []);

  const reset = useCallback(() => {
    setWidths(DEFAULT_CHAT_PANE_WIDTHS);
    localStorage.setItem(CHAT_LAYOUT_STORAGE_KEY, JSON.stringify(DEFAULT_CHAT_PANE_WIDTHS));
  }, []);

  return { containerRef, widths, resize, reset };
}
