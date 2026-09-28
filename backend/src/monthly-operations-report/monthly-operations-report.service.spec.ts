import * as ExcelJS from "exceljs";
import { MessageDeliveryStatus, MessageDirection } from "@prisma/client";
import {
  calculateReportResponseCycles,
  classifyReplyKpiCoverage,
  isReplyCycleCovered,
  isReplyCycleEligible,
  isReportHumanReply,
  pickLatestSnapshotOnOrBefore,
} from "./monthly-operations-report.service";

function message(overrides: Partial<{
  id: string;
  conversationId: string;
  direction: MessageDirection;
  sentAt: Date;
  senderUserId: string | null;
  senderDisplayName: string | null;
  deliveryStatus: MessageDeliveryStatus;
  rawPayload: Record<string, unknown> | null;
}> = {}) {
  return {
    id: overrides.id ?? "m-1",
    conversationId: overrides.conversationId ?? "c-1",
    direction: overrides.direction ?? MessageDirection.OUTBOUND,
    messageType: "text",
    sentAt: overrides.sentAt ?? new Date("2026-09-01T01:00:00.000Z"),
    senderUserId: overrides.senderUserId ?? null,
    senderDisplayName: overrides.senderDisplayName ?? null,
    deliveryStatus: overrides.deliveryStatus ?? MessageDeliveryStatus.DELIVERED,
    rawPayload: overrides.rawPayload ?? null,
  };
}

describe("MonthlyOperationsReportService helpers", () => {
  it("picks the latest follower snapshot on or before the requested date", () => {
    const snapshots = [
      { lineOaId: "oa-1", snapshotDate: new Date("2026-09-01T00:00:00.000Z"), followers: 100 },
      { lineOaId: "oa-1", snapshotDate: new Date("2026-09-19T00:00:00.000Z"), followers: 120 },
      { lineOaId: "oa-1", snapshotDate: new Date("2026-09-20T00:00:00.000Z"), followers: 125 },
      { lineOaId: "oa-2", snapshotDate: new Date("2026-09-20T00:00:00.000Z"), followers: 999 },
    ];

    expect(pickLatestSnapshotOnOrBefore(snapshots, "oa-1", "2026-09-20", "2026-09-01")).toEqual(
      snapshots[2],
    );
  });

  it("does not fall back before the report month", () => {
    const snapshots = [
      { lineOaId: "oa-1", snapshotDate: new Date("2026-08-31T00:00:00.000Z"), followers: 95 },
    ];

    expect(pickLatestSnapshotOnOrBefore(snapshots, "oa-1", "2026-09-01", "2026-09-01")).toBeNull();
  });

  it("counts a delivered internal-user outbound as a human reply", () => {
    expect(isReportHumanReply(message({ senderUserId: "user-1" }))).toBe(true);
  });

  it("counts a delivered LINE Manager mirrored outbound even without senderUserId", () => {
    expect(isReportHumanReply(message({
      senderDisplayName: "Somchai",
      rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" },
    }))).toBe(true);
  });

  it("excludes LINE Manager auto replies", () => {
    expect(isReportHumanReply(message({
      senderDisplayName: "Auto Reply Bot",
      rawPayload: {
        provider: "LINE_MANAGER",
        source: "AUTO_RESPONSE",
        managerBizId: "__AUTO_RESPONSE",
      },
    }))).toBe(false);
  });

  it("excludes failed outbound messages", () => {
    expect(isReportHumanReply(message({
      senderUserId: "user-1",
      deliveryStatus: MessageDeliveryStatus.FAILED,
    }))).toBe(false);
  });

  it("uses consecutive inbound messages as one response cycle and closes on Manager human reply", () => {
    const cycles = calculateReportResponseCycles([
      message({
        id: "in-1",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
      message({
        id: "in-2",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-01T00:05:00.000Z"),
      }),
      message({
        id: "out-1",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-01T00:30:00.000Z"),
        senderDisplayName: "Manager Staff",
        rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" },
      }),
    ]);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].startedAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(cycles[0].answeredAt?.toISOString()).toBe("2026-09-01T00:30:00.000Z");
    expect(cycles[0].durationSeconds).toBe(1800);
  });

  it("classifies reply KPI coverage from eligible response-cycle proof", () => {
    expect(classifyReplyKpiCoverage({
      mirrorAvailable: false,
      eligibleCycles: 3,
      coveredCycles: 0,
    })).toBe("not_covered");
    expect(classifyReplyKpiCoverage({
      mirrorAvailable: true,
      eligibleCycles: 10,
      coveredCycles: 6,
    })).toBe("partial");
    expect(classifyReplyKpiCoverage({
      mirrorAvailable: true,
      eligibleCycles: 10,
      coveredCycles: 10,
    })).toBe("complete");
    expect(classifyReplyKpiCoverage({
      mirrorAvailable: true,
      eligibleCycles: 0,
      coveredCycles: 0,
    })).toBe("complete");
  });

  it("does not make an unanswered cycle KPI-eligible until its 24h deadline passes", () => {
    const cycles = calculateReportResponseCycles([
      message({
        id: "in-open",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-27T10:00:00.000Z"),
      }),
    ]);
    expect(isReplyCycleEligible(cycles[0], new Date("2026-09-28T09:59:59.000Z"))).toBe(false);
    expect(isReplyCycleEligible(cycles[0], new Date("2026-09-28T10:00:00.000Z"))).toBe(true);
  });

  it("treats a <=24h human reply as proven even without Manager history", () => {
    const cycles = calculateReportResponseCycles([
      message({
        id: "in-fast",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-05T00:00:00.000Z"),
      }),
      message({
        id: "out-fast",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-05T01:00:00.000Z"),
        senderUserId: "staff-1",
      }),
    ]);
    expect(isReplyCycleCovered(
      cycles[0],
      new Date("2026-09-28T00:00:00.000Z"),
      {
        mirrorEnabled: false,
        lastSuccessfulSyncAt: null,
        historicalBackfillOldestAt: null,
      },
    )).toBe(true);
  });

  it("requires Manager history before cycle start and sync past deadline to prove a failure", () => {
    const cycles = calculateReportResponseCycles([
      message({
        id: "in-late",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-05T00:00:00.000Z"),
      }),
      message({
        id: "out-late",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-06T02:00:00.000Z"),
        senderDisplayName: "Manager Staff",
        rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" },
      }),
    ]);
    const periodEnd = new Date("2026-09-28T00:00:00.000Z");
    expect(isReplyCycleCovered(cycles[0], periodEnd, {
      mirrorEnabled: true,
      lastSuccessfulSyncAt: new Date("2026-09-28T00:00:00.000Z"),
      historicalBackfillOldestAt: new Date("2026-09-04T00:00:00.000Z"),
    })).toBe(true);
    expect(isReplyCycleCovered(cycles[0], periodEnd, {
      mirrorEnabled: true,
      lastSuccessfulSyncAt: new Date("2026-09-05T12:00:00.000Z"),
      historicalBackfillOldestAt: new Date("2026-09-04T00:00:00.000Z"),
    })).toBe(false);
    expect(isReplyCycleCovered(cycles[0], periodEnd, {
      mirrorEnabled: true,
      lastSuccessfulSyncAt: new Date("2026-09-28T00:00:00.000Z"),
      historicalBackfillOldestAt: new Date("2026-09-05T00:30:00.000Z"),
    })).toBe(false);
  });

  it("does not let an auto reply close a response cycle", () => {
    const cycles = calculateReportResponseCycles([
      message({
        id: "in-1",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
      }),
      message({
        id: "auto-1",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-01T00:01:00.000Z"),
        senderDisplayName: "Auto Reply Bot",
        rawPayload: { provider: "LINE_MANAGER", source: "AUTO_RESPONSE" },
      }),
    ]);

    expect(cycles).toHaveLength(1);
    expect(cycles[0].answeredAt).toBeNull();
  });
});


describe("MonthlyOperationsReportService XLSX export", () => {
  it("exports the August-compatible 35-column detail layout without inventing tag history", async () => {
    const { MonthlyOperationsReportService } = await import("./monthly-operations-report.service");
    const service = new MonthlyOperationsReportService({} as never, {} as never);
    (service as unknown as { get: () => Promise<unknown> }).get = async () => ({
      period: {
        month: "2026-09",
        timezone: "Asia/Bangkok",
        isCurrentMonth: true,
        start: "2026-09-01",
        focusStart: "2026-09-20",
        through: "2026-09-28",
        generatedAt: "2026-09-28T04:30:00.000Z",
      },
      scope: {
        stores: 1,
        lineAccounts: 1,
        followerComplete: 1,
        followerPartial: 0,
        followerMissing: 0,
        replyComplete: 1,
        replyPartial: 0,
        replyNotCovered: 0,
      },
      totals: {
        inboundMessages: 10,
        focusInboundMessages: 3,
        responseCycles: 4,
        repliedWithin24h: 3,
        focusResponseCycles: 2,
        focusRepliedWithin24h: 2,
        monthFollowerGrowth: 20,
        focusFollowerGrowth: 5,
        replyRateWithin24h: 0.75,
        focusReplyRateWithin24h: 1,
        observedResponseCycles: 4,
        observedRepliedWithin24h: 3,
        observedFocusResponseCycles: 2,
        observedFocusRepliedWithin24h: 2,
        observedReplyRateWithin24h: 0.75,
        observedFocusReplyRateWithin24h: 1,
        mirrorFallbackReplies: 1,
        mirrorFallbackUnmapped: 0,
      },
      stores: [{
        storeId: "store-1",
        externalStoreId: "25610",
        storeName: "OPPO Central World",
        accountName: "OPPO Central World",
        lineOaId: "oa-1",
        lineBasicId: "@126fiiqf",
        province: "Bangkok",
        region: "Central",
        amName: null,
        bmName: "BM Test",
        followers: {
          monthStart: 100,
          monthStartDate: "2026-09-01",
          focusStart: 115,
          focusStartDate: "2026-09-20",
          periodEnd: 120,
          periodEndDate: "2026-09-28",
          monthGrowth: 20,
          focusGrowth: 5,
        },
        chat: {
          inboundMessages: 10,
          focusInboundMessages: 3,
          responseCycles: 4,
          repliedWithin24h: 3,
          focusResponseCycles: 2,
          focusRepliedWithin24h: 2,
          replyRateWithin24h: 0.75,
          focusReplyRateWithin24h: 1,
          observedReplyRateWithin24h: 0.75,
          observedFocusReplyRateWithin24h: 1,
          replyCoverage: "complete",
          mirrorFallbackReplies: 1,
          mirrorFallbackUnmapped: 0,
          coveredResponseCycles: 4,
          coveredFocusResponseCycles: 2,
        },
        dataQuality: {
          followerCoverage: "complete",
          chatCoverage: "canonical_plus_manager_fallback",
          notes: [],
        },
      }],
      dataContract: {
        followerSource: "LineOaFollowerSnapshot",
        chatSource: "Message",
        responseDefinition: "test",
        replyCoverageDefinition: "test",
        lineChatMirrorRead: true,
        historicalTimelineRead: false,
        liveMirrorWrite: false,
        historicalMirrorWrite: false,
      },
    });

    const file = await service.exportXlsx({} as never, "2026-09");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Operations Detail",
      "Summary",
      "Region Summary",
      "Methodology",
    ]);

    const detail = workbook.getWorksheet("Operations Detail")!;
    expect(detail.columnCount).toBe(35);
    expect(detail.getRow(1).values).toContain("Replies Within 24h - Month");
    expect(detail.getCell("A2").value).toBe(1);
    expect(detail.getCell("F2").value).toBe("25610");
    expect(detail.getCell("U2").value).toBe(3);
    expect(detail.getCell("W2").value).toBe(0.75);
    expect(detail.getCell("Y2").value).toBeNull();
    expect(String(detail.getCell("AI2").value)).toContain("tag_history_unavailable");
    expect(file.filename).toBe("OPPO_LINE_monthly_operations_2026-09_1stores.xlsx");
  });
});


describe("MonthlyOperationsReportService XLSX production-scale export", () => {
  it("exports 146 production-scale store rows without throwing", async () => {
    const { MonthlyOperationsReportService } = await import("./monthly-operations-report.service");
    const service = new MonthlyOperationsReportService({} as never, {} as never);
    const stores = Array.from({ length: 146 }, (_, index) => ({
      storeId: "store-" + index,
      externalStoreId: String(20000 + index),
      storeName: "OPPO Store " + index,
      accountName: "OPPO Store " + index,
      lineOaId: "oa-" + index,
      lineBasicId: "@oa" + index,
      province: index % 2 === 0 ? "Bangkok" : "Chonburi",
      region: index % 2 === 0 ? "Central" : "Eastern",
      amName: null,
      bmName: "BM " + index,
      followers: {
        monthStart: 1000 + index,
        monthStartDate: "2026-09-01",
        focusStart: 1010 + index,
        focusStartDate: "2026-09-20",
        periodEnd: 1020 + index,
        periodEndDate: "2026-09-28",
        monthGrowth: 20,
        focusGrowth: 10,
      },
      chat: {
        inboundMessages: 100 + index,
        focusInboundMessages: 30 + index,
        responseCycles: 50,
        repliedWithin24h: 40,
        focusResponseCycles: 20,
        focusRepliedWithin24h: 16,
        replyRateWithin24h: 0.8,
        focusReplyRateWithin24h: 0.8,
        observedReplyRateWithin24h: 0.8,
        observedFocusReplyRateWithin24h: 0.8,
        replyCoverage: "complete",
        mirrorFallbackReplies: 0,
        mirrorFallbackUnmapped: 0,
        coveredResponseCycles: 50,
        coveredFocusResponseCycles: 20,
      },
      dataQuality: {
        followerCoverage: "complete",
        chatCoverage: "canonical_plus_manager_fallback",
        notes: [],
      },
    }));

    (service as unknown as { get: () => Promise<unknown> }).get = async () => ({
      period: {
        month: "2026-09",
        timezone: "Asia/Bangkok",
        isCurrentMonth: true,
        start: "2026-09-01",
        focusStart: "2026-09-20",
        through: "2026-09-28",
        generatedAt: "2026-09-28T04:50:00.000Z",
      },
      scope: {
        stores: stores.length,
        lineAccounts: stores.length,
        followerComplete: stores.length,
        followerPartial: 0,
        followerMissing: 0,
        replyComplete: stores.length,
        replyPartial: 0,
        replyNotCovered: 0,
      },
      totals: {
        inboundMessages: stores.reduce((sum, store) => sum + store.chat.inboundMessages, 0),
        focusInboundMessages: stores.reduce((sum, store) => sum + store.chat.focusInboundMessages, 0),
        responseCycles: stores.reduce((sum, store) => sum + store.chat.responseCycles, 0),
        repliedWithin24h: stores.reduce((sum, store) => sum + store.chat.repliedWithin24h, 0),
        focusResponseCycles: stores.reduce((sum, store) => sum + store.chat.focusResponseCycles, 0),
        focusRepliedWithin24h: stores.reduce((sum, store) => sum + store.chat.focusRepliedWithin24h, 0),
        monthFollowerGrowth: stores.length * 20,
        focusFollowerGrowth: stores.length * 10,
        replyRateWithin24h: 0.8,
        focusReplyRateWithin24h: 0.8,
        observedResponseCycles: stores.reduce((sum, store) => sum + store.chat.responseCycles, 0),
        observedRepliedWithin24h: stores.reduce((sum, store) => sum + store.chat.repliedWithin24h, 0),
        observedFocusResponseCycles: stores.reduce((sum, store) => sum + store.chat.focusResponseCycles, 0),
        observedFocusRepliedWithin24h: stores.reduce((sum, store) => sum + store.chat.focusRepliedWithin24h, 0),
        observedReplyRateWithin24h: 0.8,
        observedFocusReplyRateWithin24h: 0.8,
        mirrorFallbackReplies: 0,
        mirrorFallbackUnmapped: 0,
        coveredResponseCycles: 50,
        coveredFocusResponseCycles: 20,
      },
      stores,
      dataContract: {
        followerSource: "LineOaFollowerSnapshot",
        chatSource: "Message",
        responseDefinition: "test",
        replyCoverageDefinition: "test",
        lineChatMirrorRead: true,
        historicalTimelineRead: false,
        liveMirrorWrite: false,
        historicalMirrorWrite: false,
      },
    });

    const file = await service.exportXlsx({} as never, "2026-09");
    expect(file.buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const detail = workbook.getWorksheet("Operations Detail")!;
    expect(detail.rowCount).toBe(147);
    expect(detail.columnCount).toBe(35);
  });
});


describe("MonthlyOperationsReportService XLSX reply coverage", () => {
  it("leaves official reply KPI cells blank when reply coverage is partial", async () => {
    const { MonthlyOperationsReportService } = await import("./monthly-operations-report.service");
    const service = new MonthlyOperationsReportService({} as never, {} as never);
    (service as unknown as { get: () => Promise<unknown> }).get = async () => ({
      period: {
        month: "2026-09",
        timezone: "Asia/Bangkok",
        isCurrentMonth: true,
        start: "2026-09-01",
        focusStart: "2026-09-20",
        through: "2026-09-28",
        generatedAt: "2026-09-28T05:00:00.000Z",
      },
      scope: {
        stores: 1,
        lineAccounts: 1,
        followerComplete: 1,
        followerPartial: 0,
        followerMissing: 0,
        replyComplete: 0,
        replyPartial: 1,
        replyNotCovered: 0,
      },
      totals: {
        inboundMessages: 10,
        focusInboundMessages: 3,
        responseCycles: 0,
        repliedWithin24h: 0,
        focusResponseCycles: 0,
        focusRepliedWithin24h: 0,
        observedResponseCycles: 4,
        observedRepliedWithin24h: 3,
        observedFocusResponseCycles: 2,
        observedFocusRepliedWithin24h: 2,
        monthFollowerGrowth: 20,
        focusFollowerGrowth: 5,
        replyRateWithin24h: null,
        focusReplyRateWithin24h: null,
        observedReplyRateWithin24h: 0.75,
        observedFocusReplyRateWithin24h: 1,
        mirrorFallbackReplies: 2,
        mirrorFallbackUnmapped: 1,
      },
      stores: [{
        storeId: "store-1",
        externalStoreId: "25610",
        storeName: "OPPO Central World",
        accountName: "OPPO Central World",
        lineOaId: "oa-1",
        lineBasicId: "@126fiiqf",
        province: "Bangkok",
        region: "Central",
        amName: null,
        bmName: "BM Test",
        followers: {
          monthStart: 100,
          monthStartDate: "2026-09-01",
          focusStart: 115,
          focusStartDate: "2026-09-20",
          periodEnd: 120,
          periodEndDate: "2026-09-28",
          monthGrowth: 20,
          focusGrowth: 5,
        },
        chat: {
          inboundMessages: 10,
          focusInboundMessages: 3,
          responseCycles: 4,
          repliedWithin24h: 3,
          focusResponseCycles: 2,
          focusRepliedWithin24h: 2,
          replyRateWithin24h: null,
          focusReplyRateWithin24h: null,
          observedReplyRateWithin24h: 0.75,
          observedFocusReplyRateWithin24h: 1,
          replyCoverage: "partial",
          mirrorFallbackReplies: 2,
          mirrorFallbackUnmapped: 1,
          coveredResponseCycles: 3,
          coveredFocusResponseCycles: 2,
        },
        dataQuality: {
          followerCoverage: "complete",
          chatCoverage: "canonical_plus_manager_fallback",
          notes: ["reply_coverage_partial"],
        },
      }],
      dataContract: {
        followerSource: "LineOaFollowerSnapshot",
        chatSource: "Message + LineChatMirrorMessage read-only fallback",
        responseDefinition: "test",
        replyCoverageDefinition: "test",
        lineChatMirrorRead: true,
        historicalTimelineRead: false,
        liveMirrorWrite: false,
        historicalMirrorWrite: false,
      },
    });

    const file = await service.exportXlsx({} as never, "2026-09");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const detail = workbook.getWorksheet("Operations Detail")!;
    expect(detail.getCell("U2").value).toBeNull();
    expect(detail.getCell("W2").value).toBeNull();
    expect(detail.getCell("AG2").value).toBeNull();
    expect(detail.getCell("AH2").value).toBe("PARTIAL");
    expect(String(detail.getCell("AI2").value)).toContain("reply_coverage_partial");
  });
});
