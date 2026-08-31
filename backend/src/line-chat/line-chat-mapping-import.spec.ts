import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { parseMappingCsv, validateAndPlanMappings, applyMappings, type MappingRow } from "../../scripts/import-line-chat-mappings";
import type { PrismaClient } from "@prisma/client";

test("Mapping Import: parses CSV with standard headers", () => {
  const csv = `
lineOfficialAccountId,chatBotId,sessionKey
oa-id-1,U092441d025f688e389d25779dd8debf4,profile-a
oa-id-2,Ud8d5af30ddca3ed4237e157d5d73c2f1,profile-b
  `;

  const rows = parseMappingCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].lineOfficialAccountId, "oa-id-1");
  assert.equal(rows[0].chatBotId, "U092441d025f688e389d25779dd8debf4");
  assert.equal(rows[0].sessionKey, "profile-a");
  assert.equal(rows[1].lineOfficialAccountId, "oa-id-2");
  assert.equal(rows[1].sessionKey, "profile-b");
});

test("Mapping Import: rejects CSV with invalid header", () => {
  const csv = `
random_id,bot_key,session
oa-id-1,U092441d025f688e389d25779dd8debf4,profile-a
  `;

  assert.throws(() => parseMappingCsv(csv), /Invalid CSV header/);
});

test("Mapping Import: detects invalid bot ID format and duplicate OAs in dry-run validation", async () => {
  const rows: MappingRow[] = [
    { lineOfficialAccountId: "oa-1", chatBotId: "INVALID_BOT_ID", sessionKey: "profile-a" },
    { lineOfficialAccountId: "oa-1", chatBotId: "U092441d025f688e389d25779dd8debf4", sessionKey: "profile-a" },
    { lineOfficialAccountId: "oa-2", chatBotId: "U092441d025f688e389d25779dd8debf4", sessionKey: "profile-unknown" },
  ];

  const mockPrisma: any = {
    lineChatSession: {
      findMany: async () => [
        { id: "s-1", sessionKey: "profile-a" },
      ],
    },
    lineOfficialAccount: {
      findUnique: async () => null,
    },
  };

  const summary = await validateAndPlanMappings(mockPrisma as PrismaClient, rows);

  assert.equal(summary.valid, false);
  assert.ok(summary.errors.some((e) => e.includes("Invalid chatBotId")));
  assert.ok(summary.errors.some((e) => e.includes("Duplicate lineOfficialAccountId")));
  assert.ok(summary.errors.some((e) => e.includes("does not exist in database")));
});

test("Mapping Import: dry-run plan generates cleanly and apply updates database atomically", async () => {
  const rows: MappingRow[] = [
    { lineOfficialAccountId: "oa-valid-1", chatBotId: "U092441d025f688e389d25779dd8debf4", sessionKey: "profile-a" },
    { lineOfficialAccountId: "oa-valid-2", chatBotId: "Ud8d5af30ddca3ed4237e157d5d73c2f1", sessionKey: "profile-b" },
  ];

  const mockSessions = [
    { id: "sess-1", sessionKey: "profile-a" },
    { id: "sess-2", sessionKey: "profile-b" },
  ];

  const mockOas: Record<string, any> = {
    "oa-valid-1": { id: "oa-valid-1", name: "Store Mahachai 1", chatBotId: null, lineChatSession: null },
    "oa-valid-2": { id: "oa-valid-2", name: "Store Central World", chatBotId: null, lineChatSession: null },
  };

  const appliedUpdates: any[] = [];

  const mockPrisma: any = {
    lineChatSession: {
      findMany: async () => mockSessions,
    },
    lineOfficialAccount: {
      findUnique: async (args: any) => mockOas[args.where.id],
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        lineOfficialAccount: {
          update: async (args: any) => {
            appliedUpdates.push(args);
            return args.data;
          },
        },
      };
      return callback(tx);
    },
  };

  const summary = await validateAndPlanMappings(mockPrisma as PrismaClient, rows);

  assert.equal(summary.valid, true);
  assert.equal(summary.validRows, 2);
  assert.equal(summary.plans[0].oaName, "Store Mahachai 1");
  assert.equal(summary.plans[1].oaName, "Store Central World");

  // Apply mode
  const { updatedCount } = await applyMappings(mockPrisma as PrismaClient, summary.plans);
  assert.equal(updatedCount, 2);
  assert.equal(appliedUpdates.length, 2);
  assert.equal(appliedUpdates[0].data.chatBotId, "U092441d025f688e389d25779dd8debf4");
  assert.equal(appliedUpdates[0].data.lineChatSessionId, "sess-1");
  assert.equal(appliedUpdates[1].data.chatBotId, "Ud8d5af30ddca3ed4237e157d5d73c2f1");
  assert.equal(appliedUpdates[1].data.lineChatSessionId, "sess-2");
});
