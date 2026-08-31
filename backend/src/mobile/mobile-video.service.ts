import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ActivityActionType,
  BmReplyStatus,
  FollowUpStatus,
  MessageDirection,
  MessageType,
  Prisma,
} from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { MediaStorageService } from "../media/media-storage";
import { createMediaPublicUrl } from "../media/media-public-url";
import { ownerTrackingInboundFilter } from "../owner-tracking";
import { PrismaService } from "../prisma.service";
import { RealtimeEventService } from "../realtime/realtime-event.service";

export const MOBILE_VIDEO_MAX_BYTES = 30 * 1024 * 1024;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIDEO_PREVIEW_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAIAAABqhmJGAAADJUlEQVR42u3dW24qMRBFUYgYhJn/4Hoa+SVRBP0ol8vOWt83gJB2jrshuvfW2g2Y05e3AAQMCBgQMAgYEDAgYEDAIGBAwICAQcCAgAEBAwIGAQMCBgQMCBgEDAgYEDAIGBAwIGBAwCBgQMCAgAEBg4ABAQMCBgEDAgYEDAgYBAwIGBAwCBgQMCBgQMAgYEDAgIABAYOAAQEDAgYBAwIGBAzs8PAWLGbbtvf/4Pl8epeWcW+teRfWLlbPAmbBdGUsYMp1+zHFiz+OgAlO93R14Q+IgNkbW2BmXR8cAUs3oy4ZC5i+USUUlf+MCHj9epNDGvjU7OebWOr92+szBn5ehYDVq2EcoWeot8jZtdrrwQKr98wU22EBM+XWaVjAHLju9ToR8Kz11rzUdE9LwBzrxGtDwItf+iaPoYthARNc4LZtQ3LSsIAJO6Cm5eQgLWC6VJc/xUZYwATPWkJURljA9B1G2yhgks6faX+g32OE/aYQMKYYAc85vws8l98RAv6/cm4I9Zhit7IEjBM1AsaJV8CYYgTMgQ0cexl5vWEfJgkYU4yAcVUsYEwxAsYUI2BMMW89vAX84vtVFhj1YoGRLhYY9VpgpIsF5mc2Y+/3Xq/Xf1xogTG8WGDUa4GRLhaYM5eRvdMNr9cXtgRsDFd4LsPuCI20sMBz1tXpLNq1Xh8gWWAMLxZ4CYEjnFCv21cCJj62HreaTb2AyZi1tJbMr4CJDC9/eM1vEffWmneh1PwWr8LNZwvMrAdUh2cB8/k4WrOT11dlfgXMrJeU6hUwH9qoNsIufQXMrA2rtyx3oYsqcsHputcCc/U6c9QUq1fAzNqweh2hCQ7pNuIPFdQrYCKL6hdV2hMhYBlH1iVdATOg4YuxhT8gAuZkdTvbu/jjCJiMkg/RrYCZMmPpCpiZalasgIESfBMLBAwIGBAwCBgQMCBgQMAgYEDAgIBBwICAAQEDAgYBAwIGBAwIGAQMCBgQMAgYEDAgYEDAIGBAwICAAQGDgAEBAwIGAQMCBgQMCBgEDAgYEDAIGBAwIGBAwCBgQMCAgAEBg4ABAQMCBgEDAgYSfQO9jEwDpZeTFwAAAABJRU5ErkJggg==",
  "base64",
);

export function isSupportedMp4(buffer: Buffer): boolean {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
  return brand !== "qt  " && !brand.startsWith("3g");
}

@Injectable()
export class MobileVideoService {
  private readonly logger = new Logger(MobileVideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
    private readonly encryption: CredentialEncryptionService,
    private readonly media: MediaStorageService,
    private readonly realtime: RealtimeEventService,
  ) {}

  async send(
    user: AuthUser,
    conversationId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    idempotencyKey: string,
  ) {
    const canReply = user.authorization?.capabilities.reply ?? user.permissions?.canReply;
    if (canReply === false) throw new ForbiddenException("Reply access is forbidden");
    await this.storeAccess.assertConversationAccess(user, conversationId);

    if (!UUID_V4.test(idempotencyKey)) {
      throw new BadRequestException("idempotencyKey must be a UUID");
    }
    if (!file.buffer.length || file.buffer.length > MOBILE_VIDEO_MAX_BYTES) {
      throw new BadRequestException("Video exceeds the 30 MB limit");
    }
    if (!isSupportedMp4(file.buffer)) {
      throw new BadRequestException("Only MP4 video is supported");
    }
    const declaredMime = (file.mimetype ?? "").split(";", 1)[0].trim().toLowerCase();
    if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== "video/mp4") {
      throw new BadRequestException("Video content does not match the supported MP4 type");
    }

    const dedupeExternalId = `outbound:${idempotencyKey}`;
    const prior = await this.prisma.message.findUnique({
      where: { externalMessageId: dedupeExternalId },
      include: { media: true },
    });
    if (prior) return this.response(prior, true);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        store: true,
        lineOfficialAccount: true,
        owner: { select: { id: true, displayName: true } },
      },
    });
    if (!conversation) throw new NotFoundException("ไม่พบการสนทนา");
    if (!conversation.customer.lineUserId) throw new BadRequestException("ไม่พบ LINE User ID ของลูกค้า");
    const oa = conversation.lineOfficialAccount;
    if (!oa || oa.archivedAt || !oa.isActive || !oa.encryptedChannelAccessToken) {
      throw new BadRequestException("LINE Official Account นี้ไม่ได้เปิดใช้งาน");
    }

    let accessToken: string;
    try {
      accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken);
    } catch {
      throw new ServiceUnavailableException("ไม่สามารถอ่าน Channel Access Token ของร้านนี้ได้");
    }

    const videoKey = `line-media/outbound/${conversation.id}/${idempotencyKey}.mp4`;
    const previewKey = `line-media/outbound/${conversation.id}/${idempotencyKey}-preview.png`;
    const [storedVideo] = await Promise.all([
      this.media.put(videoKey, file.buffer, "video/mp4"),
      this.media.put(previewKey, VIDEO_PREVIEW_PNG, "image/png"),
    ]);
    const originalContentUrl = createMediaPublicUrl(videoKey);
    const previewImageUrl = createMediaPublicUrl(previewKey);

    const delivery = await this.pushVideo({
      accessToken,
      lineUserId: conversation.customer.lineUserId,
      originalContentUrl,
      previewImageUrl,
      retryKey: idempotencyKey,
    });

    const sentAt = new Date();
    const ownerTracked = (await this.prisma.message.count({
      where: { conversationId: conversation.id, ...ownerTrackingInboundFilter() },
    })) > 0;
    let ownerAssigned = false;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            externalMessageId: dedupeExternalId,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.VIDEO,
            originalText: "[Video]",
            sentAt,
            senderUserId: user.id,
            senderDisplayName: user.displayName?.trim() || "Store",
            rawPayload: {
              provider: "LINE",
              deliveryMethod: "PUSH",
              providerMessageId: delivery.externalMessageId,
              requestId: delivery.requestId,
              acceptedRequestId: delivery.acceptedRequestId,
            },
          },
        });
        await tx.messageMedia.create({
          data: {
            messageId: message.id,
            providerMessageId: dedupeExternalId,
            mediaType: MessageType.VIDEO,
            mimeType: "video/mp4",
            objectKey: videoKey,
            provider: storedVideo.provider,
            fileId: storedVideo.fileId,
            fileSize: storedVideo.size,
            processingStatus: "READY",
          },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            latestMessageAt: sentAt,
            bmReplyStatus: BmReplyStatus.REPLIED,
            followUpStatus: FollowUpStatus.COMPLETED,
          },
        });
        if (ownerTracked) {
          const ownerUpdate = await tx.conversation.updateMany({
            where: { id: conversation.id, ownerUserId: null },
            data: { ownerUserId: user.id },
          });
          ownerAssigned = ownerUpdate.count === 1;
        }
        await tx.activityHistory.create({
          data: {
            conversationId: conversation.id,
            actionType: ActivityActionType.STATUS_CHANGED,
            previousStatus: conversation.followUpStatus,
            newStatus: FollowUpStatus.COMPLETED,
            previousBmReplyStatus: conversation.bmReplyStatus,
            newBmReplyStatus: BmReplyStatus.REPLIED,
            createdByName: user.displayName,
            description: `Customer video sent via LINE (PUSH); storeId=${conversation.storeId}; lineOfficialAccountId=${conversation.lineOfficialAccountId}`,
          },
        });
        return message;
      });

      const owner = ownerAssigned
        ? { id: user.id, displayName: user.displayName?.trim() || "Staff" }
        : conversation.owner
          ? { id: conversation.owner.id, displayName: conversation.owner.displayName?.trim() || "Staff" }
          : null;
      this.realtime.publish({
        type: "message.created",
        version: 1,
        conversationId: conversation.id,
        storeId: conversation.storeId,
        message: {
          id: created.id,
          direction: "OUTBOUND",
          messageType: "VIDEO",
          text: created.originalText,
          sentAt: sentAt.toISOString(),
          sender: { userId: user.id, displayName: user.displayName?.trim() || "Staff" },
          media: {
            processingStatus: "READY",
            mimeType: "video/mp4",
            fileSize: storedVideo.size,
            url: `/messages/${created.id}/media`,
          },
        },
        conversation: {
          id: conversation.id,
          latestMessageAt: sentAt.toISOString(),
          bmReplyStatus: BmReplyStatus.REPLIED,
          owner,
          ownerTracked,
        },
      });

      return this.response(
        { ...created, media: { processingStatus: "READY", mimeType: "video/mp4", fileSize: storedVideo.size } },
        delivery.duplicateAccepted,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.message.findUnique({
          where: { externalMessageId: dedupeExternalId },
          include: { media: true },
        });
        if (existing) return this.response(existing, true);
      }
      this.logger.error(`LINE accepted outbound video but persistence failed for conversation ${conversation.id}`);
      throw error;
    }
  }

  private response(
    message: {
      id: string;
      direction: MessageDirection;
      messageType: MessageType;
      originalText: string;
      sentAt: Date;
      externalMessageId?: string | null;
      senderUserId?: string | null;
      senderDisplayName?: string | null;
      media?: { processingStatus: string; mimeType: string | null; fileSize: number | null } | null;
    },
    duplicate: boolean,
  ) {
    return {
      message: {
        id: message.id,
        direction: message.direction,
        messageType: message.messageType,
        text: message.originalText,
        sentAt: message.sentAt.toISOString(),
        sender: message.senderUserId
          ? { userId: message.senderUserId, displayName: message.senderDisplayName?.trim() || "Staff" }
          : null,
        media: message.media
          ? {
              processingStatus: message.media.processingStatus,
              mimeType: message.media.mimeType,
              fileSize: message.media.fileSize,
              url: message.media.processingStatus === "READY" ? `/messages/${message.id}/media` : null,
            }
          : null,
        idempotencyKey: message.externalMessageId?.startsWith("outbound:")
          ? message.externalMessageId.slice("outbound:".length)
          : null,
      },
      bmReplyStatus: BmReplyStatus.REPLIED,
      duplicate,
    };
  }

  private async pushVideo(input: {
    accessToken: string;
    lineUserId: string;
    originalContentUrl: string;
    previewImageUrl: string;
    retryKey: string;
  }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Line-Retry-Key": input.retryKey,
        },
        body: JSON.stringify({
          to: input.lineUserId,
          messages: [{
            type: "video",
            originalContentUrl: input.originalContentUrl,
            previewImageUrl: input.previewImageUrl,
          }],
        }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException("ส่งวิดีโอไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      let lineMessage = "";
      try {
        const body = await response.json() as { message?: string };
        lineMessage = body.message?.trim() ?? "";
      } catch {
        // Keep provider body out of logs and user response if it is not JSON.
      }
      if (response.status === 401) {
        throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      }
      if (response.status === 429) {
        throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      }
      if (response.status === 400 || response.status === 403) {
        throw new BadGatewayException(`LINE ปฏิเสธการส่งวิดีโอ${lineMessage ? `: ${lineMessage}` : ""}`);
      }
      throw new ServiceUnavailableException("ส่งวิดีโอไม่สำเร็จ กรุณาลองอีกครั้ง");
    }

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try {
      body = await response.json() as typeof body;
    } catch {
      // A duplicate-accepted response may have no JSON body.
    }
    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
      duplicateAccepted,
    };
  }
}
