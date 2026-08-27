export const DEFAULT_CUSTOMER_NAME = "LINE Customer";
export const MAX_NOTIFICATION_TEXT_LENGTH = 160;

/**
 * Keep notification text safe and readable on compact system surfaces.
 * LINE message text is customer-controlled, so do not carry newlines or
 * unbounded content into an OS notification.
 */
export function normalizeNotificationText(
  value: unknown,
  fallback = "",
  maxLength = MAX_NOTIFICATION_TEXT_LENGTH,
): string {
  const source = typeof value === "string" ? value : fallback;
  const compact = source.replace(/\s+/g, " ").trim();
  if (!compact) return fallback.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  const suffix = "...";
  return `${compact.slice(0, Math.max(0, maxLength - suffix.length))}${suffix}`;
}

export function notificationMediaPreview(messageType: unknown): string | null {
  switch (typeof messageType === "string" ? messageType.toUpperCase() : "") {
    case "IMAGE":
      return "📷 ส่งรูปภาพ";
    case "VIDEO":
      return "🎥 ส่งวิดีโอ";
    case "STICKER":
      return "ส่งสติกเกอร์";
    case "FILE":
      return "ส่งไฟล์";
    case "AUDIO":
      return "ส่งเสียง";
    case "LOCATION":
      return "ส่งตำแหน่ง";
    case "UNSUPPORTED":
      return "ไม่สามารถแสดงข้อความจากลูกค้าได้";
    default:
      return null;
  }
}

export function notificationTitle(
  customerName: unknown,
  storeName?: unknown,
): string {
  const customer = normalizeNotificationText(
    customerName,
    DEFAULT_CUSTOMER_NAME,
    80,
  ) || DEFAULT_CUSTOMER_NAME;
  const store = normalizeNotificationText(storeName, "", 80);
  return store ? `${customer} • ${store}` : customer;
}

export function notificationBody(
  messageType: unknown,
  preview: unknown,
): string {
  const mediaFallback = notificationMediaPreview(messageType);
  if (mediaFallback) return mediaFallback;
  return normalizeNotificationText(
    preview,
    "ไม่สามารถแสดงข้อความจากลูกค้าได้",
  );
}

export function buildNotificationContent(input: {
  customerName?: unknown;
  storeName?: unknown;
  messageType?: unknown;
  preview?: unknown;
}): { title: string; body: string } {
  return {
    title: notificationTitle(input.customerName, input.storeName),
    body: notificationBody(input.messageType, input.preview),
  };
}
