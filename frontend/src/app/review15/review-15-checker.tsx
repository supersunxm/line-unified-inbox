"use client";

import { useMemo, useState } from "react";
import { segmentThaiWords } from "@/lib/thai-word-counter";

const MIN_WORDS = 15;
const MAX_CHARS = 500;
const EXAMPLE_TEXT =
  "พนักงาน บริการ ดี มาก แนะนำ OPPO Reno 5G ใช้งาน ง่าย กล้อง สวย ราคา คุ้ม ประทับใจ";

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

export function Review15Checker() {
  const [text, setText] = useState("");

  const result = useMemo(() => segmentThaiWords(text), [text]);
  const count = result.count;
  const passed = count >= MIN_WORDS;
  const remaining = Math.max(0, MIN_WORDS - count);
  const hasText = text.trim().length > 0;

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="text-[27px] font-bold tracking-[-0.075em]" aria-label="OPPO Home">
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
            เช็กข้อความก่อนขอให้ลูกค้าโพสต์รีวิว
          </p>
        </div>

        <div className="mt-7 grid gap-4 lg:mt-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)] lg:items-stretch">
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
                onChange={(event) => setText(event.target.value)}
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
                onClick={() => setText("")}
                disabled={!text}
                className="min-h-11 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--app-accent-hover)] disabled:opacity-45"
              >
                ล้างข้อความ
              </button>
              <button
                type="button"
                onClick={() => setText(EXAMPLE_TEXT)}
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
              <span className="ml-1 text-2xl font-semibold sm:text-3xl">/ {MIN_WORDS} คำ</span>
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
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                  สามารถใช้ข้อความนี้ตรวจเงื่อนไข KPI ส่วนอื่นต่อได้
                </p>
              </>
            ) : (
              <>
                <div className="mt-4 rounded-full bg-[var(--app-warning)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--app-warning)]">
                  ยังไม่ครบ 15 คำ
                </div>
                <p className="mt-3 text-sm font-semibold">
                  ขาดอีก {remaining} คำ
                </p>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">
                  เพิ่มรายละเอียดรีวิวอีกเล็กน้อยแล้วตรวจใหม่
                </p>
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

        <aside className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 text-xs leading-6 text-[var(--app-text-secondary)] sm:p-5">
          <p className="font-semibold text-[var(--app-text-primary)]">หมายเหตุ</p>
          <ul className="mt-1 list-disc pl-5">
            <li>เครื่องมือนี้ตรวจเฉพาะจำนวนคำในข้อความรีวิวเท่านั้น</li>
            <li>การผ่าน KPI จริงยังต้องผ่านเงื่อนไขภาพ เดือนของภาพ และกฎ Review KPI อื่น ๆ</li>
            <li>ใช้กฎการนับคำเดียวกับระบบ Google Review KPI</li>
            <li>ข้อความไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
