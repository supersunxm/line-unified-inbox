"use client";

import React from "react";

export interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  /** Heading level for the title; defaults to h2. */
  titleAs?: "h2" | "h3";
  /** Optional 12px secondary text on the right of the header row. */
  meta?: React.ReactNode;
  /** Optional 44px footer row, usually a link. */
  footer?: React.ReactNode;
  /** "none" for bodies made of SectionCardRow items or a table. */
  bodyPadding?: "default" | "none";
  children: React.ReactNode;
}

export function SectionCard({
  title,
  titleAs = "h2",
  meta,
  footer,
  bodyPadding = "default",
  className = "",
  children,
  ...rest
}: SectionCardProps) {
  const Title = titleAs;
  return (
    <section
      className={`overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] ${className}`}
      {...rest}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] px-4">
        <Title className="min-w-0 text-[15px] font-semibold leading-snug text-[var(--app-text-primary)]">{title}</Title>
        {meta && <div className="shrink-0 text-xs text-[var(--app-text-secondary)]">{meta}</div>}
      </header>
      <div className={bodyPadding === "none" ? "" : "p-4"}>{children}</div>
      {footer && (
        <div className="flex min-h-11 items-center border-t border-[var(--app-border-subtle)] px-4 text-[13px]">
          {footer}
        </div>
      )}
    </section>
  );
}

export function SectionCardRow({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border-b border-[var(--app-border-subtle)] px-4 py-3 last:border-b-0 ${className}`} {...rest} />;
}
