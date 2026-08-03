"use client";

import { useEffect, useRef, useState } from "react";

export function StoreChatsOverflowMenu({ language, resetPaneSizes }: { language: "th" | "en" | "zh"; resetPaneSizes: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = language === "th" ? "ตัวเลือกแชทร้านค้า" : language === "zh" ? "门店聊天选项" : "Store Chats options";
  const resetLabel = language === "th" ? "รีเซ็ตขนาดหน้าต่าง" : language === "zh" ? "重置面板大小" : "Reset pane sizes";

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="app-button-secondary flex h-9 w-9 items-center justify-center rounded-lg border text-lg focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {isOpen && (
        <div role="menu" aria-label={label} className="app-surface absolute right-0 top-[calc(100%+0.4rem)] z-40 min-w-48 rounded-xl border p-2 shadow-xl">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              resetPaneSizes();
              setIsOpen(false);
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
          >
            {resetLabel}
          </button>
        </div>
      )}
    </div>
  );
}
