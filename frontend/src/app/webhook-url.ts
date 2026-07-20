export function isValidCanonicalWebhookUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    const marker = "/webhook/";
    const markerIndex = url.pathname.indexOf(marker);
    return url.protocol === "https:" && markerIndex >= 0 && url.pathname.slice(markerIndex + marker.length).length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}
