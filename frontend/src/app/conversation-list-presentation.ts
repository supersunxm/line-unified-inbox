import type { ApiCustomerSalesInformation } from "@/types/api";

export type ConversationListSection = "dashboard" | "notReplied" | "notifiedBm" | "replied";

type ConversationListLabels = {
  conversations: string;
  notReplied: string;
  notifiedBm: string;
  replied: string;
  status: (value: string) => string;
};

export function getConversationListTitle(
  sidebarView: string,
  statusFilter: string,
  labels: ConversationListLabels,
) {
  if (sidebarView === "notReplied") return labels.notReplied;
  if (sidebarView === "notifiedBm") return labels.notifiedBm;
  if (sidebarView === "replied") return labels.replied;
  if (sidebarView === "all") return labels.conversations;
  if (statusFilter !== "all") return labels.status(statusFilter);
  return labels.conversations;
}

export type BmCustomerTagKind =
  | "salesStatus"
  | "interestLevel"
  | "productModel"
  | "productVariant"
  | "product"
  | "variant"
  | "purchaseChannel"
  | "paymentMethod";

export type BmCustomerTag = {
  kind: BmCustomerTagKind;
  label: string;
  rawStatus?: "INTERESTED" | "PURCHASED" | null;
  rawInterestLevel?: "HOT" | "WARM" | "COLD" | null;
};

export function formatVariantLabel(
  variantOrRam?:
    | { ram?: string | null; rom?: string | null; color?: string | null }
    | string
    | null,
  romArg?: string | null,
  colorArg?: string | null,
): string | null {
  let ram: string | null | undefined;
  let rom: string | null | undefined;
  let color: string | null | undefined;

  if (typeof variantOrRam === "object" && variantOrRam !== null) {
    ram = variantOrRam.ram;
    rom = variantOrRam.rom;
    color = variantOrRam.color;
  } else {
    ram = variantOrRam;
    rom = romArg;
    color = colorArg;
  }

  const r = ram?.trim() || null;
  const ro = rom?.trim() || null;
  const c = color?.trim() || null;

  const ramPart = r ? (r.toUpperCase().endsWith("GB") ? r : `${r}GB`) : null;
  const romPart = ro ? (ro.toUpperCase().endsWith("GB") ? ro : `${ro}GB`) : null;
  const memPart = [ramPart, romPart].filter(Boolean).join(" / ");
  const parts = [memPart, c].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getBmCustomerSalesTags(
  sales?:
    | (Partial<ApiCustomerSalesInformation> & {
        purchaseChannel?: string[] | string | null;
        products?: Array<{
          id?: string;
          model?: { id?: string; name: string; seriesName?: string | null; category?: string | null } | string | null;
          variant?: { id?: string; ram?: string | null; rom?: string | null; color?: string | null } | string | null;
          ram?: string | null;
          rom?: string | null;
          color?: string | null;
          customProductName?: string | null;
          quantity?: number;
          status?: "INTERESTED" | "PURCHASED";
        }> | null;
      })
    | null,
): BmCustomerTag[] {
  if (!sales) return [];
  const tags: BmCustomerTag[] = [];

  // 1. INTERESTED or PURCHASED
  if (sales.status === "INTERESTED" || sales.status === "PURCHASED") {
    tags.push({
      kind: "salesStatus",
      label: sales.status,
      rawStatus: sales.status,
    });
  }

  // 2. HOT / WARM / COLD
  if (sales.interestLevel) {
    const level = sales.interestLevel.toUpperCase();
    if (level === "HOT" || level === "WARM" || level === "COLD") {
      tags.push({
        kind: "interestLevel",
        label: level,
        rawInterestLevel: level as "HOT" | "WARM" | "COLD",
      });
    }
  }

  // 3 & 4. Product model & variant
  if (sales.products && sales.products.length > 0) {
    for (const p of sales.products) {
      const modelName =
        (typeof p.model === "string" ? p.model : p.model?.name)?.trim() ||
        p.customProductName?.trim() ||
        (typeof p === "string" ? p : "");
      if (modelName) {
        tags.push({
          kind: "productModel",
          label: modelName,
        });
      }

      const variantLabel =
        typeof p.variant === "string"
          ? p.variant.trim()
          : formatVariantLabel(
              p.variant || { ram: p.ram, rom: p.rom, color: p.color },
            );
      if (variantLabel) {
        tags.push({
          kind: "productVariant",
          label: variantLabel,
        });
      }
    }
  }

  // 5. STORE / ONLINE
  if (sales.purchaseChannel) {
    const rawChannels: unknown = sales.purchaseChannel;
    const channels = Array.isArray(rawChannels)
      ? (rawChannels as string[])
      : typeof rawChannels === "string" && rawChannels.trim()
        ? [rawChannels.trim()]
        : [];

    for (const ch of channels) {
      const trimmed = typeof ch === "string" ? ch.trim().toUpperCase() : "";
      if (trimmed) {
        tags.push({
          kind: "purchaseChannel",
          label: trimmed,
        });
      }
    }
  }

  // 6. Payment method
  if (sales.paymentMethod) {
    const pm = sales.paymentMethod.trim().toUpperCase();
    const label =
      pm === "CREDIT_CARD"
        ? "CREDIT CARD"
        : pm === "INSTALLMENT"
          ? "INSTALLMENT"
          : pm === "CASH"
            ? "CASH"
            : pm === "OTHER"
              ? "OTHER"
              : pm;
    tags.push({
      kind: "paymentMethod",
      label,
    });
  }

  return tags;
}

export function getConversationListTags(
  sales?: ApiCustomerSalesInformation | null,
  maxVisible = 3,
) {
  const all = getBmCustomerSalesTags(sales);
  return {
    visible: all.slice(0, maxVisible),
    hidden: all.slice(maxVisible),
  };
}

export function getBmTagChipClass(tag: BmCustomerTag): string {
  switch (tag.kind) {
    case "salesStatus":
      return tag.rawStatus === "PURCHASED"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200/60 dark:border-emerald-800/40 font-semibold"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200/60 dark:border-blue-800/40 font-semibold";
    case "interestLevel":
      if (tag.rawInterestLevel === "HOT") {
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200/60 dark:border-rose-800/40 font-semibold";
      }
      if (tag.rawInterestLevel === "WARM") {
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/40 font-semibold";
      }
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/40 font-semibold";
    case "productModel":
    case "product":
      return "bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-accent)]/20 font-medium";
    case "productVariant":
    case "variant":
      return "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] border border-[var(--app-border)] font-medium";
    case "purchaseChannel":
      return "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] border border-[var(--app-border)] font-medium";
    case "paymentMethod":
      return "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)] border border-[var(--app-border)] font-medium";
    default:
      return "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] border border-[var(--app-border)] font-medium";
  }
}

export type ApiBmReplyStatus = "NOT_REPLIED" | "NOTIFIED_BM" | "REPLIED";

export function getBmReplyStatusBadge(
  status: ApiBmReplyStatus,
  labels: Record<ApiBmReplyStatus, string>,
) {
  return {
    kind: "bmReplyStatus" as const,
    status,
    label: labels[status] ?? status,
  };
}
