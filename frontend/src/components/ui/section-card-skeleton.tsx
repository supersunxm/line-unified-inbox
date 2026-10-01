"use client";

import React from "react";
import { Skeleton } from "./loading-state";
import { SkeletonText } from "./skeleton-text";

export interface SectionCardSkeletonProps extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "title"> {
  /** Real title, when it is known before the data; otherwise a grey block. */
  title?: React.ReactNode;
  titleAs?: "h2" | "h3";
  lines?: number;
  label?: string;
}

/** SectionCard placeholder: same frame, header row and body padding as SectionCard. */
export function SectionCardSkeleton({ title, titleAs = "h2", lines = 5, label = "กำลังโหลด…", className = "", ...rest }: SectionCardSkeletonProps) {
  const Title = titleAs;
  return (
    <section
      role="status"
      aria-busy="true"
      className={`overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-primary)] flex flex-col ${className}`}
      {...rest}
    >
      <span className="sr-only">{label}</span>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] px-4">
        {title !== undefined ? (
          <Title className="min-w-0 text-[15px] font-semibold leading-snug text-[var(--app-text-primary)]">{title}</Title>
        ) : (
          <div className="min-w-0 text-[15px] leading-snug">
            <Skeleton className="h-[1lh] w-36" />
          </div>
        )}
      </header>
      <div className="flex-1 p-4">
        <SkeletonText lines={lines} />
      </div>
    </section>
  );
}
