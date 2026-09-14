const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPdfDocumentToken(value: string): boolean {
  return uuidPattern.test(value);
}

export function createPdfDocumentUrl(mediaId: string): string {
  if (!isPdfDocumentToken(mediaId)) throw new Error("PDF document token must be a UUID");
  const rawBase = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
  if (!rawBase || !rawBase.startsWith("https://")) {
    throw new Error("PUBLIC_WEBHOOK_BASE_URL must be a valid public HTTPS URL for customer documents");
  }
  const base = rawBase;
  return `${base.replace(/\/$/, "")}/d/${encodeURIComponent(mediaId)}`;
}
