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
const pdfRelayInstances = new WeakSet<object>();

prototype.downloadImage = async function downloadPdfOrImage(url: string) {
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { /* original handler reports the friendly URL error */ }

  // Native PDF relay marks its temporary signed media URL with the original
  // filename. Ordinary image relay URLs do not carry this marker, so image
  // sends keep the original implementation and are not downloaded twice.
  if (parsed?.protocol === "https:" && parsed.searchParams.has("filename")) {
    const response = await fetch(parsed).catch(() => null);
    if (response?.ok) {
      const maxBytes = readPdfMaxBytes();
      const length = Number(response.headers.get("content-length") || "0");
      if (!length || length <= maxBytes) {
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 0 && buffer.length <= maxBytes && isPdfMagicBytes(buffer)) {
          pdfRelayInstances.add(this as object);
          return {
            buffer,
            mimeType: PDF_MIME_TYPE,
            filename: sanitizePdfFilename(parsed.searchParams.get("filename")),
          };
        }
      }
    }
  }

  pdfRelayInstances.delete(this as object);
  return originalDownload.call(this, url);
};

prototype.findImageInput = async function findAttachmentInput(page: Page) {
  if (!pdfRelayInstances.has(this as object)) {
    return originalFindInput.call(this, page);
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const inputs = frame.locator('input[type="file"]');
      const count = Math.min(await inputs.count().catch(() => 0), 12);
      for (let index = 0; index < count; index += 1) {
        const input = inputs.nth(index);
        const accept = ((await input.getAttribute("accept").catch(() => "")) || "").trim().toLowerCase();
        if (!accept || accept.includes("*/*") || accept.includes("application") || accept.includes("pdf")) {
          return input;
        }
      }
    }
    await page.waitForTimeout(250);
  }
  return null;
};
