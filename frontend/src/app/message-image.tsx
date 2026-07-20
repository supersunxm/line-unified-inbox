"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { messageMediaUrl } from "@/lib/api";
import type { ApiConversation } from "@/types/api";

type Media = ApiConversation["messages"][number]["media"];

export function MessageImage({ messageId, media, alt, unavailableLabel, errorLabel, retryLabel }: { messageId: string; media: Media; alt: string; unavailableLabel: string; errorLabel: string; retryLabel: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (media?.processingStatus !== "READY") return;
    let active = true;
    let objectUrl: string | null = null;
    void fetch(messageMediaUrl(messageId), { credentials: "include" })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error("Image unavailable");
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setSource(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media?.processingStatus, messageId, retry]);

  const close = useCallback(() => setLightboxOpen(false), []);
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, lightboxOpen]);

  if (!media) return <div className="message-image-placeholder">{unavailableLabel}</div>;
  if (media.processingStatus === "PENDING") return <div aria-label={alt} className="message-image-skeleton animate-pulse" />;
  if (media.processingStatus === "FAILED") return <div className="message-image-placeholder">{errorLabel}</div>;
  if (failed) return <div className="message-image-placeholder"><span>{errorLabel}</span><button type="button" onClick={() => { setFailed(false); setSource(null); setRetry((value) => value + 1); }}>{retryLabel}</button></div>;
  if (!source) return <div aria-label={alt} className="message-image-skeleton animate-pulse" />;

  return <><button type="button" className="message-image-button" onClick={() => setLightboxOpen(true)} aria-label={alt}><Image unoptimized width={800} height={600} src={source} alt={alt} className="message-image-thumbnail" /></button>{lightboxOpen && <div role="dialog" aria-modal="true" aria-label={alt} className="message-image-lightbox" onClick={close}><button type="button" onClick={close} className="message-image-close" aria-label="Close">×</button><Image unoptimized width={1600} height={1200} src={source} alt={alt} onClick={(event) => event.stopPropagation()} /></div>}</>;
}
