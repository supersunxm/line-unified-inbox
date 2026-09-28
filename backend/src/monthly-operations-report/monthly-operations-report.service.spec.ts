import { BadRequestException } from "@nestjs/common";
import { pickLatestSnapshotOnOrBefore } from "./monthly-operations-report.service";

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
});
