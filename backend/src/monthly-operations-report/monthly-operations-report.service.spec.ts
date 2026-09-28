import { MessageDeliveryStatus, MessageDirection } from "@prisma/client";
import {
  calculateReportResponseCycles,
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
