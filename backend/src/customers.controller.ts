import { BadRequestException, Controller, Get, NotFoundException, Param } from "@nestjs/common";
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
        nameHistory: {
          orderBy: { capturedAt: "desc" },
          select: { id: true, displayName: true, source: true, capturedAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return {
      currentName: customer.displayName,
      history: customer.nameHistory,
    };
  }

  @Get(":id/intelligence")
  async customerIntelligence(@Param("id") id: string) {
    if (!id || id.trim() === "" || id === "undefined" || id === "null") {
      throw new BadRequestException("Invalid customer ID");
    }
    return this.intelligence.analyze(id);
  }
}

