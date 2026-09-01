import type { Metadata } from "next";
import { androidReleases } from "../releases";
import { DownloadHistoryContent } from "./history-content";

export const metadata: Metadata = {
  title: "OPPO LINE OA Chat · Version History",
  description: "Android release history for OPPO LINE OA Chat.",
  robots: { index: false, follow: false },
};

export default function DownloadHistoryPage() {
  return <DownloadHistoryContent releases={androidReleases} />;
}
