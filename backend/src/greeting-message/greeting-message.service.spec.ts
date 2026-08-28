import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  GreetingSendPolicy,
  GreetingTemplateStatus,
  LineAccountType,
} from "@prisma/client";
import { GreetingMessageService } from "./greeting-message.service";

function createMockPrisma() {
  const templates: any[] = [];
  const assignments: any[] = [];
  const accounts: any[] = [];

  return {
    greetingTemplate: {
      findMany: async (args?: any) => {
        let result = [...templates];
        if (args?.where?.status) {
          if (args.where.status.not) {
            result = result.filter((t) => t.status !== args.where.status.not);
          } else {
            result = result.filter((t) => t.status === args.where.status);
          }
        }
        return result.map((t) => ({
          ...t,
          assignments: assignments.filter((a) => a.templateId === t.id),
        }));
      },
      findUnique: async (args: { where: { id: string } }) => {
        const t = templates.find((item) => item.id === args.where.id);
        if (!t) return null;
        return {
          ...t,
          assignments: assignments.filter((a) => a.templateId === t.id),
        };
      },
      create: async (args: any) => {
        const item = {
          id: `tmpl-${templates.length + 1}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          activatedAt: null,
          archivedAt: null,
        };
        templates.push(item);
        return {
          ...item,
          assignments: [],
        };
      },
      update: async (args: any) => {
        const idx = templates.findIndex((t) => t.id === args.where.id);
        if (idx === -1) throw new Error("Not found");
        const current = templates[idx];
        const updated = {
          ...current,
          ...args.data,
          version:
            args.data.version?.increment !== undefined
              ? current.version + args.data.version.increment
              : (args.data.version ?? current.version),
          updatedAt: new Date(),
        };
        templates[idx] = updated;
        return {
          ...updated,
          assignments: assignments.filter((a) => a.templateId === updated.id),
        };
      },
    },
    greetingStoreAssignment: {
      findMany: async (args?: any) => {
        if (args?.where?.templateId) {
          return assignments.filter((a) => a.templateId === args.where.templateId);
        }
        return assignments;
      },
      deleteMany: async (args?: any) => {
        const countBefore = assignments.length;
        if (args?.where?.templateId) {
          const keep = assignments.filter((a) => {
            if (a.templateId !== args.where.templateId) return true;
            if (args.where.lineOfficialAccountId?.notIn) {
              return args.where.lineOfficialAccountId.notIn.includes(
                a.lineOfficialAccountId,
              );
            }
            return false;
          });
          assignments.length = 0;
          assignments.push(...keep);
        }
        return { count: countBefore - assignments.length };
      },
      upsert: async (args: any) => {
        const idx = assignments.findIndex(
          (a) => a.lineOfficialAccountId === args.where.lineOfficialAccountId,
        );
        if (idx >= 0) {
          assignments[idx] = { ...assignments[idx], ...args.update };
          return assignments[idx];
        }
        const created = {
          id: `asg-${assignments.length + 1}`,
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        assignments.push(created);
        return created;
      },
    },
    lineOfficialAccount: {
      findMany: async (args?: any) => {
        if (args?.where?.id?.in) {
          return accounts.filter((a) => args.where.id.in.includes(a.id));
        }
        let result = [...accounts];
        if (args?.where?.accountType) {
          result = result.filter((a) => a.accountType === args.where.accountType);
        }
        return result.map((oa) => ({
          ...oa,
          greetingStoreAssignment: assignments.find(
            (asg) => asg.lineOfficialAccountId === oa.id,
          )
            ? {
                ...assignments.find((asg) => asg.lineOfficialAccountId === oa.id),
                template: templates.find(
                  (t) =>
                    t.id ===
                    assignments.find((asg) => asg.lineOfficialAccountId === oa.id)
                      .templateId,
                ),
              }
            : null,
        }));
      },
      findUnique: async (args: { where: { id: string } }) => {
        return accounts.find((a) => a.id === args.where.id) || null;
      },
      findFirst: async (args?: any) => {
        if (args?.where?.storeId) {
          return accounts.find((a) => a.storeId === args.where.storeId) || null;
        }
        return accounts[0] || null;
      },
    },
    $transaction: async (fn: any) => fn(createMockPrismaDirect(templates, assignments, accounts)),
    _raw: { templates, assignments, accounts },
  };
}

function createMockPrismaDirect(templates: any[], assignments: any[], accounts: any[]) {
  return {
    greetingStoreAssignment: {
      deleteMany: async (args?: any) => {
        if (args?.where?.templateId) {
          const keep = assignments.filter((a) => {
            if (a.templateId !== args.where.templateId) return true;
            if (args.where.lineOfficialAccountId?.notIn) {
              return args.where.lineOfficialAccountId.notIn.includes(
                a.lineOfficialAccountId,
              );
            }
            return false;
          });
          assignments.length = 0;
          assignments.push(...keep);
        }
        return { count: 0 };
      },
      upsert: async (args: any) => {
        const idx = assignments.findIndex(
          (a) => a.lineOfficialAccountId === args.where.lineOfficialAccountId,
        );
        if (idx >= 0) {
          assignments[idx] = { ...assignments[idx], ...args.update };
          return assignments[idx];
        }
        const created = {
          id: `asg-${assignments.length + 1}`,
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        assignments.push(created);
        return created;
      },
    },
  };
}

test("GreetingMessageService: create, update, activate, deactivate, archive lifecycle", async () => {
  const prisma = createMockPrisma();
  const service = new GreetingMessageService(prisma as any);

  // 1. Create DRAFT
  const created = await service.createTemplate({
    name: "Welcome Promo",
    description: "New follower greeting",
    sendPolicy: GreetingSendPolicy.FIRST_TIME_ONLY,
    messages: [
      { id: "1", type: "TEXT", textTemplate: "สวัสดี {{user.displayName}}" },
    ],
  });

  assert.equal(created.name, "Welcome Promo");
  assert.equal(created.status, GreetingTemplateStatus.DRAFT);
  assert.equal(created.version, 1);
  assert.equal(created.messages.length, 1);

  // 2. Update with content change -> version increments to 2
  const updated = await service.updateTemplate(created.id, {
    messages: [
      { id: "1", type: "TEXT", textTemplate: "สวัสดี {{user.displayName}} ยินดีต้อนรับ" },
      { id: "2", type: "IMAGE", mediaObjectKey: "line-media/greeting/pic.jpg" },
    ],
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.messages.length, 2);

  // 3. Update only name -> version remains 2
  const updatedName = await service.updateTemplate(created.id, {
    name: "Welcome Promo 2026",
  });
  assert.equal(updatedName.name, "Welcome Promo 2026");
  assert.equal(updatedName.version, 2);

  // 4. Activate template
  const activated = await service.activateTemplate(created.id);
  assert.equal(activated.status, GreetingTemplateStatus.ACTIVE);
  assert.ok(activated.activatedAt);

  // 5. Deactivate template (status becomes INACTIVE)
  const deactivated = await service.deactivateTemplate(created.id);
  assert.equal(deactivated.status, GreetingTemplateStatus.INACTIVE);

  // 6. Archive template
  const archived = await service.archiveTemplate(created.id);
  assert.equal(archived.status, GreetingTemplateStatus.ARCHIVED);
  assert.ok(archived.archivedAt);

  // Cannot update archived template
  await assert.rejects(
    service.updateTemplate(created.id, { name: "Archived Rename" }),
    BadRequestException,
  );
});

test("GreetingMessageService: store readiness and multi-store assignment", async () => {
  const prisma = createMockPrisma();

  // Populate accounts
  prisma._raw.accounts.push(
    {
      id: "oa-bangna",
      name: "OPPO Central Bangna",
      basicId: "@oppo_bangna",
      accountType: LineAccountType.STORE,
      isActive: true,
      archivedAt: null,
      storeId: "store-bangna",
      encryptedChannelAccessToken: "enc-token-1",
      store: {
        id: "store-bangna",
        name: "Central Bangna",
        code: "ST-001",
        storeMaster: {
          storeName: "Central Bangna",
          googleMapsUrl: "https://maps.app.goo.gl/bangna",
          province: "กรุงเทพมหานคร",
        },
      },
    },
    {
      id: "oa-pinklao",
      name: "OPPO Central Pinklao",
      basicId: "@oppo_pinklao",
      accountType: LineAccountType.STORE,
      isActive: true,
      archivedAt: null,
      storeId: "store-pinklao",
      encryptedChannelAccessToken: "enc-token-2",
      store: {
        id: "store-pinklao",
        name: "Central Pinklao",
        code: "ST-002",
        storeMaster: {
          storeName: "Central Pinklao",
          googleMapsUrl: null, // Missing Maps
          province: "กรุงเทพมหานคร",
        },
      },
    },
    {
      id: "oa-hq",
      name: "OPPO Thailand Main OA",
      basicId: "@oppothai",
      accountType: LineAccountType.HEAD_OFFICE, // Ineligible
      isActive: true,
      archivedAt: null,
      storeId: null,
      encryptedChannelAccessToken: "enc-token-hq",
    },
  );

  const service = new GreetingMessageService(prisma as any);

  // Template A uses ONLY store.storeName and user.displayName
  const tmplA = await service.createTemplate({
    name: "Simple Greeting",
    messages: [
      {
        id: "1",
        type: "TEXT",
        textTemplate: "สวัสดี {{user.displayName}} จาก {{store.storeName}}",
      },
    ],
  });

  const readinessA = await service.getReadiness(tmplA.id);
  assert.equal(readinessA.totalStores, 2); // Excludes HEAD_OFFICE
  assert.equal(readinessA.readyStores, 2); // Both ready because Maps is not required
  assert.equal(readinessA.blockedStores, 0);

  // Template B uses store.googleMapsUrl
  const tmplB = await service.createTemplate({
    name: "Map Greeting",
    messages: [
      {
        id: "1",
        type: "TEXT",
        textTemplate: "แผนที่ร้าน: {{store.googleMapsUrl}}",
      },
    ],
  });

  const readinessB = await service.getReadiness(tmplB.id);
  assert.equal(readinessB.totalStores, 2);
  assert.equal(readinessB.readyStores, 1); // Bangna ready
  assert.equal(readinessB.blockedStores, 1); // Pinklao blocked due to missing Maps

  // Assign template A to Bangna and Pinklao
  const assignRes = await service.assignStores(tmplA.id, {
    lineOfficialAccountIds: ["oa-bangna", "oa-pinklao"],
  });
  assert.equal(assignRes.assignedCount, 2);

  const tmplAFetch = await service.getTemplate(tmplA.id);
  assert.equal(tmplAFetch.assignedStoreCount, 2);

  // Attempt to assign HEAD_OFFICE -> rejects
  await assert.rejects(
    service.assignStores(tmplA.id, {
      lineOfficialAccountIds: ["oa-hq"],
    }),
    BadRequestException,
  );

  // Re-assigning Bangna to template B replaces its assignment from template A
  await service.assignStores(tmplB.id, {
    lineOfficialAccountIds: ["oa-bangna"],
  });

  const tmplBFetch = await service.getTemplate(tmplB.id);
  assert.equal(tmplBFetch.assignedStoreCount, 1);
  assert.deepEqual(tmplBFetch.assignedOaIds, ["oa-bangna"]);
});

test("GreetingMessageService: preview resolves variables without network calls", async () => {
  const prisma = createMockPrisma();
  prisma._raw.accounts.push({
    id: "oa-bangna",
    name: "OPPO Central Bangna",
    basicId: "@oppo_bangna",
    accountType: LineAccountType.STORE,
    isActive: true,
    archivedAt: null,
    storeId: "store-bangna",
    encryptedChannelAccessToken: "enc-token-1",
    store: {
      id: "store-bangna",
      name: "Central Bangna",
      storeMaster: {
        storeName: "Central Bangna",
        googleMapsUrl: "https://maps.app.goo.gl/bangna",
      },
    },
  });

  const service = new GreetingMessageService(prisma as any);
  const tmpl = await service.createTemplate({
    name: "Preview Test",
    messages: [
      {
        id: "1",
        type: "TEXT",
        textTemplate: "ยินดีต้อนรับคุณ {{user.displayName}} สู่ {{store.storeName}} ({{account.name}})",
      },
    ],
  });

  const preview = await service.preview(tmpl.id, {
    lineOfficialAccountId: "oa-bangna",
    sampleCustomerName: "คุณนภัสสร",
  });

  assert.equal(preview.ready, true);
  assert.equal(preview.sampleCustomerName, "คุณนภัสสร");
  assert.equal(preview.messages[0].type, "TEXT");
  if (preview.messages[0].type === "TEXT") {
    assert.equal(
      preview.messages[0].resolvedText,
      "ยินดีต้อนรับคุณ คุณนภัสสร สู่ Central Bangna (OPPO Central Bangna)",
    );
  }
});
