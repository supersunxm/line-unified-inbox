"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
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
    <div className="fixed bottom-5 right-5 z-40 w-[min(390px,calc(100vw-2.5rem))] rounded-[var(--app-radius-xl)] border border-[var(--app-accent)]/30 bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-elevated)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs">
          CRM
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--app-text-primary)]">
            Purchase Intelligence draft ready
          </p>
          <p className="mt-1 truncate text-xs text-[var(--app-text-secondary)]">
            {draft.title || "Purchase Intelligence Audience"}
          </p>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
            {draft.estimatedRecipientCount.toLocaleString()} customers · {draft.storeCount.toLocaleString()} stores
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link href={`/mass-messages/drafts/${encodeURIComponent(draft.id)}`}>
              <Button variant="primary" size="sm">
                Compose draft
              </Button>
            </Link>
            <span className="text-[11px] font-medium text-[var(--app-warning)]">
              No message sent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
