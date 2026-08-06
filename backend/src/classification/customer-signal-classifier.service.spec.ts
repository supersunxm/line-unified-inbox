import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CustomerEvent, CustomerEventSource, CustomerEventType, CustomerSignalSource, CustomerSignalType } from "@prisma/client";
import { CustomerSignalClassifierService } from "./customer-signal-classifier.service";
import { PrismaService } from "../prisma.service";

describe("CustomerSignalClassifierService", () => {
  it("extracts PRODUCT_INTEREST signal when display name matches catalog product", async () => {
    let createdSignals: any[] = [];
    const mockPrisma = {
      productModel: {
        findMany: async () => [
          {
            id: "model-reno16",
            name: "Reno16 256GB",
            isActive: true,
            aliases: [{ alias: "reno 16", source: "MANUAL", isActive: true }],
            productSeries: { name: "Reno16 Series" },
          },
        ],
      },
      customerSignal: {
        deleteMany: async () => {},
        createMany: async ({ data }: any) => {
          createdSignals = data;
          return { count: data.length };
        },
        findMany: async ({ where }: any) => createdSignals.map((d, i) => ({ id: `sig-${i}`, ...d })),
      },
    } as unknown as PrismaService;

    const classifier = new CustomerSignalClassifierService(mockPrisma);

    const mockEvent: CustomerEvent = {
      id: "evt-1",
      customerId: "cust-1",
      type: CustomerEventType.NAME_CHANGED,
      source: CustomerEventSource.LINE_PROFILE_SYNC,
      previousValue: "Fon",
      newValue: "Reno16 256GB",
      metadata: null,
      createdAt: new Date(),
    };

    const signals = await classifier.classifyEvent(mockEvent);

    assert.equal(signals.length, 1);
    assert.equal(signals[0].signalType, CustomerSignalType.PRODUCT_INTEREST);
    assert.equal(signals[0].source, CustomerSignalSource.NAME_CHANGE);
    assert.equal(signals[0].productModelId, "model-reno16");
  });

  it("extracts PURCHASE_INTENT signal when display name contains commercial keywords", async () => {
    let createdSignals: any[] = [];
    const mockPrisma = {
      productModel: {
        findMany: async () => [],
      },
      customerSignal: {
        deleteMany: async () => {},
        createMany: async ({ data }: any) => {
          createdSignals = data;
          return { count: data.length };
        },
        findMany: async ({ where }: any) => createdSignals.map((d, i) => ({ id: `sig-${i}`, ...d })),
      },
    } as unknown as PrismaService;

    const classifier = new CustomerSignalClassifierService(mockPrisma);

    const mockEvent: CustomerEvent = {
      id: "evt-2",
      customerId: "cust-2",
      type: CustomerEventType.NAME_CHANGED,
      source: CustomerEventSource.LINE_PROFILE_SYNC,
      previousValue: "K.Somchai",
      newValue: "สนใจผ่อนสินค้า",
      metadata: null,
      createdAt: new Date(),
    };

    const signals = await classifier.classifyEvent(mockEvent);

    assert.equal(signals.length, 1);
    assert.equal(signals[0].signalType, CustomerSignalType.PURCHASE_INTENT);
    assert.equal(signals[0].detectedText, "สนใจ");
  });

  it("extracts PROMOTION_INTEREST signal when display name mentions promo", async () => {
    let createdSignals: any[] = [];
    const mockPrisma = {
      productModel: {
        findMany: async () => [],
      },
      customerSignal: {
        deleteMany: async () => {},
        createMany: async ({ data }: any) => {
          createdSignals = data;
          return { count: data.length };
        },
        findMany: async ({ where }: any) => createdSignals.map((d, i) => ({ id: `sig-${i}`, ...d })),
      },
    } as unknown as PrismaService;

    const classifier = new CustomerSignalClassifierService(mockPrisma);

    const mockEvent: CustomerEvent = {
      id: "evt-3",
      customerId: "cust-3",
      type: CustomerEventType.NAME_CHANGED,
      source: CustomerEventSource.LINE_PROFILE_SYNC,
      previousValue: "Som",
      newValue: "ขอโปรแถมเคส",
      metadata: null,
      createdAt: new Date(),
    };

    const signals = await classifier.classifyEvent(mockEvent);

    assert.equal(signals.length, 1);
    assert.equal(signals[0].signalType, CustomerSignalType.PROMOTION_INTEREST);
    assert.equal(signals[0].detectedText, "โปร");
  });

  it("extracts MULTIPLE signals from 1 event (product + purchase intent + promotion)", async () => {
    let createdSignals: any[] = [];
    const mockPrisma = {
      productModel: {
        findMany: async () => [
          {
            id: "model-reno16",
            name: "Reno16 256GB",
            isActive: true,
            aliases: [{ alias: "reno 16", source: "MANUAL", isActive: true }],
            productSeries: { name: "Reno16 Series" },
          },
        ],
      },
      customerSignal: {
        deleteMany: async () => {},
        createMany: async ({ data }: any) => {
          createdSignals = data;
          return { count: data.length };
        },
        findMany: async ({ where }: any) => createdSignals.map((d, i) => ({ id: `sig-${i}`, ...d })),
      },
    } as unknown as PrismaService;

    const classifier = new CustomerSignalClassifierService(mockPrisma);

    const mockEvent: CustomerEvent = {
      id: "evt-4",
      customerId: "cust-4",
      type: CustomerEventType.NAME_CHANGED,
      source: CustomerEventSource.LINE_PROFILE_SYNC,
      previousValue: "Fon",
      newValue: "Reno16 256GB สนใจผ่อนโปรแถมเคส",
      metadata: null,
      createdAt: new Date(),
    };

    const signals = await classifier.classifyEvent(mockEvent);

    assert.equal(signals.length, 3);
    const signalTypes = signals.map((s) => s.signalType);
    assert.ok(signalTypes.includes(CustomerSignalType.PRODUCT_INTEREST));
    assert.ok(signalTypes.includes(CustomerSignalType.PURCHASE_INTENT));
    assert.ok(signalTypes.includes(CustomerSignalType.PROMOTION_INTEREST));
  });

  it("extracts UNKNOWN noise fallback when name contains no recognizable pattern", async () => {
    let createdSignals: any[] = [];
    const mockPrisma = {
      productModel: {
        findMany: async () => [],
      },
      customerSignal: {
        deleteMany: async () => {},
        createMany: async ({ data }: any) => {
          createdSignals = data;
          return { count: data.length };
        },
        findMany: async ({ where }: any) => createdSignals.map((d, i) => ({ id: `sig-${i}`, ...d })),
      },
    } as unknown as PrismaService;

    const classifier = new CustomerSignalClassifierService(mockPrisma);

    const mockEvent: CustomerEvent = {
      id: "evt-5",
      customerId: "cust-5",
      type: CustomerEventType.NAME_CHANGED,
      source: CustomerEventSource.LINE_PROFILE_SYNC,
      previousValue: "Fon",
      newValue: "Random Customer Name",
      metadata: null,
      createdAt: new Date(),
    };

    const signals = await classifier.classifyEvent(mockEvent);

    assert.equal(signals.length, 1);
    assert.equal(signals[0].signalType, CustomerSignalType.UNKNOWN);
  });
});
