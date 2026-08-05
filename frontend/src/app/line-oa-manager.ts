export type LineOaManagerResult = "copied" | "copy-failed" | "missing";

export function validLineOaManagerUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const validManager = (url.hostname === "manager.line.biz" || url.hostname === "chat.line.biz") && /^\/account\/[^/]+\/?$/u.test(url.pathname);
    if (url.protocol !== "https:" || !validManager || url.username || url.password || url.search || url.hash) return null;
    return url.toString();
  } catch { return null; }
}

export async function openLineOaManager(options: { managerUrl?: string | null; customerName: string; copy: (value: string) => Promise<void>; open: (url: string, target: string, features: string) => unknown }): Promise<LineOaManagerResult> {
  const url = validLineOaManagerUrl(options.managerUrl);
  if (!url) return "missing";
  options.open(url, "_blank", "noopener,noreferrer");
  try { await options.copy(options.customerName); return "copied"; }
  catch { return "copy-failed"; }
}
