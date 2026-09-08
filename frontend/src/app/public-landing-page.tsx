"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchPublicStores, type PublicStoreDto } from "@/lib/public-stores-api";

export function PublicLandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredStores, setFeaturedStores] = useState<PublicStoreDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPublicStores({ limit: 6 })
      .then((res) => {
        if (cancelled) return;
        setFeaturedStores(res.stores);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      router.push(`/stores?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/stores");
    }
  };

  const quickRegions = [
    { label: "กรุงเทพมหานคร", query: "province=Bangkok" },
    { label: "ภาคกลาง", query: "region=Central" },
    { label: "ภาคเหนือ", query: "region=Northern" },
    { label: "ภาคตะวันออกเฉียงเหนือ", query: "region=Northeastern" },
    { label: "ภาคใต้", query: "region=Southern" },
    { label: "ภาคตะวันออก", query: "region=Eastern" },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)] antialiased flex flex-col selection:bg-[var(--app-accent-soft)] selection:text-[var(--app-accent)]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 transition hover:opacity-90"
            aria-label="OPPO Brand Shop Home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white shadow-sm">
              O
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight sm:text-base leading-none">
                OPPO Brand Shop
              </span>
              <span className="text-[11px] font-medium text-[var(--app-text-secondary)] mt-0.5">
                ค้นหาสาขา & ช่องทางติดต่อ
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Customer Navigation">
            <Link
              href="/stores"
              className="text-xs sm:text-sm font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] transition"
            >
              ค้นหาร้าน
            </Link>
            <Link
              href="/stores"
              className="hidden sm:inline-block text-xs sm:text-sm font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] transition"
            >
              ติดต่อสาขา
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3.5 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] transition hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
            >
              เข้าสู่ระบบสำหรับพนักงาน
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[var(--app-border)] bg-[var(--app-surface)] py-14 sm:py-24">
        {/* Subtle decorative background gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,166,81,0.12),transparent)]"
        />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--app-accent-soft)] px-3.5 py-1 text-xs font-semibold text-[var(--app-accent)] mb-4">
            <span>✨</span> บริการค้นหาข้อมูลร้านค้าอย่างเป็นทางการ
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-[var(--app-text-primary)] leading-tight">
            ค้นหา OPPO Brand Shop ใกล้คุณ
          </h1>
          <p className="mt-4 text-sm sm:text-lg text-[var(--app-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            ค้นหาสาขา ช่องทางติดต่อ LINE OA, TikTok และข้อมูลร้าน OPPO Brand Shop ทั่วประเทศไทย
          </p>

          {/* Quick Search Entry Box */}
          <form onSubmit={handleSearchSubmit} className="mt-8 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-2 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-2 shadow-sm focus-within:border-[var(--app-accent)] focus-within:ring-2 focus-within:ring-[var(--app-accent)]/20 transition">
              <div className="flex flex-1 items-center w-full px-3">
                <svg
                  className="h-5 w-5 text-[var(--app-text-tertiary)] shrink-0 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="พิมพ์ชื่อสาขา, ห้างสรรพสินค้า หรือจังหวัด เช่น สยามพารากอน, เชียงใหม่..."
                  className="w-full bg-transparent text-sm text-[var(--app-text-primary)] placeholder-[var(--app-text-tertiary)] focus:outline-none py-1.5"
                  aria-label="ค้นหาชื่อสาขาหรือจังหวัด"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[var(--app-accent)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--app-accent-hover)] shrink-0"
              >
                ค้นหาร้าน
              </button>
            </div>
          </form>

          {/* Quick CTAs & Region Entry */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/stores"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--app-accent)] hover:underline"
            >
              ดูสาขาทั้งหมด 158 สาขา →
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-[var(--app-text-tertiary)] font-medium mr-1">ค้นหาตามภูมิภาค:</span>
            {quickRegions.map((reg) => (
              <Link
                key={reg.label}
                href={`/stores?${reg.query}`}
                className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-1 font-medium text-[var(--app-text-secondary)] transition hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
              >
                {reg.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Use the Directory */}
      <section className="py-14 sm:py-20 border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xl font-bold sm:text-2xl text-[var(--app-text-primary)]">
              บริการสำหรับลูกค้า OPPO
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[var(--app-text-secondary)]">
              รวมทุกช่องทางการติดต่อและข้อมูลของ OPPO Brand Shop ไว้ในที่เดียว
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-xl mb-4">
                📍
              </div>
              <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                ค้นหาสาขาใกล้คุณ
              </h3>
              <p className="mt-2 text-xs text-[var(--app-text-secondary)] leading-relaxed">
                ค้นหา OPPO Brand Shop ตามชื่อห้างสรรพสินค้า จังหวัด หรือภูมิภาคได้อย่างรวดเร็ว
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#06C755]/10 text-xl mb-4">
                💬
              </div>
              <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                ติดต่อร้านผ่าน LINE
              </h3>
              <p className="mt-2 text-xs text-[var(--app-text-secondary)] leading-relaxed">
                เชื่อมต่อกับ LINE Official Account ของสาขาโดยตรงเพื่อสอบถามสินค้า โปรโมชั่น และสต็อก
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/10 dark:bg-white/10 text-xl mb-4">
                📱
              </div>
              <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                ดู TikTok ของสาขา
              </h3>
              <p className="mt-2 text-xs text-[var(--app-text-secondary)] leading-relaxed">
                ติดตามคลิปแกะกล่อง โปรโมชั่นประจำสาขา และรีวิวฟังก์ชันมือถือจากผู้เชี่ยวชาญ
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-xl mb-4">
                🗺️
              </div>
              <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                เปิดเส้นทาง Google Maps
              </h3>
              <p className="mt-2 text-xs text-[var(--app-text-secondary)] leading-relaxed">
                กดดูแผนที่เพื่อนำทางไปยังหน้าร้านจริงได้อย่างสะดวก พร้อมตำแหน่งและชั้นที่ตั้ง
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Stores Preview */}
      <section className="py-14 sm:py-20 bg-[var(--app-surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl text-[var(--app-text-primary)]">
                สาขา OPPO Brand Shop แนะนำ
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--app-text-secondary)]">
                สำรวจสาขายอดนิยมพร้อมช่องทางติดต่อ
              </p>
            </div>
            <Link
              href="/stores"
              className="text-xs sm:text-sm font-semibold text-[var(--app-accent)] hover:underline"
            >
              ดูทั้งหมด →
            </Link>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--app-border)] p-5 animate-pulse"
                >
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
                  <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredStores.map((store) => (
                <article
                  key={store.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm transition hover:shadow-md hover:border-[var(--app-accent)]/40"
                >
                  <div>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      {store.province && (
                        <span className="inline-flex items-center rounded-md bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-text-secondary)]">
                          📍 {store.province}
                        </span>
                      )}
                      {store.region && (
                        <span className="inline-flex items-center rounded-md bg-[var(--app-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-accent)]">
                          {store.region}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[var(--app-text-primary)] line-clamp-2">
                      <Link href={`/stores/${store.slug || store.id}`} className="hover:text-[var(--app-accent)] transition">
                        {store.name}
                      </Link>
                    </h3>
                    <p className="mt-2 text-xs text-[var(--app-text-tertiary)] line-clamp-2 leading-relaxed">
                      {store.location.addressPreview}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[var(--app-border-subtle)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {store.line?.url && (
                        <a
                          href={store.line.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg bg-[#06C755] px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          LINE
                        </a>
                      )}
                      {store.tiktok?.profileUrl && (
                        <a
                          href={store.tiktok.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          TikTok
                        </a>
                      )}
                    </div>
                    <Link
                      href={`/stores/${store.slug || store.id}`}
                      className="text-xs font-semibold text-[var(--app-accent)] hover:underline"
                    >
                      ดูข้อมูลร้าน →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--app-border)] bg-[var(--app-surface-subtle)] py-8 text-xs text-[var(--app-text-secondary)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-accent)] text-xs font-bold text-white">
                O
              </span>
              <span className="font-semibold text-[var(--app-text-primary)]">
                OPPO Brand Shop Store Directory
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-4 text-xs" aria-label="Footer navigation">
              <Link href="/stores" className="hover:text-[var(--app-accent)] transition">
                ค้นหาร้าน
              </Link>
              <Link href="/privacy" className="hover:text-[var(--app-accent)] transition">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-[var(--app-accent)] transition">
                Terms
              </Link>
              <Link href="/login" className="hover:text-[var(--app-accent)] transition">
                เข้าสู่ระบบสำหรับพนักงาน
              </Link>
            </nav>
          </div>
          <div className="mt-4 pt-4 border-t border-[var(--app-border)] text-center sm:text-left text-[11px] text-[var(--app-text-tertiary)] flex flex-col sm:flex-row justify-between items-center gap-2">
            <p>© {new Date().getFullYear()} OPPO Brand Shop Directory · lineoppo.click</p>
            <p>ข้อมูลสาขาและช่องทางติดต่ออย่างเป็นทางการสำหรับผู้ใช้บริการในประเทศไทย</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
