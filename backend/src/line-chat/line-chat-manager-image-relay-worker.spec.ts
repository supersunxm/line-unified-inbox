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

describe("LINE Manager image relay delivery verification", () => {
  it("accepts a stable cleared file input even when sent image surfaces do not increase", () => {
    const beforeAttachmentSurfaces = 12;
    const polls = [
      { filesCount: 0, currentAttachmentSurfaces: 12 },
      { filesCount: 0, currentAttachmentSurfaces: 12 },
    ];
    let consecutiveClearedPolls = 0;
    let verified = false;

    for (const poll of polls) {
      if (poll.filesCount === 0) {
        consecutiveClearedPolls += 1;
        if (poll.currentAttachmentSurfaces !== beforeAttachmentSurfaces || consecutiveClearedPolls >= 2) {
          verified = true;
          break;
        }
      } else {
        consecutiveClearedPolls = 0;
      }
    }

    expect(verified).toBe(true);
  });

  it("does not accept a file input that remains selected", () => {
    const beforeAttachmentSurfaces = 12;
    const polls = [
      { filesCount: 1, currentAttachmentSurfaces: 12 },
      { filesCount: 1, currentAttachmentSurfaces: 12 },
    ];
    let consecutiveClearedPolls = 0;
    let verified = false;

    for (const poll of polls) {
      if (poll.filesCount === 0) {
        consecutiveClearedPolls += 1;
        if (poll.currentAttachmentSurfaces !== beforeAttachmentSurfaces || consecutiveClearedPolls >= 2) {
          verified = true;
          break;
        }
      } else {
        consecutiveClearedPolls = 0;
      }
    }

    expect(verified).toBe(false);
  });
});
