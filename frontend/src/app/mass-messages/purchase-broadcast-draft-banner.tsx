"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MassMessageCampaignDetail } from "@/types/api";

export function PurchaseBroadcastDraftBanner() {
  const [draft, setDraft] = useState<MassMessageCampaignDetail | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listMassMessageCampaigns(50, 0)
      .then((result) => {
        if (!active) return;
        const latest = result.items.find(
          (item) => item.status === "DRAFT" && item.audienceType === "SELECTED_USERS",
        );
        setDraft(latest ?? null);
      })
      .catch(() => {
        if (active) setDraft(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!draft) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(390px,calc(100vw-2.5rem))] rounded-xl border border-emerald-200 bg-white p-4 shadow-xl dark:border-emerald-900 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          CRM
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Purchase Intelligence draft ready
          </p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {draft.title || "Purchase Intelligence Audience"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draft.estimatedRecipientCount.toLocaleString()} customers · {draft.storeCount.toLocaleString()} stores
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/mass-messages/drafts/${encodeURIComponent(draft.id)}`}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Compose draft
            </Link>
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              No message sent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
