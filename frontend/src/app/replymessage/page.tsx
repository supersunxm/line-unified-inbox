"use client";

import Link from "next/link";
import { AuthorizedSection } from "../authorized-workspace";
import { Store24hResponsePanel } from "../dashboard/store-24h-response-panel";

export default function ReplyMessagePage() {
  return (
    <AuthorizedSection section="dashboard">
      <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-secondary)]">
                OPPO LINE OA · การตอบกลับข้อความ
              </div>
              <h1 className="mt-1 text-2xl font-bold">อัตราตอบกลับภายใน 24 ชั่วโมง</h1>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                ตรวจสอบ SLA การตอบกลับของแต่ละร้านตามช่วงเวลาที่เลือก
              </p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-semibold hover:bg-[var(--app-surface-secondary)]"
            >
              กลับแดชบอร์ด
            </Link>
          </div>

          <Store24hResponsePanel
            getStoreDisplayName={(name) => name}
            onOpenStore={(storeId) => {
              window.location.href = `/chats?store=${encodeURIComponent(storeId)}`;
            }}
          />
        </div>
      </main>
    </AuthorizedSection>
  );
}
