"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPublicStores,
  type PublicStoreDto,
} from "@/lib/public-stores-api";
import {
  getStoreLocatorProvinces,
  getStoreLocatorRegion,
  getStoreLocatorRegionCount,
  getStoreLocatorRegions,
  getSafeStoreLocatorLineUrl,
  matchesStoreLocatorQuery,
  STORE_LOCATOR_REGION_ORDER,
} from "./store-locator-utils";
import { trackStoreLocatorEvent } from "./store-locator-analytics";

const STEPS = ["ภูมิภาค", "จังหวัด", "สาขา"] as const;

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
    </svg>
  );
}

function LineIcon() {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-black">
      LINE
    </span>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol className="mx-auto flex max-w-md items-start justify-between" aria-label="ขั้นตอนค้นหาสาขา">
      {STEPS.map((step, index) => {
        const stepNumber = index + 1;
        const completed = stepNumber < currentStep;
        const active = stepNumber === currentStep;

        return (
          <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-4 h-px w-full ${completed ? "bg-[var(--app-accent)]" : "bg-[var(--app-border)]"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                active || completed
                  ? "bg-[var(--app-accent)] text-white"
                  : "border border-[var(--app-border-strong)] bg-[var(--app-surface)] text-[var(--app-text-tertiary)]"
              }`}
            >
              {completed ? "✓" : stepNumber}
            </span>
            <span className={`text-[11px] font-semibold ${active ? "text-[var(--app-accent)]" : "text-[var(--app-text-secondary)]"}`}>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3" role="status" aria-label="กำลังโหลดข้อมูลสาขา" aria-busy="true">
      <span className="sr-only">กำลังโหลดข้อมูลสาขา</span>
      {["w-5/6", "w-full", "w-4/5"].map((width) => (
        <div key={width} className="h-[76px] animate-pulse rounded-2xl bg-[var(--app-surface)] shadow-[var(--app-shadow-card)]">
          <div className={`m-4 h-4 ${width} rounded bg-[var(--app-border-subtle)]`} />
          <div className="mx-4 h-3 w-1/3 rounded bg-[var(--app-border-subtle)]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)] px-5 py-10 text-center" role="status">
      <div aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-surface-subtle)] text-2xl">⌕</div>
      <p className="text-sm font-bold text-[var(--app-text-primary)]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-secondary)]">{description}</p>
    </div>
  );
}

function StoreCard({ store, onLineOaClick }: { store: PublicStoreDto; onLineOaClick: (store: PublicStoreDto) => void }) {
  const region = getStoreLocatorRegion(store.region);
  const lineUrl = getSafeStoreLocatorLineUrl(store.line?.url);

  return (
    <article className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-xl">
          🏪
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-[var(--app-text-primary)] sm:text-lg">
            {store.name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-relaxed text-[var(--app-text-secondary)]">
            {store.province && <span>📍 {store.province}</span>}
            {region && <span>{region}</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {lineUrl ? (
          <a
            href={lineUrl}
            onClick={() => onLineOaClick(store)}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[var(--app-accent-hover)] active:scale-[0.99]"
            rel="noopener noreferrer"
            aria-label={`แชทกับ ${store.name} ใน LINE`}
            data-testid="store-locator-line-cta"
          >
            <LineIcon />
            <span>แชทกับสาขานี้ใน LINE</span>
            <span aria-hidden="true" className="text-base">↗</span>
          </a>
        ) : (
          <div className="flex min-h-[54px] w-full items-center justify-center rounded-xl bg-[var(--disabled-background)] px-4 py-3 text-center text-sm font-semibold text-[var(--app-text-tertiary)]">
            ยังไม่มีช่องทาง LINE ของสาขานี้
          </div>
        )}

        {store.location.mapsUrl && (
          <a
            href={store.location.mapsUrl}
            className="flex min-h-[42px] items-center justify-center rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-hover)]"
            rel="noopener noreferrer"
            target="_blank"
          >
            ดูแผนที่สาขา
          </a>
        )}
      </div>
    </article>
  );
}

export function StoreLocatorApp() {
  const [stores, setStores] = useState<PublicStoreDto[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const hasTrackedOpen = useRef(false);

  useEffect(() => {
    if (hasTrackedOpen.current) return;
    hasTrackedOpen.current = true;
    trackStoreLocatorEvent("store_locator_open");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicStores({}, { signal: controller.signal })
      .then((response) => setStores(response.stores))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [reloadVersion]);

  const availableRegions = useMemo(() => getStoreLocatorRegions(stores), [stores]);
  const provinces = useMemo(
    () => (selectedRegion ? getStoreLocatorProvinces(stores, selectedRegion) : []),
    [selectedRegion, stores],
  );
  const currentStep = selectedProvince ? 3 : selectedRegion ? 2 : 1;
  const hasSearch = searchQuery.trim().length > 0;

  const searchResults = useMemo(() => {
    const scope = stores.filter((store) => {
      if (selectedRegion && getStoreLocatorRegion(store.region) !== selectedRegion) return false;
      if (selectedProvince && store.province?.trim() !== selectedProvince) return false;
      return true;
    });

    return scope.filter((store) => matchesStoreLocatorQuery(store, searchQuery));
  }, [searchQuery, selectedProvince, selectedRegion, stores]);

  const selectRegion = (region: string) => {
    trackStoreLocatorEvent("region_selected", { region });
    setSelectedRegion(region);
    setSelectedProvince(null);
    setSearchQuery("");
  };

  const selectProvince = (province: string) => {
    trackStoreLocatorEvent("province_selected", { region: selectedRegion ?? undefined, province });
    setSelectedProvince(province);
    setSearchQuery("");
  };

  const resetLocator = () => {
    setSelectedRegion(null);
    setSelectedProvince(null);
    setSearchQuery("");
  };

  const retryLoading = () => {
    setLoading(true);
    setError(null);
    setReloadVersion((version) => version + 1);
  };

  const selectStore = (store: PublicStoreDto) => {
    const details = {
      region: getStoreLocatorRegion(store.region) ?? undefined,
      province: store.province ?? undefined,
      storeName: store.name,
    };
    trackStoreLocatorEvent("store_selected", details);
    trackStoreLocatorEvent("line_oa_clicked", details);
  };

  const showSearchResults = hasSearch;
  const showRegions = !showSearchResults && !selectedRegion;
  const showProvinces = !showSearchResults && Boolean(selectedRegion) && !selectedProvince;
  const showStores = !showSearchResults && Boolean(selectedProvince);

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)] antialiased">
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex min-h-[64px] max-w-xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="OPPO Brand Shop Home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white shadow-sm">O</span>
            <div>
              <p className="text-sm font-bold leading-tight">OPPO Brand Shop</p>
              <p className="text-[11px] text-[var(--app-text-secondary)]">ค้นหาสาขาใกล้คุณ</p>
            </div>
          </Link>
          {selectedRegion && (
            <button
              type="button"
              onClick={resetLocator}
              className="min-h-[42px] rounded-xl px-3 text-xs font-semibold text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]"
            >
              เปลี่ยนภูมิภาค
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        <section className="rounded-3xl bg-[var(--app-accent)] px-5 py-6 text-white shadow-[var(--app-shadow-elevated)] sm:px-7">
          <p className="text-xs font-semibold text-white/80">LINE Official Account ของ OPPO Main</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">ค้นหาสาขา OPPO</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/90">เลือกสาขาที่ต้องการ แล้วแชทกับสาขานั้นได้ทันที</p>
        </section>

        <section className="mt-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
          <label htmlFor="store-locator-search" className="text-sm font-bold text-[var(--app-text-primary)]">
            ค้นหาสาขา
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--app-text-tertiary)]"><SearchIcon /></span>
            <input
              id="store-locator-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ค้นหาจังหวัด ชื่อร้าน หรือชื่อห้าง"
              className="min-h-[52px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-11 pr-10 text-sm placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/20"
              aria-describedby="store-locator-search-help"
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 min-w-[44px] px-3 text-lg text-[var(--app-text-tertiary)]"
                aria-label="ล้างคำค้นหา"
              >
                ×
              </button>
            )}
          </div>
          <p id="store-locator-search-help" className="mt-2 text-[11px] text-[var(--app-text-tertiary)]">ค้นหาได้จากจังหวัด ชื่อสาขา หรือชื่อห้าง/ทำเลที่อยู่ในชื่อสาขา</p>
        </section>

        <section className="mt-6 px-1">
          <StepIndicator currentStep={currentStep} />
        </section>

        {selectedRegion && !hasSearch && (
          <div className="mt-6 flex items-center gap-2 text-xs">
            <button type="button" onClick={resetLocator} className="min-h-[40px] font-semibold text-[var(--app-accent)]">ภูมิภาคทั้งหมด</button>
            <span aria-hidden="true" className="text-[var(--app-text-tertiary)]">›</span>
            <button
              type="button"
              onClick={() => setSelectedProvince(null)}
              className={`min-h-[40px] font-semibold ${selectedProvince ? "text-[var(--app-accent)]" : "text-[var(--app-text-primary)]"}`}
            >
              {selectedRegion}
            </button>
            {selectedProvince && (
              <>
                <span aria-hidden="true" className="text-[var(--app-text-tertiary)]">›</span>
                <span className="font-semibold text-[var(--app-text-primary)]">{selectedProvince}</span>
              </>
            )}
          </div>
        )}

        {loading && <div className="mt-6"><LoadingState /></div>}

        {!loading && error && (
          <section className="mt-6 rounded-2xl border border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-[var(--app-danger)]">{error}</p>
            <button
              type="button"
              onClick={retryLoading}
              className="mt-4 min-h-[44px] rounded-xl bg-[var(--app-danger)] px-5 py-2 text-sm font-bold text-white"
            >
              ลองใหม่
            </button>
          </section>
        )}

        {!loading && !error && stores.length === 0 && (
          <section className="mt-6">
            <EmptyState title="ยังไม่มีข้อมูลสาขา" description="ขณะนี้ยังไม่มีข้อมูลสาขาที่พร้อมให้บริการ กรุณาลองใหม่ภายหลัง" />
          </section>
        )}

        {!loading && !error && stores.length > 0 && showRegions && (
          <section className="mt-6" aria-labelledby="region-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="region-heading" className="text-lg font-black">เลือกภูมิภาค</h2>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">เลือกพื้นที่เพื่อดูจังหวัดที่มีสาขา</p>
              </div>
              <span className="text-xs text-[var(--app-text-tertiary)]">{stores.length.toLocaleString("th-TH")} สาขา</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STORE_LOCATOR_REGION_ORDER.map((region) => {
                const count = getStoreLocatorRegionCount(stores, region);
                const available = availableRegions.includes(region);
                return (
                  <button
                    key={region}
                    type="button"
                    disabled={!available}
                    onClick={() => selectRegion(region)}
                    className="flex min-h-[104px] flex-col items-start justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left shadow-[var(--app-shadow-card)] transition hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                    data-testid={`store-locator-region-${region}`}
                  >
                    <span className="text-sm font-bold leading-snug">{region}</span>
                    <span className="flex w-full items-center justify-between text-xs text-[var(--app-text-secondary)]">
                      {count > 0 ? `${count.toLocaleString("th-TH")} สาขา` : "ยังไม่มีสาขา"}
                      {available && <ChevronIcon />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!loading && !error && showProvinces && selectedRegion && (
          <section className="mt-6" aria-labelledby="province-heading">
            <div className="mb-3">
              <h2 id="province-heading" className="text-lg font-black">เลือกจังหวัด</h2>
              <p className="mt-1 text-xs text-[var(--app-text-secondary)]">จังหวัดที่มีสาขาใน{selectedRegion}</p>
            </div>
            <div className="space-y-3">
              {provinces.map((province) => {
                const count = stores.filter(
                  (store) => getStoreLocatorRegion(store.region) === selectedRegion && store.province?.trim() === province,
                ).length;
                return (
                  <button
                    key={province}
                    type="button"
                    onClick={() => selectProvince(province)}
                    className="flex min-h-[68px] w-full items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left shadow-[var(--app-shadow-card)] transition hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]"
                  >
                    <span className="text-base font-bold">{province}</span>
                    <span className="flex items-center gap-2 text-xs text-[var(--app-text-secondary)]">{count.toLocaleString("th-TH")} สาขา <ChevronIcon /></span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {!loading && !error && (showStores || showSearchResults) && (
          <section className="mt-6" aria-labelledby="store-heading" aria-live="polite">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="store-heading" className="text-lg font-black">{showSearchResults ? "ผลการค้นหา" : "เลือกสาขา"}</h2>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{searchResults.length.toLocaleString("th-TH")} สาขา</p>
              </div>
              {selectedProvince && <button type="button" onClick={() => setSelectedProvince(null)} className="min-h-[40px] text-xs font-bold text-[var(--app-accent)]">เปลี่ยนจังหวัด</button>}
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((store) => <StoreCard key={store.id || store.slug} store={store} onLineOaClick={selectStore} />)}
              </div>
            ) : (
              <EmptyState title="ไม่พบสาขาที่ค้นหา" description="ลองค้นหาด้วยชื่อจังหวัด ชื่อร้าน หรือชื่อห้างอื่น" />
            )}
          </section>
        )}

        {!loading && !error && !showSearchResults && selectedRegion && provinces.length === 0 && (
          <div className="mt-6">
            <EmptyState title="ยังไม่มีจังหวัดที่พร้อมแสดง" description="ขณะนี้ยังไม่มีจังหวัดที่มีข้อมูลพร้อมแสดงในภูมิภาคนี้" />
          </div>
        )}
      </div>
    </main>
  );
}
