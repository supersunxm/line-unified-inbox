import type { ReactNode } from "react";
import { GreetingModeNav } from "./greeting-mode-nav";

export default function GreetingMessagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GreetingModeNav />
      {children}
      <style>{`
        html[data-theme="dark"] body:has(#greeting-store-targeting) .bg-white,
        html[data-theme="dark"] body:has(#greeting-store-targeting) [class*="bg-[#f4f5f7]"],
        html[data-theme="dark"] body:has(#greeting-store-targeting) .bg-gray-50,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .bg-gray-100,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .bg-gray-200 {
          background-color: var(--app-surface) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) .hover\\:bg-gray-50:hover,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .hover\\:bg-gray-100:hover,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .hover\\:bg-gray-200:hover {
          background-color: var(--app-surface-hover) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) .text-gray-900,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .text-gray-800,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .text-gray-700,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .text-gray-600 {
          color: var(--app-text-primary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) .text-gray-500 {
          color: var(--app-text-secondary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) .text-gray-400 {
          color: var(--app-text-tertiary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) .border-gray-100,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .border-gray-200,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .border-gray-300 {
          border-color: var(--app-border) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) input:not([type="checkbox"]):not([type="radio"]),
        html[data-theme="dark"] body:has(#greeting-store-targeting) textarea,
        html[data-theme="dark"] body:has(#greeting-store-targeting) select {
          background: var(--app-surface) !important;
          color: var(--app-text-primary) !important;
          border-color: var(--app-border-strong) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) input::placeholder,
        html[data-theme="dark"] body:has(#greeting-store-targeting) textarea::placeholder {
          color: var(--app-text-tertiary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) button.bg-white,
        html[data-theme="dark"] body:has(#greeting-store-targeting) a.bg-white {
          background: var(--app-surface) !important;
          color: var(--app-text-primary) !important;
          border-color: var(--app-border-strong) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) button.bg-white:hover,
        html[data-theme="dark"] body:has(#greeting-store-targeting) a.bg-white:hover {
          background: var(--app-surface-hover) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) .shadow-xs,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .shadow-2xs,
        html[data-theme="dark"] body:has(#greeting-store-targeting) .shadow-sm {
          box-shadow: var(--app-shadow-card) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) textarea {
          caret-color: var(--app-accent);
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) details > div,
        html[data-theme="dark"] body:has(#greeting-store-targeting) [class*="shadow-lg"][class*="bg-white"] {
          background: var(--app-surface-subtle) !important;
          border-color: var(--app-border) !important;
          color: var(--app-text-primary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting {
          background: var(--app-surface) !important;
          border-color: var(--app-border) !important;
          color: var(--app-text-primary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:first-child {
          border-bottom-color: var(--app-border-subtle) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:first-child h2 {
          color: var(--app-text-primary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:first-child > div:first-child > div,
        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting td:nth-child(2) > span {
          color: var(--app-text-secondary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:nth-child(2) > div:first-child input[type="search"] {
          background: var(--app-surface-subtle) !important;
          color: var(--app-text-primary) !important;
          border-color: var(--app-border-strong) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:nth-child(2) > div:first-child > div:nth-last-child(2) {
          background: var(--app-surface-subtle) !important;
          border-color: var(--app-border) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:nth-child(2) > div:nth-child(3) {
          border-color: var(--app-border) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting thead {
          background: var(--app-surface-subtle) !important;
          color: var(--app-text-secondary) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting th,
        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting td {
          border-color: var(--app-border-subtle) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting tbody tr:hover {
          background: var(--app-surface-hover) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting tbody tr:has(input[type="checkbox"]:checked) {
          background: var(--app-accent-soft) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) #greeting-store-targeting > div:nth-child(2) > div:last-child {
          border-top-color: var(--app-border) !important;
        }

        html[data-theme="dark"] body:has(#greeting-store-targeting) hr,
        html[data-theme="dark"] body:has(#greeting-store-targeting) [class*="border-b"] {
          border-color: var(--app-border) !important;
        }
      `}</style>
    </>
  );
}
