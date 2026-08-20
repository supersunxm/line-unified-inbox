"use client";

import React from "react";
import { Button } from "./button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "เกิดข้อผิดพลาดในการโหลดข้อมูล",
  message,
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] p-4 text-xs text-[#C62828] dark:text-[#fca5a5] ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="h-4 w-4 shrink-0 mt-0.5 text-[var(--app-danger)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <span className="font-semibold">{title}: </span>
          <span className="opacity-90">{message}</span>
        </div>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onRetry}
          className="shrink-0 self-end sm:self-center border-[var(--app-danger)]/30 text-[#C62828] dark:text-[#fca5a5] hover:bg-[var(--app-danger)] hover:text-white"
        >
          ลองใหม่อีกครั้ง
        </Button>
      )}
    </div>
  );
}
