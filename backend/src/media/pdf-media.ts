export const PDF_MIME_TYPE = "application/pdf";
export const DEFAULT_PDF_MAX_BYTES = 20 * 1024 * 1024;

export class PdfValidationError extends Error {
  constructor(readonly code: "PDF_EXTENSION_REQUIRED" | "PDF_MIME_REQUIRED" | "PDF_SIGNATURE_INVALID" | "PDF_TOO_LARGE", message: string) {
    super(message);
  }
}

export function readPdfMaxBytes(environment: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(environment.MEDIA_MAX_PDF_FILE_SIZE_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_PDF_MAX_BYTES;
}

export function isPdfFilename(filename?: string | null): boolean {
  return typeof filename === "string" && /\.pdf$/i.test(filename.trim());
}

export function sanitizePdfFilename(filename?: string | null): string {
  const normalized = (filename ?? "document.pdf")
    .normalize("NFKC")
    .replace(/[\\/]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/"/g, "_")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join("")
    .trim()
    .replace(/^\.+$/, "document.pdf")
    .slice(0, 180);
  if (!normalized) return "document.pdf";
  return normalized;
}

export function isPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).equals(Buffer.from("%PDF-"));
}

export function validatePdfBuffer(input: {
  buffer: Buffer;
  filename?: string | null;
  mimeType?: string | null;
  maxBytes?: number;
}) {
  if (!isPdfFilename(input.filename)) {
    throw new PdfValidationError("PDF_EXTENSION_REQUIRED", "Only PDF files are supported");
  }
  const declaredMime = (input.mimeType ?? "").split(";", 1)[0].trim().toLowerCase();
  if (declaredMime && declaredMime !== PDF_MIME_TYPE && declaredMime !== "application/octet-stream") {
    throw new PdfValidationError("PDF_MIME_REQUIRED", "The uploaded file MIME type is not PDF");
  }
  const maxBytes = input.maxBytes ?? readPdfMaxBytes();
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new PdfValidationError("PDF_TOO_LARGE", "The configured PDF limit is invalid");
  }
  if (!input.buffer.length || input.buffer.length > maxBytes) {
    throw new PdfValidationError("PDF_TOO_LARGE", "PDF files must be 20 MB or smaller");
  }
  if (!isPdfMagicBytes(input.buffer)) {
    throw new PdfValidationError("PDF_SIGNATURE_INVALID", "The uploaded file is not a valid PDF");
  }
  return {
    filename: sanitizePdfFilename(input.filename),
    mimeType: PDF_MIME_TYPE,
    fileSize: input.buffer.length,
  };
}
