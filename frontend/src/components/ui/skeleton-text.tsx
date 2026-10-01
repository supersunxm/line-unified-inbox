"use client";

import React from "react";
import { Skeleton } from "./loading-state";

export interface SkeletonTextProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Number of lines; defaults to 1. */
  lines?: number;
  /** Height of each line (Tailwind class); defaults to "h-4". */
  lineHeight?: string;
  /** Optional width for the last line; defaults to full width. */
  lastLineWidth?: string;
  /** Gap between lines; defaults to "gap-2". */
  gap?: string;
}

export function SkeletonText({
  lines = 1,
  lineHeight = "h-4",
  lastLineWidth,
  gap = "gap-2",
  className = "",
  ...rest
}: SkeletonTextProps) {
  return (
    <div className={`flex flex-col ${gap} ${className}`} {...rest}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`${lineHeight} ${index === lines - 1 && lastLineWidth ? lastLineWidth : "w-full"}`}
        />
      ))}
    </div>
  );
}
