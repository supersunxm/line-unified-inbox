import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CustomerSalesStatus, PaymentMethodType, Prisma } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { ConversationsService } from "../conversations.service";
import { PrismaService } from "../prisma.service";
import { SendConversationMessageDto } from "../dto";
import { MobileConversationQueryDto, MobileMessageQueryDto, MobileProductQueryDto, MobileProductVariantQueryDto, SalesProductItemDto, UpdateCustomerSalesInformationDto, UpdateMobileConversationTagsDto, UpdateMobilePurchaseInformationDto } from "./mobile-conversations.dto";
import { EMPTY_OPERATIONAL_PRIORITY, PriorityService } from "../priority/priority.service";
import type { OperationalPriority } from "../priority/priority.types";
import { buildAiInsight, buildCustomerSalesInformation, buildOperationalState, buildPurchaseInformation } from "../conversation-data-contract";

const previewText = (text: string, max = 160) => text.length <= max ? text : `${text.slice(0, max - 1)}…`;

function purchaseSnapshot(input: {
  sourceChannels: readonly string[];
  isInstallment: boolean;
  products?: readonly { productModelId: string; productVariantId: string | null }[];
}) {
  return {
    purchaseChannel: [...input.sourceChannels],
    paymentMethod: input.isInstallment ? "INSTALLMENT" : null,
    products: (input.products ?? []).map((product) => ({ productModelId: product.productModelId, productVariantId: product.productVariantId })),
  };
}

@Injectable()
export class MobileConversationsService {
  constructor(private readonly prisma: PrismaService, private readonly storeAccess: StoreAccessService, private readonly conversations: ConversationsService, private readonly priority: PriorityService = undefined as unknown as PriorityService) {}

  async list(user: AuthUser, query: MobileConversationQueryDto) {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const pageSize = Math.min(50, Math.max(1, query.pageSize));
    const where: Prisma.ConversationWhereInput = {
      store: { isActive: true, archivedAt: null },
      ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ latestMessageAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          latestMessageAt: true,
          bmReplyStatus: true,
          followUpStatus: true,
          customer: { select: { id: true, displayName: true } },
          store: { select: { id: true, name: true, code: true } },
          messages: { orderBy: [{ sentAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true } },
          _count: { select: { pushNotifications: { where: { userId: user.id, readAt: null } } } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    const priorityById: Map<string, OperationalPriority> = this.priority
      ? await this.priority.forConversationIds(user, items.map((item) => item.id), accessibleStoreIds)
      : new Map<string, OperationalPriority>();
    return {
      items: items.map((item) => {
        const message = item.messages[0] ?? null;
        return {
          id: item.id,
          customer: item.customer,
          store: item.store,
          latestMessageAt: item.latestMessageAt,
          bmReplyStatus: item.bmReplyStatus,
          followUpStatus: item.followUpStatus,
          unreadCount: item._count.pushNotifications,
          priority: priorityById.get(item.id) ?? EMPTY_OPERATIONAL_PRIORITY,
          operationalState: buildOperationalState({
            replyStatus: item.bmReplyStatus,
            priority: priorityById.get(item.id)?.level,
            unread: item._count.pushNotifications,
          }),
          lastMessage: message ? { id: message.id, direction: message.direction, messageType: message.messageType, preview: previewText(message.originalText), sentAt: message.sentAt } : null,
        };
      }),
      total,
      page: query.page,
      pageSize,
    };
  }

  async get(user: AuthUser, conversationId: string, query: MobileMessageQueryDto = new MobileMessageQueryDto()) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    const cursor = query.before ? decodeCursor(query.before) : null;
    if (query.before && !cursor) throw new NotFoundException("Invalid message cursor");
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        latestMessageAt: true,
        bmReplyStatus: true,
        followUpStatus: true,
        priority: true,
        sourceChannels: true,
        isInstallment: true,
        customerSalesStatus: true,
        interestLevel: true,
        paymentMethod: true,
        productRelationship: true,
        purchaseIntent: true,
        purchaseRecordedAt: true,
        purchaseRecordedBy: { select: { id: true, displayName: true } },
        salesRecordedAt: true,
        salesRecordedBy: { select: { id: true, displayName: true } },
        customer: { select: { id: true, displayName: true } },
        store: { select: { id: true, name: true, code: true } },
        salesProducts: {
          select: {
            id: true,
            productModelId: true,
            productVariantId: true,
            customProductName: true,
            ram: true,
            rom: true,
            color: true,
            quantity: true,
            status: true,
            productModel: { select: { id: true, name: true, productSeries: { select: { name: true, productGroup: true } } } },
            productVariant: { select: { id: true, ram: true, rom: true, color: true } },
          },
        },
        products: {
          select: {
            source: true,
            confidence: true,
            matchedPhrase: true,
            detectionMethod: true,
            sourceMessageId: true,
            productModel: { select: { id: true, name: true, productSeries: { select: { name: true, productGroup: true } } } },
            productVariant: { select: { id: true, ram: true, rom: true, color: true } },
          },
        },
        topics: {
          select: {
            source: true,
            confidence: true,
            topic: { select: { id: true, name: true, category: true } },
          },
        },
        messages: {
          where: cursor ? { OR: [{ sentAt: { lt: cursor.sentAt } }, { sentAt: cursor.sentAt, id: { lt: cursor.id } }] } : undefined,
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
          take: query.limit + 1,
          select: { id: true, direction: true, messageType: true, originalText: true, sentAt: true, senderUserId: true, senderDisplayName: true, media: { select: { processingStatus: true, mimeType: true, fileSize: true } } },
        },
        _count: { select: { pushNotifications: { where: { userId: user.id, readAt: null } } } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    const hasEarlier = conversation.messages.length > query.limit;
    const pageMessages = conversation.messages.slice(0, query.limit).reverse();
    const oldest = pageMessages[0];
    const priority = this.priority
      ? (await this.priority.forConversationIds(user, [conversation.id])).get(conversation.id) ?? EMPTY_OPERATIONAL_PRIORITY
      : EMPTY_OPERATIONAL_PRIORITY;
    const products = conversation.products ?? [];
    const salesProducts = conversation.salesProducts ?? [];
    const topics = conversation.topics ?? [];
    // Only an explicitly MANUAL product can participate in the legacy tags
    // compatibility field. Unattributed rows must not look like purchase data.
    const manualProduct = products.find((product) => product.source === "MANUAL");
    return {
      id: conversation.id,
      customer: conversation.customer,
      store: conversation.store,
      latestMessageAt: conversation.latestMessageAt,
      bmReplyStatus: conversation.bmReplyStatus,
      followUpStatus: conversation.followUpStatus,
      tags: {
        sourceChannels: conversation.sourceChannels,
        isInstallment: conversation.isInstallment,
        product: manualProduct
          ? {
              id: manualProduct.productModel.id,
              productName: manualProduct.productModel.name,
              category: manualProduct.productModel.productSeries.productGroup,
              seriesName: manualProduct.productModel.productSeries.name,
            }
          : null,
        variant: manualProduct?.productVariant ?? null,
      },
      customerSalesInformation: buildCustomerSalesInformation({
        ...conversation,
        salesProducts,
        products,
        salesRecordedBy: conversation.salesRecordedBy,
        salesRecordedAt: conversation.salesRecordedAt,
        purchaseRecordedBy: conversation.purchaseRecordedBy,
        purchaseRecordedAt: conversation.purchaseRecordedAt,
      }),
      purchaseInformation: buildPurchaseInformation({
        ...conversation,
        salesProducts,
        products,
        salesRecordedBy: conversation.salesRecordedBy,
        salesRecordedAt: conversation.salesRecordedAt,
        purchaseRecordedBy: conversation.purchaseRecordedBy,
        purchaseRecordedAt: conversation.purchaseRecordedAt,
      }),
      aiInsight: buildAiInsight({
        products,
        topics,
        productRelationship: conversation.productRelationship,
        purchaseIntent: conversation.purchaseIntent,
      }),
      operationalState: buildOperationalState({
        replyStatus: conversation.bmReplyStatus,
        priority: priority.level,
        unread: conversation._count.pushNotifications,
      }),
      unreadCount: conversation._count.pushNotifications,
      nextCursor: hasEarlier && oldest ? encodeCursor(oldest.sentAt, oldest.id) : null,
      messages: pageMessages.map((message) => ({
        id: message.id,
        direction: message.direction,
        messageType: message.messageType,
        text: message.originalText,
        sentAt: message.sentAt,
        sender: message.direction === "OUTBOUND" ? { userId: message.senderUserId, displayName: message.senderDisplayName ?? "Store" } : null,
        media: message.media ? { processingStatus: message.media.processingStatus, mimeType: message.media.mimeType, fileSize: message.media.fileSize, url: message.media.processingStatus === "READY" ? `/messages/${message.id}/media` : null } : null,
      })),
    };
  }

  async markRead(user: AuthUser, conversationId: string) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    await this.prisma.pushNotification.updateMany({
      where: { userId: user.id, conversationId, readAt: null },
      data: { readAt: new Date() },
    });
    return { conversationId, unreadCount: 0 };
  }

  async products(query: MobileProductQueryDto) {
    const search = query.search?.trim();
    const models = await this.prisma.productModel.findMany({
      where: {
        isActive: true,
        classificationLevel: "MODEL",
        productSeries: {
          isActive: true,
          ...(query.category ? { productGroup: query.category } : {}),
        },
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: Math.min(50, Math.max(1, query.limit)),
      select: { id: true, name: true, productSeries: { select: { name: true, productGroup: true } } },
    });
    return {
      items: models.map((model) => ({
        id: model.id,
        productName: model.name,
        category: model.productSeries.productGroup,
        seriesName: model.productSeries.name,
      })),
    };
  }

  async productVariants(productId: string, query: MobileProductVariantQueryDto = new MobileProductVariantQueryDto()) {
    const product = await this.prisma.productModel.findFirst({
      where: { id: productId, isActive: true, classificationLevel: "MODEL", productSeries: { isActive: true } },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product model is unavailable");
    const variants = await this.prisma.productVariant.findMany({
      where: { productModelId: productId, isActive: true },
      orderBy: [{ ram: "asc" }, { rom: "asc" }, { color: "asc" }, { id: "asc" }],
      take: Math.min(50, Math.max(1, query.limit)),
      select: { id: true, ram: true, rom: true, color: true },
    });
    return { items: variants };
  }

  async updateTags(user: AuthUser, conversationId: string, dto: UpdateMobileConversationTagsDto, recordPurchaseBy?: AuthUser) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    const hasPurchaseFields = dto.sourceChannels !== undefined || dto.isInstallment !== undefined || dto.productId !== undefined || dto.variantId !== undefined;
    if (hasPurchaseFields && !recordPurchaseBy) {
      throw new BadRequestException("Purchase fields must be updated through /mobile/conversations/:id/purchase-information");
    }
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          sourceChannels: true,
          isInstallment: true,
          purchaseRecordedById: true,
          purchaseRecordedAt: true,
          products: { where: { source: "MANUAL" }, select: { productModelId: true, productVariantId: true } },
        },
      });
      if (!conversation) throw new NotFoundException("Conversation not found");
      const previousPurchase = purchaseSnapshot({
        sourceChannels: conversation.sourceChannels ?? [],
        isInstallment: conversation.isInstallment ?? false,
        products: conversation.products ?? [],
      });

      let productModel: { id: string } | null = null;
      let productVariant: { id: string; productModelId: string } | null = null;
      if (dto.productId === null && dto.variantId !== undefined && dto.variantId !== null) {
        throw new BadRequestException("A product is required for a product variant");
      }
      if (dto.productId !== undefined && dto.productId !== null) {
        productModel = await tx.productModel.findFirst({
          where: { id: dto.productId, isActive: true, classificationLevel: "MODEL", productSeries: { isActive: true } },
          select: { id: true },
        });
        if (!productModel) throw new BadRequestException("Product model is unavailable");
      }

      if (dto.variantId !== undefined && dto.variantId !== null) {
        productVariant = await tx.productVariant.findFirst({
          where: { id: dto.variantId, isActive: true, productModel: { isActive: true, classificationLevel: "MODEL", productSeries: { isActive: true } } },
          select: { id: true, productModelId: true },
        });
        if (!productVariant) throw new BadRequestException("Product variant is unavailable");
        const selectedProductId = productModel?.id ?? (await tx.conversationProduct.findFirst({ where: { conversationId, source: "MANUAL" }, select: { productModelId: true } }))?.productModelId;
        if (!selectedProductId || productVariant.productModelId !== selectedProductId) {
          throw new BadRequestException("Product variant does not belong to the selected product");
        }
      }

      const conversationUpdate: Prisma.ConversationUpdateInput = {};
      if (dto.sourceChannels !== undefined) conversationUpdate.sourceChannels = dto.sourceChannels;
      if (dto.isInstallment !== undefined) conversationUpdate.isInstallment = dto.isInstallment;
      const recordedAt = recordPurchaseBy ? new Date() : null;
      if (recordPurchaseBy) {
        conversationUpdate.purchaseRecordedAt = recordedAt;
        conversationUpdate.purchaseRecordedBy = { connect: { id: recordPurchaseBy.id } };
      }
      if (Object.keys(conversationUpdate).length > 0) await tx.conversation.update({ where: { id: conversationId }, data: conversationUpdate });

      if (dto.productId !== undefined) {
        await tx.conversationProduct.deleteMany({ where: { conversationId, source: "MANUAL" } });
        if (productModel) {
          await tx.conversationProduct.create({ data: { conversationId, productModelId: productModel.id, productVariantId: productVariant?.id ?? null, source: "MANUAL", confidence: 1 } });
        }
      } else if (dto.variantId !== undefined) {
        const manual = await tx.conversationProduct.findFirst({ where: { conversationId, source: "MANUAL" }, select: { conversationId: true, productModelId: true } });
        if (!manual) throw new BadRequestException("A product must be selected before choosing a variant");
        await tx.conversationProduct.update({ where: { conversationId_productModelId: { conversationId, productModelId: manual.productModelId } }, data: { productVariantId: productVariant?.id ?? null } });
      }

      if (recordPurchaseBy) {
        const updated = await tx.conversation.findUnique({
          where: { id: conversationId },
          select: {
            sourceChannels: true,
            isInstallment: true,
            products: { where: { source: "MANUAL" }, select: { productModelId: true, productVariantId: true } },
          },
        });
        const nextPurchase = purchaseSnapshot({
          sourceChannels: updated?.sourceChannels ?? conversation.sourceChannels ?? [],
          isInstallment: updated?.isInstallment ?? conversation.isInstallment ?? false,
          products: updated?.products ?? conversation.products ?? [],
        });
        await tx.activityHistory.create({
          data: {
            conversationId,
            actionType: "PURCHASE_INFORMATION_UPDATED",
            description: "Purchase information updated",
            createdByUserId: recordPurchaseBy.id,
            createdByName: recordPurchaseBy.displayName?.trim() || recordPurchaseBy.email,
            metadata: { category: "PURCHASE_INFORMATION", oldValue: previousPurchase, newValue: nextPurchase },
          },
        });
      }
    });
    return this.get(user, conversationId);
  }

  async updateCustomerSalesInfo(user: AuthUser, conversationId: string, dto: UpdateCustomerSalesInformationDto) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          customerSalesStatus: true,
          salesRecordedAt: true,
          interestLevel: true,
          paymentMethod: true,
          sourceChannels: true,
          isInstallment: true,
          products: { where: { source: "MANUAL" }, select: { productModelId: true, productVariantId: true } },
          salesProducts: {
            select: {
              id: true,
              productModelId: true,
              productVariantId: true,
              quantity: true,
              status: true,
            },
          },
        },
      });
      if (!conversation) throw new NotFoundException("Conversation not found");

      const previousPurchase = purchaseSnapshot({
        sourceChannels: conversation.sourceChannels ?? [],
        isInstallment: conversation.isInstallment ?? false,
        products: conversation.products ?? [],
      });

      const conversationUpdate: Prisma.ConversationUpdateInput = {};
      const recordedAt = new Date();

      if (dto.status !== undefined) {
        conversationUpdate.customerSalesStatus = dto.status;
      }
      if (dto.interestLevel !== undefined) {
        conversationUpdate.interestLevel = dto.status === "PURCHASED" ? null : dto.interestLevel;
      }
      if (dto.purchaseChannel !== undefined) {
        conversationUpdate.sourceChannels = dto.purchaseChannel;
      }
      if (dto.paymentMethod !== undefined) {
        conversationUpdate.paymentMethod = dto.paymentMethod;
        conversationUpdate.isInstallment = dto.paymentMethod === "INSTALLMENT";
      }

      conversationUpdate.salesRecordedAt = recordedAt;
      conversationUpdate.salesRecordedBy = { connect: { id: user.id } };
      conversationUpdate.purchaseRecordedAt = recordedAt;
      conversationUpdate.purchaseRecordedBy = { connect: { id: user.id } };

      await tx.conversation.update({
        where: { id: conversationId },
        data: conversationUpdate,
      });

      if (dto.products !== undefined) {
        const validatedProducts: Array<{
          productModelId: string;
          productVariantId: string | null;
          customProductName: string | null;
          ram: string | null;
          rom: string | null;
          color: string | null;
          quantity: number;
          status: CustomerSalesStatus;
        }> = [];

        for (const p of dto.products) {
          const model = await tx.productModel.findFirst({
            where: { id: p.productModelId, isActive: true },
            select: { id: true, name: true },
          });
          if (!model) {
            throw new BadRequestException(`Product model ${p.productModelId} is invalid or inactive`);
          }

          let variantId: string | null = null;
          let ram: string | null = p.ram ?? null;
          let rom: string | null = p.rom ?? null;
          let color: string | null = p.color ?? null;

          if (p.productVariantId) {
            const variant = await tx.productVariant.findFirst({
              where: { id: p.productVariantId, productModelId: model.id, isActive: true },
              select: { id: true, ram: true, rom: true, color: true },
            });
            if (!variant) {
              throw new BadRequestException(`Product variant ${p.productVariantId} does not belong to model ${model.name}`);
            }
            variantId = variant.id;
            ram = ram ?? variant.ram;
            rom = rom ?? variant.rom;
            color = color ?? variant.color;
          }

          const itemStatus = p.status ?? (dto.status || CustomerSalesStatus.INTERESTED);

          validatedProducts.push({
            productModelId: model.id,
            productVariantId: variantId,
            customProductName: p.customProductName ?? null,
            ram,
            rom,
            color,
            quantity: p.quantity ?? 1,
            status: itemStatus,
          });
        }

        if (tx.conversationSalesProduct?.deleteMany) {
          await tx.conversationSalesProduct.deleteMany({ where: { conversationId } });
        }

        if (validatedProducts.length > 0) {
          if (tx.conversationSalesProduct?.createMany) {
            await tx.conversationSalesProduct.createMany({
              data: validatedProducts.map((vp) => ({
                conversationId,
                productModelId: vp.productModelId,
                productVariantId: vp.productVariantId,
                customProductName: vp.customProductName,
                ram: vp.ram,
                rom: vp.rom,
                color: vp.color,
                quantity: vp.quantity,
                status: vp.status,
              })),
            });
          }

          if (tx.conversationProduct?.deleteMany) {
            await tx.conversationProduct.deleteMany({ where: { conversationId, source: "MANUAL" } });
          }
          const first = validatedProducts[0];
          if (tx.conversationProduct?.create) {
            await tx.conversationProduct.create({
              data: {
                conversationId,
                productModelId: first.productModelId,
                productVariantId: first.productVariantId,
                source: "MANUAL",
                confidence: 1,
              },
            });
          }
        } else {
          if (tx.conversationProduct?.deleteMany) {
            await tx.conversationProduct.deleteMany({ where: { conversationId, source: "MANUAL" } });
          }
        }
      }

      const nextPurchase = purchaseSnapshot({
        sourceChannels: dto.purchaseChannel ?? conversation.sourceChannels ?? [],
        isInstallment: dto.paymentMethod === "INSTALLMENT" || (conversation.isInstallment ?? false),
        products: dto.products ? dto.products.map((p) => ({ productModelId: p.productModelId, productVariantId: p.productVariantId ?? null })) : (conversation.products ?? []),
      });

      const isConversion = conversation.customerSalesStatus === CustomerSalesStatus.INTERESTED && dto.status === CustomerSalesStatus.PURCHASED;
      const conversionTimeMs = isConversion && conversation.salesRecordedAt
        ? (new Date().getTime() - new Date(conversation.salesRecordedAt).getTime())
        : null;

      await tx.activityHistory.create({
        data: {
          conversationId,
          actionType: dto.status === "PURCHASED" ? "PURCHASE_INFORMATION_UPDATED" : "CUSTOMER_SALES_INFO_UPDATED",
          description: isConversion
            ? "Converted from Interested lead to Purchased customer"
            : dto.status === "PURCHASED"
              ? "Purchase information updated"
              : "Customer sales information updated",
          createdByUserId: user.id,
          createdByName: user.displayName?.trim() || user.email,
          metadata: {
            category: dto.status === "PURCHASED" ? "PURCHASE_INFORMATION" : "CUSTOMER_SALES_INFO",
            oldValue: previousPurchase,
            newValue: nextPurchase,
            status: dto.status,
            previousStatus: conversation.customerSalesStatus,
            interestLevel: dto.interestLevel,
            productCount: dto.products?.length,
            isConversion,
            conversionTimeMs,
            interestRecordedAt: isConversion ? conversation.salesRecordedAt : null,
          },
        },
      });
    });

    return this.get(user, conversationId);
  }

  async updatePurchaseInformation(user: AuthUser, conversationId: string, dto: UpdateMobilePurchaseInformationDto) {
    const products: SalesProductItemDto[] | undefined = dto.productModelId !== undefined
      ? (dto.productModelId
          ? [{ productModelId: dto.productModelId, productVariantId: dto.productVariantId, quantity: 1, status: CustomerSalesStatus.PURCHASED }]
          : [])
      : undefined;

    return this.updateCustomerSalesInfo(user, conversationId, {
      status: CustomerSalesStatus.PURCHASED,
      purchaseChannel: dto.purchaseChannel,
      paymentMethod: dto.paymentMethod === "INSTALLMENT" ? PaymentMethodType.INSTALLMENT : null,
      products,
    });
  }

  async send(user: AuthUser, conversationId: string, dto: SendConversationMessageDto) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    return this.conversations.sendMessage(conversationId, dto, user);
  }

  async sendImage(user: AuthUser, conversationId: string, file: { buffer: Buffer; mimetype: string; size: number }, idempotencyKey: string) {
    await this.storeAccess.assertConversationAccess(user, conversationId);
    return this.conversations.sendImage(conversationId, file, idempotencyKey, user);
  }
}

function encodeCursor(sentAt: Date, id: string) { return Buffer.from(JSON.stringify({ sentAt: sentAt.toISOString(), id }), "utf8").toString("base64url"); }
function decodeCursor(value: string): { sentAt: Date; id: string } | null { try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { sentAt?: string; id?: string }; if (!parsed.sentAt || !parsed.id) return null; const sentAt = new Date(parsed.sentAt); return Number.isNaN(sentAt.getTime()) ? null : { sentAt, id: parsed.id }; } catch { return null; } }
