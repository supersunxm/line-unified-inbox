import React from "react";
import { TopNavigation, TopNavigationProps } from "./top-navigation";

export interface AppShellProps extends TopNavigationProps {
  isLoading?: boolean;
  apiError?: string | null;
  loadApplicationData?: () => Promise<void> | void;
  children: React.ReactNode;
}

const shellFallbacks = {
  th: {
    dashboard: "แดชบอร์ด",
    language: "ภาษา",
    searchPlaceholder: "ค้นหาลูกค้า ร้านค้า หรือข้อความ",
    loadingData: "กำลังโหลดข้อมูลจากระบบ...",
    apiError: "ไม่สามารถเชื่อมต่อระบบข้อมูลได้",
    retry: "ลองอีกครั้ง",
  },
  en: {
    dashboard: "Dashboard",
    language: "Language",
    searchPlaceholder: "Search customers, stores, or messages",
    loadingData: "Loading system data...",
    apiError: "Unable to connect to the data service",
    retry: "Retry",
  },
  zh: {
    dashboard: "仪表盘",
    language: "语言",
    searchPlaceholder: "搜索客户、门店或消息",
    loadingData: "正在加载系统数据...",
    apiError: "无法连接数据服务",
    retry: "重试",
  },
} as const;

export function AppShell({
  isLoading,
  apiError,
  loadApplicationData,
  children,
  ...topNavProps
}: AppShellProps) {
  const fallback = shellFallbacks[topNavProps.language];
  const normalizedText = {
    ...topNavProps.text,
    dashboard:
      topNavProps.language === "zh" && topNavProps.text.dashboard === "Dashboard"
        ? fallback.dashboard
        : topNavProps.text.dashboard || fallback.dashboard,
    language:
      topNavProps.language === "zh" && topNavProps.text.language === "Language"
        ? fallback.language
        : topNavProps.text.language || fallback.language,
    searchPlaceholder:
      topNavProps.language === "zh" && (topNavProps.text.searchPlaceholder === "Search" || topNavProps.text.searchPlaceholder === "Search customers, stores, or messages")
        ? fallback.searchPlaceholder
        : topNavProps.text.searchPlaceholder || fallback.searchPlaceholder,
    loadingData: topNavProps.text.loadingData || fallback.loadingData,
    apiError: topNavProps.text.apiError || fallback.apiError,
    retry: topNavProps.text.retry || fallback.retry,
  };

  return (
    <div className="app-shell flex h-dvh min-h-dvh max-h-dvh w-full min-w-0 max-w-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      <style>{`
        @media (min-width: 768px) {
          html,
          body {
            height: 100%;
            max-height: 100dvh;
            overflow: hidden !important;
          }
          .app-shell {
            height: 100dvh !important;
            max-height: 100dvh !important;
            overflow: hidden !important;
          }
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

      <TopNavigation {...topNavProps} text={normalizedText} />

      {isLoading && (
        <div className="app-shell-status shrink-0 border-b border-[var(--app-info)]/30 bg-[var(--app-info-soft)] px-4 py-2 text-center text-xs font-medium text-[var(--app-info)]">
          {normalizedText.loadingData}
        </div>
      )}

      {apiError && (
        <div role="alert" className="app-shell-status shrink-0 flex items-center justify-center gap-3 border-b border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] px-4 py-2 text-xs font-medium text-[var(--app-danger)]">
          <span>{normalizedText.apiError}: {apiError}</span>
          {loadApplicationData && (
            <button
              type="button"
              onClick={() => void loadApplicationData()}
              className="rounded-[var(--app-radius-sm)] border border-[var(--app-danger)]/30 bg-[var(--app-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--app-danger)] hover:bg-[var(--app-danger)] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-danger)]/40"
            >
              {normalizedText.retry}
            </button>
          )}
        </div>
      )}

      <div className="app-mobile-scroll flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
