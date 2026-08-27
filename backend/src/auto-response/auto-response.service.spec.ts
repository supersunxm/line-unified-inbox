import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AutoResponseContentType, AutoResponseStatus, UserRole } from "@prisma/client";
import { AutoResponseService } from "./auto-response.service";
import { AuthUser } from "../auth/auth.guard";

const testAdmin: AuthUser = {
  id: "admin-1",
  username: "admin",
  role: UserRole.ADMIN,
};

describe("AutoResponseService", () => {
  it("creates a draft auto-response rule with multi-messages and logs audit", async () => {
    let createdData: any = null;
    let auditRecord: any = null;

    const mockPrisma = {
      autoResponseRule: {
        create: async ({ data }: any) => {
          createdData = data;
          return {
            id: "rule-1",
            ...data,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActivatedAt: null,
            archivedAt: null,
          };
        },
        findUnique: async () => ({
          id: "rule-1",
          name: "Promotion Sequence",
          description: "Test description",
          status: AutoResponseStatus.DRAFT,
          triggerType: "POSTBACK",
          contentType: AutoResponseContentType.MULTI_MESSAGE,
          textTemplate: "Hello from {{store.storeName}}",
          contentJson: {
            version: 1,
            messages: [
              { id: "b1", type: "IMAGE", mediaObjectKey: "line-media/auto-response/img.jpg" },
              { id: "b2", type: "TEXT", textTemplate: "Hello from {{store.storeName}}" },
            ],
          },
          version: 1,
          createdByUserId: "admin-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastActivatedAt: null,
          archivedAt: null,
        }),
      },
      richMenuTemplate: {
        findMany: async () => [],
      },
    } as any;

    const mockAudit = {
      record: async (payload: any) => {
        auditRecord = payload;
      },
    } as any;

    const service = new AutoResponseService(mockPrisma, mockAudit);

    const result = await service.createRule(
      {
        name: "Promotion Sequence",
        description: "Test description",
        messages: [
          { id: "b1", type: "IMAGE", mediaObjectKey: "line-media/auto-response/img.jpg" },
          { id: "b2", type: "TEXT", textTemplate: "Hello from {{store.storeName}}" },
        ],
      },
      testAdmin,
    );

    assert.equal(createdData.name, "Promotion Sequence");
    assert.equal(createdData.status, AutoResponseStatus.DRAFT);
    assert.equal(createdData.contentType, AutoResponseContentType.MULTI_MESSAGE);
    assert.equal(auditRecord.action, "AUTO_RESPONSE_CREATED");
    assert.deepEqual(result.usedVariables, ["store.storeName"]);
    assert.equal(result.messages.length, 2);
    assert.equal(result.usageCount, 0);
  });

  it("rejects creating rule with empty name or invalid blocks", async () => {
    const service = new AutoResponseService({} as any);
    await assert.rejects(
      () =>
        service.createRule(
          {
            name: "   ",
            textTemplate: "Hello",
          },
          testAdmin,
        ),
      BadRequestException,
    );

    await assert.rejects(
      () =>
        service.createRule(
          {
            name: "Invalid Blocks",
            messages: [],
          },
          testAdmin,
        ),
      BadRequestException,
    );
  });

  it("updates rule and increments version when messages change", async () => {
    let updatePayload: any = null;
    let auditPayload: any = null;

    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promotion Rule",
          status: AutoResponseStatus.ACTIVE,
          textTemplate: "Old text",
          contentJson: {
            version: 1,
            messages: [{ id: "b1", type: "TEXT", textTemplate: "Old text" }],
          },
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: async ({ data }: any) => {
          updatePayload = data;
          return {
            id: "rule-1",
            name: "Promotion Rule",
            status: AutoResponseStatus.ACTIVE,
            textTemplate: "New text with {{store.storeName}}",
            contentJson: {
              version: 1,
              messages: [{ id: "b1", type: "TEXT", textTemplate: "New text with {{store.storeName}}" }],
            },
            version: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      },
      richMenuTemplate: {
        findMany: async () => [],
      },
    } as any;

    const mockAudit = {
      record: async (p: any) => {
        auditPayload = p;
      },
    } as any;

    const service = new AutoResponseService(mockPrisma, mockAudit);

    await service.updateRule(
      "rule-1",
      {
        messages: [
          { id: "b1", type: "TEXT", textTemplate: "New text with {{store.storeName}}" },
        ],
      },
      testAdmin,
    );

    assert.deepEqual(updatePayload.version, { increment: 1 });
    assert.equal(auditPayload.metadata.bumpedVersion, true);
  });

  it("activates draft rule with valid multi-message blocks", async () => {
    let updatedData: any = null;

    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promo",
          status: AutoResponseStatus.DRAFT,
          contentJson: {
            version: 1,
            messages: [
              { id: "b1", type: "IMAGE", mediaObjectKey: "line-media/img.jpg" },
              { id: "b2", type: "TEXT", textTemplate: "Special offer!" },
            ],
          },
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: async ({ data }: any) => {
          updatedData = data;
          return {
            id: "rule-1",
            name: "Promo",
            status: AutoResponseStatus.ACTIVE,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      },
      richMenuTemplate: {
        findMany: async () => [],
      },
    } as any;

    const service = new AutoResponseService(mockPrisma);
    await service.activateRule("rule-1", testAdmin);

    assert.equal(updatedData.status, AutoResponseStatus.ACTIVE);
    assert.ok(updatedData.lastActivatedAt instanceof Date);
  });

  it("rejects activating rule with empty blocks", async () => {
    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promo",
          status: AutoResponseStatus.DRAFT,
          textTemplate: "",
          contentJson: null,
          version: 1,
        }),
      },
    } as any;

    const service = new AutoResponseService(mockPrisma);
    await assert.rejects(
      () => service.activateRule("rule-1", testAdmin),
      BadRequestException,
    );
  });

  it("previews multi-message rule with resolved store variables and readiness", async () => {
    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Store Info",
          contentJson: {
            version: 1,
            messages: [
              { id: "img-1", type: "IMAGE", mediaObjectKey: "line-media/promo.jpg" },
              { id: "txt-1", type: "TEXT", textTemplate: "Welcome to {{store.storeName}}! Maps: {{store.googleMapsUrl}}" },
            ],
          },
        }),
      },
      lineOfficialAccount: {
        findUnique: async () => ({
          id: "oa-bangna",
          name: "OPPO Bangna",
          store: {
            id: "store-1",
            name: "OBS Central Bangna",
            storeMaster: {
              externalStoreId: "865",
              googleMapsUrl: "https://maps.app.goo.gl/sample",
            },
          },
        }),
      },
    } as any;

    const service = new AutoResponseService(mockPrisma);
    const preview = await service.previewRule("rule-1", {
      lineOfficialAccountId: "oa-bangna",
    });

    assert.equal(preview.ready, true);
    assert.equal(preview.messages.length, 2);
    assert.equal(preview.messages[0].type, "IMAGE");
    assert.equal(preview.messages[1].type, "TEXT");
    assert.equal(
      (preview.messages[1] as any).resolvedText,
      "Welcome to OBS Central Bangna! Maps: https://maps.app.goo.gl/sample",
    );
    assert.deepEqual(preview.unresolvedVariables, []);
  });

  it("previews rule showing blocked when required Google Maps is missing", async () => {
    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Store Location",
          contentJson: {
            version: 1,
            messages: [
              { id: "txt-1", type: "TEXT", textTemplate: "Location: {{store.googleMapsUrl}}" },
            ],
          },
        }),
      },
      lineOfficialAccount: {
        findUnique: async () => ({
          id: "oa-nomaps",
          name: "OPPO Test",
          store: {
            id: "store-2",
            name: "Test Store",
            storeMaster: {
              externalStoreId: "999",
              googleMapsUrl: null,
            },
          },
        }),
      },
    } as any;

    const service = new AutoResponseService(mockPrisma);
    const preview = await service.previewRule("rule-1", {
      lineOfficialAccountId: "oa-nomaps",
    });

    assert.equal(preview.ready, false);
    assert.match(preview.reason || "", /Google Maps/);
  });
});
