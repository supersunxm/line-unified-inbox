"use client";

import React, { useEffect, useRef } from "react";
import { IconButton } from "./icon-button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const maxWidthStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
  className = "",
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scrolling while modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-120"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-desc" : undefined}
        className={`w-full ${maxWidthStyles[maxWidth]} rounded-[var(--app-radius-xl)] bg-[var(--app-surface)] border border-[var(--app-border)] shadow-[var(--app-shadow-modal)] overflow-hidden text-[var(--app-text-primary)] transition-all ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--app-border-subtle)]">
          <div>
            <h3 id="modal-title" className="text-base font-semibold tracking-tight text-[var(--app-text-primary)]">
              {title}
            </h3>
            {description && (
              <p id="modal-desc" className="mt-0.5 text-xs text-[var(--app-text-secondary)]">
                {description}
              </p>
            )}
          </div>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 max-h-[calc(85vh-8rem)] overflow-y-auto space-y-4 text-xs">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
