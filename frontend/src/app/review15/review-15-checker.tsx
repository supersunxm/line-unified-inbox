"use client";

import Link from "next/link";
import Image from "next/image";
import { LanguageControl, useAppLanguage } from "../language";
import { review15Text, type Review15Key } from "./review-15-translations";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  segmentThaiWords,
  WORD_COUNT_RULE_VERSION,
} from "@/lib/thai-word-counter";
import { pickRandomReview15Example, REVIEW15_EXAMPLES } from "./review-15-example";

type ScanNotice = { key: Review15Key; values?: Record<string, string | number> };
class ReviewScanError extends Error {
  constructor(readonly key: Review15Key) { super(key); }
}
const MIN_WORDS = 15;
const MAX_CHARS = 500;
const MAX_SCAN_IMAGES = 3;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const VISITOR_STORAGE_KEY = "lineoppo-review15-visitor-id-v1";
type Mode = "text" | "image";

type VisitorCountResponse = {
  totalVisitors: number;
  approximate: true;
};

function getOrCreateAnonymousVisitorId(): string | null {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;

    const visitorId = window.crypto.randomUUID();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
    return visitorId;
  } catch {
    try {
      const existing = window.sessionStorage.getItem(VISITOR_STORAGE_KEY);
      if (existing) return existing;

      const visitorId = window.crypto.randomUUID();
      window.sessionStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
      return visitorId;
    } catch {
      return null;
    }
  }
}

type ScanImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type ScanCandidate = {
  id: string;
  text: string;
  sourceName: string;
  imageIndex: number;
  confirmed: boolean;
  confidence: number | null;
};

type VisionScanResponse = {
  provider: "google-cloud-vision";
  imagesProcessed: number;
  estimatedReviewCount: number;
  missingReviewCount: number;
  candidates: Array<{
    imageIndex: number;
    text: string;
    confidence: number | null;
  }>;
};

async function optimizeImageForOcr(file: File): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new ReviewScanError("fileReadError"));
      element.src = imageUrl;
    });

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const maxWidth = 1800;
    const maxPixels = 7_000_000;

    const widthScale = Math.min(1, maxWidth / Math.max(sourceWidth, 1));
    const pixelScale = Math.min(
      1,
      Math.sqrt(maxPixels / Math.max(sourceWidth * sourceHeight, 1)),
    );
    const scale = Math.min(widthScale, pixelScale);

    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob ?? file),
        "image/jpeg",
        0.94,
      );
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9.55 17.35 4.2 12l1.42-1.42 3.93 3.93 8.83-8.83L19.8 7.1 9.55 17.35Z"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h16v12H8l-4 4V4Zm3 5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm5 0A1.25 1.25 0 1 0 12 7a1.25 1.25 0 0 0 0 2.5Zm5 0A1.25 1.25 0 1 0 17 7a1.25 1.25 0 0 0 0 2.5Z"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 4 7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.2L15 4H9Zm3 13.2A4.2 4.2 0 1 1 12 8.8a4.2 4.2 0 0 1 0 8.4Zm0-1.8A2.4 2.4 0 1 0 12 10.6a2.4 2.4 0 0 0 0 4.8Z"
      />
    </svg>
  );
}

function ManualChecker({
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (value: string) => void;
}) {
  const { language } = useAppLanguage();
  const t = review15Text(language);
  const result = useMemo(() => segmentThaiWords(text), [text]);
  const count = result.count;
  const passed = count >= MIN_WORDS;
  const remaining = Math.max(0, MIN_WORDS - count);
  const hasText = text.trim().length > 0;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)] xl:items-stretch">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
          <label htmlFor="review-text" className="mb-2 block text-sm font-semibold">
            {t("reviewText")}</label>
          <div className="relative">
            <textarea
              id="review-text"
              value={text}
              maxLength={MAX_CHARS}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder={t("placeholder")}
              className="min-h-44 w-full resize-y rounded-xl border border-[var(--app-border-strong)] bg-[var(--input-background)] px-4 py-3 pb-8 text-base leading-7 outline-none transition focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/15 sm:min-h-52"
            />
            <span className="pointer-events-none absolute bottom-3 right-3 text-[11px] font-medium text-[var(--app-text-tertiary)]">
              {text.length}/{MAX_CHARS}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => onTextChange("")}
              disabled={!text}
              className="min-h-11 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-hover)] disabled:opacity-45"
            >
              {t("clear")}</button>
            <button
              type="button"
              onClick={() =>
                onTextChange(pickRandomReview15Example(text).text)
              }
              className="min-h-11 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--app-surface-hover)]"
            >
              {t("random")}</button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--app-text-tertiary)]">
            {t("exampleCount", { count: REVIEW15_EXAMPLES.length })}
          </p>
        </section>

        <section
          aria-live="polite"
          className={[
            "flex min-h-48 flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-[var(--app-shadow-card)] transition",
            !hasText
              ? "border-[var(--app-border)] bg-[var(--app-surface)]"
              : passed
                ? "border-[var(--app-success)]/25 bg-[var(--app-success-soft)]"
                : "border-[var(--app-warning)]/25 bg-[var(--app-warning-soft)]",
          ].join(" ")}
        >
          <div
            className={[
              "font-tabular text-5xl font-bold tracking-tight sm:text-6xl",
              !hasText
                ? "text-[var(--app-text-tertiary)]"
                : passed
                  ? "text-[var(--app-accent)]"
                  : "text-[var(--app-warning)]",
            ].join(" ")}
          >
            {count}
            <span className="ml-1 text-2xl font-semibold sm:text-3xl">
              {t("wordTarget", { count: MIN_WORDS })}
            </span>
          </div>

          {!hasText ? (
            <p className="mt-4 text-sm font-medium text-[var(--app-text-secondary)]">
              {t("start")}</p>
          ) : passed ? (
            <>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--app-success)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--app-accent)]">
                <CheckIcon />
                {t("passed")}</div>
              <p className="mt-3 text-sm font-semibold text-[var(--app-accent)]">
                {t("passDescription")}</p>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-full bg-[var(--app-warning)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--app-warning)]">
                {t("notPassed")}</div>
              <p className="mt-3 text-sm font-semibold">{t("remaining", { count: remaining })}</p>
            </>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">
            {t("countedWords")}{hasText ? t("wordCount", { count }) : ""}
          </h2>
          {hasText && (
            <span className="text-xs font-medium text-[var(--app-text-secondary)]">
              {t("accordingToRules")}</span>
          )}
        </div>

        {result.finalTokens.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {result.finalTokens.map((token, index) => (
              <span
                key={token + "-" + index}
                className="rounded-full bg-[var(--app-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--app-accent)]"
              >
                {token}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--app-text-tertiary)]">
            {t("tokensEmpty")}</p>
        )}
      </section>
    </>
  );
}

export function Review15Checker() {
  const { language } = useAppLanguage();
  const t = review15Text(language);
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[]>([]);
  const [scanEstimatedReviewCount, setScanEstimatedReviewCount] = useState(0);
  const [scanMissingReviewCount, setScanMissingReviewCount] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState<ScanNotice | null>(null);
  const [scanError, setScanError] = useState<ScanNotice | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [visitorTotal, setVisitorTotal] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = `${review15Text(language)("title")} | OPPO Brand Shop`;
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    const recordVisitor = async () => {
      const visitorId = getOrCreateAnonymousVisitorId();
      if (!visitorId) return;

      try {
        const response = await fetch("/api-backend/review15/visitors", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ visitorId }),
        });

        if (!response.ok) return;

        const payload = (await response.json()) as VisitorCountResponse;
        if (!cancelled && Number.isFinite(payload.totalVisitors)) {
          setVisitorTotal(Math.max(0, payload.totalVisitors));
        }
      } catch {
        // Visitor analytics must never block the checker.
      }
    };

    void recordVisitor();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      scanImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [scanImages]);

  const scannedResults = useMemo(
    () =>
      scanCandidates.map((candidate) => ({
        ...candidate,
        segmentation: segmentThaiWords(candidate.text),
      })),
    [scanCandidates],
  );

  const replaceScanImages = (files: File[]) => {
    scanImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));

    const next = files.slice(0, MAX_SCAN_IMAGES).map((file, index) => ({
      id: file.name + "-" + file.lastModified + "-" + index,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setScanImages(next);
    setScanCandidates([]);
    setScanEstimatedReviewCount(0);
    setScanMissingReviewCount(0);
    setScanProgress(0);
    setScanStatus(null);
    setScanError(null);
  };

  const handleFileSelection = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files);
    const valid = selected.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_IMAGE_BYTES,
    );

    if (valid.length === 0) {
      setScanError({ key: "invalidImage" });
      replaceScanImages([]);
      return;
    }

    replaceScanImages(valid);

    if (selected.length > MAX_SCAN_IMAGES) {
      setScanError({ key: "imageLimit" });
    } else if (valid.length !== selected.length) {
      setScanError({ key: "imagesSkipped" });
    }
  };

  const runImageScan = async () => {
    if (scanImages.length === 0 || isScanning) return;

    setIsScanning(true);
    setScanError(null);
    setScanCandidates([]);
    setScanEstimatedReviewCount(0);
    setScanMissingReviewCount(0);
    setScanProgress(8);
    setScanStatus({ key: "preparing" });

    try {
      const formData = new FormData();

      for (let index = 0; index < scanImages.length; index += 1) {
        const image = scanImages[index];
        setScanProgress(
          Math.round(10 + ((index + 1) / scanImages.length) * 25),
        );
        setScanStatus(
          { key: "preparingImage", values: { index: index + 1, total: scanImages.length } },
        );

        const optimized = await optimizeImageForOcr(image.file);
        formData.append(
          "images",
          optimized,
          "review-" + (index + 1) + ".jpg",
        );
      }

      setScanProgress(45);
      setScanStatus({ key: "sending" });

      const response = await fetch("/api-backend/review15/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 429) throw new ReviewScanError("rateLimit");
        if (response.status === 503) throw new ReviewScanError("unavailable");
        throw new ReviewScanError("imageReadError");
      }

      setScanProgress(78);
      setScanStatus({ key: "extracting" });

      const payload = (await response.json()) as VisionScanResponse;
      const usableCandidates = payload.candidates.filter(
        (candidate) => candidate.text.trim().length > 0,
      );
      const droppedBlankCandidates =
        payload.candidates.length - usableCandidates.length;
      const nextCandidates: ScanCandidate[] = usableCandidates.map(
        (candidate, index) => ({
          id:
            "vision-" +
            candidate.imageIndex +
            "-" +
            index +
            "-" +
            Date.now(),
          text: candidate.text.trim(),
          sourceName: scanImages[candidate.imageIndex]?.file.name ?? "",
          imageIndex: candidate.imageIndex,
          confirmed: false,
          confidence: candidate.confidence,
        }),
      );

      const missingReviewCount =
        (payload.missingReviewCount ?? 0) + droppedBlankCandidates;
      const estimatedReviewCount = Math.max(
        payload.estimatedReviewCount ?? 0,
        nextCandidates.length + missingReviewCount,
      );

      setScanCandidates(nextCandidates);
      setScanEstimatedReviewCount(estimatedReviewCount);
      setScanMissingReviewCount(missingReviewCount);
      setScanProgress(100);

      if (nextCandidates.length > 0) {
        if (missingReviewCount > 0) {
          setScanStatus(
            { key: "extracted", values: { count: nextCandidates.length, total: estimatedReviewCount } },
          );
        } else {
          setScanStatus({ key: "detected", values: { count: nextCandidates.length } });
        }
      } else {
        setScanStatus({ key: "noneDetected" });
        setScanError(
          { key: "noneHelp" },
        );
      }
    } catch (error) {
      console.error("Review image Vision scan failed", error);
      setScanProgress(0);
      setScanStatus(null);
      setScanError(
        { key: error instanceof ReviewScanError ? error.key : "scanError" },
      );
    } finally {
      setIsScanning(false);
    }
  };

  const updateCandidate = (id: string, value: string) => {
    setScanCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, text: value, confirmed: false }
          : candidate,
      ),
    );
  };

  const confirmCandidate = (id: string) => {
    setScanCandidates((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, confirmed: true } : candidate,
      ),
    );
  };

  const openCandidateInManualMode = (value: string) => {
    setText(value.slice(0, MAX_CHARS));
    setMode("text");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label={t("home")}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white shadow-sm">
              O
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight tracking-tight sm:text-base">
                OPPO Brand Shop
              </span>
              <span className="truncate text-[11px] font-medium text-[var(--app-text-secondary)]">
                {t("stores")}</span>
            </div>
          </Link>
          <LanguageControl />
          <span className="hidden min-w-0 truncate text-sm font-medium text-[var(--app-text-secondary)] xl:block">
            {t("title")}
          </span>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-7 sm:px-6 sm:pb-14 sm:pt-12 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-accent)] text-white shadow-sm">
            <ChatIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            {t("title")}</h1>
          <p className="mt-2 text-sm text-[var(--app-text-secondary)] sm:text-base">
            {t("subtitle")}</p>
          {visitorTotal !== null && (
            <div
              className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs text-[var(--app-text-secondary)] shadow-sm"
              title={t("visitorPrivacy")}
            >
              <span>{t("visitors")}</span>
              <strong className="font-tabular text-[var(--app-accent)]">
                {visitorTotal.toLocaleString(language === "zh" ? "zh-CN" : language === "th" ? "th-TH" : "en-US")}
              </strong>
              <span>{t("people")}</span>
              <span className="text-[var(--app-text-tertiary)]">{t("anonymous")}</span>
            </div>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-xl grid-cols-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={[
              "min-h-11 rounded-xl px-3 text-sm font-semibold transition",
              mode === "text"
                ? "bg-[var(--app-accent)] text-white"
                : "text-[var(--app-text-secondary)]",
            ].join(" ")}
          >
            {t("manualMode")}</button>
          <button
            type="button"
            onClick={() => setMode("image")}
            className={[
              "min-h-11 rounded-xl px-3 text-sm font-semibold transition",
              mode === "image"
                ? "bg-[var(--app-accent)] text-white"
                : "text-[var(--app-text-secondary)]",
            ].join(" ")}
          >
            {t("imageMode")}</button>
        </div>

        <div className="mt-5 lg:mt-7">
          {mode === "text" ? (
            <ManualChecker text={text} onTextChange={setText} />
          ) : (
            <>
              <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <CameraIcon />
                  </div>
                  <div>
                    <h2 className="font-bold">{t("scanTitle")}</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)] sm:text-sm">
                      {t("scanHelp")}</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => handleFileSelection(event.target.files)}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="mt-4 flex min-h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-subtle)] px-4 py-5 text-center transition hover:border-[var(--app-accent)] disabled:opacity-50"
                >
                  <span className="text-sm font-bold text-[var(--app-accent)]">
                    {t("chooseImage")}</span>
                  <span className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    {t("imageFormats")}</span>
                </button>

                {scanImages.length > 0 && (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {scanImages.map((image) => (
                        <div
                          key={image.id}
                          className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)]"
                        >
                          <Image
                            unoptimized
                            width={300}
                            height={400}
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="aspect-[3/4] w-full object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={runImageScan}
                      disabled={isScanning}
                      className="mt-4 min-h-12 w-full rounded-xl bg-[var(--app-accent)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--app-accent-hover)] disabled:opacity-55"
                    >
                      {isScanning ? t("scanning") : t("scan")}
                    </button>
                  </>
                )}

                {(isScanning || scanProgress > 0) && (
                  <div className="mt-4" aria-live="polite">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>{scanStatus ? t(scanStatus.key, scanStatus.values) : t("preparingShort")}</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
                      <div
                        className="h-full rounded-full bg-[var(--app-accent)] transition-all duration-300"
                        style={{ width: scanProgress + "%" }}
                      />
                    </div>
                  </div>
                )}

                {scanError && (
                  <div className="mt-4 rounded-xl border border-[var(--app-warning)]/25 bg-[var(--app-warning-soft)] px-3 py-2.5 text-xs leading-5">
                    {t(scanError.key, scanError.values)}
                  </div>
                )}

                <div className="mt-4 rounded-xl bg-[var(--app-accent-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--app-text-secondary)]">
                  <strong className="text-[var(--app-accent)]">
                    Google Vision OCR:
                  </strong>{" "}
                  {t("ocrPrivacy")}</div>
              </section>

              {scannedResults.length > 0 && (
                <section className="mt-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="font-bold">
                        {scanMissingReviewCount > 0
                          ? t("extracted", { count: scannedResults.length, total: scanEstimatedReviewCount })
                          : t("found", { count: scannedResults.length })}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                        {t("checkOcr")}</p>
                    </div>
                  </div>

                  {scanMissingReviewCount > 0 && (
                    <div className="mb-3 rounded-xl border border-[var(--app-warning)]/30 bg-[var(--app-warning-soft)] px-3 py-2.5 text-xs leading-5">
                      {t("missingWarning", { total: scanEstimatedReviewCount, count: scannedResults.length })}
                    </div>
                  )}

                  <div className="grid gap-3">
                    {scannedResults.map((candidate, index) => {
                      const count = candidate.segmentation.count;
                      const passed = count >= MIN_WORDS;
                      const remaining = Math.max(0, MIN_WORDS - count);

                      return (
                        <article
                          key={candidate.id}
                          className={[
                            "rounded-2xl border bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)]",
                            passed
                              ? "border-[var(--app-success)]/25"
                              : "border-[var(--app-warning)]/25",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">
                                {t("reviewNumber", { index: index + 1 })}
                              </p>
                              <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-[var(--app-text-tertiary)]">
                                {candidate.sourceName || t("imageName", { index: candidate.imageIndex + 1 })}
                              </p>
                              {typeof candidate.confidence === "number" && (
                                <p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">
                                  {t("confidence", { percent: Math.round(candidate.confidence * 100) })}
                                </p>
                              )}
                            </div>
                            <div
                              className={[
                                "rounded-full px-3 py-1.5 text-xs font-bold",
                                candidate.confirmed
                                  ? passed
                                    ? "bg-[var(--app-success-soft)] text-[var(--app-accent)]"
                                    : "bg-[var(--app-warning-soft)] text-[var(--app-warning)]"
                                  : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]",
                              ].join(" ")}
                            >
                              {candidate.confirmed
                                ? t("confirmedCount", { count, minimum: MIN_WORDS })
                                : t("awaitingCheck")}
                            </div>
                          </div>

                          <textarea
                            value={candidate.text}
                            onChange={(event) =>
                              updateCandidate(candidate.id, event.target.value)
                            }
                            rows={4}
                            className="mt-3 w-full resize-y rounded-xl border border-[var(--app-border-strong)] bg-[var(--input-background)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-accent)]"
                            aria-label={t("reviewLabel", { index: index + 1 })}
                          />

                          <div className="mt-3 flex flex-wrap gap-2">
                            {!candidate.confirmed ? (
                              <button
                                type="button"
                                onClick={() => confirmCandidate(candidate.id)}
                                className="rounded-full bg-[var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                {t("confirm")}</button>
                            ) : (
                              <span
                                className={[
                                  "rounded-full px-3 py-1 text-xs font-semibold",
                                  passed
                                    ? "bg-[var(--app-success-soft)] text-[var(--app-accent)]"
                                    : "bg-[var(--app-warning-soft)] text-[var(--app-warning)]",
                                ].join(" ")}
                              >
                                {passed
                                  ? t("passed")
                                  : t("remaining", { count: remaining })}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                openCandidateInManualMode(candidate.text)
                              }
                              className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs font-semibold"
                            >
                              {t("openManual")}</button>
                          </div>

                          {!candidate.confirmed && (
                            <p className="mt-2 text-[11px] leading-5 text-[var(--app-warning)]">
                              {t("confirmHelp")}</p>
                          )}

                          {candidate.confirmed &&
                            candidate.segmentation.finalTokens.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {candidate.segmentation.finalTokens.map(
                                  (token, tokenIndex) => (
                                    <span
                                      key={token + "-" + tokenIndex}
                                      className="rounded-full bg-[var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-accent)]"
                                    >
                                      {token}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

            </>
          )}
        </div>

        <section className="mt-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
          <h2 className="text-sm font-bold">{t("rules")}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">
            {t("sameCounter", { version: WORD_COUNT_RULE_VERSION })}
          </p>

          <div className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3">
              <strong>{t("minimumRule")}</strong>
              <p className="mt-1 text-[var(--app-text-secondary)]">
                {t("repeatRule")}</p>
            </div>
            <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3">
              <strong>{t("thaiSegmentation")}</strong>
              <p className="mt-1 text-[var(--app-text-secondary)]">
                {t("notSpaces")}</p>
            </div>
          </div>

          <details className="mt-3 rounded-xl border border-[var(--app-border)] p-3 text-xs leading-6">
            <summary className="cursor-pointer font-semibold">
              {t("allRules")}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--app-text-secondary)]">
              <li>
                {t("ignoreRule")}</li>
              <li>
                {t("brandRule")}</li>
              <li>
                {t("lockedRule")}</li>
              <li>
                {t("modelRule")}</li>
              <li>
                {t("prefixRule")}</li>
              <li>
                {t("compoundRule")}</li>
              <li>
                {t("googleUiRule")}</li>
              <li>
                {t("ocrRule")}</li>
            </ul>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>ดี มาก ดี มาก</strong>
                <div className="text-[var(--app-text-secondary)]">{t("equalsWords", { count: 4 })}</div>
              </div>
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>ความ + สะอาด</strong>
                <div className="text-[var(--app-text-secondary)]">
                  {t("compoundExample")}</div>
              </div>
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>โปรโมชั่น</strong>
                <div className="text-[var(--app-text-secondary)]">{t("equalsWords", { count: 1 })}</div>
              </div>
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>OPPO Reno 5G</strong>
                <div className="text-[var(--app-text-secondary)]">{t("equalsWords", { count: 3 })}</div>
              </div>
            </div>
          </details>
        </section>

        <aside className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-xs leading-6 text-[var(--app-text-secondary)] sm:p-5">
          <p className="font-semibold text-[var(--app-text-primary)]">{t("kpiNote")}</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{t("onlyWords")}</li>
            <li>
              {t("otherRequirements")}</li>
            <li>
              {t("ocrAccuracy")}</li>
            <li>
              {t("temporaryImages")}</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
