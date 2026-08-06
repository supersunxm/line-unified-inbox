import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { CustomerEventType } from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { CustomerIntelligenceService } from "./customer-intelligence.service";

@Controller("customers")
export class CustomersController {
  constructor(private readonly prisma: PrismaService, private readonly intelligence: CustomerIntelligenceService) {}

  @Get(":id/name-history")
  async nameHistory(@Param("id") id: string) {
    if (!id || id.trim() === "" || id === "undefined" || id === "null") {
      throw new BadRequestException("Invalid customer ID");
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        displayName: true,
        events: {
          where: { type: CustomerEventType.NAME_CHANGED },
          orderBy: { createdAt: "desc" },
          select: { id: true, newValue: true, previousValue: true, source: true, createdAt: true },
        },
      },
    }).catch(() => null);

    if (!customer) {
      const fallbackCustomer = await this.prisma.customer.findUnique({
        where: { id },
        select: { displayName: true },
      });
      if (!fallbackCustomer) throw new NotFoundException("Customer not found");
      return { currentName: fallbackCustomer.displayName, history: [] };
    }

    const history = customer.events.map((e) => ({
      id: e.id,
      displayName: e.newValue || customer.displayName,
      previousValue: e.previousValue,
      source: e.source,
      capturedAt: e.createdAt,
    }));

    return {
      currentName: customer.displayName,
      history,
    };
  }

  @Get(":id/events")
  async customerEvents(@Param("id") id: string) {
    if (!id || id.trim() === "" || id === "undefined" || id === "null") {
      throw new BadRequestException("Invalid customer ID");
    }
    try {
      return await this.prisma.customerEvent.findMany({
        where: { customerId: id },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return [];
    }
  }

  @Get(":id/intelligence")
  async customerIntelligence(@Param("id") id: string) {
    if (!id || id.trim() === "" || id === "undefined" || id === "null") {
      throw new BadRequestException("Invalid customer ID");
    }
    return this.intelligence.analyze(id);
  }
}

