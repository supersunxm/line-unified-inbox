"use client";

import { useEffect, useState } from "react";
import { messageMediaUrl } from "@/lib/api";
import type { ApiConversation } from "@/types/api";

type Media = ApiConversation["messages"][number]["media"];

function statusLabel(media: Media, unavailableLabel: string, errorLabel: string): string | null {
  if (!media) return unavailableLabel;
  if (media.processingStatus === "PENDING") return "กำลังเตรียมไฟล์...";
  if (media.processingStatus === "FAILED") return errorLabel;
  if (media.processingStatus === "SKIPPED") return unavailableLabel;
  return null;
}

export function MessageVideo({
  messageId,
  media,
}: {
  messageId: string;
  media: Media;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (media?.processingStatus !== "READY") return;
    let active = true;
    let objectUrl: string | null = null;
    void fetch(messageMediaUrl(messageId), { credentials: "include" })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.startsWith("video/")) {
          throw new Error("Video unavailable");
        }
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setSource(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media?.processingStatus, messageId]);

  const label = failed
    ? "โหลดวิดีโอไม่สำเร็จ"
    : statusLabel(media, "วิดีโอไม่ได้ถูกจัดเก็บ", "โหลดวิดีโอไม่สำเร็จ");
  if (label) return <div className="message-image-placeholder">{label}</div>;
  if (!source) return <div className="message-image-skeleton animate-pulse" aria-label="กำลังโหลดวิดีโอ" />;

  return (
    <video
      className="max-h-[360px] max-w-full rounded-lg"
      controls
      playsInline
      preload="metadata"
      src={source}
    />
  );
}

export function MessageFileAttachment({
  messageId,
  media,
  fileName,
}: {
  messageId: string;
  media: Media;
  fileName: string | null;
}) {
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = statusLabel(media, "ไฟล์ไม่ได้ถูกจัดเก็บ", "โหลดไฟล์ไม่สำเร็จ");

  if (label) return <div className="message-image-placeholder">{label}</div>;

  const download = async () => {
    setDownloading(true);
    setFailed(false);
    try {
      const response = await fetch(messageMediaUrl(messageId), { credentials: "include" });
      if (!response.ok) throw new Error("File unavailable");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName?.trim() || "attachment";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={downloading}
      className="flex max-w-full items-center gap-2 rounded-lg border border-current/20 px-3 py-2 text-left text-sm disabled:opacity-60"
    >
      <span aria-hidden>📎</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{fileName?.trim() || "ไฟล์แนบ"}</span>
        <span className="block text-xs opacity-70">
          {failed ? "ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง" : downloading ? "กำลังดาวน์โหลด..." : "กดเพื่อดาวน์โหลด"}
        </span>
      </span>
    </button>
  );
}
