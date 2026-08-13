import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeEventService } from "./realtime-event.service";

@Global()
@Module({ imports: [AuthModule], controllers: [RealtimeController], providers: [RealtimeEventService], exports: [RealtimeEventService] })
export class RealtimeModule {}
