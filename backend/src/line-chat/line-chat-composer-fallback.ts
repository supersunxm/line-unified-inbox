import type { Frame, Locator } from "playwright";

/**
 * LINE Manager layouts are not identical across OAs. Some expose the chat
 * composer as a single textarea that Playwright reports as transiently
 * disabled/readonly while the page settles. When a frame has exactly one
 * textarea and it is not a search field, treat it as the same composer
 * primitive used by the working Central World flow and activate that DOM
 * control before returning it to the relay worker.
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

  await textarea.evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) return;
    element.disabled = false;
    element.readOnly = false;
    element.removeAttribute("disabled");
    element.removeAttribute("readonly");
  }).catch(() => {});

  return textarea;
}
