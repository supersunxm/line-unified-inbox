import assert from "node:assert/strict";
import test from "node:test";
import { PdfValidationError, DEFAULT_PDF_MAX_BYTES, isPdfFilename, isPdfMagicBytes, readPdfMaxBytes, sanitizePdfFilename, validatePdfBuffer } from "./pdf-media";
import { createPdfDocumentUrl, isPdfDocumentToken } from "./pdf-document-url";

const validPdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");

void test("PDF filename validation is case-insensitive and rejects missing extensions", () => {
  assert.equal(isPdfFilename("invoice.PDF"), true);
  assert.equal(isPdfFilename("invoice.pdf "), true);
  assert.equal(isPdfFilename("invoice.pdf.exe"), false);
  assert.equal(isPdfFilename("invoice"), false);
  assert.equal(isPdfFilename(undefined), false);
});

void test("PDF filenames are sanitized without preserving path traversal", () => {
  assert.equal(sanitizePdfFilename("../customer\\statement.pdf"), "__customer_statement.pdf");
  assert.equal(sanitizePdfFilename("\u0000statement.pdf"), "statement.pdf");
  assert.equal(sanitizePdfFilename(""), "document.pdf");
  assert.equal(sanitizePdfFilename("statement.exe"), "statement.exe");
});

void test("PDF magic-byte detection requires the PDF header", () => {
  assert.equal(isPdfMagicBytes(validPdf), true);
  assert.equal(isPdfMagicBytes(Buffer.from("PK\\x03\\x04")), false);
  assert.equal(isPdfMagicBytes(Buffer.from("%PDF")), false);
});

void test("PDF validation accepts application/pdf and octet-stream with a valid signature", () => {
  assert.deepEqual(validatePdfBuffer({ buffer: validPdf, filename: "statement.pdf", mimeType: "application/pdf; charset=binary" }), {
    filename: "statement.pdf",
    mimeType: "application/pdf",
    fileSize: validPdf.length,
  });
  assert.equal(validatePdfBuffer({ buffer: validPdf, filename: "statement.pdf", mimeType: "application/octet-stream" }).mimeType, "application/pdf");
  assert.equal(validatePdfBuffer({ buffer: validPdf, filename: "statement.pdf" }).fileSize, validPdf.length);
});

void test("PDF validation rejects wrong extension, MIME, signature, and empty content", () => {
  for (const input of [
    { filename: "statement.txt", mimeType: "application/pdf", expected: "PDF_EXTENSION_REQUIRED" },
    { filename: "statement.pdf", mimeType: "image/png", expected: "PDF_MIME_REQUIRED" },
    { filename: "statement.pdf", mimeType: "application/pdf", buffer: Buffer.from("not pdf"), expected: "PDF_SIGNATURE_INVALID" },
    { filename: "statement.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0), expected: "PDF_TOO_LARGE" },
  ]) {
    assert.throws(
      () => validatePdfBuffer({ buffer: input.buffer ?? validPdf, filename: input.filename, mimeType: input.mimeType }),
      (error: unknown) => error instanceof PdfValidationError && error.code === input.expected,
    );
  }
});

void test("PDF validation enforces the centralized maximum size", () => {
  assert.throws(
    () => validatePdfBuffer({ buffer: validPdf, filename: "statement.pdf", maxBytes: validPdf.length - 1 }),
    (error: unknown) => error instanceof PdfValidationError && error.code === "PDF_TOO_LARGE",
  );
  assert.equal(readPdfMaxBytes({ MEDIA_MAX_PDF_FILE_SIZE_BYTES: "1234" }), 1234);
  assert.equal(readPdfMaxBytes({ MEDIA_MAX_PDF_FILE_SIZE_BYTES: "invalid" }), DEFAULT_PDF_MAX_BYTES);
});

void test("customer PDF URLs use opaque UUID tokens and HTTPS", () => {
  const previousBase = process.env.PUBLIC_WEBHOOK_BASE_URL;
  process.env.PUBLIC_WEBHOOK_BASE_URL = "https://files.example.test/";
  try {
    const token = "11111111-1111-4111-8111-111111111111";
    assert.equal(isPdfDocumentToken(token), true);
    assert.equal(isPdfDocumentToken("1"), false);
    assert.equal(createPdfDocumentUrl(token), "https://files.example.test/d/11111111-1111-4111-8111-111111111111");
    assert.throws(() => createPdfDocumentUrl("not-a-token"));
  } finally {
    if (previousBase === undefined) delete process.env.PUBLIC_WEBHOOK_BASE_URL;
    else process.env.PUBLIC_WEBHOOK_BASE_URL = previousBase;
  }
});
