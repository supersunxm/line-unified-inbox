import type { Metadata } from "next";
import Link from "next/link";
import { androidReleases } from "../releases";

export const metadata: Metadata = {
  title: "ประวัติเวอร์ชัน OPPO LINE OA Chat",
  description: "ประวัติ Android release ของ OPPO LINE OA Chat",
  robots: { index: false, follow: false },
};

export default function DownloadHistoryPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Android App</p>
            <h1 className="mt-1 text-2xl font-bold">ประวัติเวอร์ชัน</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Version history ของ OPPO LINE OA Chat ที่เผยแพร่ผ่าน lineoppo.click</p>
          </div>
          <Link href="/download" className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">กลับหน้าดาวน์โหลด</Link>
        </div>

        <div className="space-y-4">
          {androidReleases.map((release, index) => {
            const downloadUrl = `/downloads/${release.fileName}${release.sha256 ? `?sha=${release.sha256}` : ""}`;
            return (
              <article key={`${release.version}-${release.build}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#12151c]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold">Version {release.version}+{release.build}</h2>
                      {index === 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Latest</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Released: <time dateTime={release.releasedAt}>{release.releasedAtDisplay}</time> · {release.size}</p>
                  </div>
                  <a href={downloadUrl} download={release.fileName} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">ดาวน์โหลด</a>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {release.notes.map((note) => <li key={note} className="flex gap-2"><span className="font-bold text-emerald-500">•</span><span>{note}</span></li>)}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          ทุก Android release ใหม่ต้องอัปเดต version/build, วันที่เผยแพร่, APK ล่าสุด และรายการประวัติเวอร์ชันก่อนถือว่า release เสร็จสมบูรณ์
        </div>
      </div>
    </main>
  );
}
