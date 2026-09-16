"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GreetingModeNav() {
  const pathname = usePathname();
  const onOverview = pathname === "/greeting-messages/manage";

  return (
    <div className="fixed right-6 top-[72px] z-[60] flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      <Link
        href="/greeting-messages/manage"
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          onOverview
            ? "bg-[#06c755] text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        ภาพรวม
      </Link>
      <Link
        href="/greeting-messages"
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          !onOverview
            ? "bg-[#06c755] text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        Builder
      </Link>
    </div>
  );
}
