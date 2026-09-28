import { BadRequestException, Injectable } from "@nestjs/common";
import { MessageDeliveryStatus, MessageDirection, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { formatDbDateToIso, getTodayBangkokDateString, toUtcDateForDb } from "../follower-insights/date-utils";
import { type AnalyticsMessage, bangkokMonthBounds } from "../mobile/monthly-summary.service";
import { PrismaService } from "../prisma.service";
import ExcelJS from "exceljs";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;


type ReportAnalyticsMessage = AnalyticsMessage & {
  deliveryStatus: MessageDeliveryStatus;
  rawPayload: Prisma.JsonValue | null;
};

type ReportResponseCycle = {
  conversationId: string;
  startedAt: Date;
  answeredAt: Date | null;
  durationSeconds: number | null;
};

const AUTO_REPLY_BOT_DISPLAY_NAME = "Auto Reply Bot";

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

export function isReportHumanReply(message: ReportAnalyticsMessage) {
  if (
    message.direction !== MessageDirection.OUTBOUND
    || message.deliveryStatus !== MessageDeliveryStatus.DELIVERED
  ) {
    return false;
  }
  const raw = jsonObject(message.rawPayload);
  const automated = message.senderDisplayName?.trim() === AUTO_REPLY_BOT_DISPLAY_NAME
    || raw.source === "AUTO_RESPONSE"
    || raw.managerBizId === "__AUTO_RESPONSE";
  if (automated) return false;
  return Boolean(message.senderUserId)
    || raw.source === "LINE_MANAGER_MIRROR"
    || raw.provider === "LINE_MANAGER";
}

export function calculateReportResponseCycles(messages: ReportAnalyticsMessage[]): ReportResponseCycle[] {
  const sorted = [...messages].sort((left, right) => {
    const timestamp = left.sentAt.getTime() - right.sentAt.getTime();
    return timestamp
      || left.conversationId.localeCompare(right.conversationId)
      || left.id.localeCompare(right.id);
  });
  const open = new Map<string, Date>();
  const cycles: ReportResponseCycle[] = [];
  for (const message of sorted) {
    if (message.direction === MessageDirection.INBOUND) {
      if (!open.has(message.conversationId)) open.set(message.conversationId, message.sentAt);
      continue;
    }
    if (!isReportHumanReply(message)) continue;
    const startedAt = open.get(message.conversationId);
    if (!startedAt) continue;
    cycles.push({
      conversationId: message.conversationId,
      startedAt,
      answeredAt: message.sentAt,
      durationSeconds: Math.max(0, (message.sentAt.getTime() - startedAt.getTime()) / 1000),
    });
    open.delete(message.conversationId);
  }
  for (const [conversationId, startedAt] of open) {
    cycles.push({ conversationId, startedAt, answeredAt: null, durationSeconds: null });
  }
  return cycles.sort((left, right) =>
    left.startedAt.getTime() - right.startedAt.getTime()
    || left.conversationId.localeCompare(right.conversationId),
  );
}

type Snapshot = {
  lineOaId: string;
  snapshotDate: Date;
  followers: number | null;
};

export type MonthlyOperationsStoreRow = {
  storeId: string;
  externalStoreId: string | null;
  storeName: string;
  accountName: string | null;
  lineOaId: string;
  lineBasicId: string | null;
  province: string | null;
  region: string | null;
  amName: null;
  bmName: string | null;
  followers: {
    monthStart: number | null;
    monthStartDate: string | null;
    focusStart: number | null;
    focusStartDate: string | null;
    periodEnd: number | null;
    periodEndDate: string | null;
    monthGrowth: number | null;
    focusGrowth: number | null;
  };
  chat: {
    inboundMessages: number;
    focusInboundMessages: number;
    responseCycles: number;
    repliedWithin24h: number;
    focusResponseCycles: number;
    focusRepliedWithin24h: number;
    replyRateWithin24h: number | null;
    focusReplyRateWithin24h: number | null;
  };
  dataQuality: {
    followerCoverage: "complete" | "partial" | "missing";
    chatCoverage: "canonical_message_timeline";
    notes: string[];
  };
};

function monthKeyInBangkok(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayBoundary(month: string, day: number): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new BadRequestException("month must use YYYY-MM format");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  return new Date(Date.UTC(year, monthNumber - 1, day) - BANGKOK_OFFSET_MS);
}

function localDate(date: Date): string {
  const local = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

export function pickLatestSnapshotOnOrBefore(
  snapshots: Snapshot[],
  lineOaId: string,
  requestedIsoDate: string,
  minimumIsoDate: string,
): Snapshot | null {
  return snapshots
    .filter((snapshot) => snapshot.lineOaId === lineOaId && snapshot.followers !== null)
    .filter((snapshot) => {
      const date = formatDbDateToIso(snapshot.snapshotDate);
      return date >= minimumIsoDate && date <= requestedIsoDate;
    })
    .sort((left, right) => right.snapshotDate.getTime() - left.snapshotDate.getTime())[0] ?? null;
}

function snapshotValue(snapshot: Snapshot | null) {
  return {
    value: snapshot?.followers ?? null,
    date: snapshot ? formatDbDateToIso(snapshot.snapshotDate) : null,
  };
}

function growth(end: number | null, start: number | null) {
  return end === null || start === null ? null : end - start;
}

function intervalContains(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

@Injectable()
export class MonthlyOperationsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async get(user: AuthUser, requestedMonth?: string) {
    const now = new Date();
    const currentMonth = monthKeyInBangkok(now);
    const month = requestedMonth ?? currentMonth;
    const bounds = bangkokMonthBounds(month);
    if (month > currentMonth) throw new BadRequestException("Future months are not available");

    const isCurrentMonth = month === currentMonth;
    const periodEnd = isCurrentMonth ? now : bounds.end;
    const focusStart = dayBoundary(month, 20);
    const effectiveFocusStart = focusStart < bounds.start ? bounds.start : focusStart;
    const responseReadEnd = new Date(periodEnd.getTime() + RESPONSE_WINDOW_MS);
    const monthStartIso = localDate(bounds.start);
    const focusStartIso = localDate(effectiveFocusStart);
    const periodEndIso = getTodayBangkokDateString(
      isCurrentMonth ? now : new Date(bounds.end.getTime() - 1),
    );

    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const accountWhere: Prisma.LineOfficialAccountWhereInput = {
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      storeId: accessibleStoreIds === null ? { not: null } : { in: accessibleStoreIds },
      store: { isActive: true, archivedAt: null },
    };

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: accountWhere,
      select: {
        id: true,
        name: true,
        basicId: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            region: true,
            storeMaster: {
              select: {
                externalStoreId: true,
                storeName: true,
                accountName: true,
                province: true,
                region: true,
                bmName: true,
              },
            },
          },
        },
      },
      orderBy: [{ store: { name: "asc" } }, { name: "asc" }],
    });

    const accountIds = accounts.map((account) => account.id);
    const snapshots = accountIds.length === 0
      ? []
      : await this.prisma.lineOaFollowerSnapshot.findMany({
          where: {
            lineOaId: { in: accountIds },
            status: "ready",
            followers: { not: null },
            snapshotDate: {
              gte: toUtcDateForDb(monthStartIso),
              lte: toUtcDateForDb(periodEndIso),
            },
          },
          select: { lineOaId: true, snapshotDate: true, followers: true },
          orderBy: [{ snapshotDate: "asc" }, { lineOaId: "asc" }],
        });

    const conversationScope: Prisma.ConversationWhereInput = {
      isQa: false,
      lineOfficialAccountId: { in: accountIds },
      ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
      store: { isActive: true, archivedAt: null },
    };
    const messages = accountIds.length === 0
      ? []
      : await this.prisma.message.findMany({
          where: {
            conversation: conversationScope,
            sentAt: { gte: bounds.start, lt: responseReadEnd },
          },
          select: {
            id: true,
            conversationId: true,
            direction: true,
            messageType: true,
            sentAt: true,
            senderUserId: true,
            senderDisplayName: true,
            deliveryStatus: true,
            rawPayload: true,
            conversation: {
              select: {
                lineOfficialAccountId: true,
              },
            },
          },
          orderBy: [{ sentAt: "asc" }, { id: "asc" }],
        });

    const messagesByAccount = new Map<string, ReportAnalyticsMessage[]>();
    for (const message of messages) {
      const lineOaId = message.conversation.lineOfficialAccountId;
      const current = messagesByAccount.get(lineOaId) ?? [];
      current.push({
        id: message.id,
        conversationId: message.conversationId,
        direction: message.direction,
        messageType: message.messageType,
        sentAt: message.sentAt,
        senderUserId: message.senderUserId,
        senderDisplayName: message.senderDisplayName,
        deliveryStatus: message.deliveryStatus,
        rawPayload: message.rawPayload,
      });
      messagesByAccount.set(lineOaId, current);
    }

    const stores: MonthlyOperationsStoreRow[] = accounts
      .filter((account): account is typeof account & { storeId: string; store: NonNullable<typeof account.store> } =>
        Boolean(account.storeId && account.store),
      )
      .map((account) => {
        const accountMessages = messagesByAccount.get(account.id) ?? [];
        const cycles = calculateReportResponseCycles(accountMessages);
        const periodCycles = cycles.filter((cycle) => intervalContains(cycle.startedAt, bounds.start, periodEnd));
        const focusCycles = cycles.filter((cycle) => intervalContains(cycle.startedAt, effectiveFocusStart, periodEnd));
        const repliedWithin24h = periodCycles.filter(
          (cycle) => cycle.durationSeconds !== null && cycle.durationSeconds <= 24 * 60 * 60,
        ).length;
        const focusRepliedWithin24h = focusCycles.filter(
          (cycle) => cycle.durationSeconds !== null && cycle.durationSeconds <= 24 * 60 * 60,
        ).length;
        const inboundMessages = accountMessages.filter(
          (message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, bounds.start, periodEnd),
        ).length;
        const focusInboundMessages = accountMessages.filter(
          (message) => message.direction === MessageDirection.INBOUND && intervalContains(message.sentAt, effectiveFocusStart, periodEnd),
        ).length;

        const startSnapshot = pickLatestSnapshotOnOrBefore(snapshots, account.id, monthStartIso, monthStartIso);
        const focusSnapshot = pickLatestSnapshotOnOrBefore(snapshots, account.id, focusStartIso, monthStartIso);
        const endSnapshot = pickLatestSnapshotOnOrBefore(snapshots, account.id, periodEndIso, monthStartIso);
        const start = snapshotValue(startSnapshot);
        const focus = snapshotValue(focusSnapshot);
        const end = snapshotValue(endSnapshot);
        const followerPoints = [start.value, focus.value, end.value].filter((value) => value !== null).length;
        const notes: string[] = [];
        if (!account.store.storeMaster) notes.push("store_master_missing");
        if (!startSnapshot) notes.push("follower_month_start_missing");
        if (!focusSnapshot) notes.push("follower_focus_start_missing");
        if (!endSnapshot) notes.push("follower_period_end_missing");

        return {
          storeId: account.store.id,
          externalStoreId: account.store.storeMaster?.externalStoreId ?? account.store.code ?? null,
          storeName: account.store.storeMaster?.storeName ?? account.store.name,
          accountName: account.store.storeMaster?.accountName ?? account.name,
          lineOaId: account.id,
          lineBasicId: account.basicId,
          province: account.store.storeMaster?.province ?? null,
          region: account.store.storeMaster?.region ?? account.store.region ?? null,
          amName: null,
          bmName: account.store.storeMaster?.bmName ?? null,
          followers: {
            monthStart: start.value,
            monthStartDate: start.date,
            focusStart: focus.value,
            focusStartDate: focus.date,
            periodEnd: end.value,
            periodEndDate: end.date,
            monthGrowth: growth(end.value, start.value),
            focusGrowth: growth(end.value, focus.value),
          },
          chat: {
            inboundMessages,
            focusInboundMessages,
            responseCycles: periodCycles.length,
            repliedWithin24h,
            focusResponseCycles: focusCycles.length,
            focusRepliedWithin24h,
            replyRateWithin24h: periodCycles.length === 0 ? null : repliedWithin24h / periodCycles.length,
            focusReplyRateWithin24h: focusCycles.length === 0 ? null : focusRepliedWithin24h / focusCycles.length,
          },
          dataQuality: {
            followerCoverage: followerPoints === 3 ? "complete" : followerPoints === 0 ? "missing" : "partial",
            chatCoverage: "canonical_message_timeline",
            notes,
          },
        };
      });

    const totals = stores.reduce(
      (summary, store) => {
        summary.inboundMessages += store.chat.inboundMessages;
        summary.focusInboundMessages += store.chat.focusInboundMessages;
        summary.responseCycles += store.chat.responseCycles;
        summary.repliedWithin24h += store.chat.repliedWithin24h;
        summary.focusResponseCycles += store.chat.focusResponseCycles;
        summary.focusRepliedWithin24h += store.chat.focusRepliedWithin24h;
        if (store.followers.monthGrowth !== null) summary.monthFollowerGrowth += store.followers.monthGrowth;
        if (store.followers.focusGrowth !== null) summary.focusFollowerGrowth += store.followers.focusGrowth;
        return summary;
      },
      {
        inboundMessages: 0,
        focusInboundMessages: 0,
        responseCycles: 0,
        repliedWithin24h: 0,
        focusResponseCycles: 0,
        focusRepliedWithin24h: 0,
        monthFollowerGrowth: 0,
        focusFollowerGrowth: 0,
      },
    );

    return {
      period: {
        month,
        timezone: "Asia/Bangkok",
        isCurrentMonth,
        start: monthStartIso,
        focusStart: focusStartIso,
        through: periodEndIso,
        generatedAt: now.toISOString(),
      },
      scope: {
        stores: stores.length,
        lineAccounts: accounts.length,
        followerComplete: stores.filter((store) => store.dataQuality.followerCoverage === "complete").length,
        followerPartial: stores.filter((store) => store.dataQuality.followerCoverage === "partial").length,
        followerMissing: stores.filter((store) => store.dataQuality.followerCoverage === "missing").length,
      },
      totals: {
        ...totals,
        replyRateWithin24h: totals.responseCycles === 0 ? null : totals.repliedWithin24h / totals.responseCycles,
        focusReplyRateWithin24h: totals.focusResponseCycles === 0 ? null : totals.focusRepliedWithin24h / totals.focusResponseCycles,
      },
      stores,
      dataContract: {
        followerSource: "LineOaFollowerSnapshot",
        chatSource: "Message",
        responseDefinition: "first delivered human staff outbound after an inbound response cycle, including LINE Manager mirrored human replies, within 24 hours",
        historicalTimelineRead: false,
        liveMirrorWrite: false,
        historicalMirrorWrite: false,
      },
    };
  }
  async exportXlsx(user: AuthUser, requestedMonth?: string): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }> {
    const report = await this.get(user, requestedMonth);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OPPO LINE OA Monitor";
    workbook.created = new Date();

    const detailHeaders = [
      "序号", "来源账号", "标准门店名称", "后台账号名称", "Google表ACCOUNT NAME",
      "STORE ID", "AM", "BM NAME", "Line账号ID", "省份 Province", "区域 Region",
      "匹配状态", "匹配方式", "月初累计好友", "20日累计好友", "期末累计好友",
      "本月累计新增粉丝", "20日后新增粉丝", "本月用户私信数", "20日后用户私信数",
      "本月24小时以内回复数", "20日后24小时以内回复数", "本月回复率", "20日后回复率",
      "本月已打标签人数", "本月未打标签人数", "本月标签统计基数", "本月标签覆盖率",
      "20日后已打标签人数", "20日后未打标签人数", "20日后标签统计基数", "20日后标签覆盖率",
      "聊天列表检查数", "数据状态", "备注",
    ];

    const detail = workbook.addWorksheet("运营明细", {
      views: [{ state: "frozen", ySplit: 1, xSplit: 3 }],
    });
    detail.addRow(detailHeaders);
    detail.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    detail.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    detail.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    detail.getRow(1).height = 34;

    report.stores.forEach((store, index) => {
      const dataStatus = store.dataQuality.followerCoverage === "complete" && store.dataQuality.notes.length === 0
        ? "COMPLETE"
        : store.dataQuality.followerCoverage === "missing"
          ? "MISSING"
          : "PARTIAL";
      const notes = [...store.dataQuality.notes, "tag_history_unavailable"].join("; ");
      detail.addRow([
        index + 1, "STORE", store.storeName, store.accountName ?? "", store.accountName ?? "",
        store.externalStoreId ?? "", store.amName ?? "", store.bmName ?? "", store.lineBasicId ?? "",
        store.province ?? "", store.region ?? "", store.externalStoreId ? "MATCHED" : "UNMATCHED",
        store.externalStoreId ? "STORE_MASTER" : "STORE_FALLBACK",
        store.followers.monthStart, store.followers.focusStart, store.followers.periodEnd,
        store.followers.monthGrowth, store.followers.focusGrowth,
        store.chat.inboundMessages, store.chat.focusInboundMessages,
        store.chat.repliedWithin24h, store.chat.focusRepliedWithin24h,
        store.chat.replyRateWithin24h, store.chat.focusReplyRateWithin24h,
        null, null, null, null, null, null, null, null,
        store.chat.responseCycles, dataStatus, notes,
      ]);
    });

    const widths = [8, 12, 30, 28, 28, 14, 16, 28, 18, 18, 16, 14, 16, 14, 14, 14, 16, 16, 16, 16, 18, 18, 14, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 14, 40];
    detail.columns.forEach((column, index) => { column.width = widths[index] ?? 14; });
    detail.getColumn(23).numFmt = "0.0%";
    detail.getColumn(24).numFmt = "0.0%";
    detail.getColumn(28).numFmt = "0.0%";
    detail.getColumn(32).numFmt = "0.0%";
    detail.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    });
    if (report.stores.length > 0) {
      detail.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: report.stores.length + 1, column: detailHeaders.length },
      };
    }

    const summary = workbook.addWorksheet("汇总", { views: [{ state: "frozen", ySplit: 2 }] });
    summary.mergeCells("A1:D1");
    summary.getCell("A1").value = "OPPO LINE Monthly Operations Report — " + report.period.month;
    summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    summary.getRow(1).height = 28;
    summary.addRow(["指标", "数值", "期间/口径", "备注"]);
    summary.getRow(2).font = { bold: true };
    summary.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAF7" } };

    const monthPeriod = report.period.start + " → " + report.period.through;
    const focusPeriod = report.period.focusStart + " → " + report.period.through;
    const metrics: Array<[string, string | number | null, string, string]> = [
      ["门店数", report.scope.stores, report.period.month, ""],
      ["LINE OA数", report.scope.lineAccounts, report.period.month, ""],
      ["Follower snapshot 完整", report.scope.followerComplete, report.period.start + " / " + report.period.focusStart + " / " + report.period.through, ""],
      ["Follower snapshot 部分", report.scope.followerPartial, report.period.month, ""],
      ["Follower snapshot 缺失", report.scope.followerMissing, report.period.month, ""],
      ["本月新增粉丝", report.totals.monthFollowerGrowth, monthPeriod, ""],
      ["20日后新增粉丝", report.totals.focusFollowerGrowth, focusPeriod, ""],
      ["本月用户私信数", report.totals.inboundMessages, monthPeriod, "Canonical Message inbound"],
      ["20日后用户私信数", report.totals.focusInboundMessages, focusPeriod, "Canonical Message inbound"],
      ["本月Response Cycles", report.totals.responseCycles, monthPeriod, "连续inbound直到human reply为1 cycle"],
      ["本月24小时以内回复数", report.totals.repliedWithin24h, monthPeriod, "Delivered human reply <= 24h"],
      ["本月24小时回复率", report.totals.replyRateWithin24h, monthPeriod, "24h replies / response cycles"],
      ["20日后24小时以内回复数", report.totals.focusRepliedWithin24h, focusPeriod, ""],
      ["20日后24小时回复率", report.totals.focusReplyRateWithin24h, focusPeriod, ""],
    ];
    metrics.forEach((row) => summary.addRow(row));
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 18;
    summary.getColumn(3).width = 28;
    summary.getColumn(4).width = 44;
    for (let rowNumber = 3; rowNumber <= summary.rowCount; rowNumber += 1) {
      const key = String(summary.getCell("A" + rowNumber).value ?? "");
      if (key.includes("回复率")) summary.getCell("B" + rowNumber).numFmt = "0.0%";
    }

    const regionSummary = workbook.addWorksheet("账号分组汇总", { views: [{ state: "frozen", ySplit: 1 }] });
    regionSummary.addRow(["Region", "Stores", "Inbound", "Response Cycles", "<=24h Replies", "24h Reply Rate", "Follower Growth"]);
    regionSummary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    regionSummary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    const byRegion = new Map<string, { stores: number; inbound: number; cycles: number; replies: number; followerGrowth: number }>();
    for (const store of report.stores) {
      const key = store.region || "Unspecified";
      const current = byRegion.get(key) ?? { stores: 0, inbound: 0, cycles: 0, replies: 0, followerGrowth: 0 };
      current.stores += 1;
      current.inbound += store.chat.inboundMessages;
      current.cycles += store.chat.responseCycles;
      current.replies += store.chat.repliedWithin24h;
      current.followerGrowth += store.followers.monthGrowth ?? 0;
      byRegion.set(key, current);
    }
    for (const [region, values] of [...byRegion.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      regionSummary.addRow([
        region, values.stores, values.inbound, values.cycles, values.replies,
        values.cycles === 0 ? null : values.replies / values.cycles,
        values.followerGrowth,
      ]);
    }
    regionSummary.columns = [
      { width: 18 }, { width: 12 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 },
    ];
    regionSummary.getColumn(6).numFmt = "0.0%";

    const methodology = workbook.addWorksheet("口径说明");
    methodology.addRow(["项目", "口径"]);
    methodology.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    methodology.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
    const methodologyRows = [
      ["时区", "Asia/Bangkok"],
      ["Follower", "读取 LineOaFollowerSnapshot。月初、20日、期末按该日期或之前最近可用的当月快照；不会回退到上个月。"],
      ["本月用户私信数", "Canonical Message timeline 中 direction=INBOUND 的消息数。"],
      ["Response Cycle", "同一会话连续 inbound 直到首个 delivered human outbound 视为一个 cycle。"],
      ["Human Reply", "内部 senderUserId 或 canonical LINE Manager metadata(source=LINE_MANAGER_MIRROR/provider=LINE_MANAGER)；自动回复不计。"],
      ["24小时回复", "Response cycle 首个 human reply 与 cycle 开始时间差 <=24小时。"],
      ["Tag字段", "当前 P0 尚无可靠 historical tag snapshot，因此 Y:AF 留空，并在备注写 tag_history_unavailable。"],
      ["Mirror隔离", "报表只读 Message / follower snapshots / Store Master；不写 Live Mirror 或 Historical Mirror。"],
      ["生成时间", report.period.generatedAt],
    ];
    methodologyRows.forEach((row) => methodology.addRow(row));
    methodology.getColumn(1).width = 24;
    methodology.getColumn(2).width = 100;
    methodology.getColumn(2).alignment = { wrapText: true, vertical: "top" };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename: "OPPO_LINE_monthly_operations_" + report.period.month + "_" + report.scope.stores + "stores.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

}
