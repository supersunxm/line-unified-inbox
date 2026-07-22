"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDateDisplay,
  getBkkDateStr,
  validateDateRange,
} from "./follower-insights-utils";

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onApply: (start: string, end: string) => void;
  onQuickRange: (days: number) => void;
}

export function DateRangePicker({ dateFrom, dateTo, onApply, onQuickRange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(dateFrom);
  const [draftEnd, setDraftEnd] = useState<string | null>(dateTo);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayIso = useMemo(() => getBkkDateStr(new Date()), []);

  const handleOpenPopover = () => {
    setDraftStart(dateFrom);
    setDraftEnd(dateTo);
    setPickerError(null);
    setIsOpen(true);
  };

  // Click outside listener, Real Focus Trap, & Escape key handler
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

      // Real Focus Trap implementation
      if (e.key === "Tab" && popoverRef.current) {
        const focusables = popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
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

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const initialMonthDate = useMemo(() => {
    if (dateFrom) {
      const [y, m] = dateFrom.split("-").map((n) => parseInt(n, 10));
      if (!isNaN(y) && !isNaN(m)) return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [dateFrom]);

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialMonthDate);

  const prevMonth = () => {
    setCurrentMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const handleDateClick = (isoStr: string) => {
    if (isoStr > todayIso) return; // Future dates disabled
    setPickerError(null);

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(isoStr);
      setDraftEnd(null);
    } else if (draftStart && !draftEnd) {
      if (isoStr < draftStart) {
        setDraftStart(isoStr);
        setDraftEnd(draftStart);
      } else {
        setDraftEnd(isoStr);
      }
    }
  };

  const handleApplyClick = () => {
    if (!draftStart) return;
    const finalEnd = draftEnd || draftStart;

    const validation = validateDateRange(draftStart, finalEnd);
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
    <div className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpenPopover())}
        className="flex items-center gap-2.5 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-700 hover:bg-slate-800/80 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-950"
        aria-label="Select date range"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <svg className="h-4 w-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="truncate">
          {formatDateDisplay(dateFrom)} – {formatDateDisplay(dateTo)}
        </span>
        <svg className={`h-4 w-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Dialog */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label="Date range calendar picker"
          className="absolute right-0 top-full mt-2 z-50 w-[330px] md:w-[680px] max-w-[92vw] rounded-2xl border border-slate-800 bg-slate-900 p-4 md:p-5 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Range</span>
              <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                {draftStart ? formatDateDisplay(draftStart) : "Start date"} — {draftEnd ? formatDateDisplay(draftEnd) : "End date"}
              </span>
            </div>

            {/* Quick Range Buttons inside Popover */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onQuickRange(7);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                7D
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuickRange(14);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                14D
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuickRange(30);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                30D
              </button>
            </div>
          </div>

          {/* Validation Error Message */}
          {pickerError && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
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
              onDateClick={handleDateClick}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              showPrevBtn={true}
              showNextBtn={false}
            />

            <div className="hidden md:block">
              <CalendarMonthGrid
                monthDate={nextMonthDate}
                draftStart={draftStart}
                draftEnd={draftEnd}
                todayIso={todayIso}
                onDateClick={handleDateClick}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                showPrevBtn={false}
                showNextBtn={true}
              />
            </div>
          </div>

          {/* Footer Bar */}
          <div className="mt-4 border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Max 90 calendar days range.</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleCancelClick}
                className="rounded-xl border border-slate-800 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyClick}
                disabled={!draftStart}
                className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarMonthGrid({
  monthDate,
  draftStart,
  draftEnd,
  todayIso,
  onDateClick,
  onPrevMonth,
  onNextMonth,
  showPrevBtn,
  showNextBtn,
}: {
  monthDate: Date;
  draftStart: string | null;
  draftEnd: string | null;
  todayIso: string;
  onDateClick: (isoStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  showPrevBtn: boolean;
  showNextBtn: boolean;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(monthDate);
  }, [monthDate]);

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

    if (e.key === "PageUp") {
      e.preventDefault();
      onPrevMonth();
      return;
    }

    if (e.key === "PageDown") {
      e.preventDefault();
      onNextMonth();
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

      // Focus target day button if present in DOM
      const targetBtn = document.querySelector<HTMLButtonElement>(`button[data-date="${targetIso}"]`);
      if (targetBtn) {
        targetBtn.focus();
      } else {
        if (offsetDays < 0) onPrevMonth();
        else onNextMonth();
      }
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
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="Previous month"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <div className="w-6"></div>
        )}

        <span className="text-sm font-semibold text-white">{monthLabel}</span>

        {showNextBtn ? (
          <button
            type="button"
            onClick={onNextMonth}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="Next month"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-6"></div>
        )}
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 uppercase pb-2">
        <span>Su</span>
        <span>Mo</span>
        <span>Tu</span>
        <span>We</span>
        <span>Th</span>
        <span>Fr</span>
        <span>Sa</span>
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {daysArray.map((item, idx) => {
          if (!item) {
            return <div key={`empty-${idx}`} className="h-8"></div>;
          }
          const { dayNumber, isoStr } = item;
          const isStart = draftStart === isoStr;
          const isEnd = draftEnd === isoStr;
          const isInRange = Boolean(draftStart && draftEnd && isoStr > draftStart && isoStr < draftEnd);
          const isToday = isoStr === todayIso;
          const isFuture = isoStr > todayIso;

          let btnClass =
            "h-8 w-full font-medium transition-colors flex items-center justify-center relative focus:ring-2 focus:ring-blue-500 focus:outline-none focus:z-10 ";

          if (isFuture) {
            btnClass += "text-slate-600 cursor-not-allowed opacity-40";
          } else if (isStart && isEnd) {
            btnClass += "bg-blue-600 text-white font-bold rounded-lg shadow-sm";
          } else if (isStart) {
            btnClass += "bg-blue-600 text-white font-bold rounded-l-lg shadow-sm";
          } else if (isEnd) {
            btnClass += "bg-blue-600 text-white font-bold rounded-r-lg shadow-sm";
          } else if (isInRange) {
            btnClass += "bg-blue-600/20 text-blue-200 hover:bg-blue-600/30";
          } else {
            btnClass += "text-slate-300 hover:bg-slate-800 rounded-lg";
          }

          return (
            <button
              key={isoStr}
              data-date={isoStr}
              type="button"
              disabled={isFuture}
              onClick={() => onDateClick(isoStr)}
              onKeyDown={(e) => handleKeyDown(e, isoStr)}
              className={btnClass}
              aria-label={isoStr}
              aria-selected={isStart || isEnd || isInRange}
              aria-current={isToday ? "date" : undefined}
            >
              {dayNumber}
              {isToday && !isStart && !isEnd && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-400"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
