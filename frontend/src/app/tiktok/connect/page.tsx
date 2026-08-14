import type { Metadata } from "next";
import Link from "next/link";
import { TikTokConnectForm } from "./connect-form";

export const metadata: Metadata = {
  title: "Connect TikTok Account | OPPO Retail TikTok Monitor",
  description:
    "Connect an authorized TikTok store account to the OPPO Retail TikTok Monitor operations dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TikTokConnectPage() {
  const isConfigured = Boolean(process.env.TIKTOK_CLIENT_KEY);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#0b0d11] dark:text-slate-100">
      {/* Top Header Bar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-[#12151c]/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-xs text-white shadow-xs dark:bg-emerald-500">
              O
            </span>
            <div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                OPPO Retail TikTok Monitor
              </span>
              <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
                {" "}
                · Store Connection
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/tiktok"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Overview
            </Link>
            <Link
              href="/tiktok/dashboard"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#12151c] sm:p-10">
          {/* Header & Icon */}
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs dark:bg-emerald-950/80 dark:text-emerald-400">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.41a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.28 8.28 0 0 0 4.84 1.55V6.85a4.85 4.85 0 0 1-1.07-.16z" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
              Connect TikTok Account
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You will be redirected to TikTok to authorize read-only access for retail account, profile, and video monitoring.
            </p>
          </div>

          {/* Requested Scopes & Permissions Breakdown */}
          <div className="my-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Requested Read-Only Permissions
            </h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">TikTok profile information:</strong>{" "}
                  Account username, display name, and avatar.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">Follower &amp; account statistics:</strong>{" "}
                  Follower count, following count, total likes, and video count.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">✓</span>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">Public video metadata &amp; performance metrics:</strong>{" "}
                  Video titles, view counts, likes, comments, and shares.
                </div>
              </li>
            </ul>
          </div>

          {/* Security & Read-Only Notice */}
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-left dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">ℹ</span>
              <div>
                <strong>Read-Only Monitoring:</strong> This application only monitors store analytics and performance. It does not request permission to publish, edit, or delete videos on your account.
              </div>
            </div>
          </div>

          {/* Connect Action Form */}
          <TikTokConnectForm isConfigured={isConfigured} />

          {/* Policy & Module Links */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/tiktok" className="hover:underline">
              TikTok Overview
            </Link>
            <span>·</span>
            <Link href="/tiktok/dashboard" className="hover:underline">
              Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>© {new Date().getFullYear()} OPPO Retail Operations. All rights reserved.</p>
      </footer>
    </div>
  );
}
