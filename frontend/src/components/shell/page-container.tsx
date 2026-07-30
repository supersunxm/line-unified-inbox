import React from "react";

export interface PageContainerProps {
  variant?: "readable" | "wide" | "full";
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  variant = "readable",
  children,
  className = "",
}: PageContainerProps) {
  if (variant === "full") {
    return (
      <div className={`w-full h-full min-h-0 flex-1 flex flex-col min-w-0 ${className}`}>
        {children}
      </div>
    );
  }

  if (variant === "wide") {
    return (
      <main className={`w-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
        <div className="mx-auto max-w-[1440px] space-y-6">
          {children}
        </div>
      </main>
    );
  }

  // default: readable (Dashboard, Follower Insights, Friend Source Links)
  return (
    <main className={`w-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 ${className}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        {children}
      </div>
    </main>
  );
}
