"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPublicStoreByIdentifier,
  type PublicStoreDto,
} from "@/lib/public-stores-api";
import { formatPublicRegion } from "@/lib/public-regions";

interface Props {
  identifier: string;
  initialStore?: PublicStoreDto | null;
}

export function PublicStoreProfile({ identifier, initialStore }: Props) {
  const [store, setStore] = useState<PublicStoreDto | null>(initialStore ?? null);
  const [loading, setLoading] = useState(!initialStore);
  const [copiedLineId, setCopiedLineId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStore) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPublicStoreByIdentifier(identifier)
      .then((res) => {
        if (cancelled) return;
        setStore(res);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดข้อมูลร้านค้า");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [identifier, initialStore]);

  const copyLineId = async (basicId: string) => {
    try {
      await navigator.clipboard.writeText(basicId);
      setCopiedLineId(true);
      setTimeout(() => setCopiedLineId(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)] antialiased flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 transition hover:opacity-90"
              aria-label="OPPO Brand Shop Home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-accent)] text-xs font-bold text-white">
                O
              </span>
              <span className="text-xs sm:text-sm font-bold tracking-tight">
                OPPO Brand Shop
              </span>
            </Link>
            <span className="text-[var(--app-border)]">|</span>
            <Link
              href="/stores"
              className="text-xs font-semibold text-[var(--app-accent)] hover:underline"
            >
              ← สาขาทั้งหมด
            </Link>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] whitespace-nowrap"
          >
            <span className="sm:hidden">สำหรับพนักงาน</span>
            <span className="hidden sm:inline">เข้าสู่ระบบสำหรับพนักงาน</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {/* Loading state */}
          {loading && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-sm animate-pulse space-y-4">
              <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-xl mt-6" />
            </div>
          )}

          {/* Not Found State */}
          {!loading && (!store || error) && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-2xl">
                🏪
              </div>
              <h1 className="text-xl font-bold text-[var(--app-text-primary)]">
                ไม่พบข้อมูลร้านค้าที่ระบุ
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-[var(--app-text-secondary)] max-w-md mx-auto">
                สาขาที่คุณกำลังค้นหาอาจมีการปรับปรุงข้อมูล หรือไม่เปิดให้บริการในระบบขณะนี้
              </p>
              <Link
                href="/stores"
                className="mt-6 inline-flex items-center rounded-xl bg-[var(--app-accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--app-accent-hover)]"
              >
                ← กลับไปยังหน้ารวมร้านค้า
              </Link>
            </div>
          )}

          {/* Store Profile Card */}
          {!loading && store && (
            <div className="space-y-6">
              {/* Identity Header Card */}
              <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 sm:p-8 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {store.province && (
                    <span className="inline-flex items-center rounded-md bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--app-text-secondary)]">
                      📍 {store.province}
                    </span>
                  )}
                  {store.region && (
                    <span className="inline-flex items-center rounded-md bg-[var(--app-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-accent)]">
                      {formatPublicRegion(store.region)}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-[var(--app-text-primary)]">
                  {store.name}
                </h1>

                <div className="mt-4 pt-4 border-t border-[var(--app-border-subtle)] text-xs text-[var(--app-text-secondary)] leading-relaxed">
                  <p>
                    <strong className="text-[var(--app-text-primary)]">ที่อยู่ / ทำเล:</strong>{" "}
                    {store.location.addressPreview}
                  </p>
                </div>
              </section>

              {/* Direct Channels Grid */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* LINE OA Channel */}
                <section className="flex flex-col justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#06C755] text-xs font-bold text-white">
                        L
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-[var(--app-text-primary)]">
                          LINE Official Account
                        </h2>
                        <span className="text-[11px] text-[var(--app-text-secondary)]">
                          สอบถามข้อมูล ซื้อสินค้า ปรึกษาพนักงาน
                        </span>
                      </div>
                    </div>

                    {store.line?.basicId && (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--app-surface-subtle)] p-3 border border-[var(--app-border-subtle)]">
                        <div>
                          <div className="text-[10px] text-[var(--app-text-tertiary)] uppercase tracking-wider">
                            LINE ID
                          </div>
                          <div className="text-xs font-mono font-bold text-[var(--app-text-primary)]">
                            {store.line.basicId}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyLineId(store.line!.basicId!)}
                          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)]"
                        >
                          {copiedLineId ? "คัดลอกแล้ว ✓" : "คัดลอก"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    {store.line?.url ? (
                      <a
                        href={store.line.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
                      >
                        ติดต่อร้านผ่าน LINE
                      </a>
                    ) : (
                      <div className="rounded-xl bg-[var(--app-surface-subtle)] py-3 text-center text-xs text-[var(--app-text-tertiary)]">
                        ยังไม่มีช่องทาง LINE ในขณะนี้
                      </div>
                    )}
                  </div>
                </section>

                {/* TikTok Channel */}
                <section className="flex flex-col justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
                  <div>
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                        TT
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-[var(--app-text-primary)]">
                          TikTok Official
                        </h2>
                        <span className="text-[11px] text-[var(--app-text-secondary)]">
                          ชมคลิปโปรโมชั่น รีวิวมือถือรุ่นใหม่
                        </span>
                      </div>
                    </div>

                    {store.tiktok?.username && (
                      <div className="mt-3 rounded-xl bg-[var(--app-surface-subtle)] p-3 border border-[var(--app-border-subtle)]">
                        <div className="text-[10px] text-[var(--app-text-tertiary)] uppercase tracking-wider">
                          บัญชีทางการ
                        </div>
                        <div className="text-xs font-semibold text-[var(--app-text-primary)] truncate">
                          @{store.tiktok.username}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    {store.tiktok?.profileUrl ? (
                      <a
                        href={store.tiktok.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
                      >
                        เปิด TikTok Profile
                      </a>
                    ) : (
                      <div className="rounded-xl bg-[var(--app-surface-subtle)] py-3 text-center text-xs text-[var(--app-text-tertiary)]">
                        ยังไม่มีช่องทาง TikTok ในขณะนี้
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Map & Location Card */}
              {store.location.mapsUrl && (
                <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-lg">
                      🗺️
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--app-text-primary)]">
                        แผนที่ Google Maps
                      </h2>
                      <p className="text-xs text-[var(--app-text-secondary)]">
                        เปิดแผนที่เพื่อดูเส้นทางและนำทางไปยังสาขา
                      </p>
                    </div>
                  </div>

                  <a
                    href={store.location.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--app-text-primary)] transition hover:bg-[var(--app-surface-hover)]"
                  >
                    เปิดใน Google Maps ↗
                  </a>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[var(--app-border)] bg-[var(--app-surface)] py-6 text-center text-xs text-[var(--app-text-tertiary)]">
        <div className="mx-auto max-w-4xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} OPPO Brand Shop Directory · Thailand</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:underline">
              หน้าแรก
            </Link>
            <Link href="/stores" className="hover:underline">
              หน้ารวมร้านค้า
            </Link>
            <Link href="/privacy" className="hover:underline">
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/terms" className="hover:underline">
              ข้อกำหนดการใช้งาน
            </Link>
            <Link href="/login" className="hover:underline">
              สำหรับพนักงาน
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
