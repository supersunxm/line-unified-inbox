import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { AuthRequest, AuthUser } from "../auth/auth.guard";
import { MassMessageController } from "./mass-message.controller";
import type { MassMessageService } from "./mass-message.service";
import {
  MassMessageAudienceType,
  MassMessageStoreMode,
} from "./mass-message.types";

const admin: AuthUser = {
  id: "admin-1",
  email: "admin@example.com",
  displayName: "Admin",
  role: UserRole.ADMIN,
  isActive: true,
};

const request = { user: admin } as AuthRequest;

test("SELECTED_USERS preview is rejected before scope resolution", async () => {
  let previewCalled = false;
  const service = {
    preview: async () => {
      previewCalled = true;
      throw new Error("preview should not be called");
    },
  } as unknown as MassMessageService;
  const controller = new MassMessageController(service);

  await assert.rejects(
    () =>
      controller.preview(
        {
          storeSelection: { mode: MassMessageStoreMode.ALL },
          audienceType: MassMessageAudienceType.SELECTED_USERS,
        },
        request,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(previewCalled, false);
});

test("SELECTED_USERS cannot enter legacy create-and-send flow", async () => {
  let sendCalled = false;
  const service = {
    createAndSend: async () => {
      sendCalled = true;
      throw new Error("send should not be called");
    },
  } as unknown as MassMessageService;
  const controller = new MassMessageController(service);

  await assert.rejects(
    () =>
      controller.createAndSend(
        {
          campaignRequestId: "a0000000-0000-4000-8000-000000000001",
          storeSelection: { mode: MassMessageStoreMode.ALL },
          audienceType: MassMessageAudienceType.SELECTED_USERS,
          messages: [{ type: "text", text: "must not send" }],
        },
        request,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(sendCalled, false);
});
