// Pure layout and value rules for KpiStrip. Kept free of JSX so node --test can
// import it directly. Every class name below is a complete literal string so
// Tailwind can see it when scanning sources.

export type KpiColumns = 2 | 3 | 4 | 5;
export type KpiValueSize = "default" | "compact";

export const KPI_EMPTY_VALUE = "—";

// The strip shows 1 column on phones, 2 from `sm`, and `columns` from `lg`.
export const KPI_SMALL_COLUMNS = 2;

// Dividers come from the 1px grid gap showing the container colour, so every
// row must be completely filled with item cells (see kpiItemSpans).
export const KPI_STRIP_CONTAINER_CLASS =
  "grid grid-cols-1 gap-px overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-border-subtle)] sm:grid-cols-2";

export const KPI_ITEM_CLASS = "min-w-0 bg-[var(--app-surface)] px-4 py-3.5";
export const KPI_LABEL_CLASS = "flex items-start justify-between gap-2 text-[13px] text-[var(--app-text-secondary)]";
export const KPI_PERIOD_CLASS =
  "shrink-0 rounded-full bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[11px] font-medium leading-4 text-[var(--app-text-secondary)]";
export const KPI_SUBTEXT_CLASS = "mt-1 text-xs text-[var(--app-text-secondary)]";

const LARGE_COLUMN_CLASS: Record<KpiColumns, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

const SMALL_SPAN_CLASS: Record<1 | 2, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
};

const LARGE_SPAN_CLASS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
};

const VALUE_CLASS: Record<KpiValueSize, string> = {
  default: "mt-2 text-[28px] font-semibold leading-tight tracking-tight text-[var(--app-text-primary)] font-tabular",
  compact: "mt-2 truncate whitespace-nowrap text-[22px] font-semibold leading-tight tracking-tight text-[var(--app-text-primary)] font-tabular",
};

export function isEmptyKpiValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function resolveKpiColumns(itemCount: number, columns?: KpiColumns): KpiColumns {
  if (columns) return columns;
  return Math.min(5, Math.max(2, itemCount)) as KpiColumns;
}

export function kpiGridClass(columns: KpiColumns): string {
  return `${KPI_STRIP_CONTAINER_CLASS} ${LARGE_COLUMN_CLASS[columns]}`;
}

export function kpiValueClass(size: KpiValueSize = "default"): string {
  return VALUE_CLASS[size];
}

// Only the last item ever spans: it absorbs the empty cells of the final row so
// the grid gap never shows as a grey block.
export function kpiItemSpans(index: number, itemCount: number, columns: KpiColumns): { small: 1 | 2; large: 1 | 2 | 3 | 4 | 5 } {
  if (index !== itemCount - 1) return { small: 1, large: 1 };
  const smallLeftover = itemCount % KPI_SMALL_COLUMNS;
  const largeLeftover = itemCount % columns;
  return {
    small: smallLeftover === 0 ? 1 : ((KPI_SMALL_COLUMNS - smallLeftover + 1) as 1 | 2),
    large: largeLeftover === 0 ? 1 : ((columns - largeLeftover + 1) as 1 | 2 | 3 | 4 | 5),
  };
}

export function kpiItemSpanClass(index: number, itemCount: number, columns: KpiColumns): string {
  const spans = kpiItemSpans(index, itemCount, columns);
  if (spans.small === 1 && spans.large === 1) return "";
  return `${SMALL_SPAN_CLASS[spans.small]} ${LARGE_SPAN_CLASS[spans.large]}`;
}
