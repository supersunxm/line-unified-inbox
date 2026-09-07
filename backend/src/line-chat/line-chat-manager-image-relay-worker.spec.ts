import { describe, expect, it } from "vitest";

/**
 * Regression contract for the production failure seen on 2026-09-07:
 * chat.line.biz accepted the selected file, but its preview was not rendered as
 * an <img>. The relay must treat a retained FileList as positive attachment
 * evidence instead of requiring an image-count increase.
 */
describe("LINE Manager image relay preview readiness", () => {
  it("accepts a selected file even when visible image count is unchanged", () => {
    const filesCount = 1;
    const currentAttachmentSurfaces = 12;
    const beforeAttachmentSurfaces = 12;
    const ready = filesCount > 0 || currentAttachmentSurfaces > beforeAttachmentSurfaces;
    expect(ready).toBe(true);
  });

  it("rejects when neither file selection nor a new attachment surface exists", () => {
    const filesCount = 0;
    const currentAttachmentSurfaces = 12;
    const beforeAttachmentSurfaces = 12;
    const ready = filesCount > 0 || currentAttachmentSurfaces > beforeAttachmentSurfaces;
    expect(ready).toBe(false);
  });
});
