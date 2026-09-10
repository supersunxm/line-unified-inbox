import type { Frame, Locator } from "playwright";

/**
 * LINE Manager layouts are not identical across OAs. Some expose the chat
 * composer as a single textarea before the control is actually ready for
 * manual chat. Treat that sole non-search textarea as the composer only when
 * LINE Manager itself reports it as editable. Never remove disabled/readonly
 * state in the DOM: doing so can create a fake editable control that accepts
 * text visually but is not wired to LINE's real send handler.
 */
export async function findSoleManagerTextarea(frame: Frame): Promise<Locator | null> {
  const textareas = frame.locator("textarea");
  const count = await textareas.count().catch(() => 0);
  if (count !== 1) return null;

  const textarea = textareas.first();
  const metadata = await textarea.evaluate((element) => ({
    placeholder: element.getAttribute("placeholder")?.toLowerCase() ?? "",
    ariaLabel: element.getAttribute("aria-label")?.toLowerCase() ?? "",
  })).catch(() => null);
  if (!metadata) return null;

  const hint = `${metadata.placeholder} ${metadata.ariaLabel}`;
  if (/search|ค้นหา/u.test(hint)) return null;

  const editable = await textarea.isEditable().catch(() => false);
  if (!editable) return null;

  return textarea;
}
