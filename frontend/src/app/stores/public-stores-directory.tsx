"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchPublicStores } from "@/lib/public-stores-api";
import {
  normalizePublicRegion,
  formatPublicRegion,
  matchesPublicRegion,
  getDeduplicatedPublicRegions,
} from "@/lib/public-regions";
import {
  type PublicStoreDto,
} from "@/lib/public-stores-api";

export function PublicStoresDirectory() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [stores, setStores] = useState<PublicStoreDto[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and filter states initialized from URL params if present
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [selectedRegion, setSelectedRegion] = useState(() => searchParams.get("region") ?? "ALL");
  const [selectedProvince, setSelectedProvince] = useState(() => searchParams.get("province") ?? "ALL");

  // Sync URL search parameters when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    if (selectedRegion && selectedRegion !== "ALL") {
      params.set("region", selectedRegion);
    }
    if (selectedProvince && selectedProvince !== "ALL") {
      params.set("province", selectedProvince);
    }
    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState(null, "", newUrl);
  }, [searchQuery, selectedRegion, selectedProvince, pathname]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPublicStores()
      .then((res) => {
        if (cancelled) return;
        setStores(res.stores);
        setProvinces(res.filters.provinces);
        setRegions(res.filters.regions);
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
  }, []);

  // Deduplicate and order public region labels
  const displayRegions = useMemo(() => getDeduplicatedPublicRegions(regions), [regions]);

  // Filter stores locally for instant responsiveness
  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return stores.filter((store) => {
      // Region match (supports Thai canonical labels and raw English legacy values)
      if (selectedRegion !== "ALL") {
        if (!matchesPublicRegion(store.region, selectedRegion)) {
          return false;
        }
      }

      // Province match
      if (selectedProvince !== "ALL") {
        if (
          !store.province ||
          store.province.toLowerCase() !== selectedProvince.toLowerCase()
        ) {
          return false;
        }
      }

      // Search query match (supports name, province, raw region, Thai normalized region, ID)
      if (q) {
        const matchName = store.name.toLowerCase().includes(q);
        const matchProvince = (store.province ?? "").toLowerCase().includes(q);
        const matchRegion =
          (store.region ?? "").toLowerCase().includes(q) ||
          formatPublicRegion(store.region).toLowerCase().includes(q);
        const matchId = store.id.toLowerCase().includes(q);

        if (!matchName && !matchProvince && !matchRegion && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [stores, searchQuery, selectedRegion, selectedProvince]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedRegion("ALL");
    setSelectedProvince("ALL");
    window.history.replaceState(null, "", pathname);
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)] antialiased flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="OPPO Brand Shop Home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white shadow-sm">
              O
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight sm:text-base leading-tight">
                OPPO Brand Shop
              </span>
              <span className="text-[11px] font-medium text-[var(--app-text-secondary)]">
                ค้นหาสาขา & ช่องทางติดต่อ
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main Navigation">
            <Link
              href="/"
              className="text-xs sm:text-sm font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] transition"
            >
              หน้าแรก
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)] whitespace-nowrap"
            >
              <span className="sm:hidden">สำหรับพนักงาน</span>
              <span className="hidden sm:inline">เข้าสู่ระบบสำหรับพนักงาน</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero & Search Section */}
      <section className="border-b border-[var(--app-border)] bg-[var(--app-surface)] py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-accent)] mb-3">
            ค้นหาสาขาใกล้บ้านคุณ
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl text-[var(--app-text-primary)]">
            ค้นหา OPPO Brand Shop
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--app-text-secondary)]">
            ค้นหาร้านและช่องทางติดต่อของสาขาใกล้คุณ ติดต่อผ่าน LINE OA หรือดู TikTok ทางการ
          </p>

          {/* Search Input */}
          <div className="mt-6 relative max-w-2xl mx-auto">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--app-text-tertiary)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อร้าน, ห้างสรรพสินค้า, สาขา หรือจังหวัด..."
              className="w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] py-3.5 pl-11 pr-10 text-sm placeholder-[var(--app-text-tertiary)] shadow-sm focus:border-[var(--app-accent)] focus:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/20 transition"
              aria-label="ค้นหาชื่อร้านหรือจังหวัด"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)]"
                aria-label="ล้างการค้นหา"
              >
                ✕
              </button>
            )}
          </div>

          {/* Region & Province Filter Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedRegion("ALL")}
              className={`inline-flex items-center justify-center min-h-[38px] rounded-full px-4 py-2 font-medium transition ${
                selectedRegion === "ALL"
                  ? "bg-[var(--app-accent)] text-white shadow-sm"
                  : "bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              }`}
            >
              ทุกภูมิภาค
            </button>
            {displayRegions.map((region) => {
              const isActive =
                selectedRegion !== "ALL" &&
                normalizePublicRegion(selectedRegion) === region;

              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={`inline-flex items-center justify-center min-h-[38px] rounded-full px-4 py-2 font-medium transition ${
                    isActive
                      ? "bg-[var(--app-accent)] text-white shadow-sm"
                      : "bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  {region}
                </button>
              );
            })}

            {/* Province Selector */}
            {provinces.length > 0 && (
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="min-h-[38px] rounded-full border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs text-[var(--app-text-primary)] font-medium focus:border-[var(--app-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--app-accent)]"
                aria-label="เลือกจังหวัด"
              >
                <option value="ALL">เลือกจังหวัด (ทั้งหมด)</option>
                {provinces.map((prov) => (
                  <option key={prov} value={prov}>
                    {prov}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {/* Results Main Content */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Status Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--app-text-primary)]">
              รายชื่อสาขา OPPO Brand Shop
            </h2>
            <span className="text-xs font-medium text-[var(--app-text-secondary)]">
              {loading
                ? "กำลังโหลดข้อมูล..."
                : `พบ ${filteredStores.length.toLocaleString()} สาขา`}
            </span>
          </div>

          {/* Error State */}
          {error && (
            <div className="rounded-2xl border border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] p-6 text-center">
              <p className="text-sm font-semibold text-[var(--app-danger)]">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-white"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && !error && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 animate-pulse"
                >
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
                  <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          )}

          {/* Empty Results State */}
          {!loading && !error && filteredStores.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] p-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-2xl">
                🔍
              </div>
              <h3 className="text-base font-bold text-[var(--app-text-primary)]">
                ไม่พบสาขาที่ตรงกับเงื่อนไขการค้นหา
              </h3>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                ลองตรวจสอบตัวสะกด หรือปรับเปลี่ยนเงื่อนไขภูมิภาค/จังหวัด
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center rounded-xl bg-[var(--app-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--app-accent-hover)]"
              >
                ล้างเงื่อนไขการค้นหา
              </button>
            </div>
          )}

          {/* Store Cards Grid */}
          {!loading && !error && filteredStores.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStores.map((store) => {
                const storeDetailUrl = `/stores/${store.slug || store.id}`;

                return (
                  <article
                    key={store.id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm transition hover:shadow-md hover:border-[var(--app-accent)]/40"
                  >
                    <div>
                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                        {store.province && (
                          <span className="inline-flex items-center rounded-md bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-text-secondary)]">
                            📍 {store.province}
                          </span>
                        )}
                        {store.region && (
                          <span className="inline-flex items-center rounded-md bg-[var(--app-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-accent)]">
                            {formatPublicRegion(store.region)}
                          </span>
                        )}
                      </div>

                      {/* Store Name */}
                      <h3 className="text-base font-bold text-[var(--app-text-primary)] line-clamp-2 leading-snug">
                        <Link href={storeDetailUrl} className="hover:text-[var(--app-accent)] transition">
                          {store.name}
                        </Link>
                      </h3>

                      {/* Address preview */}
                      <p className="mt-2 text-xs text-[var(--app-text-tertiary)] line-clamp-2 leading-relaxed">
                        {store.location.addressPreview}
                      </p>
                    </div>

                    {/* Social & Contact Actions */}
                    <div className="mt-5 pt-4 border-t border-[var(--app-border-subtle)] space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {/* LINE OA Button */}
                        {store.line?.url && (
                          <a
                            href={store.line.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#06C755] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105"
                            aria-label={`แอด LINE ${store.name}`}
                          >
                            <span>LINE</span>
                          </a>
                        )}

                        {/* TikTok Button */}
                        {store.tiktok?.profileUrl && (
                          <a
                            href={store.tiktok.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                            aria-label={`เปิด TikTok ${store.name}`}
                          >
                            <span>TikTok</span>
                          </a>
                        )}

                        {/* Google Maps Button */}
                        {store.location.mapsUrl && (
                          <a
                            href={store.location.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-2 text-xs font-medium text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-hover)]"
                            aria-label={`เปิดแผนที่ Google Maps ${store.name}`}
                            title="เปิดแผนที่ Google Maps"
                          >
                            🗺️
                          </a>
                        )}
                      </div>

                      {/* Store Profile Link */}
                      <Link
                        href={storeDetailUrl}
                        className="block w-full text-center rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] py-2 text-xs font-semibold text-[var(--app-text-primary)] transition hover:bg-[var(--app-surface-hover)]"
                      >
                        ดูรายละเอียดร้าน →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[var(--app-border)] bg-[var(--app-surface)] py-6 text-center text-xs text-[var(--app-text-tertiary)]">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} OPPO Brand Shop Directory · Thailand</p>
          <div className="flex items-center gap-4">
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
