import type { Metadata } from "next";
import { DownloadContent } from "./download-content";
import { latestAndroidRelease } from "./releases";

export const metadata: Metadata = {
  title: "OPPO LINE OA Chat · Android Download",
  description: "Download the latest OPPO LINE OA Chat Android app and view release history.",
  robots: { index: false, follow: false },
};

export default function DownloadAppPage() {
  return <DownloadContent release={latestAndroidRelease} />;
}
