import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineOfficialAccountsController } from "./line-official-accounts.controller";
import { LineOfficialAccountsService } from "./line-official-accounts.service";

@Module({ controllers: [LineOfficialAccountsController], providers: [PrismaService, LineOfficialAccountsService] })
export class LineOfficialAccountsModule {}
