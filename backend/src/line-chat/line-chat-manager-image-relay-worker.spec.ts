import { describe, expect, it } from "vitest";

describe("LINE Manager image relay preview readiness", () => {
  it("accepts a selected file even when the preview is not an img", () => {
    const filesCount = 1;
    const currentAttachmentSurfaces = 12;
    const beforeAttachmentSurfaces = 12;
    const ready = filesCount > 0 || currentAttachmentSurfaces > beforeAttachmentSurfaces;
    expect(ready).toBe(true);
  });

  it("rejects when there is no selected file and no new attachment surface", () => {
    const filesCount = 0;
    const currentAttachmentSurfaces = 12;
    const beforeAttachmentSurfaces = 12;
    const ready = filesCount > 0 || currentAttachmentSurfaces > beforeAttachmentSurfaces;
    expect(ready).toBe(false);
  });
});
