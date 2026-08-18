import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ดาวน์โหลดแอปพลิเคชัน OPPO LINE OA Chat (Android)",
  description: "ดาวน์โหลดและติดตั้งแอปพลิเคชัน OPPO LINE OA Chat สำหรับพนักงานขายหน้าร้าน (BM / PC)",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DownloadAppPage() {
  const apkFileName = "oppo-line-oa-chat-v1.0.5-production.apk";
  const apkDownloadUrl = `/downloads/${apkFileName}`;
  const sha256Checksum = "da00c1a50ef111cbf290ca2783575aaaa5d8c2088f0422a765d4b6219d8afc2f";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-sm text-white shadow-xs dark:bg-emerald-500">
            O
          </span>
          <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-slate-100">
            OPPO LINE OA Chat
          </span>
        </div>

        {/* Main Download Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          {/* App Icon / Badge */}
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-black p-2 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/LOGO_OBS.png"
              alt="OPPO Brand Shop"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Title & Version */}
          <div className="mt-5 text-center">
            <h1 className="font-bold text-xl text-slate-900 tracking-tight sm:text-2xl dark:text-white">
              OPPO LINE OA Chat
            </h1>
            <p className="mt-1 font-medium text-slate-500 text-xs dark:text-slate-400">
              สำหรับพนักงานขายหน้าร้าน (BM / PC)
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 text-xs dark:bg-emerald-950/60 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Version 1.0.5+6 (In-App Update & CRM Release) · 56.9 MB
            </div>
          </div>

          {/* Release Highlights */}
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-xs dark:border-slate-800/80 dark:bg-slate-900/40">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              ✨ มีอะไรใหม่ในเวอร์ชัน 1.0.5 (What&apos;s New in v1.0.5)
            </h3>
            <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span><strong>In-App APK Update System</strong>: ตรวจสอบและแจ้งเตือนเวอร์ชันใหม่อัตโนมัติเมื่อเปิดแอป พร้อมปุ่มกดอัปเดตทันที</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span><strong>Interested → Purchased Conversion</strong>: แปลงลูกค้าสนใจเป็นซื้อแล้วได้ทันทีใน 1 คลิก พร้อมเก็บสเปกเดิมครบ</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span><strong>Customer Sales CRM Improvement</strong>: ปรับปรุงระดับความสนใจแบบเป็นกลาง (Neutral State) และตัวเลือกที่ชัดเจนยิ่งขึ้น</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span><strong>Multi-Product Tagging & Confirmation</strong>: บันทึกสินค้าได้หลายรายการพร้อมหน้าต่างยืนยันสรุปข้อมูลก่อนบันทึก</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">•</span>
                <span><strong>Customer Sales Timeline</strong>: ติดตามประวัติการบันทึกและระยะเวลาปิดการขาย (Conversion Time) บน Web Monitor</span>
              </li>
            </ul>
          </div>

          {/* Download Action Button */}
          <div className="mt-6">
            <a
              href={apkDownloadUrl}
              download={apkFileName}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-sm text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>ดาวน์โหลด APK (Download APK)</span>
            </a>
          </div>

          {/* Checksum Details */}
          <div className="mt-4 rounded-lg bg-slate-50 p-2.5 text-center text-[10px] text-slate-400 dark:bg-slate-900/60 dark:text-slate-500">
            <span className="font-semibold uppercase tracking-wider">SHA-256 Checksum:</span>
            <div className="mt-0.5 truncate font-mono">{sha256Checksum}</div>
          </div>

          {/* Step-by-Step Installation Guide */}
          <div className="mt-6 border-slate-100 border-t pt-5 dark:border-slate-800/60">
            <h2 className="font-semibold text-slate-900 text-xs uppercase tracking-wider dark:text-slate-200">
              ขั้นตอนการติดตั้งบนมือถือ / แท็บเล็ต (Installation Steps)
            </h2>
            <ol className="mt-3 space-y-3 text-slate-600 text-xs leading-relaxed dark:text-slate-300">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  1
                </span>
                <span>กดปุ่ม <strong>ดาวน์โหลด APK</strong> ด้านบน และรอจนกว่าการดาวน์โหลดจะเสร็จสมบูรณ์</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  2
                </span>
                <span>เปิดไฟล์ที่ดาวน์โหลดมา หากขึ้นเตือนความปลอดภัย ให้เลือก <strong>&ldquo;ตั้งค่า (Settings)&rdquo;</strong> และเปิดอนุญาต <strong>&ldquo;ติดตั้งแอปจากแหล่งที่ไม่รู้จัก (Allow from this source)&rdquo;</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  3
                </span>
                <span>กด <strong>&ldquo;ติดตั้ง (Install)&rdquo;</strong> เมื่อติดตั้งเสร็จแล้วกด <strong>&ldquo;เปิด (Open)&rdquo;</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  4
                </span>
                <span>ลงทะเบียนบัญชีพนักงานใหม่ หรือเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ได้รับอนุมัติ</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Footer Support */}
        <div className="text-center text-slate-400 text-xs dark:text-slate-500">
          พบปัญหาการติดตั้ง? ติดต่อผู้ดูแลระบบฝ่ายปฏิบัติการ OPPO
        </div>
      </div>
    </main>
  );
}
