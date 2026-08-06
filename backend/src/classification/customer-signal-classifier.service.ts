import { Injectable, Logger } from "@nestjs/common";
import { CustomerEvent, CustomerSignalSource, CustomerSignalType } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { automaticCatalogAliasesForModel, storedProductAliasSafety } from "./product-catalog";
import { matchProduct } from "./product-matcher";

const purchaseIntentKeywords = ["สนใจ", "ผ่อน", "สด", "จอง", "ซื้อ", "มัดจำ", "จัดส่ง", "สั่งซื้อ"];
const priceInquiryKeywords = ["ราคา", "กี่บาท", "เช็คราคา", "ราคาทั้งหมด", "เท่าไหร่"];
const promotionKeywords = ["โปร", "แถม", "ส่วนลด", "ลดราคา", "ส่งฟรี", "แถมเคส", "แถมฟิล์ม", "โปรโมชั่น"];
const storeVisitKeywords = ["หน้าร้าน", "ไปสาขา", "ลองเครื่อง", "หน้าร้านสาขา", "รับเครื่องที่ร้าน"];

export type ExtractedSignal = {
  signalType: CustomerSignalType;
  productModelId?: string | null;
  detectedText: string;
  confidence: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CustomerSignalClassifierService {
  private readonly logger = new Logger(CustomerSignalClassifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  async classifyEvent(event: CustomerEvent) {
    if (event.type !== "NAME_CHANGED" || !event.newValue) {
      return [];
    }

    const rawText = event.newValue.trim();
    if (!rawText) return [];

    try {
      const storedModels = await this.prisma.productModel.findMany({
        where: { isActive: true },
        include: {
          aliases: { where: { isActive: true } },
          productSeries: true,
        },
      });

      const models = storedModels.map((model) => ({
        ...model,
        aliases: [
          ...model.aliases.map((alias) => ({
            ...alias,
            safety: storedProductAliasSafety(model.name, alias.alias, alias.source),
          })),
          ...automaticCatalogAliasesForModel(model.name).map(({ alias, safety }) => ({
            alias,
            safety,
            priority: 0,
          })),
        ],
      }));

      const productMatch = matchProduct(
        [{ id: event.id, text: rawText, sentAt: event.createdAt }],
        models,
      );

      const signalsToCreate: ExtractedSignal[] = [];

      // 1. Product Interest Signal
      if (productMatch) {
        signalsToCreate.push({
          signalType: CustomerSignalType.PRODUCT_INTEREST,
          productModelId: productMatch.model.id,
          detectedText: productMatch.matchedPhrase || productMatch.model.name,
          confidence: Math.max(0.85, productMatch.confidence),
          metadata: {
            productModelName: productMatch.model.name,
            productSeriesName: productMatch.model.productSeries?.name ?? null,
            detectionMethod: productMatch.detectionMethod,
          },
        });
      }

      // 2. Price Inquiry Signal
      const matchedPriceKeyword = priceInquiryKeywords.find((kw) => rawText.includes(kw));
      if (matchedPriceKeyword) {
        signalsToCreate.push({
          signalType: CustomerSignalType.PRICE_INQUIRY,
          productModelId: productMatch?.model.id ?? null,
          detectedText: matchedPriceKeyword,
          confidence: 0.8,
        });
      }

      // 3. Purchase Intent Signal
      const matchedPurchaseKeyword = purchaseIntentKeywords.find((kw) => rawText.includes(kw));
      if (matchedPurchaseKeyword) {
        signalsToCreate.push({
          signalType: CustomerSignalType.PURCHASE_INTENT,
          productModelId: productMatch?.model.id ?? null,
          detectedText: matchedPurchaseKeyword,
          confidence: 0.85,
        });
      }

      // 4. Promotion Interest Signal
      const matchedPromoKeyword = promotionKeywords.find((kw) => rawText.includes(kw));
      if (matchedPromoKeyword) {
        signalsToCreate.push({
          signalType: CustomerSignalType.PROMOTION_INTEREST,
          productModelId: productMatch?.model.id ?? null,
          detectedText: matchedPromoKeyword,
          confidence: 0.75,
        });
      }

      // 5. Store Visit Intent Signal
      const matchedStoreVisitKeyword = storeVisitKeywords.find((kw) => rawText.includes(kw));
      if (matchedStoreVisitKeyword) {
        signalsToCreate.push({
          signalType: CustomerSignalType.STORE_VISIT_INTENT,
          productModelId: productMatch?.model.id ?? null,
          detectedText: matchedStoreVisitKeyword,
          confidence: 0.8,
        });
      }

      // 6. Unknown / Noise fallback
      if (signalsToCreate.length === 0) {
        signalsToCreate.push({
          signalType: CustomerSignalType.UNKNOWN,
          productModelId: null,
          detectedText: rawText,
          confidence: 0.3,
        });
      }

      // Delete old signals for this event if re-classifying
      await this.prisma.customerSignal.deleteMany({
        where: { customerEventId: event.id },
      });

      // Bulk insert new signals
      await this.prisma.customerSignal.createMany({
        data: signalsToCreate.map((signal) => ({
          customerId: event.customerId,
          customerEventId: event.id,
          signalType: signal.signalType,
          source: CustomerSignalSource.NAME_CHANGE,
          productModelId: signal.productModelId ?? null,
          detectedText: signal.detectedText,
          confidence: signal.confidence,
          metadata: (signal.metadata ?? {
            previousValue: event.previousValue,
            newValue: event.newValue,
          }) as any,
          createdAt: event.createdAt,
        })),
      });

      const persistedSignals = await this.prisma.customerSignal.findMany({
        where: { customerEventId: event.id },
      });

      this.logger.log(
        `Classified ${persistedSignals.length} CustomerSignal(s) for event ${event.id}`,
      );

      return persistedSignals;
    } catch (error) {
      this.logger.error(`Failed to classify signals for CustomerEvent ${event.id}`, error as Error);
      return [];
    }
  }
}
