import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

export type MessageTrafficPeriod = "today" | "7d" | "30d";

type StoreTrafficAgg = {
  storeId: string;
  storeName: string;
  externalStoreId: string | null;
  inboundMessages: number;
  conversationIds: Set<string>;
  hourly: number[];
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function getBangkokParts(date: Date) {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return {
    hour: shifted.getUTCHours(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function getBangkokMidnightUtc(date: Date = new Date()) {
  const shifted = new Date(date.getTime() + BANGKOK_OFFSET_MS);
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    -7,
    0,
    0,
    0,
  ));
}

function parseBangkokDateStart(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
}

function parseBangkokDateEnd(value: string) {
  const start = parseBangkokDateStart(value);
  start.setUTCDate(start.getUTCDate() + 1);
  start.setTime(start.getTime() - 1);
  return start;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class MessageTrafficService {
  constructor(private readonly prisma: PrismaService) {}

  private getPeriodStartDate(period: MessageTrafficPeriod) {
    const start = getBangkokMidnightUtc();
    if (period === "7d") start.setUTCDate(start.getUTCDate() - 6);
    if (period === "30d") start.setUTCDate(start.getUTCDate() - 29);
    return start;
  }

  async getTraffic(
    period: MessageTrafficPeriod = "30d",
    allowedStoreIds?: string[],
    customRange?: { from: string; to: string },
  ) {
    const rangeStart = customRange ? parseBangkokDateStart(customRange.from) : this.getPeriodStartDate(period);
    const rangeEnd = customRange ? parseBangkokDateEnd(customRange.to) : new Date();
    const rangeType = customRange ? "custom" : period;

    const storeWhere = allowedStoreIds === undefined
      ? { isActive: true, archivedAt: null }
      : { id: { in: allowedStoreIds }, isActive: true, archivedAt: null };

    const stores = await this.prisma.store.findMany({
      where: storeWhere,
      select: {
        id: true,
        name: true,
        storeMaster: { select: { externalStoreId: true } },
      },
      orderBy: { name: "asc" },
    });

    const activeStoreIds = stores.map((store) => store.id);
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const dayOfWeekDistribution = DAY_LABELS.map((day, dayOfWeek) => ({ dayOfWeek, day, count: 0 }));

    if (activeStoreIds.length === 0) {
      return {
        period: rangeType,
        customRange: customRange ?? null,
        timezone: "Asia/Bangkok",
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        totalInboundMessages: 0,
        totalConversations: 0,
        messagesPerConversation: 0,
        overallPeakHour: { hour: 0, count: 0, window: "00:00 - 01:00" },
        hourlyDistribution,
        dayOfWeekDistribution,
        topStores: [],
        storeHourlyDistribution: [],
      };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        direction: "INBOUND",
        sentAt: { gte: rangeStart, lte: rangeEnd },
        conversation: { storeId: { in: activeStoreIds } },
      },
      select: {
        conversationId: true,
        sentAt: true,
        conversation: { select: { storeId: true } },
      },
      orderBy: { sentAt: "asc" },
    });

    const storeMap = new Map<string, StoreTrafficAgg>();
    for (const store of stores) {
      storeMap.set(store.id, {
        storeId: store.id,
        storeName: store.name,
        externalStoreId: store.storeMaster?.externalStoreId ?? null,
        inboundMessages: 0,
        conversationIds: new Set<string>(),
        hourly: new Array<number>(24).fill(0),
      });
    }

    const allConversationIds = new Set<string>();

    for (const message of messages) {
      const { hour, dayOfWeek } = getBangkokParts(message.sentAt);
      hourlyDistribution[hour].count++;
      dayOfWeekDistribution[dayOfWeek].count++;
      allConversationIds.add(message.conversationId);

      const agg = storeMap.get(message.conversation.storeId);
      if (!agg) continue;
      agg.inboundMessages++;
      agg.conversationIds.add(message.conversationId);
      agg.hourly[hour]++;
    }

    let overallPeakHour = 0;
    for (let hour = 1; hour < 24; hour++) {
      if (hourlyDistribution[hour].count > hourlyDistribution[overallPeakHour].count) {
        overallPeakHour = hour;
      }
    }

    const rankedStores = [...storeMap.values()]
      .filter((store) => store.inboundMessages > 0)
      .map((store) => {
        let peakHour = 0;
        for (let hour = 1; hour < 24; hour++) {
          if (store.hourly[hour] > store.hourly[peakHour]) peakHour = hour;
        }
        const distinctConversations = store.conversationIds.size;
        return {
          storeId: store.storeId,
          storeName: store.storeName,
          externalStoreId: store.externalStoreId,
          inboundMessages: store.inboundMessages,
          distinctConversations,
          messagesPerConversation: distinctConversations > 0
            ? round2(store.inboundMessages / distinctConversations)
            : 0,
          peakHour: {
            hour: peakHour,
            count: store.hourly[peakHour],
            window: `${String(peakHour).padStart(2, "0")}:00 - ${String((peakHour + 1) % 24).padStart(2, "0")}:00`,
          },
        };
      })
      .sort((a, b) => b.inboundMessages - a.inboundMessages || a.storeName.localeCompare(b.storeName))
      .map((store, index) => ({ rank: index + 1, ...store }));

    const storeHourlyDistribution = rankedStores.map((store) => ({
      storeId: store.storeId,
      storeName: store.storeName,
      externalStoreId: store.externalStoreId,
      hourly: storeMap.get(store.storeId)?.hourly.map((count, hour) => ({ hour, count })) ?? [],
    }));

    const totalInboundMessages = messages.length;
    const totalConversations = allConversationIds.size;

    return {
      period: rangeType,
      customRange: customRange ?? null,
      timezone: "Asia/Bangkok",
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      totalInboundMessages,
      totalConversations,
      messagesPerConversation: totalConversations > 0
        ? round2(totalInboundMessages / totalConversations)
        : 0,
      overallPeakHour: {
        hour: overallPeakHour,
        count: hourlyDistribution[overallPeakHour].count,
        window: `${String(overallPeakHour).padStart(2, "0")}:00 - ${String((overallPeakHour + 1) % 24).padStart(2, "0")}:00`,
      },
      hourlyDistribution,
      dayOfWeekDistribution,
      topStores: rankedStores,
      storeHourlyDistribution,
    };
  }
}
