import test from "node:test";
import assert from "node:assert/strict";
import { RichMenuController } from "./rich-menu.controller";
import { AuthRequest } from "../auth/auth.guard";
import { UserRole } from "@prisma/client";

void test("RichMenuController routes require ADMIN and forward requests to service", async () => {
  const adminReq: AuthRequest = {
    user: {
      id: "admin-1",
      email: "admin@oppo.com",
      displayName: "Admin User",
      role: UserRole.ADMIN,
    },
  } as any;

  let listCalled = false;
  let createCalled = false;
  let getCalled = false;
  let updateCalled = false;
  let deleteCalled = false;
  let previewCalled = false;
  let readinessCalled = false;
  let assignmentsCalled = false;

  const mockService = {
    listTemplates: async () => {
      listCalled = true;
      return [{ id: "t1", name: "Template 1" }];
    },
    createTemplate: async (dto: any, user: any) => {
      createCalled = true;
      return { id: "t2", name: dto.name };
    },
    getTemplate: async (id: string) => {
      getCalled = true;
      return { id, name: "Template 1" };
    },
    updateTemplate: async (id: string, dto: any) => {
      updateCalled = true;
      return { id, name: dto.name };
    },
    deleteTemplate: async (id: string) => {
      deleteCalled = true;
      return { deleted: true, id };
    },
    preview: async (id: string, body: any) => {
      previewCalled = true;
      return { templateId: id, readinessStatus: "READY" };
    },
    evaluateReadiness: async (id: string) => {
      readinessCalled = true;
      return { templateId: id, summary: { total: 10, ready: 10, blocked: 0 } };
    },
    saveAssignments: async (id: string, body: any) => {
      assignmentsCalled = true;
      return { templateId: id, assignedCount: 5 };
    },
    uploadImage: async (file: any, user: any) => {
      return { imageUrl: "https://example.com/img.png", width: 2500, height: 1686 };
    },
  } as any;

  const controller = new RichMenuController(mockService);

  const list = await controller.listTemplates();
  assert.equal(listCalled, true);
  assert.equal(list.length, 1);

  const created = await controller.createTemplate({ name: "New Tmpl", areas: [] }, adminReq);
  assert.equal(createCalled, true);
  assert.equal(created.name, "New Tmpl");

  const fetched = await controller.getTemplate("t1");
  assert.equal(getCalled, true);

  const updated = await controller.updateTemplate("t1", { name: "Updated" });
  assert.equal(updateCalled, true);

  const deleted = await controller.deleteTemplate("t1");
  assert.equal(deleteCalled, true);

  const preview = await controller.previewTemplate("t1", { lineOfficialAccountId: "oa-1" });
  assert.equal(previewCalled, true);

  const readiness = await controller.evaluateReadiness("t1");
  assert.equal(readinessCalled, true);

  const savedAssignments = await controller.saveAssignments("t1", { lineOfficialAccountIds: ["oa-1"] });
  assert.equal(assignmentsCalled, true);
});
