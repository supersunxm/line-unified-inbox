import assert from "node:assert/strict";
import test from "node:test";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { MassMessageController } from "./mass-message.controller";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import type { AuthRequest, AuthUser } from "../auth/auth.guard";
import {
  MassMessageAudienceType,
  MassMessageStoreMode,
} from "./mass-message.types";

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@oppo.th",
  displayName: "Admin",
  role: UserRole.ADMIN,
  isActive: true,
};

void test("MassMessageController is guarded with ADMIN role", () => {
  const reflector = new Reflector();
  const roles = reflector.get<UserRole[]>(REQUIRED_ROLES, MassMessageController);
  assert.deepEqual(roles, [UserRole.ADMIN]);
});

void test("MassMessageController preview forwards parameters to service", async () => {
  let calledWith: any = null;
  const mockService = {
    preview: async (input: any, user: AuthUser) => {
      calledWith = { input, user };
      return {
        storeCount: 1,
        eligibleStoreCount: 1,
        skippedStoreCount: 0,
        estimatedRecipientCount: 10,
        stores: [],
      };
    },
  } as any;

  const controller = new MassMessageController(mockService);
  const req = { user: adminUser } as AuthRequest;
  const body = {
    storeSelection: { mode: MassMessageStoreMode.ALL },
    audienceType: MassMessageAudienceType.ALL_KNOWN,
  };

  const result = await controller.preview(body, req);
  assert.equal(result.storeCount, 1);
  assert.deepEqual(calledWith.input, body);
  assert.equal(calledWith.user.id, "admin-1");
});

void test("MassMessageController createAndSend forwards parameters to service", async () => {
  let calledWith: any = null;
  const mockService = {
    createAndSend: async (input: any, user: AuthUser) => {
      calledWith = { input, user };
      return { id: "c-1", duplicate: false };
    },
  } as any;

  const controller = new MassMessageController(mockService);
  const req = { user: adminUser } as AuthRequest;
  const body = {
    campaignRequestId: "a0000000-0000-4000-8000-000000000001",
    storeSelection: { mode: MassMessageStoreMode.ALL },
    audienceType: MassMessageAudienceType.ALL_KNOWN,
    messages: [{ type: "text", text: "hi" }],
  };

  const result = await controller.createAndSend(body, req);
  assert.equal(result.id, "c-1");
  assert.deepEqual(calledWith.input, body);
  assert.equal(calledWith.user.id, "admin-1");
});
