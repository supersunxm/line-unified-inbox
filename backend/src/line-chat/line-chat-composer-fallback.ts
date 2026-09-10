import type { Frame, Locator } from "playwright";

/**
 * LINE Manager layouts are not identical across OAs. Some expose the chat
 * composer as a single textarea that Playwright may report outside the normal
 * lower-pane geometry (or with transient visibility while the page settles).
 * When a frame has exactly one textarea and it is not a search field, treat it
 * as the same composer primitive used by the working Central World flow.
 */
export async function findSoleManagerTextarea(frame: Frame): Promise<Locator | null> {
  const textareas = frame.locator("textarea");
  const count = await textareas.count().catch(() => 0);
  if (count !== 1) return null;

  const textarea = textareas.first();
  const metadata = await textarea.evaluate((element) => ({
    placeholder: element.getAttribute("placeholder")?.toLowerCase() ?? "",
    ariaLabel: element.getAttribute("aria-label")?.toLowerCase() ?? "",
    disabled: (element as HTMLTextAreaElement).disabled,
  })).catch(() => null);
  if (!metadata || metadata.disabled) return null;

  const hint = `${metadata.placeholder} ${metadata.ariaLabel}`;
  if (/search|ค้นหา/u.test(hint)) return null;
  return textarea;
}
