import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StoreMasterController } from "./store-master.controller";
import { StoreMasterService } from "./store-master.service";

@Module({ controllers: [StoreMasterController], providers: [PrismaService, StoreMasterService], exports: [StoreMasterService] })
export class StoreMasterModule {}
