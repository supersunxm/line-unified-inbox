import { Module } from "@nestjs/common";
import { StoreMasterController } from "./store-master.controller";
import { StoreMasterService } from "./store-master.service";

@Module({ controllers: [StoreMasterController], providers: [StoreMasterService], exports: [StoreMasterService] })
export class StoreMasterModule {}
