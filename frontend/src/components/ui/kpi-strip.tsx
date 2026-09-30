"use client";

import React from "react";
import {
  KPI_EMPTY_VALUE,
  KPI_ITEM_CLASS,
  KPI_LABEL_CLASS,
  KPI_PERIOD_CLASS,
  KPI_SUBTEXT_CLASS,
  isEmptyKpiValue,
  kpiGridClass,
  kpiItemSpanClass,
  kpiValueClass,
  resolveKpiColumns,
  type KpiColumns,
  type KpiValueSize,
} from "./kpi-strip-model";

export interface KpiItem {
  id: string;
  label: string;
  /** null, undefined or "" renders "—" at normal size; put the reason in `subtext`. */
  value: React.ReactNode | null;
  subtext?: React.ReactNode;
  /** Short period chip, e.g. "ตอนนี้" or "7 วัน". */
  period?: string;
  /** "compact" for text-like values such as "16:00 – 17:00" or a weekday. */
  valueSize?: KpiValueSize;
}

export interface KpiStripProps extends Omit<React.HTMLAttributes<HTMLDListElement>, "children"> {
  items: KpiItem[];
  /** Columns from the `lg` breakpoint; defaults to the item count (2–5). */
  columns?: KpiColumns;
}

export function KpiStrip({ items, columns, className = "", ...rest }: KpiStripProps) {
  const resolvedColumns = resolveKpiColumns(items.length, columns);
  return (
    <dl className={`${kpiGridClass(resolvedColumns)} ${className}`} {...rest}>
      {items.map((item, index) => (
        <div key={item.id} className={`${KPI_ITEM_CLASS} ${kpiItemSpanClass(index, items.length, resolvedColumns)}`}>
          <dt className={KPI_LABEL_CLASS}>
            <span className="min-w-0">{item.label}</span>
            {item.period && <span className={KPI_PERIOD_CLASS}>{item.period}</span>}
          </dt>
          <dd className={kpiValueClass(item.valueSize)}>{isEmptyKpiValue(item.value) ? KPI_EMPTY_VALUE : item.value}</dd>
          {item.subtext && <dd className={KPI_SUBTEXT_CLASS}>{item.subtext}</dd>}
        </div>
      ))}
    </dl>
  );
}
