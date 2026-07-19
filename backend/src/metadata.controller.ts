import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("metadata")
export class MetadataController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("products") async products() {
    return { series: await this.prisma.productSeries.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { models: { where: { isActive: true }, orderBy: { name: "asc" } } } }) };
  }
  @Get("topics") topics() { return this.prisma.topic.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }); }
}
