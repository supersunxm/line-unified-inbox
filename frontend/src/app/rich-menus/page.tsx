"use client";

import Link from "next/link";
import { AuthorizedWorkspace } from "../authorized-workspace";
import { useAppLanguage } from "../language";
import { RICH_MENU_I18N } from "./rich-menu-i18n";

export default function RichMenusPage() {
  const { language } = useAppLanguage();
  const text = RICH_MENU_I18N[language];
  return (
    <div className="relative h-full">
      <AuthorizedWorkspace section="rich-menus" />
      <Link
        href="/rich-menus/overview"
        className="fixed right-6 top-20 z-50 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold text-[var(--app-text-primary)] shadow-sm hover:bg-[var(--app-surface-muted)]"
      >
        {text.overviewLink}
      </Link>
    </div>
  );
}
