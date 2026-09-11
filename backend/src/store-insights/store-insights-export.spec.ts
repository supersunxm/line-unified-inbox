import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { ForbiddenException } from "@nestjs/common";
import { StoreInsightsController } from "./store-insights.controller";
import { StoreInsightsService } from "./store-insights.service";
import { CUSTOMER_VOICE_ANALYSIS_VERSION } from "./customer-voice-taxonomy";

const user = { id: "user-1", email: "user@example.test", displayName: "Viewer", role: "VIEWER", isActive: true } as never;
const currentVersion = CUSTOMER_VOICE_ANALYSIS_VERSION;

function message(id: string, direction: "INBOUND" | "OUTBOUND" | "SYSTEM", sentAt: string, extras: Record<string, unknown> = {}) {
  return {
    id,
    direction,
    messageType: "TEXT",
    originalText: extras.originalText ?? `raw message ${id}`,
    sentAt: new Date(sentAt),
    senderUserId: null,
    senderDisplayName: null,
    sender: null,
    rawPayload: null,
    ...extras,
  };
}

function analysis(version: string, primaryTopic: string | null, intent: string | null, processedAt = "2026-09-05T04:00:00.000Z") {
  return {
    analysisVersion: version,
    source: primaryTopic ? "RULE_ENRICHED" : "UNCLASSIFIED",
    primaryTopic,
    secondaryTopics: [],
    intent,
    productMentions: primaryTopic ? ["OPPO Reno16"] : [],
    confidence: primaryTopic ? 0.9 : null,
    inputMessageCount: 1,
    lastAnalyzedMessageAt: new Date("2026-09-05T03:00:00.000Z"),
    processedAt: new Date(processedAt),
    modelProvider: null,
    modelName: version.replace("customer-voice-", ""),
  };
}

function conversation(id: string, storeId: string, messages: unknown[], analyses: unknown[] = []) {
  return {
    id,
    customerId: `line-user-${id}`,
    latestMessageAt: new Date("2026-09-05T04:00:00.000Z"),
    customer: { id: `line-user-${id}`, displayName: `Private Customer ${id}` },
    messages,
    customerSalesStatus: "PURCHASED",
    sourceChannels: [],
    isInstallment: false,
    paymentMethod: null,
    purchaseRecordedAt: null,
    purchaseRecordedById: null,
    salesRecordedAt: null,
    salesRecordedById: null,
    salesProducts: [{ customProductName: null, productModel: { id: "model-1", name: "OPPO Reno16", productSeries: { name: "Reno Series" } } }],
    products: [],
    topics: [{ topic: { name: "Existing Topic" } }],
    customerVoiceAnalyses: analyses,
    storeId,
    isQa: false,
    lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
  };
}

function buildService(options: {
  storeIds: string[];
  conversations?: Record<string, unknown[]>;
  deniedStoreId?: string;
}) {
  const calls: { conversationWhere: unknown[]; messageWhere: unknown[]; access: string[] } = { conversationWhere: [], messageWhere: [], access: [] };
  const stores = new Map(options.storeIds.map((storeId) => [storeId, {
    id: storeId,
    name: `Store ${storeId}`,
    code: `CODE-${storeId}`,
    region: "Central",
    storeMaster: { externalStoreId: `EXT-${storeId}`, province: "Bangkok", region: "Central" },
    lineOfficialAccounts: [{ id: `oa-${storeId}`, name: `OA ${storeId}`, basicId: `@${storeId}`, connectionStatus: "CONNECTED", lastWebhookReceivedAt: null }],
  }]));
  const prisma = {
    store: {
      findFirst: async ({ where }: { where: { id: string } }) => stores.get(where.id) ?? null,
    },
    conversation: {
      findMany: async (args: { where: { storeId: string }; select: { messages: { where: unknown } } }) => {
        calls.conversationWhere.push(args.where);
        calls.messageWhere.push(args.select.messages.where);
        return options.conversations?.[args.where.storeId] ?? [];
      },
    },
    activityHistory: { findMany: async () => [] },
    lineOaFollowerSnapshot: { findMany: async () => [] },
  };
  const access = {
    assertStoreAccess: async (_currentUser: unknown, storeId: string) => {
      calls.access.push(storeId);
      if (storeId === options.deniedStoreId) throw new ForbiddenException("Store access is forbidden");
    },
  };
  return { service: new StoreInsightsService(prisma as never, access as never), calls };
}

async function workbookFor(result: { buffer: Buffer }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  return workbook;
}

test("single-store export creates the four analytics sheets and uses the requested filename", async () => {
  const storeId = "store-1";
  const rows = [conversation(storeId, storeId, [
    message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z"),
    message("out-1", "OUTBOUND", "2026-09-05T03:10:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One" }),
  ], [analysis(currentVersion, "Price Inquiry", "PRICE_CHECK")])];
  const { service } = buildService({ storeIds: [storeId], conversations: { [storeId]: rows } });

  const result = await service.export(user, { storeIds: [storeId], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" });
  const workbook = await workbookFor(result);

  assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(result.filename, "store-360_EXT-store-1_20260905-20260905.xlsx");
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Summary", "Conversations", "Customer Voice", "Responders"]);
  assert.equal(workbook.getWorksheet("Summary")!.getRow(2).getCell(5).value, 1);
  assert.equal(workbook.getWorksheet("Conversations")!.getRow(2).getCell(3).value, "conv_cd9eb030bab0cbb7");
  assert.equal(workbook.getWorksheet("Customer Voice")!.getRow(2).getCell(4).value, currentVersion);
  assert.equal(workbook.getWorksheet("Responders")!.getRow(2).getCell(3).value, "Staff One");
});

test("multi-store export includes exactly the explicitly selected stores, including the seven-store path", async () => {
  const storeIds = Array.from({ length: 7 }, (_, index) => `store-${index + 1}`);
  const conversations = Object.fromEntries(storeIds.map((storeId) => [storeId, [conversation(`conversation-${storeId}`, storeId, [message(`in-${storeId}`, "INBOUND", "2026-09-05T03:00:00.000Z")])]]));
  const { service } = buildService({ storeIds, conversations });

  const result = await service.export(user, { storeIds, startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" });
  const workbook = await workbookFor(result);
  const summary = workbook.getWorksheet("Summary")!;

  assert.equal(result.filename, "store-360_multi_20260905-20260905.xlsx");
  assert.equal(summary.rowCount, 8);
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => summary.getRow(index + 2).getCell(1).value), storeIds.map((storeId) => `EXT-${storeId}`));
});

test("export rejects an unauthorized store before reading analytics rows", async () => {
  const { service, calls } = buildService({ storeIds: ["store-1", "store-2"], deniedStoreId: "store-2" });
  await assert.rejects(
    service.export(user, { storeIds: ["store-1", "store-2"], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" }),
    ForbiddenException,
  );
  assert.equal(calls.conversationWhere.length, 0);
});

test("export uses Bangkok inclusive dates and the existing 24-hour response look-ahead", async () => {
  const { service, calls } = buildService({ storeIds: ["store-1"], conversations: { "store-1": [] } });
  await service.export(user, { storeIds: ["store-1"], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" });

  assert.deepEqual(calls.conversationWhere[0], {
    storeId: "store-1",
    isQa: false,
    lineOfficialAccount: { accountType: "STORE", isActive: true, archivedAt: null },
    messages: { some: { direction: "INBOUND", sentAt: { gte: new Date("2026-09-04T17:00:00.000Z"), lt: new Date("2026-09-05T17:00:00.000Z") } } },
  });
  assert.deepEqual(calls.messageWhere[0], { sentAt: { gte: new Date("2026-09-04T17:00:00.000Z"), lt: new Date("2026-09-06T17:00:00.000Z") } });
});

test("export includes only the current Customer Voice version and does not double-count historical rows", async () => {
  const storeId = "store-1";
  const rows = [conversation("conversation-1", storeId, [message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z")], [
    analysis("customer-voice-rules-v1", "Other", "GENERAL"),
    analysis("customer-voice-rules-v2", "Promotion", "PURCHASE_CONSIDERATION"),
    analysis(currentVersion, "Price Inquiry", "PRICE_CHECK"),
  ])];
  const { service } = buildService({ storeIds: [storeId], conversations: { [storeId]: rows } });
  const workbook = await workbookFor(await service.export(user, { storeIds: [storeId], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" }));

  const summary = workbook.getWorksheet("Summary")!.getRow(2);
  const voice = workbook.getWorksheet("Customer Voice")!;
  assert.equal(summary.getCell(15).value, 1);
  assert.equal(summary.getCell(16).value, 1);
  assert.equal(voice.rowCount, 2);
  assert.equal(voice.getRow(2).getCell(4).value, currentVersion);
});

test("export contains no customer PII or raw message text and attributes only human responders", async () => {
  const storeId = "store-1";
  const rows = [conversation("conversation-privacy", storeId, [
    message("in-1", "INBOUND", "2026-09-05T03:00:00.000Z", { originalText: "RAW CUSTOMER MESSAGE" }),
    message("out-human", "OUTBOUND", "2026-09-05T03:01:00.000Z", { senderUserId: "staff-1", senderDisplayName: "Staff One" }),
    message("out-bot", "OUTBOUND", "2026-09-05T03:02:00.000Z", { senderDisplayName: "Auto Reply Bot" }),
    message("out-system", "SYSTEM", "2026-09-05T03:03:00.000Z", { senderDisplayName: "System" }),
  ])];
  const { service } = buildService({ storeIds: [storeId], conversations: { [storeId]: rows } });
  const workbook = await workbookFor(await service.export(user, { storeIds: [storeId], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" }));

  const values = workbook.worksheets.flatMap((sheet) => sheet.getSheetValues().flat().filter((value): value is string => typeof value === "string"));
  assert.equal(values.includes("RAW CUSTOMER MESSAGE"), false);
  assert.equal(values.includes("line-user-conversation-privacy"), false);
  assert.equal(values.includes("Private Customer conversation-privacy"), false);
  assert.deepEqual(workbook.getWorksheet("Responders")!.getRow(2).values.slice(1, 6), ["EXT-store-1", "Store store-1", "Staff One", 1, 1]);
  assert.equal(values.includes("Auto Reply Bot"), false);
  assert.equal(values.includes("System"), false);
});

test("empty-data stores still return a valid workbook with headers and a zero-safe summary", async () => {
  const { service } = buildService({ storeIds: ["empty-store"], conversations: { "empty-store": [] } });
  const workbook = await workbookFor(await service.export(user, { storeIds: ["empty-store"], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" }));

  assert.equal(workbook.getWorksheet("Summary")!.getRow(2).getCell(5).value, 0);
  assert.equal(workbook.getWorksheet("Customer Voice")!.rowCount, 1);
  assert.equal(workbook.getWorksheet("Responders")!.rowCount, 1);
});

test("export rejects non-Bangkok timezone and more than ten stores", async () => {
  const { service } = buildService({ storeIds: ["store-1"] });
  await assert.rejects(
    service.export(user, { storeIds: ["store-1"], startDate: "2026-09-05", endDate: "2026-09-05", timezone: "UTC" }),
    /only supports Asia\/Bangkok/,
  );
  await assert.rejects(
    service.export(user, { storeIds: Array.from({ length: 11 }, (_, index) => `store-${index}`), startDate: "2026-09-05", endDate: "2026-09-05", timezone: "Asia/Bangkok" }),
    /at most 10 stores/,
  );
});

test("export controller returns the XLSX MIME type and attachment headers", async () => {
  const headers = new Map<string, string | number>();
  const body = Buffer.from("xlsx");
  const controller = new StoreInsightsController({
    export: async () => ({ buffer: body, filename: "store-360_store_20260905-20260905.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  } as never, {} as never);
  await controller.export({ user } as never, { storeIds: ["store-1"], startDate: "2026-09-05", endDate: "2026-09-05" }, {
    setHeader: (name: string, value: string | number) => { headers.set(name, value); },
    end: (value: Buffer) => { assert.equal(value, body); },
  } as never);

  assert.equal(headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(headers.get("Content-Disposition"), "attachment; filename=\"store-360_store_20260905-20260905.xlsx\"");
  assert.equal(headers.get("Content-Length"), body.length);
});
