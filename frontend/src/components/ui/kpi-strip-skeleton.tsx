"use client";

import React from "react";
import { Skeleton } from "./loading-state";
import {
  KPI_ITEM_CLASS,
  KPI_LABEL_CLASS,
  KPI_SUBTEXT_CLASS,
  kpiGridClass,
  kpiItemSpanClass,
  kpiValueClass,
  resolveKpiColumns,
  type KpiColumns,
} from "./kpi-strip-model";

export interface KpiStripSkeletonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Defaults to `columns`, i.e. one full row. */
  itemCount?: number;
  /** Same meaning as KpiStrip's `columns`; pass the value the real strip uses. */
  columns?: KpiColumns;
  /** Reserve the subtext line when the real items have one. */
  subtext?: boolean;
  label?: string;
}

/**
 * KpiStrip placeholder with identical geometry: same container, item, label,
 * value and subtext classes from kpi-strip-model, with each line's text replaced
 * by a block one line-height tall.
 */
export function KpiStripSkeleton({ itemCount, columns, subtext = true, label = "กำลังโหลด…", className = "", ...rest }: KpiStripSkeletonProps) {
  const count = itemCount ?? columns ?? 4;
  const resolvedColumns = resolveKpiColumns(count, columns);
  return (
    <div role="status" aria-busy="true" className={`${kpiGridClass(resolvedColumns)} ${className}`} {...rest}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`${KPI_ITEM_CLASS} ${kpiItemSpanClass(index, count, resolvedColumns)}`}>
          <div className={KPI_LABEL_CLASS}>
            <Skeleton className="h-[1lh] w-24 max-w-full" />
          </div>
          <div className={kpiValueClass()}>
            <Skeleton className="h-[1lh] w-20 max-w-full" />
          </div>
          {subtext && (
            <div className={KPI_SUBTEXT_CLASS}>
              <Skeleton className="h-[1lh] w-28 max-w-full" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
