import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AutoResponseStatus, UserRole } from "@prisma/client";
import { AutoResponseService } from "./auto-response.service";
import { AuthUser } from "../auth/auth.guard";

const testAdmin: AuthUser = {
  id: "admin-1",
  username: "admin",
  role: UserRole.ADMIN,
};

describe("AutoResponseService", () => {
  it("creates a draft auto-response rule and logs audit", async () => {
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
          name: "Promotion Rule",
          description: "Test description",
          status: AutoResponseStatus.DRAFT,
          triggerType: "POSTBACK",
          contentType: "TEXT",
          textTemplate: "Hello from {{store.storeName}}",
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
        name: "Promotion Rule",
        description: "Test description",
        textTemplate: "Hello from {{store.storeName}}",
      },
      testAdmin,
    );

    assert.equal(createdData.name, "Promotion Rule");
    assert.equal(createdData.status, AutoResponseStatus.DRAFT);
    assert.equal(auditRecord.action, "AUTO_RESPONSE_CREATED");
    assert.deepEqual(result.usedVariables, ["store.storeName"]);
    assert.equal(result.usageCount, 0);
  });

  it("rejects creating rule with empty name", async () => {
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
  });

  it("updates rule and increments version when textTemplate changes", async () => {
    let updatePayload: any = null;
    let auditPayload: any = null;

    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promotion Rule",
          status: AutoResponseStatus.ACTIVE,
          textTemplate: "Old text",
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
        textTemplate: "New text with {{store.storeName}}",
      },
      testAdmin,
    );

    assert.deepEqual(updatePayload.version, { increment: 1 });
    assert.equal(auditPayload.metadata.bumpedVersion, true);
  });

  it("activates draft rule with valid text template", async () => {
    let updatedData: any = null;

    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promo",
          status: AutoResponseStatus.DRAFT,
          textTemplate: "Special offer!",
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
            textTemplate: "Special offer!",
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

  it("rejects activating rule with empty text template", async () => {
    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promo",
          status: AutoResponseStatus.DRAFT,
          textTemplate: "",
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

  it("previews rule with resolved store variables and readiness", async () => {
    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Store Info",
          textTemplate: "Welcome to {{store.storeName}}! Maps: {{store.googleMapsUrl}}",
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
    assert.equal(
      preview.resolvedText,
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
          textTemplate: "Location: {{store.googleMapsUrl}}",
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

  it("finds Rich Menu usages dynamically from template areas", async () => {
    const mockPrisma = {
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promotion Rule",
          textTemplate: "Text",
          status: AutoResponseStatus.ACTIVE,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      richMenuTemplate: {
        findMany: async () => [
          {
            id: "tmpl-1",
            name: "Default Menu",
            status: "ACTIVE",
            areasJson: [
              {
                id: "area-1",
                actionType: "POSTBACK_AUTO_RESPONSE",
                autoResponseRuleId: "rule-1",
              },
              {
                id: "area-2",
                actionType: "URI",
                actionData: "https://example.com",
              },
            ],
          },
        ],
      },
    } as any;

    const service = new AutoResponseService(mockPrisma);
    const usage = await service.getRuleUsage("rule-1");

    assert.equal(usage.usageCount, 1);
    assert.equal(usage.linkedRichMenus[0].templateName, "Default Menu");
  });
});
