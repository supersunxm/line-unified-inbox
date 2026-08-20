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
    <div className="app-shell flex flex-col min-h-screen bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      {/* Top Navigation */}
      <TopNavigation {...topNavProps} />

      {/* Global Loading Banner */}
      {isLoading && (
        <div className="border-b border-[var(--app-info)]/30 bg-[var(--app-info-soft)] px-4 py-2 text-center text-xs font-medium text-[var(--app-info)]">
          {topNavProps.text.loadingData || "กำลังโหลดข้อมูลจากระบบ..."}
        </div>
      )}

      {/* Global API Error Banner */}
      {apiError && (
        <div role="alert" className="flex items-center justify-center gap-3 border-b border-[var(--app-danger)]/30 bg-[var(--app-danger-soft)] px-4 py-2 text-xs font-medium text-[var(--app-danger)]">
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

      {/* Main Workspace Layout Container */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {children}
      </div>
    </div>
  );
}

