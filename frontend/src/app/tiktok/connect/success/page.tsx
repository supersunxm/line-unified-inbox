import type { Metadata } from "next";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Connected Successfully | OPPO Retail Operations",
  description: "Your TikTok account has been successfully connected to OPPO Retail Operations.",
  robots: {
    index: false,
    follow: false,
  },
};

interface VerifiedConnectResult {
  displayName?: string;
  username?: string;
  storeName?: string;
  timestamp?: number;
}

async function getVerifiedConnectResult(): Promise<VerifiedConnectResult | null> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("tiktok_connect_result")?.value;
    if (!rawCookie) {
      return null;
    }

    const jsonStr = Buffer.from(rawCookie, "base64url").toString("utf8");
    const parsed = JSON.parse(jsonStr) as VerifiedConnectResult;
    return parsed;
  } catch {
    return null;
  }
}

export default async function TikTokConnectSuccessPage() {
  const verifiedResult = await getVerifiedConnectResult();
  const displayName = verifiedResult?.displayName?.trim() || "";
  const username = verifiedResult?.username?.trim().replace(/^@+/, "") || "";
  const storeName = verifiedResult?.storeName?.trim() || "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 font-bold text-xs text-white shadow-xs dark:bg-emerald-500">
            O
          </span>
          <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-slate-100">
            OPPO Retail TikTok
          </span>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          {/* Success Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-950/20">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Heading */}
          <div className="mt-6 text-center">
            <h1 className="font-bold text-xl text-slate-900 tracking-tight sm:text-2xl dark:text-white">
              เชื่อมต่อ TikTok สำเร็จ
            </h1>
            <p className="mt-1 font-medium text-emerald-600 text-xs tracking-wide uppercase dark:text-emerald-400">
              TikTok Account Connected
            </p>
          </div>

          {/* Verified Account Details Box (rendered ONLY when signed/cookie result is present) */}
          {(displayName || username || storeName) && (
            <div className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/50">
              {displayName && (
                <div>
                  <span className="block font-medium text-[11px] text-slate-400 uppercase tracking-wider dark:text-slate-500">
                    ชื่อบัญชี TikTok / Display Name
                  </span>
                  <div className="mt-0.5 flex items-center gap-2 font-semibold text-slate-900 text-sm dark:text-slate-100">
                    <span>{displayName}</span>
                    {username && (
                      <span className="font-mono text-emerald-600 text-xs dark:text-emerald-400">
                        @{username}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {storeName && (
                <div className="border-slate-200/60 border-t pt-2.5 dark:border-slate-800/60">
                  <span className="block font-medium text-[11px] text-slate-400 uppercase tracking-wider dark:text-slate-500">
                    สาขาร้านค้าที่เชื่อมโยง / Linked Store
                  </span>
                  <span className="mt-0.5 block font-semibold text-slate-900 text-sm dark:text-slate-100">
                    {storeName}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Body Description */}
          <div className="mt-6 space-y-2 text-center text-slate-600 text-sm leading-relaxed dark:text-slate-300">
            <p>
              บัญชี TikTok ของร้านได้รับการเชื่อมต่อกับระบบ OPPO Retail Operations เรียบร้อยแล้ว
            </p>
            <p className="text-slate-500 text-xs dark:text-slate-400">
              Your TikTok account has been successfully connected to OPPO Retail Operations.
            </p>
          </div>

          {/* Footer Notice */}
          <div className="mt-8 border-slate-100 border-t pt-4 text-center dark:border-slate-800/60">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 text-xs dark:text-slate-400">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              คุณสามารถปิดหน้านี้ได้ / You may now close this page.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
