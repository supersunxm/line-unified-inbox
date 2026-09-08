import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { PublicStoresController } from "./public-stores.controller";
import { PublicStoresService } from "./public-stores.service";

@Module({
  imports: [PrismaModule],
  controllers: [PublicStoresController],
  providers: [PublicStoresService],
  exports: [PublicStoresService],
})
export class PublicStoresModule {}
