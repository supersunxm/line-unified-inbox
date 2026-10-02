"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { segmentThaiWords } from "@/lib/thai-word-counter";

const MIN_WORDS = 15;
const MAX_CHARS = 500;
const MAX_SCAN_IMAGES = 3;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
async function optimizeImageForOcr(file: File): Promise<Blob> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("อ่านไฟล์ภาพไม่สำเร็จ"));
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
  const result = useMemo(() => segmentThaiWords(text), [text]);
  const count = result.count;
  const passed = count >= MIN_WORDS;
  const remaining = Math.max(0, MIN_WORDS - count);
  const hasText = text.trim().length > 0;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)] lg:items-stretch">
        <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
          <label htmlFor="review-text" className="mb-2 block text-sm font-semibold">
            ข้อความรีวิวลูกค้า
          </label>
          <div className="relative">
            <textarea
              id="review-text"
              value={text}
              maxLength={MAX_CHARS}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="วางข้อความรีวิวที่นี่..."
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
              ล้างข้อความ
            </button>
            <button
              type="button"
              onClick={() => onTextChange(EXAMPLE_TEXT)}
              className="min-h-11 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--app-surface-hover)]"
            >
              ใช้ข้อความตัวอย่าง
            </button>
          </div>
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
              / {MIN_WORDS} คำ
            </span>
          </div>

          {!hasText ? (
            <p className="mt-4 text-sm font-medium text-[var(--app-text-secondary)]">
              วางข้อความเพื่อเริ่มตรวจ
            </p>
          ) : passed ? (
            <>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--app-success)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--app-accent)]">
                <CheckIcon />
                ครบ 15 คำแล้ว
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--app-accent)]">
                ข้อความนี้ผ่านเกณฑ์จำนวนคำ
              </p>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-full bg-[var(--app-warning)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--app-warning)]">
                ยังไม่ครบ 15 คำ
              </div>
              <p className="mt-3 text-sm font-semibold">ขาดอีก {remaining} คำ</p>
            </>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-card)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">
            คำที่ระบบนับ
            {hasText ? " (" + count + " คำ)" : ""}
          </h2>
          {hasText && (
            <span className="text-xs font-medium text-[var(--app-text-secondary)]">
              ตามกฎ Review KPI
            </span>
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
            คำที่ผ่านกฎการนับจะแสดงที่นี่
          </p>
        )}
      </section>
    </>
  );
}

export function Review15Checker() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [scanImages, setScanImages] = useState<ScanImage[]>([]);
  const [scanCandidates, setScanCandidates] = useState<ScanCandidate[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [scanError, setScanError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setScanProgress(0);
    setScanStatus("");
    setScanError("");
  };

  const handleFileSelection = (files: FileList | null) => {
    if (!files) return;

    const selected = Array.from(files);
    const valid = selected.filter(
      (file) => file.type.startsWith("image/") && file.size <= MAX_IMAGE_BYTES,
    );

    if (valid.length === 0) {
      setScanError("กรุณาเลือกไฟล์ภาพ JPG / PNG ขนาดไม่เกิน 12 MB");
      replaceScanImages([]);
      return;
    }

    replaceScanImages(valid);

    if (selected.length > MAX_SCAN_IMAGES) {
      setScanError("สแกนได้ครั้งละไม่เกิน 3 ภาพ ระบบเลือก 3 ภาพแรกให้แล้ว");
    } else if (valid.length !== selected.length) {
      setScanError("มีบางไฟล์ที่ไม่ใช่ภาพหรือมีขนาดเกิน 12 MB จึงไม่ได้ถูกเลือก");
    }
  };

  const runImageScan = async () => {
    if (scanImages.length === 0 || isScanning) return;

    setIsScanning(true);
    setScanError("");
    setScanCandidates([]);
    setScanProgress(8);
    setScanStatus("กำลังเตรียมภาพ...");

    try {
      const formData = new FormData();

      for (let index = 0; index < scanImages.length; index += 1) {
        const image = scanImages[index];
        setScanProgress(
          Math.round(10 + ((index + 1) / scanImages.length) * 25),
        );
        setScanStatus(
          "กำลังเตรียมภาพ " + (index + 1) + " จาก " + scanImages.length,
        );

        const optimized = await optimizeImageForOcr(image.file);
        formData.append(
          "images",
          optimized,
          "review-" + (index + 1) + ".jpg",
        );
      }

      setScanProgress(45);
      setScanStatus("กำลังส่งภาพไปวิเคราะห์...");

      const response = await fetch("/api-backend/review15/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "";
        try {
          const errorBody = (await response.json()) as {
            message?: string | string[];
          };
          message = Array.isArray(errorBody.message)
            ? errorBody.message.join(" ")
            : errorBody.message ?? "";
        } catch {
          // Fall through to the status-based message below.
        }

        if (response.status === 429) {
          throw new Error(
            "สแกนถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
          );
        }

        if (response.status === 503) {
          throw new Error(
            message ||
              "ระบบ Google Vision ยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
          );
        }

        throw new Error(message || "อ่านภาพไม่สำเร็จ");
      }

      setScanProgress(78);
      setScanStatus("กำลังแยกเฉพาะข้อความรีวิว...");

      const payload = (await response.json()) as VisionScanResponse;
      const nextCandidates: ScanCandidate[] = payload.candidates.map(
        (candidate, index) => ({
          id:
            "vision-" +
            candidate.imageIndex +
            "-" +
            index +
            "-" +
            Date.now(),
          text: candidate.text,
          sourceName:
            scanImages[candidate.imageIndex]?.file.name ||
            "ภาพ " + (candidate.imageIndex + 1),
          confirmed: false,
          confidence: candidate.confidence,
        }),
      );

      setScanCandidates(nextCandidates);
      setScanProgress(100);

      if (nextCandidates.length > 0) {
        setScanStatus("ตรวจพบ " + nextCandidates.length + " รีวิว");
      } else {
        setScanStatus("ยังไม่พบข้อความรีวิวที่ชัดเจน");
        setScanError(
          "ระบบอ่านภาพแล้ว แต่ยังแยกข้อความรีวิวไม่ได้ ลองใช้ Screenshot ที่เห็นชื่อผู้รีวิว ดาว วันที่ และข้อความรีวิวครบในจอ",
        );
      }
    } catch (error) {
      console.error("Review image Vision scan failed", error);
      setScanProgress(0);
      setScanStatus("");
      setScanError(
        error instanceof Error
          ? error.message
          : "สแกนภาพไม่สำเร็จ กรุณาลองใหม่",
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

  const useCandidateInManualMode = (value: string) => {
    setText(value.slice(0, MAX_CHARS));
    setMode("text");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="text-[27px] font-bold tracking-[-0.075em]"
            aria-label="OPPO Home"
          >
            oppo
          </a>
          <span className="hidden text-sm font-medium text-[var(--app-text-secondary)] sm:block">
            Review 15-Word Checker
          </span>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-7 sm:px-6 sm:pb-14 sm:pt-12 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--app-accent)] text-white shadow-sm">
            <ChatIcon />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            ตรวจสอบรีวิว 15 คำ
          </h1>
          <p className="mt-2 text-sm text-[var(--app-text-secondary)] sm:text-base">
            พิมพ์ข้อความ หรือสแกน Screenshot จาก Google Reviews
          </p>
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
            พิมพ์ข้อความ
          </button>
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
            สแกนจากภาพ
          </button>
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
                    <h2 className="font-bold">สแกนข้อความจากภาพรีวิว</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)] sm:text-sm">
                      รองรับ Screenshot ที่มีหลายรีวิวในภาพเดียว และเลือกได้สูงสุด 3 ภาพต่อครั้ง
                    </p>
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
                    เลือกรูป / ถ่ายภาพ
                  </span>
                  <span className="mt-1 text-xs text-[var(--app-text-secondary)]">
                    JPG, PNG • ไม่เกิน 12 MB ต่อภาพ
                  </span>
                </button>

                {scanImages.length > 0 && (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {scanImages.map((image) => (
                        <div
                          key={image.id}
                          className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)]"
                        >
                          <img
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
                      {isScanning ? "กำลังสแกน..." : "สแกนข้อความรีวิว"}
                    </button>
                  </>
                )}

                {(isScanning || scanProgress > 0) && (
                  <div className="mt-4" aria-live="polite">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>{scanStatus || "กำลังเตรียม..."}</span>
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
                    {scanError}
                  </div>
                )}

                <div className="mt-4 rounded-xl bg-[var(--app-accent-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--app-text-secondary)]">
                  <strong className="text-[var(--app-accent)]">
                    Google Vision OCR:
                  </strong>{" "}
                  ภาพจะถูกส่งแบบชั่วคราวผ่าน server ของ lineoppo.click ไปยัง Google Cloud Vision
                  เพื่ออ่านข้อความและตำแหน่งของข้อความ ระบบหน้านี้ไม่บันทึกไฟล์ภาพลงฐานข้อมูล
                </div>
              </section>

              {scannedResults.length > 0 && (
                <section className="mt-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="font-bold">
                        พบ {scannedResults.length} รีวิว
                      </h2>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                        ตรวจข้อความที่ OCR อ่านได้ก่อนใช้ผลนับคำ
                      </p>
                    </div>
                  </div>

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
                                รีวิว {index + 1}
                              </p>
                              <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-[var(--app-text-tertiary)]">
                                {candidate.sourceName}
                              </p>
                              {typeof candidate.confidence === "number" && (
                                <p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">
                                  OCR confidence {Math.round(candidate.confidence * 100)}%
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
                                ? count + " / " + MIN_WORDS + " คำ"
                                : "รอตรวจข้อความ"}
                            </div>
                          </div>

                          <textarea
                            value={candidate.text}
                            onChange={(event) =>
                              updateCandidate(candidate.id, event.target.value)
                            }
                            rows={4}
                            className="mt-3 w-full resize-y rounded-xl border border-[var(--app-border-strong)] bg-[var(--input-background)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-accent)]"
                            aria-label={"ข้อความรีวิว " + (index + 1)}
                          />

                          <div className="mt-3 flex flex-wrap gap-2">
                            {!candidate.confirmed ? (
                              <button
                                type="button"
                                onClick={() => confirmCandidate(candidate.id)}
                                className="rounded-full bg-[var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                ยืนยันข้อความนี้และนับคำ
                              </button>
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
                                  ? "ครบ 15 คำแล้ว"
                                  : "ขาดอีก " + remaining + " คำ"}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                useCandidateInManualMode(candidate.text)
                              }
                              className="rounded-full border border-[var(--app-border)] px-3 py-1 text-xs font-semibold"
                            >
                              เปิดในโหมดพิมพ์
                            </button>
                          </div>

                          {!candidate.confirmed && (
                            <p className="mt-2 text-[11px] leading-5 text-[var(--app-warning)]">
                              ระบบใช้ตำแหน่งข้อความจาก Google Vision เพื่อแยกรีวิวออกจากรูปสินค้า
                              แต่ยังต้องตรวจ/แก้ข้อความก่อนยืนยัน ระบบจะยังไม่ตัดสินผ่าน 15 คำ
                            </p>
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
          <h2 className="text-sm font-bold">กฎการนับคำ</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">
            หน้าเช็กนี้ใช้ตัวนับคำชุดเดียวกับ Google Review KPI
          </p>

          <div className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3">
              <strong>15 คำขึ้นไป = ผ่าน</strong>
              <p className="mt-1 text-[var(--app-text-secondary)]">
                14 คำยังไม่ผ่าน และคำที่ซ้ำกันยังนับทุกครั้ง
              </p>
            </div>
            <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3">
              <strong>ตัดคำภาษาไทยอัตโนมัติ</strong>
              <p className="mt-1 text-[var(--app-text-secondary)]">
                ไม่ได้นับจากจำนวนช่องว่างในประโยค
              </p>
            </div>
          </div>

          <details className="mt-3 rounded-xl border border-[var(--app-border)] p-3 text-xs leading-6">
            <summary className="cursor-pointer font-semibold">
              ดูรายละเอียดกฎทั้งหมด
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--app-text-secondary)]">
              <li>
                ไม่นับช่องว่าง เครื่องหมายวรรคตอน Emoji สัญลักษณ์ และตัวเลขล้วน
              </li>
              <li>
                คำอังกฤษหรือชื่อแบรนด์ที่มีตัวอักษร เช่น OPPO, Reno และ 5G
                สามารถนับเป็นคำได้
              </li>
              <li>
                คำนำหน้า การ, ความ, น่า, ผู้, นัก, ชาว, ช่าง จะรวมกับคำถัดไปเป็น 1 คำ
              </li>
              <li>
                คำประสมที่กำหนดไว้ เช่น โรงพยาบาล, เครื่องใช้, แม่บ้าน,
                ท่องเที่ยว และต่างชาติ นับเป็น 1 คำ
              </li>
              <li>
                ข้อความ UI ของ Google เช่น See translation, Like, Share, More,
                อ่านเพิ่มเติม และดูคำแปล ไม่นับ
              </li>
              <li>
                เมื่อสแกนจากภาพ ระบบพยายามตัดชื่อผู้รีวิว จำนวนรีวิว ดาว
                และวันที่ออกก่อน แล้วให้ BM ตรวจแก้ข้อความ OCR ได้ก่อนนับ
              </li>
            </ul>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>ดี มาก ดี มาก</strong>
                <div className="text-[var(--app-text-secondary)]">= 4 คำ</div>
              </div>
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>ความ + สะอาด</strong>
                <div className="text-[var(--app-text-secondary)]">
                  = ความสะอาด 1 คำ
                </div>
              </div>
              <div className="rounded-lg bg-[var(--app-accent-soft)] px-3 py-2">
                <strong>OPPO Reno 5G</strong>
                <div className="text-[var(--app-text-secondary)]">= 3 คำ</div>
              </div>
            </div>
          </details>
        </section>

        <aside className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-xs leading-6 text-[var(--app-text-secondary)] sm:p-5">
          <p className="font-semibold text-[var(--app-text-primary)]">หมายเหตุ KPI</p>
          <ul className="mt-1 list-disc pl-5">
            <li>เครื่องมือนี้ตรวจเฉพาะจำนวนคำในข้อความรีวิว</li>
            <li>
              การผ่าน KPI จริงยังต้องผ่านเงื่อนไขภาพ เดือนของภาพ และกฎ Review KPI อื่น ๆ
            </li>
            <li>
              ผลจาก Google Vision ควรตรวจข้อความก่อนยืนยัน เพราะภาพเบลอ
              ข้อความถูกบัง หรือ layout ผิดปกติยังทำให้อ่านคลาดเคลื่อนได้
            </li>
            <li>
              ภาพถูกส่งเพื่อ OCR แบบชั่วคราวและไม่ถูกบันทึกลงฐานข้อมูลของหน้านี้
            </li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
