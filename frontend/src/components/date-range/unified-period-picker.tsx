"use client";

import { createPortal } from "react-dom";
import { matchesPreset, PERIOD_PRESETS, presetRange, selectDraftDate } from "./period-range";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  formatDateDisplay,
  getBkkDateStr,
  validateDateRange,
} from "@/app/follower-insights/follower-insights-utils";
import { getFollowerInsightsText, type Language } from "@/app/follower-insights/follower-insights-translations";

interface UnifiedPeriodPickerProps {
  dateFrom: string;
  dateTo: string;
  readyDates?: Set<string>;
  partialDates?: Set<string>;
  missingDates?: Set<string>;
  language?: Language;
  onApply: (start: string, end: string) => void;
  disabled?: boolean;
  className?: string;
}

export function UnifiedPeriodPicker({
  dateFrom,
  dateTo,
  readyDates,
  partialDates,
  missingDates,
  language = "en",
  onApply,
  disabled = false,
  className = "",
}: UnifiedPeriodPickerProps) {
  const t = getFollowerInsightsText(language);
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(dateFrom);
  const [draftEnd, setDraftEnd] = useState<string | null>(dateTo);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [position, setPosition] = useState({ left: 12, top: 12 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  const todayIso = getBkkDateStr(new Date());
  const onQuickRange = (days: number) => {
    const range = presetRange(days, todayIso);
    onApply(range.dateFrom, range.dateTo);
    setIsOpen(false);
  };
  const presetButtons = (draft = false) => PERIOD_PRESETS.map((days) => (
    <button key={days} type="button" disabled={disabled} aria-pressed={matchesPreset({ dateFrom, dateTo }, days, todayIso)}
      onClick={() => { onQuickRange(days); if (draft) triggerRef.current?.focus(); }}
      className={`rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] disabled:opacity-40 ${matchesPreset({ dateFrom, dateTo }, days, todayIso) ? "bg-[var(--app-accent)] text-white" : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"}`}>{days}D</button>
  ));

  const handleOpenPopover = () => {
    setDraftStart(dateFrom);
    setDraftEnd(dateTo);
    setPickerError(null);
    setCurrentMonthDate(initialMonthDate);
    setIsOpen(true);
  };

  // Dismiss without committing and keep keyboard focus within the open calendar.
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && popoverRef.current) {
        const candidates = popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const focusables = Array.from(candidates).filter((element) => element.getClientRects().length > 0);
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    popoverRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const initialMonthDate = (() => {
    if (dateFrom) {
      const [y, m] = dateFrom.split("-").map((n) => parseInt(n, 10));
      if (!isNaN(y) && !isNaN(m)) return new Date(y, m - 1, 1);
    }
    return new Date();
  })();

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialMonthDate);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!anchor || !popover) return;
      setPosition({
        left: Math.max(12, Math.min(anchor.right - popover.width, window.innerWidth - popover.width - 12)),
        top: Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - popover.height - 12)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, currentMonthDate, pickerError]);

  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    popoverRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  }, [currentMonthDate]);

  const focusDate = (iso: string) => {
    if (iso > todayIso) return;
    const button = popoverRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${iso}"]`);
    if (button && button.getClientRects().length > 0) {
      button.focus();
      return;
    }
    pendingFocus.current = iso;
    const [year, month] = iso.split("-").map(Number);
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const handleDateClick = (isoStr: string) => {
    if (isoStr > todayIso) return; // Future dates disabled
    setPickerError(null);

    const draft = selectDraftDate({ start: draftStart, end: draftEnd }, isoStr);
    if (draft.start && draft.end) {
      const validation = validateDateRange(draft.start, draft.end, language);
      if (!validation.valid) {
        setPickerError(validation.error);
        return;
      }
    }
    setDraftStart(draft.start);
    setDraftEnd(draft.end);
  };

  const handleApplyClick = () => {
    if (!draftStart || pickerError || disabled) return;
    const finalEnd = draftEnd || draftStart;

    const validation = validateDateRange(draftStart, finalEnd, language);
    if (!validation.valid) {
      setPickerError(validation.error);
      return;
    }

    onApply(draftStart, finalEnd);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleCancelClick = () => {
    setDraftStart(dateFrom);
    setDraftEnd(dateTo);
    setPickerError(null);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const nextMonthDate = useMemo(() => {
    return new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
  }, [currentMonthDate]);

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 text-left ${className}`}>
      <div className="inline-flex rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-1">{presetButtons()}</div>
      {/* Trigger Button */}
      <button
        data-date-from={dateFrom}
        data-date-to={dateTo}
        ref={triggerRef}
        disabled={disabled}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpenPopover())}
        className="flex max-w-full items-center gap-2.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] px-4 py-2 text-sm font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)] transition-all shadow-sm aria-expanded:border-[var(--app-accent)] aria-expanded:bg-[var(--app-accent-soft)] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
        aria-label={t.selectDateRange}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <svg className="h-4 w-4 text-[var(--app-accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="truncate">
          {dateFrom && dateTo ? `${formatDateDisplay(dateFrom, language)} – ${formatDateDisplay(dateTo, language)}` : t.selectDateRange}
        </span>
        <svg className={`h-4 w-4 text-[var(--app-text-secondary)] transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Dialog */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={position}
          role="dialog"
          aria-modal="true"
          aria-label={t.selectDateRange}
          className="fixed z-[100] w-[330px] md:w-[680px] max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:p-5 shadow-2xl text-[var(--app-text-primary)] animate-in fade-in zoom-in-95 duration-150 overflow-y-auto"
        >
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[var(--app-border)] mb-4 gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider">{t.selectDateRange}</span>
              <span className="text-xs font-medium text-[var(--app-accent)] bg-[var(--app-accent-soft)] px-2 py-0.5 rounded-full border border-[var(--app-border)]">
                {draftStart ? formatDateDisplay(draftStart, language) : "—"} — {draftEnd ? formatDateDisplay(draftEnd, language) : "—"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">{presetButtons(true)}</div>
          </div>

          {/* Validation Error Message */}
          {pickerError && (
            <div role="alert" className="mb-3 rounded-lg border border-[var(--app-danger)] bg-[var(--app-danger-soft)] px-3 py-2 text-xs text-[var(--app-danger)]">
              {pickerError}
            </div>
          )}

          {/* Dual Calendar Grid (Desktop 2 months, Mobile 1 month) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CalendarMonthGrid
              monthDate={currentMonthDate}
              draftStart={draftStart}
              draftEnd={draftEnd}
              todayIso={todayIso}
              readyDates={readyDates}
              partialDates={partialDates}
              missingDates={missingDates}
              language={language}
              onFocusDate={focusDate}
              onDateClick={handleDateClick}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              showPrevBtn={true}
              showNextBtn={true}
            />

            <div className="hidden md:block">
              <CalendarMonthGrid
                monthDate={nextMonthDate}
                draftStart={draftStart}
                draftEnd={draftEnd}
                todayIso={todayIso}
                readyDates={readyDates}
                partialDates={partialDates}
                missingDates={missingDates}
                language={language}
                onFocusDate={focusDate}
                onDateClick={handleDateClick}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                showPrevBtn={false}
                showNextBtn={true}
              />
            </div>
          </div>

          {/* Footer Bar */}
          <div className="mt-4 border-t border-[var(--app-border)] pt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--app-text-secondary)]">{t.max90DaysNote}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleCancelClick}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-1.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus:outline-none"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleApplyClick}
                disabled={!draftStart || Boolean(pickerError) || disabled}
                className="rounded-xl bg-[var(--app-accent)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--app-accent)] disabled:opacity-40 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus:outline-none"
              >
                {t.apply}
              </button>
            </div>
          </div>
        </div>
        , document.body
      )}
    </div>
  );
}

function CalendarMonthGrid({
  monthDate,
  draftStart,
  draftEnd,
  todayIso,
  readyDates,
  partialDates,
  missingDates,
  language = "en",
  onDateClick,
  onFocusDate,
  onPrevMonth,
  onNextMonth,
  showPrevBtn,
  showNextBtn,
}: {
  monthDate: Date;
  draftStart: string | null;
  draftEnd: string | null;
  todayIso: string;
  readyDates?: Set<string>;
  partialDates?: Set<string>;
  missingDates?: Set<string>;
  language?: Language;
  onDateClick: (isoStr: string) => void;
  onFocusDate: (isoStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  showPrevBtn: boolean;
  showNextBtn: boolean;
}) {
  const t = getFollowerInsightsText(language);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthLabel = useMemo(() => {
    const intlLocale = language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(monthDate);
  }, [monthDate, language]);

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayOfWeek = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  const daysArray = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      arr.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isoStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      arr.push({ dayNumber: d, isoStr });
    }
    return arr;
  }, [year, month, firstDayOfWeek, daysInMonth]);

  // Arrow key navigation between days
  const handleKeyDown = (e: React.KeyboardEvent, isoStr: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isoStr <= todayIso) onDateClick(isoStr);
      return;
    }

    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const [year, month, day] = isoStr.split("-").map(Number);
      const targetMonth = month - 1 + (e.key === "PageUp" ? -1 : 1);
      const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
      onFocusDate(new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10));
      return;
    }

    let offsetDays = 0;
    if (e.key === "ArrowLeft") offsetDays = -1;
    else if (e.key === "ArrowRight") offsetDays = 1;
    else if (e.key === "ArrowUp") offsetDays = -7;
    else if (e.key === "ArrowDown") offsetDays = 7;

    if (offsetDays !== 0) {
      e.preventDefault();
      const [y, m, d] = isoStr.split("-").map((n) => parseInt(n, 10));
      const targetDate = new Date(Date.UTC(y, m - 1, d + offsetDays));
      const targetIso = targetDate.toISOString().slice(0, 10);

      onFocusDate(targetIso);
    }
  };

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between pb-3">
        {showPrevBtn ? (
          <button
            type="button"
            onClick={onPrevMonth}
            className="rounded-lg p-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus:outline-none"
            aria-label={t.prevMonth}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <div className="w-6"></div>
        )}

        <span className="text-sm font-semibold text-[var(--app-text-primary)]">{monthLabel}</span>

        {showNextBtn ? (
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-lg p-1.5 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-subtle)] hover:text-[var(--app-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus:outline-none"
            aria-label={t.nextMonth}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-6"></div>
        )}
      </div>

      {/* Calendar Grid */}
      <div role="grid" aria-label={t.selectDateRange}>
        {/* Weekday Labels */}
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[var(--app-text-secondary)] uppercase pb-2" role="row">
          {t.weekdays.map((day, idx) => (
            <span key={idx} role="columnheader">{day}</span>
          ))}
        </div>

        {/* Day Cells Grid */}
        <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
          {Array.from({ length: Math.ceil(daysArray.length / 7) }).map((_, weekIdx) => (
            <div key={weekIdx} className="contents" role="row">
              {daysArray.slice(weekIdx * 7, weekIdx * 7 + 7).map((item, colIdx) => {
                if (!item) {
                  return <div key={`empty-${weekIdx}-${colIdx}`} className="h-8" role="gridcell"></div>;
                }
                const { dayNumber, isoStr } = item;
                const isStart = draftStart === isoStr;
                const isEnd = draftEnd === isoStr;
                const isInRange = Boolean(draftStart && draftEnd && isoStr > draftStart && isoStr < draftEnd);
                const isToday = isoStr === todayIso;
                const isFuture = isoStr > todayIso;

                let btnClass =
                  "h-8 w-full font-medium transition-colors flex items-center justify-center relative focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] focus:outline-none focus:z-10 ";

                if (isFuture) {
                  btnClass += "text-[var(--app-text-tertiary)] cursor-not-allowed opacity-40";
                } else if (isStart && isEnd) {
                  btnClass += "bg-[var(--app-accent)] text-white font-bold rounded-lg shadow-sm";
                } else if (isStart) {
                  btnClass += "bg-[var(--app-accent)] text-white font-bold rounded-l-lg shadow-sm";
                } else if (isEnd) {
                  btnClass += "bg-[var(--app-accent)] text-white font-bold rounded-r-lg shadow-sm";
                } else if (isInRange) {
                  btnClass += "bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]";
                } else {
                  btnClass += "text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)] rounded-lg";
                }

                return (
                  <div key={isoStr} role="gridcell" aria-selected={isStart || isEnd || isInRange}>
                    <button
                      data-date={isoStr}
                      type="button"
                      disabled={isFuture}
                      onClick={() => onDateClick(isoStr)}
                      onKeyDown={(e) => handleKeyDown(e, isoStr)}
                      className={btnClass}
                      aria-label={formatDateDisplay(isoStr, language)}
                      aria-current={isToday ? "date" : undefined}
                    >
                      <span className="relative z-10">{dayNumber}</span>
                      <div className="absolute bottom-[2px] flex justify-center w-full gap-[2px]">
                        {readyDates?.has(isoStr) && <span className="h-[3px] w-[3px] rounded-full bg-[var(--app-accent)]"></span>}
                        {partialDates?.has(isoStr) && <span className="h-[3px] w-[3px] rounded-full bg-[var(--app-warning)]"></span>}
                        {missingDates?.has(isoStr) && <span className="h-[3px] w-[3px] rounded-full border border-[var(--app-text-secondary)]"></span>}
                        {isToday && !readyDates?.has(isoStr) && !partialDates?.has(isoStr) && !missingDates?.has(isoStr) && (
                          <span className="h-[3px] w-[3px] rounded-full bg-[var(--app-accent)]"></span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
