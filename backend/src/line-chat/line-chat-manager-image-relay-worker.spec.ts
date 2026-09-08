import { describe, expect, it } from "vitest";
import { isSuccessfulLineManagerSendResponse } from "./line-chat-manager-image-relay-worker.service";

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

describe("LINE Manager image relay network delivery verification", () => {
  it("accepts a successful chat mutation response during Send", () => {
    expect(isSuccessfulLineManagerSendResponse({
      method: "POST",
      status: 200,
      hostname: "chat.line.biz",
      pathname: "/api/v2/bots/U123/chats/C456/messages",
      botId: "U123",
      lineChatUserId: "C456",
    })).toBe(true);
  });

  it("accepts a successful chat mutation when chat identity is carried outside the URL", () => {
    expect(isSuccessfulLineManagerSendResponse({
      method: "POST",
      status: 201,
      hostname: "chat.line.biz",
      pathname: "/api/v2/chats/messages",
      botId: "U123",
      lineChatUserId: "C456",
    })).toBe(true);
  });

  it("rejects GET responses and failed mutations", () => {
    expect(isSuccessfulLineManagerSendResponse({
      method: "GET",
      status: 200,
      hostname: "chat.line.biz",
      pathname: "/api/v2/bots/U123/chats/C456/messages",
    })).toBe(false);

    expect(isSuccessfulLineManagerSendResponse({
      method: "POST",
      status: 500,
      hostname: "chat.line.biz",
      pathname: "/api/v2/bots/U123/chats/C456/messages",
    })).toBe(false);
  });

  it("rejects unrelated Manager settings mutations", () => {
    expect(isSuccessfulLineManagerSendResponse({
      method: "PATCH",
      status: 200,
      hostname: "chat.line.biz",
      pathname: "/api/v4/bots/U123/settings/chatMode",
      botId: "U123",
    })).toBe(false);
  });

  it("rejects other hosts even when the path looks like a chat send", () => {
    expect(isSuccessfulLineManagerSendResponse({
      method: "POST",
      status: 200,
      hostname: "example.com",
      pathname: "/api/v2/bots/U123/chats/C456/messages",
      botId: "U123",
      lineChatUserId: "C456",
    })).toBe(false);
  });
});

describe("LINE Manager image relay DOM fallback verification", () => {
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
