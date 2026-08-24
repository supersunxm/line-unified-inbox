"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export type MobileNavKey = "dashboard" | "chats" | "followers" | "more";

export function MobilePageShell({ children, bottomNav }: { children: ReactNode; bottomNav?: ReactNode }) {
  return (
    <main className="fixed inset-0 z-[100] flex min-h-0 w-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
      {bottomNav}
    </main>
  );
}

export function MobilePageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">{eyebrow}</p>}
          <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.025em]">{title}</h1>
          {description && <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

export function MobileSectionTabs<T extends string>({ value, items, onChange }: { value: T; items: Array<{ value: T; label: string; badge?: string | number }>; onChange: (value: T) => void }) {
  return (
    <div className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[var(--app-bg)]/95 px-4 py-2 backdrop-blur">
      <div className="grid rounded-xl bg-[var(--app-surface-subtle)] p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } as CSSProperties}>
        {items.map((item) => (
          <button key={item.value} type="button" onClick={() => onChange(item.value)} className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors ${value === item.value ? "bg-[var(--app-surface)] text-[var(--app-accent)] shadow-sm" : "text-[var(--app-text-secondary)]"}`}>
            {item.label}{item.badge !== undefined ? ` ${item.badge}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MobileSection({ title, description, action, children }: { title?: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-[11px] leading-4 text-[var(--app-text-secondary)]">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function MobileMetricGrid({ children }: { children: ReactNode }) { return <div className="grid grid-cols-2 gap-2.5">{children}</div>; }

export function MobileMetricCard({ label, value, detail, tone = "default", wide = false }: { label: string; value: ReactNode; detail?: ReactNode; tone?: "default" | "accent" | "success" | "warning" | "danger" | "info"; wide?: boolean }) {
  const toneClass = tone === "accent" ? "text-[var(--app-accent)]" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : tone === "danger" ? "text-rose-600 dark:text-rose-400" : tone === "info" ? "text-sky-600 dark:text-sky-400" : "text-[var(--app-text-primary)]";
  return (
    <div className={`rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm ${wide ? "col-span-2" : ""}`}>
      <p className="text-[11px] font-semibold text-[var(--app-text-secondary)]">{label}</p>
      <div className={`mt-1.5 text-[26px] font-bold leading-none tracking-[-0.035em] tabular-nums ${toneClass}`}>{value}</div>
      {detail && <div className="mt-2 text-[11px] leading-4 text-[var(--app-text-tertiary)]">{detail}</div>}
    </div>
  );
}

export function MobileCard({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm ${className}`}>{children}</div>; }

export function MobileListCard({ title, subtitle, leading, trailing, children }: { title: ReactNode; subtitle?: ReactNode; leading?: ReactNode; trailing?: ReactNode; children?: ReactNode }) {
  return (
    <article className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><div className="truncate text-sm font-bold">{title}</div>{subtitle && <div className="mt-0.5 truncate text-[11px] text-[var(--app-text-tertiary)]">{subtitle}</div>}</div>
            {trailing && <div className="shrink-0">{trailing}</div>}
          </div>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </article>
  );
}

export function MobileEmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-10 text-center"><p className="text-sm font-bold">{title}</p>{description && <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">{description}</p>}</div>;
}

export function MobileBottomNav({ current, onMore }: { current: MobileNavKey; onMore: () => void }) {
  const items: Array<{ key: Exclude<MobileNavKey, "more">; href: string; label: string; icon: string }> = [
    { key: "dashboard", href: "/dashboard", label: "แดชบอร์ด", icon: "▦" },
    { key: "chats", href: "/chats", label: "แชทร้านค้า", icon: "◫" },
    { key: "followers", href: "/follower-insights", label: "ผู้ติดตาม", icon: "↗" },
  ];
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t border-[var(--app-border)] bg-[var(--app-surface)] px-1 pt-1.5" style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}>
      {items.map((item) => <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] ${current === item.key ? "font-semibold text-[var(--app-accent)]" : "font-medium text-[var(--app-text-secondary)]"}`}><span className="text-lg leading-none">{item.icon}</span><span>{item.label}</span></Link>)}
      <button type="button" onClick={onMore} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] ${current === "more" ? "font-semibold text-[var(--app-accent)]" : "font-medium text-[var(--app-text-secondary)]"}`}><span className="text-xl leading-none">•••</span><span>เพิ่มเติม</span></button>
    </nav>
  );
}

export function MobileMoreSheet({ displayName, role, onClose }: { displayName: string; role: "ADMIN" | "VIEWER"; onClose: () => void }) {
  const links = [
    { href: "/dashboard/message-traffic", label: "Message Traffic" },
    { href: "/coupons", label: "คูปอง" },
    { href: "/stores", label: "จัดการร้านค้า" },
    { href: "/friend-source-links", label: "Friend Source Links" },
    { href: "/tiktok", label: "TikTok Monitor" },
    ...(role === "ADMIN" ? [
      { href: "/admin/purchase-analytics", label: "ข้อมูลการซื้อ" },
      { href: "/mass-messages", label: "ส่งข้อความ" },
      { href: "/admin/registrations", label: "BM & PC Accounts" },
    ] : []),
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/35" onClick={onClose}>
      <div className="max-h-[78vh] w-full overflow-y-auto rounded-t-[1.6rem] border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" />
        <div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold">เพิ่มเติม</p><p className="mt-0.5 truncate text-xs text-[var(--app-text-tertiary)]">{displayName}</p></div><button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-lg">×</button></div>
        <div className="grid grid-cols-2 gap-2">{links.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-3 text-sm font-semibold">{item.label}</Link>)}</div>
      </div>
    </div>
  );
}
