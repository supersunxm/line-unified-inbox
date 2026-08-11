import { Module } from "@nestjs/common";
import { DeviceTokenController } from "./device-token.controller";
import { DeviceTokenService } from "./device-token.service";
import { NotificationDispatcher } from "./notification-dispatcher.service";
import { NotificationEnqueueService } from "./notification-enqueue.service";
import { FirebasePushProvider } from "./firebase-push.provider";
import { NotificationWorker } from "./notification-worker.service";

@Module({ controllers: [DeviceTokenController], providers: [DeviceTokenService, NotificationEnqueueService, NotificationDispatcher, FirebasePushProvider, NotificationWorker], exports: [NotificationEnqueueService, NotificationDispatcher, NotificationWorker] })
export class NotificationsModule {}
