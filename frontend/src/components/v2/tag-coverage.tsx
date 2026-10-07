"use client";

import React from "react";
import { TAG_TYPE_LABELS, tagCoverageView, type TagCoverageCounts } from "@/lib/v2/tag-coverage";
import { rateState } from "@/lib/v2/value-state";
import { languageLocale } from "@/app/language-utils";
import { useAppLanguage } from "@/app/language";
import { v2Text } from "@/lib/v2/v2-translations";
import { useV2Month } from "./v2-month-data";
import { StateValue } from "./v2-ui";

const dateTime = (value: string, language: "th" | "en" | "zh") => new Date(value).toLocaleString(`${languageLocale(language)}-u-ca-gregory`, { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

const TAG_TYPE_TRANSLATION_KEYS: Record<keyof TagCoverageCounts["byType"], "tagProduct" | "tagPeriod" | "tagOnline" | "tagFilm" | "tagPayment" | "tagFinance" | "tagSource" | "tagDate"> = {
  product: "tagProduct", period: "tagPeriod", online: "tagOnline", film: "tagFilm", payment: "tagPayment", finance: "tagFinance", source: "tagSource", date: "tagDate",
};

function tagTypeKey(key: keyof TagCoverageCounts["byType"]) {
  return TAG_TYPE_TRANSLATION_KEYS[key];
}

/** Where the tags come from and when they were last updated, or that the first read-back is still running. */
export function useTagCoverageNote(): string | null {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const { tagCoverage } = useV2Month();
  if (tagCoverage.error) return t("unableToLoadTagsWithError", { error: tagCoverage.error });
  if (!tagCoverage.data) return null;
  if (!tagCoverage.data.rederiveComplete) return t("tagReadInProgress");
  return t("tagSourceUpdated", { updated: tagCoverage.data.updatedAt ? t("updatedAt", { date: dateTime(tagCoverage.data.updatedAt, language) }) : "" });
}

/**
 * Table cell: share of read names with ≥ 1 tag, and how many names were read.
 * A store whose names were never read says "ยังไม่ได้อ่านชื่อ", never 0%.
 */
export function TagCoverageCell({ counts }: { counts: TagCoverageCounts | undefined }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const { tagCoverage } = useV2Month();
  if (!tagCoverage.data) {
    const reason = tagCoverage.error ? t("unableToLoadDataWithError", { error: tagCoverage.error }) : t("loading");
    return <span title={reason} className="text-[var(--app-text-secondary)]">{tagCoverage.error ? "—" : "…"}<span className="sr-only"> ({reason})</span></span>;
  }
  const view = tagCoverageView(counts ?? null);
  if (!view || view.kind === "no-chats") return <span title={t("tagNoChats")} className="text-[var(--app-text-secondary)]">—<span className="sr-only"> ({t("tagNoChats")})</span></span>;
  if (view.kind === "unread") return <span data-v2-tag-unread className="whitespace-nowrap text-xs text-[var(--app-text-secondary)]">{t("tagUnread")}</span>;
  return (
    <span className="block whitespace-nowrap" data-v2-tag-coverage>
      <StateValue state={view.tagged} format="percent" />
      <span className="block text-[11px] text-[var(--app-text-secondary)]">{t("readNamesFraction", { read: view.read.toLocaleString(languageLocale(language)), total: view.total.toLocaleString(languageLocale(language)) })}</span>
    </span>
  );
}

/** Drawer section: coverage of the store's month, and which tag types the names carry. */
export function TagCoverageDetail({ counts }: { counts: TagCoverageCounts | undefined }) {
  const { language } = useAppLanguage();
  const t = v2Text(language);
  const { tagCoverage } = useV2Month();
  const note = useTagCoverageNote();
  if (!tagCoverage.data) return <p className="text-xs text-[var(--app-text-secondary)]">{note ?? t("noTagData")}</p>;
  const view = tagCoverageView(counts ?? null);
  if (!view || view.kind === "no-chats") return <p className="text-xs text-[var(--app-text-secondary)]">{t("tagNoChats")}</p>;
  if (view.kind === "unread") {
    return (
      <>
        <p data-v2-tag-unread className="text-sm font-medium">{t("tagUnread")}</p>
        <p className="text-xs text-[var(--app-text-secondary)]">{t("unreadCustomerNames", { count: view.total.toLocaleString(languageLocale(language)), note: note ? ` · ${note}` : "" })}</p>
      </>
    );
  }
  return (
    <>
      <dl className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
          <dt className="text-[var(--app-text-secondary)]">{t("oneOrMoreTags")}</dt>
          <dd className="mt-1 text-lg font-semibold"><StateValue state={view.tagged} format="percent" /></dd>
          <dd className="text-[var(--app-text-secondary)]">{t("countOfNames", { count: counts!.tagged.toLocaleString(languageLocale(language)), total: view.read.toLocaleString(languageLocale(language)) })}</dd>
        </div>
        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
          <dt className="text-[var(--app-text-secondary)]">{t("withPurchaseMonth")}</dt>
          <dd className="mt-1 text-lg font-semibold"><StateValue state={view.withPeriod} format="percent" /></dd>
          <dd className="text-[var(--app-text-secondary)]">{t("countOfNames", { count: counts!.withPeriod.toLocaleString(languageLocale(language)), total: view.read.toLocaleString(languageLocale(language)) })}</dd>
        </div>
        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
          <dt className="text-[var(--app-text-secondary)]">{t("namesRead")}</dt>
          <dd className="mt-1 text-lg font-semibold"><StateValue state={rateState(view.read, view.total)} format="percent" /></dd>
          <dd className="text-[var(--app-text-secondary)]">{t("countOfChats", { count: view.read.toLocaleString(languageLocale(language)), total: view.total.toLocaleString(languageLocale(language)) })}</dd>
        </div>
      </dl>
      <table data-v2-tag-types className="mt-2 w-full text-left text-xs">
        <caption className="sr-only">{t("tagTypes")}</caption>
        <thead className="text-[11px] text-[var(--app-text-secondary)]">
          <tr className="border-b border-[var(--app-border)]">
            <th scope="col" className="px-3 py-1.5 font-medium">{t("tagTypes")}</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("tagCount")}</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("percentReadNames")}</th>
          </tr>
        </thead>
        <tbody>
          {TAG_TYPE_LABELS.map(([key]) => (
            <tr key={key}>
              <th scope="row" className="px-3 py-1 font-normal">{t(tagTypeKey(key))}</th>
              <td className="px-3 py-1 text-right tabular-nums">{counts!.byType[key].toLocaleString(languageLocale(language))}</td>
              <td className="px-3 py-1 text-right"><StateValue state={rateState(counts!.byType[key], view.read)} format="percent" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--app-text-secondary)]">{t("tagCoverageMethod", { note: note ? ` · ${note}` : "" })}</p>
    </>
  );
}
