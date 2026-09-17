import { PageContainer } from "@/components/shell/page-container";

export default function TikTokStoreLoading() {
  return (
    <PageContainer variant="wide">
      <div className="space-y-6 pb-8 animate-pulse">
        {/* Back link skeleton */}
        <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700" />

        {/* Header skeleton */}
        <div>
          <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-4 w-48 rounded bg-slate-100 dark:bg-slate-800" />
        </div>

        {/* Profile section skeleton */}
        <div className="flex flex-col gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-10 w-36 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* 4 metric cards skeleton */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-7 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </section>

        {/* 3 growth cards skeleton */}
        <section className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-6 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-3 w-12 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </section>

        {/* Sparkline chart skeleton */}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900">
          <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-6 h-56 rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    </PageContainer>
  );
}
