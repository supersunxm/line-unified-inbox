import type { Locator, Page } from "playwright";
import { LineChatManagerImageRelayWorkerService } from "./line-chat-manager-image-relay-worker.service";
import { isPdfMagicBytes, PDF_MIME_TYPE, readPdfMaxBytes, sanitizePdfFilename } from "../media/pdf-media";

type RelayPrototype = {
  downloadImage: (url: string) => Promise<{ buffer: Buffer; mimeType: string; filename: string }>;
  findImageInput: (page: Page) => Promise<Locator | null>;
};

const prototype = LineChatManagerImageRelayWorkerService.prototype as unknown as RelayPrototype;
const originalDownload = prototype.downloadImage;
const originalFindInput = prototype.findImageInput;

prototype.downloadImage = async function downloadPdfOrImage(url: string) {
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { /* original handler reports the friendly URL error */ }
  if (parsed?.protocol === "https:") {
    const response = await fetch(parsed).catch(() => null);
    if (response?.ok) {
      const maxBytes = readPdfMaxBytes();
      const length = Number(response.headers.get("content-length") || "0");
      if (!length || length <= maxBytes) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 0 && buffer.length <= maxBytes && isPdfMagicBytes(buffer)) {
          return {
            buffer,
            mimeType: PDF_MIME_TYPE,
            filename: sanitizePdfFilename(parsed.searchParams.get("filename")),
          };
        }
      }
    }
  }
  return originalDownload.call(this, url);
};

prototype.findImageInput = async function findAttachmentInput(page: Page) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const inputs = frame.locator('input[type="file"]');
      const count = Math.min(await inputs.count().catch(() => 0), 12);
      let imageFallback: Locator | null = null;
      for (let index = 0; index < count; index += 1) {
        const input = inputs.nth(index);
        const accept = ((await input.getAttribute("accept").catch(() => "")) || "").trim().toLowerCase();
        if (!accept || accept.includes("*/*") || accept.includes("application") || accept.includes("pdf")) return input;
        if (!imageFallback && (accept.includes("image") || accept.includes("jpg") || accept.includes("png"))) imageFallback = input;
      }
      if (imageFallback) return imageFallback;
    }
    await page.waitForTimeout(250);
  }
  return originalFindInput.call(this, page);
};
