"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { MassMessageCampaignDetail } from "@/types/api";
import { pickLanguageText, useAppLanguage } from "../language";

export function PurchaseBroadcastDraftBanner() {
  const { language } = useAppLanguage();
  const [draft, setDraft] = useState<MassMessageCampaignDetail | null>(null);
  const locale = language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US";
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const text = pickLanguageText(language, {
    th: { ready: "Draft จาก Purchase Intelligence พร้อมแล้ว", fallback: "กลุ่มลูกค้า Purchase Intelligence", customers: "ลูกค้า", stores: "ร้าน", compose: "เขียนข้อความใน Draft", unsent: "ยังไม่มีการส่งข้อความ" },
    en: { ready: "Purchase Intelligence draft ready", fallback: "Purchase Intelligence Audience", customers: "customers", stores: "stores", compose: "Compose draft", unsent: "No message sent" },
    zh: { ready: "Purchase Intelligence 草稿已准备好", fallback: "Purchase Intelligence 客群", customers: "位客户", stores: "家门店", compose: "编辑草稿", unsent: "尚未发送消息" },
  });

  useEffect(() => {
    let active = true;
    api.listMassMessageCampaigns(50, 0).then((result) => {
      if (!active) return;
      const latest = result.items.find((item) => item.status === "DRAFT" && item.audienceType === "SELECTED_USERS");
      setDraft(latest ?? null);
    }).catch(() => { if (active) setDraft(null); });
    return () => { active = false; };
  }, []);

  if (!draft) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(390px,calc(100vw-2.5rem))] rounded-[var(--app-radius-xl)] border border-[var(--app-accent)]/30 bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-elevated)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs">CRM</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--app-text-primary)]">{text.ready}</p>
          <p className="mt-1 truncate text-xs text-[var(--app-text-secondary)]">{draft.title || text.fallback}</p>
          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{nf.format(draft.estimatedRecipientCount)} {text.customers} · {nf.format(draft.storeCount)} {text.stores}</p>
          <div className="mt-3 flex items-center gap-2">
            <Link href={`/mass-messages/drafts/${encodeURIComponent(draft.id)}`}><Button variant="primary" size="sm">{text.compose}</Button></Link>
            <span className="text-[11px] font-medium text-[var(--app-warning)]">{text.unsent}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
