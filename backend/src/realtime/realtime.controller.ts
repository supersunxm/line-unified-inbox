import { Controller, MessageEvent, Req, Sse } from "@nestjs/common";
import { interval, merge, of } from "rxjs";
import { filter, map } from "rxjs/operators";
import type { AuthRequest } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { RealtimeEventService } from "./realtime-event.service";

@Controller("realtime")
export class RealtimeController {
  constructor(private readonly events: RealtimeEventService, private readonly storeAccess: StoreAccessService) {}

  @Sse("events")
  async eventsStream(@Req() request: AuthRequest) {
    const storeIds = await this.storeAccess.accessibleStoreIds(request.user!);
    return merge(
      of<MessageEvent>({ type: "connected", data: { version: 1 } }),
      this.events.stream().pipe(
        filter((event) => event.storeId !== null && (storeIds === null || storeIds.includes(event.storeId))),
        map((event) => ({ type: event.type, data: event })),
      ),
      interval(25_000).pipe(map(() => ({ type: "heartbeat", data: { version: 1 } }))),
    );
  }
}
