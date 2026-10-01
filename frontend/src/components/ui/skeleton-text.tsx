"use client";

import React from "react";
import { Skeleton } from "./loading-state";

export interface SkeletonTextProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  lines?: number;
  /** Tailwind height class for each line. */
  lineHeight?: string;
  /** Width class for the last line, so a paragraph does not end flush. */
  lastLineWidth?: string;
}

/**
 * Grey text lines. A building block (like Skeleton): it is aria-hidden and has no
 * status role, so placing it inside a skeleton that announces itself does not
 * create a second live region.
 */
export function SkeletonText({ lines = 1, lineHeight = "h-3.5", lastLineWidth = "w-2/3", className = "", ...rest }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`} {...rest}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={`${lineHeight} ${lines > 1 && index === lines - 1 ? lastLineWidth : "w-full"}`} />
      ))}
    </div>
  );
}
