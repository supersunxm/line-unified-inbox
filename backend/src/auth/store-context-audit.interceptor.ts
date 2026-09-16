import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { AuthRequest } from "./auth.guard";
import { AuditLogService } from "./audit-log.service";

@Injectable()
export class StoreContextAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const actingStore = request.user?.storeContext;
    if (!actingStore || ["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.audit.record({
            actorUserId: request.user!.id,
            action: "HQ_STORE_ACTION",
            metadata: {
              actingStoreId: actingStore.storeId,
              actingStoreName: actingStore.storeName,
              actingStoreCode: actingStore.storeCode,
              method: request.method,
              path: request.path,
            },
            ipAddress: request.ip,
            userAgent: request.get("user-agent"),
          });
        },
      }),
    );
  }
}
