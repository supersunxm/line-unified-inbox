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
    <div className="app-shell flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Navigation */}
      <TopNavigation {...topNavProps} />

      {/* Global Loading Banner */}
      {isLoading && (
        <div className="border-b border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/70 px-4 py-2 text-center text-sm font-medium text-blue-700 dark:text-blue-300">
          {topNavProps.text.loadingData || "กำลังโหลดข้อมูลจากระบบ..."}
        </div>
      )}

      {/* Global API Error Banner */}
      {apiError && (
        <div role="alert" className="flex items-center justify-center gap-3 border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/70 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300">
          <span>{topNavProps.text.apiError || "ไม่สามารถเชื่อมต่อระบบข้อมูลได้"}: {apiError}</span>
          {loadApplicationData && (
            <button
              type="button"
              onClick={() => void loadApplicationData()}
              className="rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-950 transition-colors focus-visible:ring-2 focus-visible:ring-red-500"
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
