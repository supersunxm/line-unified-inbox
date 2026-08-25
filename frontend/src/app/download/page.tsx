import type { Metadata } from "next";
import Link from "next/link";
import { latestAndroidRelease } from "./releases";

export const metadata: Metadata = {
  title: "ดาวน์โหลดแอปพลิเคชัน OPPO LINE OA Chat (Android)",
  description: "ดาวน์โหลด OPPO LINE OA Chat เวอร์ชันล่าสุดสำหรับ Android พร้อมดูวันที่อัปเดตและประวัติเวอร์ชัน",
  robots: { index: false, follow: false },
};

export default function DownloadAppPage() {
  const release = latestAndroidRelease;
  const apkDownloadUrl = `/downloads/${release.fileName}?sha=${release.sha256}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-150 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-sm text-white shadow-xs dark:bg-emerald-500">O</span>
          <span className="font-semibold text-base tracking-tight">OPPO LINE OA Chat</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8 dark:border-slate-800/80 dark:bg-[#12151c] dark:shadow-none">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-black p-2 shadow-lg ring-1 ring-slate-200 dark:ring-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/LOGO_OBS.png" alt="OPPO Brand Shop" className="h-full w-full object-contain" />
          </div>

          <div className="mt-5 text-center">
            <h1 className="font-bold text-xl tracking-tight sm:text-2xl dark:text-white">OPPO LINE OA Chat</h1>
            <p className="mt-1 font-medium text-slate-500 text-xs dark:text-slate-400">สำหรับ HQ / BM / PC</p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 text-xs dark:bg-emerald-950/60 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Latest · Version {release.version}+{release.build} · {release.size}
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">อัปเดตล่าสุด: {release.releasedAtDisplay}</p>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-xs dark:border-slate-800/80 dark:bg-slate-900/40">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">มีอะไรใหม่ในเวอร์ชัน {release.version}</h3>
            <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">
              {release.notes.map((note) => (
                <li key={note} className="flex items-start gap-1.5"><span className="font-bold text-emerald-500">•</span><span>{note}</span></li>
              ))}
            </ul>
          </div>

          <div className="mt-6 space-y-2.5">
            <a href={apkDownloadUrl} download={release.fileName} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 font-semibold text-sm text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>ดาวน์โหลด APK เวอร์ชันล่าสุด</span>
            </a>
            <Link href="/download/history" className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              ดูประวัติเวอร์ชัน
            </Link>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-2.5 text-center text-[10px] text-slate-400 dark:bg-slate-900/60 dark:text-slate-500">
            <span className="font-semibold uppercase tracking-wider">SHA-256 Checksum:</span>
            <div className="mt-0.5 truncate font-mono">{release.sha256}</div>
          </div>

          <div className="mt-6 border-slate-100 border-t pt-5 dark:border-slate-800/60">
            <h2 className="font-semibold text-xs uppercase tracking-wider dark:text-slate-200">ขั้นตอนการติดตั้งบนมือถือ / แท็บเล็ต</h2>
            <ol className="mt-3 space-y-3 text-slate-600 text-xs leading-relaxed dark:text-slate-300">
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">1</span><span>หากเคยติดตั้งแอปเวอร์ชัน 1.0.12 หรือต่ำกว่า ให้ถอนการติดตั้งเวอร์ชันเดิมก่อน เนื่องจากเวอร์ชัน 1.0.13 เปลี่ยนเป็น Android package ใหม่</span></li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">2</span><span>กดปุ่ม <strong>ดาวน์โหลด APK เวอร์ชันล่าสุด</strong> และรอจนดาวน์โหลดเสร็จ</span></li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">3</span><span>เปิดไฟล์ที่ดาวน์โหลดมา หากขึ้นเตือนความปลอดภัย ให้เปิดอนุญาต <strong>ติดตั้งแอปจากแหล่งที่ไม่รู้จัก</strong></span></li>
              <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">4</span><span>กด <strong>ติดตั้ง</strong> แล้วเปิดแอปเพื่อเข้าสู่ระบบหรือสมัครบัญชี</span></li>
            </ol>
          </div>
        </div>

        <div className="text-center text-slate-400 text-xs dark:text-slate-500">พบปัญหาการติดตั้ง? ติดต่อผู้ดูแลระบบฝ่ายปฏิบัติการ OPPO</div>
      </div>
    </main>
  );
}
