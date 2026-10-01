"use client";

import { ListRowSkeleton } from "@/components/ui/list-row-skeleton";

function ConversationRow() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5 flex-1 pr-4">
          <div className="h-4 w-32 rounded bg-[var(--border)]"></div>
          <div className="h-3 w-20 rounded bg-[var(--border)] opacity-60"></div>
        </div>
        <div className="h-3 w-12 rounded bg-[var(--border)] opacity-50"></div>
      </div>
      <div className="h-3.5 w-3/4 rounded bg-[var(--border)] opacity-70"></div>
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-16 rounded-full bg-[var(--border)] opacity-60"></div>
        <div className="h-5 w-20 rounded-full bg-[var(--border)] opacity-60"></div>
        <div className="h-5 w-14 rounded-full bg-[var(--border)] opacity-60"></div>
      </div>
    </>
  );
}

export function ConversationRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <ListRowSkeleton
      count={count}
      listClassName="divide-y divide-[var(--border)] motion-safe:animate-pulse"
      rowClassName="p-4 space-y-3"
      renderRow={() => <ConversationRow />}
    />
  );
}
