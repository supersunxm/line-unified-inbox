import { Module } from "@nestjs/common";
import { StoreMasterController } from "./store-master.controller";
import { StoreMasterService } from "./store-master.service";
import { StoreLifecycleService } from "./store-lifecycle.service";

@Module({ controllers: [StoreMasterController], providers: [StoreMasterService, StoreLifecycleService], exports: [StoreMasterService, StoreLifecycleService] })
export class StoreMasterModule {}
