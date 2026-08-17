import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unable to Connect TikTok | OPPO Retail Operations",
  description: "There was a problem connecting your TikTok account to OPPO Retail Operations.",
  robots: {
    index: false,
    follow: false,
  },
};

interface PageProps {
  searchParams: Promise<{
    reason?: string;
  }>;
}

interface ErrorContent {
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  badge: string;
}

function getErrorContent(reason?: string): ErrorContent {
  switch (reason) {
    case "authorization_denied":
      return {
        badge: "Authorization Cancelled",
        titleTh: "การอนุญาตถูกยกเลิก",
        titleEn: "Authorization Denied or Cancelled",
        descTh: "การอนุญาตเชื่อมต่อบัญชี TikTok ถูกยกเลิกหรือปฏิเสธ หากต้องการเชื่อมต่อกรุณาลองใหม่อีกครั้ง",
        descEn: "Authorization was cancelled or denied. Please try again if you wish to connect your store account.",
      };
    case "store_not_found":
      return {
        badge: "Store Not Found",
        titleTh: "ไม่พบบัญชีร้านค้าในระบบ",
        titleEn: "Store Account Not Found",
        descTh: "ไม่พบข้อมูลร้านค้า OPPO ที่ลงทะเบียนตรงกับชื่อผู้ใช้ TikTok นี้ กรุณาตรวจสอบว่าใช้บัญชี TikTok ที่ลงทะเบียนไว้กับทางร้าน หรือติดต่อ Retail Operations",
        descEn: "We could not match this TikTok account with an OPPO store. Please confirm that you are using the registered TikTok account for your store or contact Retail Operations.",
      };
    case "duplicate_store_mapping":
      return {
        badge: "Duplicate Mapping",
        titleTh: "พบข้อมูลร้านค้าซ้ำซ้อน",
        titleEn: "Duplicate Store Mapping",
        descTh: "พบข้อมูลร้านค้าซ้ำซ้อนในระบบสำหรับบัญชี TikTok นี้ กรุณาติดต่อ Retail Operations เพื่อตรวจสอบความถูกต้อง",
        descEn: "Multiple store records match this TikTok username. Please contact Retail Operations to resolve the store mapping.",
      };
    case "invalid_state":
      return {
        badge: "Session Expired",
        titleTh: "เซสชันหมดอายุหรือไม่ถูกต้อง",
        titleEn: "Invalid or Expired Session",
        descTh: "เซสชันการเชื่อมต่อหมดอายุหรือไม่ถูกต้องเพื่อความปลอดภัย กรุณากดปุ่มด้านล่างเพื่อเริ่มกระบวนการใหม่อีกครั้ง",
        descEn: "The authorization session expired or was invalid. Please restart the connection process.",
      };
    case "oauth_failed":
    default:
      return {
        badge: "Connection Error",
        titleTh: "ไม่สามารถเชื่อมต่อได้",
        titleEn: "Unable to Connect TikTok",
        descTh: "เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี TikTok กรุณาลองใหม่อีกครั้ง หรือติดต่อฝ่ายปฏิบัติการค้าปลีก (Retail Operations)",
        descEn: "An error occurred while connecting your TikTok account. Please try again later or contact Retail Operations.",
      };
  }
}

export default async function TikTokConnectErrorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const content = getErrorContent(params.reason);

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
          {/* Error Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-8 ring-rose-50/50 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-950/20">
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
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Heading */}
          <div className="mt-6 text-center">
            <h1 className="font-bold text-xl text-slate-900 tracking-tight sm:text-2xl dark:text-white">
              {content.titleTh}
            </h1>
            <p className="mt-1 font-medium text-rose-600 text-xs tracking-wide uppercase dark:text-rose-400">
              {content.titleEn}
            </p>
          </div>

          {/* Description Box */}
          <div className="mt-6 space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center text-slate-600 text-sm leading-relaxed dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-300">
            <p>{content.descTh}</p>
            <p className="text-slate-500 text-xs dark:text-slate-400">{content.descEn}</p>
          </div>

          {/* Try Again Action */}
          <div className="mt-8 space-y-3">
            <Link
              href="/tiktok/connect"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-sm text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <span>ลองใหม่อีกครั้ง / Try Again</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Footer Notice */}
          <div className="mt-6 border-slate-100 border-t pt-4 text-center dark:border-slate-800/60">
            <span className="font-medium text-slate-400 text-xs dark:text-slate-500">
              Retail Operations Support: ติดต่อฝ่ายปฏิบัติการค้าปลีก
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
