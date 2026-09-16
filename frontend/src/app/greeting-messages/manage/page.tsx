"use client";

import { AuthorizedWorkspace } from "../../authorized-workspace";
import { GreetingManagementView } from "../greeting-management-view";

export default function GreetingManagementPage() {
  return (
    <>
      {/* Reuse the canonical application shell so this page keeps the same sidebar/top navigation as the rest of the app. */}
      <div className="greeting-manage-shell-source">
        <AuthorizedWorkspace section="greeting-messages" />
      </div>

      {/* Management content overlays only the workspace content area; the canonical app navigation remains visible. */}
      <div className="greeting-manage-overlay">
        <GreetingManagementView />
      </div>

      <style jsx global>{`
        .greeting-manage-overlay {
          position: fixed;
          inset: 3.75rem 0 0 var(--app-sidebar-width, 16rem);
          z-index: 20;
          overflow: auto;
          background: var(--app-bg, #f7f9fb);
          color: var(--app-text-primary, #111827);
        }

        /* GreetingManagementView originally shipped with a temporary standalone sidebar.
           Hide only that local sidebar now that the canonical app shell is restored. */
        .greeting-manage-overlay aside:first-of-type {
          display: none !important;
        }

        .greeting-manage-overlay main {
          width: 100% !important;
          min-width: 0 !important;
          padding-top: 1.25rem !important;
          background: var(--app-bg, #f7f9fb) !important;
          color: var(--app-text-primary, #111827) !important;
        }

        .greeting-manage-overlay > div,
        .greeting-manage-overlay > div > div {
          min-height: 100% !important;
          background: var(--app-bg, #f7f9fb) !important;
          color: var(--app-text-primary, #111827) !important;
        }

        /* Theme bridge: the management view predates the shared shell tokens and still
           contains light-only Tailwind utilities. Scope all overrides to this page so
           both light and dark mode use the same canonical application palette. */
        .greeting-manage-overlay .bg-white,
        .greeting-manage-overlay details > div,
        .greeting-manage-overlay input,
        .greeting-manage-overlay select {
          background: var(--app-surface, #ffffff) !important;
          color: var(--app-text-primary, #111827) !important;
        }

        .greeting-manage-overlay .bg-gray-50,
        .greeting-manage-overlay .bg-gray-100 {
          background: var(--app-surface-subtle, #f4f6f8) !important;
        }

        .greeting-manage-overlay [class*="bg-emerald-50/60"] {
          background: var(--app-success-soft, rgba(16, 185, 129, 0.12)) !important;
        }

        .greeting-manage-overlay .bg-emerald-50 {
          background: var(--app-success-soft, #ecfdf5) !important;
        }

        .greeting-manage-overlay .bg-sky-50 {
          background: var(--app-info-soft, #f0f9ff) !important;
        }

        .greeting-manage-overlay .bg-rose-50 {
          background: var(--app-danger-soft, #fff1f2) !important;
        }

        .greeting-manage-overlay .text-gray-900,
        .greeting-manage-overlay .text-gray-700 {
          color: var(--app-text-primary, #111827) !important;
        }

        .greeting-manage-overlay .text-gray-600,
        .greeting-manage-overlay .text-gray-500 {
          color: var(--app-text-secondary, #667085) !important;
        }

        .greeting-manage-overlay .text-gray-400 {
          color: var(--app-text-tertiary, #98a2b3) !important;
        }

        .greeting-manage-overlay .text-emerald-700 {
          color: var(--app-success, #059669) !important;
        }

        .greeting-manage-overlay .text-rose-600,
        .greeting-manage-overlay .text-rose-700 {
          color: var(--app-danger, #dc2626) !important;
        }

        .greeting-manage-overlay .text-amber-600 {
          color: var(--app-warning, #d97706) !important;
        }

        .greeting-manage-overlay .border-gray-100,
        .greeting-manage-overlay .border-gray-200,
        .greeting-manage-overlay .border-gray-300 {
          border-color: var(--app-border-subtle, #e5e7eb) !important;
        }

        .greeting-manage-overlay .border-emerald-200,
        .greeting-manage-overlay .border-emerald-300 {
          border-color: color-mix(in srgb, var(--app-success, #10b981) 45%, transparent) !important;
        }

        .greeting-manage-overlay .border-rose-200 {
          border-color: color-mix(in srgb, var(--app-danger, #ef4444) 40%, transparent) !important;
        }

        .greeting-manage-overlay .divide-gray-100 > :not([hidden]) ~ :not([hidden]) {
          border-color: var(--app-border-subtle, #e5e7eb) !important;
        }

        .greeting-manage-overlay input,
        .greeting-manage-overlay select {
          border-color: var(--app-border, #d0d5dd) !important;
          outline: none;
        }

        .greeting-manage-overlay input::placeholder {
          color: var(--app-text-tertiary, #98a2b3) !important;
        }

        .greeting-manage-overlay input:focus,
        .greeting-manage-overlay select:focus {
          border-color: var(--app-accent, #06c755) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent, #06c755) 18%, transparent);
        }

        .greeting-manage-overlay tr:hover {
          background: var(--app-surface-subtle, #f4f6f8) !important;
        }

        .greeting-manage-overlay thead {
          background: var(--app-surface-subtle, #f4f6f8) !important;
          color: var(--app-text-secondary, #667085) !important;
        }

        .greeting-manage-overlay table,
        .greeting-manage-overlay tbody,
        .greeting-manage-overlay td,
        .greeting-manage-overlay th {
          color: inherit;
        }

        .greeting-manage-overlay details > summary,
        .greeting-manage-overlay a[class*="border-gray-300"],
        .greeting-manage-overlay button[class*="border-gray-300"] {
          background: var(--app-surface, #ffffff) !important;
          color: var(--app-text-primary, #111827) !important;
          border-color: var(--app-border, #d0d5dd) !important;
        }

        .greeting-manage-overlay details > summary:hover,
        .greeting-manage-overlay a[class*="border-gray-300"]:hover,
        .greeting-manage-overlay button[class*="border-gray-300"]:hover {
          background: var(--app-surface-subtle, #f4f6f8) !important;
        }

        .greeting-manage-overlay .ring-white {
          --tw-ring-color: var(--app-surface, #ffffff) !important;
        }

        .greeting-manage-overlay img {
          border-color: var(--app-border-subtle, #e5e7eb) !important;
        }

        .greeting-manage-overlay section,
        .greeting-manage-overlay main > div > div > aside {
          border-color: var(--app-border-subtle, #e5e7eb) !important;
        }

        .greeting-manage-overlay .shadow-sm,
        .greeting-manage-overlay .shadow-lg {
          box-shadow: var(--app-shadow-sm, 0 1px 2px rgba(16, 24, 40, 0.08)) !important;
        }

        @media (max-width: 767px) {
          .greeting-manage-overlay {
            inset: 3.75rem 0 0 0;
          }
        }
      `}</style>
    </>
  );
}
