import React from "react";

export interface PageContainerProps {
  variant?: "readable" | "wide" | "full";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PageContainer({
  variant = "readable",
  children,
  className = "",
  style,
}: PageContainerProps) {
  if (variant === "full") {
    return (
      <div style={style} className={`w-full h-full min-h-0 flex-1 flex flex-col min-w-0 overflow-hidden ${className}`}>
        {children}
      </div>
    );
  }

  if (variant === "wide") {
    return (
      <main style={style} className={`w-full flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
        <div className="mx-auto max-w-[1440px] space-y-6">
          {children}
        </div>
      </main>
    );
  }

  // default: readable (Dashboard, Follower Insights, Friend Source Links)
  return (
    <main style={style} className={`w-full flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        {children}
      </div>
    </main>
  );
}
