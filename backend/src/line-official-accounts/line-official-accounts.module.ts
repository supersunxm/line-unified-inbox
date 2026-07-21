import { Module } from "@nestjs/common";
import { LineOfficialAccountsController } from "./line-official-accounts.controller";
import { LineOfficialAccountsService } from "./line-official-accounts.service";

@Module({ controllers: [LineOfficialAccountsController], providers: [LineOfficialAccountsService] })
export class LineOfficialAccountsModule {}
