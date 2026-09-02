"use client";

import Link from "next/link";
import { LanguageControl, pickLanguageText, useAppLanguage } from "../../language";
import type { AndroidRelease } from "../releases";
import { localeFor, translatedNotes } from "../download-content";

export function DownloadHistoryContent({ releases }: { releases: AndroidRelease[] }) {
  const { language } = useAppLanguage();
  const locale = localeFor(language);
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const text = pickLanguageText(language, {
    th: { title: "ประวัติเวอร์ชัน", description: "ประวัติ OPPO LINE OA Chat สำหรับ Android ที่เผยแพร่ผ่าน lineoppo.click", back: "กลับหน้าดาวน์โหลด", version: "เวอร์ชัน", latest: "ล่าสุด", released: "เผยแพร่", download: "ดาวน์โหลด", notice: "ทุก Android release ใหม่ต้องอัปเดต version/build, วันที่เผยแพร่, APK ล่าสุด และรายการประวัติเวอร์ชันก่อนถือว่า release เสร็จสมบูรณ์" },
    en: { title: "Version history", description: "Android release history for OPPO LINE OA Chat published through lineoppo.click", back: "Back to download", version: "Version", latest: "Latest", released: "Released", download: "Download", notice: "Every new Android release must update the version/build, release date, latest APK, and version history before the release is considered complete." },
    zh: { title: "版本历史", description: "通过 lineoppo.click 发布的 OPPO LINE OA Chat Android 版本历史", back: "返回下载页面", version: "版本", latest: "最新", released: "发布日期", download: "下载", notice: "每次新的 Android 发布都必须更新版本/build、发布日期、最新 APK 和版本历史，才视为发布完成。" },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 dark:bg-[#0b0d11] dark:text-slate-100">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Android App</p><h1 className="mt-1 text-2xl font-bold">{text.title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text.description}</p></div>
          <LanguageControl />
        </div>
        <Link href="/download" className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">← {text.back}</Link>

        <div className="space-y-4">
          {releases.map((release, index) => {
            const downloadUrl = `/downloads/${release.fileName}${release.sha256 ? `?sha=${release.sha256}` : ""}`;
            const releasedAt = formatter.format(new Date(`${release.releasedAt}T00:00:00Z`));
            return (
              <article key={`${release.version}-${release.build}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#12151c]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{text.version} {release.version}+{release.build}</h2>{index === 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">{text.latest}</span>}</div><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{text.released}: <time dateTime={release.releasedAt}>{releasedAt}</time> · {release.size}</p></div>
                  <a href={downloadUrl} download={release.fileName} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">{text.download}</a>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">{translatedNotes(release, language).map((note) => <li key={note} className="flex gap-2"><span className="font-bold text-emerald-500">•</span><span>{note}</span></li>)}</ul>
              </article>
            );
          })}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{text.notice}</div>
      </div>
    </main>
  );
}
