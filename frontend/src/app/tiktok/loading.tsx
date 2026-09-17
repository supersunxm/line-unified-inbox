import { PageContainer } from "@/components/shell/page-container";

export default function TikTokLoading() {
  return (
    <PageContainer variant="wide">
      <div className="space-y-6 pb-8 animate-pulse">
        {/* Header skeleton */}
        <section className="rounded-[32px] bg-slate-950 px-6 py-8 sm:px-8 lg:px-10">
          <div className="h-3 w-40 rounded bg-white/10" />
          <div className="mt-4 h-10 w-64 rounded-lg bg-white/10" />
          <div className="mt-3 h-4 w-96 rounded bg-white/[0.06]" />
        </section>

        {/* Metric cards skeleton */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-4 h-8 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </section>

        {/* Table skeleton */}
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.7fr]">
          <div className="rounded-3xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800" />
                  <div className="flex-1">
                    <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-1 h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-black/[0.06] bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="flex-1">
                    <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-1 h-3 w-28 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-6 w-14 rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
