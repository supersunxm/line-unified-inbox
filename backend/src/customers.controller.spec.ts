import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomerIntelligenceService } from "./customer-intelligence.service";
import { PrismaService } from "./prisma.service";

describe("CustomersController", () => {
  it("extracts id param correctly and returns customer name history", async () => {
    const mockPrisma = {
      customer: {
        findUnique: async ({ where }: any) => {
          if (where.id === "cust-1") {
            return {
              displayName: "Test Customer",
              events: [{ id: "h1", newValue: "Old Name", previousValue: "Original Name", source: "LINE_PROFILE_SYNC", createdAt: new Date() }],
            };
          }
          return null;
        },
      },
    } as unknown as PrismaService;

    const mockIntelligence = {} as CustomerIntelligenceService;
    const controller = new CustomersController(mockPrisma, mockIntelligence);

    const result = await controller.nameHistory("cust-1");
    assert.equal(result.currentName, "Test Customer");
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].displayName, "Old Name");
  });

  it("throws BadRequestException when nameHistory receives invalid customer id", async () => {
    const controller = new CustomersController({} as PrismaService, {} as CustomerIntelligenceService);
    await assert.rejects(async () => controller.nameHistory("undefined"), BadRequestException);
    await assert.rejects(async () => controller.nameHistory(""), BadRequestException);
  });

  it("throws NotFoundException when customer is not found", async () => {
    const mockPrisma = {
      customer: {
        findUnique: async () => null,
      },
    } as unknown as PrismaService;

    const controller = new CustomersController(mockPrisma, {} as CustomerIntelligenceService);
    await assert.rejects(async () => controller.nameHistory("cust-999"), NotFoundException);
  });

  it("customerIntelligence extracts id parameter correctly and delegates to service", async () => {
    let analyzedId = "";
    const mockIntelligence = {
      analyze: async (id: string) => {
        analyzedId = id;
        return {
          customerId: id,
          profileSummary: "Summary",
          customerStage: "NEW",
          intent: [],
          interestedProducts: [],
          recommendedActions: [],
          confidenceScore: 0.8,
          evidence: [],
        };
      },
    } as unknown as CustomerIntelligenceService;

    const controller = new CustomersController({} as PrismaService, mockIntelligence);
    const result = await controller.customerIntelligence("cust-100");

    assert.equal(analyzedId, "cust-100");
    assert.equal(result.customerId, "cust-100");
  });

  it("customerIntelligence rejects invalid customer ID", async () => {
    const controller = new CustomersController({} as PrismaService, {} as CustomerIntelligenceService);
    await assert.rejects(async () => controller.customerIntelligence("null"), BadRequestException);
  });
});
