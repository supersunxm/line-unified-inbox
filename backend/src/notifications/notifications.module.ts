import { Module } from "@nestjs/common";
import { DeviceTokenController } from "./device-token.controller";
import { DeviceTokenService } from "./device-token.service";
import { NotificationDispatcher } from "./notification-dispatcher.service";
import { NotificationEnqueueService } from "./notification-enqueue.service";

@Module({ controllers: [DeviceTokenController], providers: [DeviceTokenService, NotificationEnqueueService, NotificationDispatcher], exports: [NotificationEnqueueService, NotificationDispatcher] })
export class NotificationsModule {}
