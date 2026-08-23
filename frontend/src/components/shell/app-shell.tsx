import React from "react";
import { TopNavigation, TopNavigationProps } from "./top-navigation";

export interface AppShellProps extends TopNavigationProps {
  isLoading?: boolean;
  apiError?: string | null;
  loadApplicationData?: () => Promise<void> | void;
  children: React.ReactNode;
}

export function AppShell({
  isLoading,
  apiError,
  loadApplicationData,
  children,
  ...topNavProps
}: AppShellProps) {
  return (
    <div className="app-shell flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <style>{`
        @media (min-width: 768px) {
          .app-mobile-scroll,
          .app-shell-status {
            margin-left: var(--app-sidebar-width, 16rem);
            width: calc(100% - var(--app-sidebar-width, 16rem));
            transition: margin-left 200ms ease, width 200ms ease;
          }
        }

        @media (max-width: 767px) {
          html,
          body {
            width: 100%;
            max-width: 100%;
            height: 100%;
            overflow: hidden !important;
            overscroll-behavior: none;
          }

          .app-shell {
            position: relative;
            width: 100%;
            height: 100dvh !important;
            min-height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
            padding-bottom: 0 !important;
          }

          .app-mobile-scroll {
            min-height: 0 !important;
            flex: 1 1 auto;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            overscroll-behavior-y: none;
            -webkit-overflow-scrolling: touch;
            padding-bottom: calc(4.35rem + env(safe-area-inset-bottom));
          }

          .app-shell[data-mobile-chat-view="chat"] .app-mobile-scroll,
          .app-shell[data-mobile-chat-view="info"] .app-mobile-scroll {
            padding-bottom: 0 !important;
            overflow-y: hidden !important;
          }

          .app-shell[data-mobile-chat-view] .app-header {
            display: none !important;
          }

          .app-shell.app-shell[data-mobile-chat-view="list"] {
            padding-bottom: 0 !important;
          }

          .app-header {
            position: relative !important;
            display: flex !important;
            width: 100%;
            max-width: 100vw;
            min-height: 3.75rem !important;
            height: 3.75rem !important;
            flex: 0 0 3.75rem;
            flex-wrap: nowrap !important;
            align-items: center !important;
            overflow: visible;
            padding: 0.55rem 0.75rem !important;
          }

          .app-header > div:first-child {
            width: auto;
            min-width: 0;
            flex: 1 1 auto;
            gap: 0.5rem !important;
          }

          .app-shell main,
          .app-shell section,
          .app-shell article,
          .app-shell div { min-width: 0; }

          .app-shell img,
          .app-shell svg,
          .app-shell canvas { max-width: 100%; }
        }
      `}</style>

      <TopNavigation {...topNavProps} />

      {isLoading && (
        <div className="app-shell-status shrink-0 border-b border-[var(--app-info)]/30 bg-[var(--app-info-soft)] px-4 py-2 text-center text-xs font-medium text-[var(--app-info)]">
          {topNavProps.text.loadingData || "กำลังโหลดข้อมูลจากระบบ..."}
        </div>
      )}

      {apiError && (
        <div role="alert" className="app-shell-status shrink-0 flex items-center justify-center gap-3 border-b border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] px-4 py-2 text-xs font-medium text-[var(--app-danger)]">
          <span>{topNavProps.text.apiError || "ไม่สามารถเชื่อมต่อระบบข้อมูลได้"}: {apiError}</span>
          {loadApplicationData && (
            <button
              type="button"
              onClick={() => void loadApplicationData()}
              className="rounded-[var(--app-radius-sm)] border border-[var(--app-danger)]/30 bg-[var(--app-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--app-danger)] hover:bg-[var(--app-danger)] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-danger)]/40"
            >
              {topNavProps.text.retry || "ลองอีกครั้ง"}
            </button>
          )}
        </div>
      )}

      <div className="app-mobile-scroll flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
