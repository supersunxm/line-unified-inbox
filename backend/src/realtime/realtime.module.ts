import { Global, Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller";
import { RealtimeEventService } from "./realtime-event.service";

@Global()
@Module({ controllers: [RealtimeController], providers: [RealtimeEventService], exports: [RealtimeEventService] })
export class RealtimeModule {}
