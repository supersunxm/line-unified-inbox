import { BadRequestException, ForbiddenException, Injectable, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ActivityActionType, BmReplyStatus, FollowUpStatus, MessageDirection, MessageType, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { LineChatManagerMessageRelayService } from "../line-chat/line-chat-manager-message-relay.service";
import { MediaStorageService } from "../media/media-storage";
import { createMediaPublicUrl } from "../media/media-public-url";
import { PDF_MIME_TYPE, PdfValidationError, readPdfMaxBytes, validatePdfBuffer } from "../media/pdf-media";
import { ownerTrackingInboundFilter } from "../owner-tracking";
import { PrismaService } from "../prisma.service";
import { RealtimeEventService } from "../realtime/realtime-event.service";

@Injectable()
export class MobilePdfSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
    private readonly media: MediaStorageService,
    private readonly managerRelay: LineChatManagerMessageRelayService,
    @Optional() private readonly realtime?: RealtimeEventService,
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

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new BadRequestException("idempotencyKey must be a UUID");
    }

    let pdf: ReturnType<typeof validatePdfBuffer>;
    try {
      pdf = validatePdfBuffer({
        buffer: file.buffer,
        filename: file.originalname,
        mimeType: file.mimetype,
        maxBytes: readPdfMaxBytes(),
      });
    } catch (error) {
      if (error instanceof PdfValidationError) {
        const message = error.code === "PDF_TOO_LARGE"
          ? "ไฟล์ PDF มีขนาดใหญ่เกินกว่าที่ระบบรองรับ"
          : error.code === "PDF_EXTENSION_REQUIRED"
            ? "รองรับไฟล์ PDF เท่านั้น"
            : error.code === "PDF_MIME_REQUIRED"
              ? "ชนิดไฟล์ไม่ตรงกับ PDF"
              : "ไฟล์ที่เลือกไม่ใช่ PDF ที่ถูกต้อง";
        throw new BadRequestException(message);
      }
      throw error;
    }

    const externalMessageId = `outbound:${idempotencyKey}`;
    const existing = await this.prisma.message.findUnique({
      where: { externalMessageId },
      include: { media: true },
    });
    if (existing) {
      return {
        message: this.presentMessage(existing),
        bmReplyStatus: BmReplyStatus.REPLIED,
        duplicate: true,
      };
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        store: true,
        lineOfficialAccount: true,
        owner: { select: { id: true, displayName: true } },
        _count: { select: { messages: { where: ownerTrackingInboundFilter() } } },
      },
    });
    if (!conversation) throw new BadRequestException("ไม่พบการสนทนา");
    if (!conversation.storeId || !conversation.lineOfficialAccount?.isActive || conversation.lineOfficialAccount.archivedAt) {
      throw new BadRequestException("LINE Official Account นี้ไม่ได้เปิดใช้งาน");
    }

    const objectKey = `line-media/outbound/${conversation.id}/${idempotencyKey}.pdf`;
    const stored = await this.media.put(objectKey, file.buffer, PDF_MIME_TYPE);
    if (!stored.fileId || !stored.provider) {
      throw new ServiceUnavailableException("Media storage failed to persist outbound PDF");
    }

    const relayUrl = new URL(createMediaPublicUrl(objectKey));
    relayUrl.searchParams.set("filename", pdf.filename);

    const relay = await this.managerRelay.relayImage({
      conversationId: conversation.id,
      imageUrl: relayUrl.toString(),
      idempotencyKey,
    });
    if (!relay.handled) {
      throw new ServiceUnavailableException(
        "ร้านนี้ยังไม่ได้เปิดการส่งไฟล์ผ่าน LINE OA Manager ระบบจะไม่ส่งผ่าน Messaging API เพื่อป้องกันการใช้โควต้า",
      );
    }

    const sentAt = new Date();
    const documentToken = randomUUID();
    let ownerAssigned = false;
    const ownerTracked = (conversation._count?.messages ?? 0) > 0;

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            externalMessageId,
            direction: MessageDirection.OUTBOUND,
            messageType: MessageType.FILE,
            originalText: `[PDF: ${pdf.filename}]`,
            fileName: pdf.filename,
            sentAt,
            senderUserId: user.id,
            senderDisplayName: user.displayName?.trim() || "Store",
            rawPayload: {
              provider: "LINE_MANAGER",
              deliveryMethod: "MANUAL_CHAT_FILE",
              lineChatUserId: relay.lineChatUserId,
              fileType: PDF_MIME_TYPE,
            },
          },
        });
        await tx.messageMedia.create({
          data: {
            id: documentToken,
            messageId: message.id,
            providerMessageId: externalMessageId,
            mediaType: MessageType.FILE,
            mimeType: PDF_MIME_TYPE,
            objectKey: stored.provider === "google-drive" ? null : objectKey,
            provider: stored.provider,
            fileId: stored.fileId,
            fileSize: stored.size,
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
          const result = await tx.conversation.updateMany({
            where: { id: conversation.id, ownerUserId: null },
            data: { ownerUserId: user.id },
          });
          ownerAssigned = result.count === 1;
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
            description: `Customer PDF sent via LINE OA Manager Manual Chat; storeId=${conversation.storeId}; lineOfficialAccountId=${conversation.lineOfficialAccountId}`,
          },
        });
        return message;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.prisma.message.findUnique({
          where: { externalMessageId },
          include: { media: true },
        });
        if (duplicate) {
          return {
            message: this.presentMessage(duplicate),
            bmReplyStatus: BmReplyStatus.REPLIED,
            duplicate: true,
          };
        }
      }
      throw error;
    }

    const media = {
      processingStatus: "READY",
      mimeType: PDF_MIME_TYPE,
      fileSize: stored.size,
      url: `/messages/${created.id}/media`,
    };
    const sender = { userId: user.id, displayName: user.displayName?.trim() || "Staff" };
    const owner = ownerAssigned
      ? { id: user.id, displayName: user.displayName?.trim() || "Staff" }
      : conversation.owner
        ? { id: conversation.owner.id, displayName: conversation.owner.displayName || "Staff" }
        : null;

    this.realtime?.publish({
      type: "message.created",
      version: 1,
      conversationId: conversation.id,
      storeId: conversation.storeId,
      message: {
        id: created.id,
        direction: MessageDirection.OUTBOUND,
        messageType: MessageType.FILE,
        text: created.originalText,
        fileName: created.fileName,
        sentAt: created.sentAt.toISOString(),
        sender,
        media,
      },
      conversation: {
        id: conversation.id,
        latestMessageAt: sentAt.toISOString(),
        bmReplyStatus: BmReplyStatus.REPLIED,
        ownerTracked,
        owner,
      },
    });

    return {
      message: {
        ...created,
        sender,
        sticker: null,
        media,
      },
      bmReplyStatus: BmReplyStatus.REPLIED,
      duplicate: relay.duplicate,
    };
  }

  private presentMessage(message: {
    id: string;
    conversationId: string;
    externalMessageId: string;
    direction: MessageDirection;
    messageType: MessageType;
    originalText: string;
    fileName: string | null;
    sentAt: Date;
    senderUserId: string | null;
    senderDisplayName: string | null;
    media?: { processingStatus: string; mimeType: string | null; fileSize: number | null } | null;
  }) {
    const sender = message.direction === MessageDirection.OUTBOUND && message.senderUserId
      ? { userId: message.senderUserId, displayName: message.senderDisplayName?.trim() || "Staff" }
      : null;
    return {
      id: message.id,
      conversationId: message.conversationId,
      externalMessageId: message.externalMessageId,
      direction: message.direction,
      messageType: message.messageType,
      originalText: message.originalText,
      fileName: message.fileName,
      sentAt: message.sentAt,
      sender,
      sticker: null,
      media: message.media
        ? {
            processingStatus: message.media.processingStatus,
            mimeType: message.media.mimeType,
            fileSize: message.media.fileSize,
            url: message.media.processingStatus === "READY" ? `/messages/${message.id}/media` : null,
          }
        : null,
    };
  }
}
