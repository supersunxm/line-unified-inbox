import { Injectable } from "@nestjs/common";
import type { QuickReplyLocale, QuickReplyProvider, QuickReplyProviderCandidate, QuickReplyProviderInput, QuickReplyProviderResult } from "./quick-reply.types";

const greetingPattern = /^(สวัสดี|หวัดดี|hello|hi|hey|你好|您好)/iu;
const afterSalesPattern = /(เคลม|ซ่อม|ประกัน|ศูนย์บริการ|warranty|repair|service|维修|保修)/iu;

@Injectable()
export class DeterministicQuickReplyProvider implements QuickReplyProvider {
  generate(input: QuickReplyProviderInput): Promise<QuickReplyProviderResult> {
    const startedAt = Date.now();
    const { context } = input;
    const latest = context.recentMessages.find((message) => message.id === context.contextMessageId);
    const text = latest?.text ?? "";
    const product = context.signals.productModels[0];
    const candidates: QuickReplyProviderCandidate[] = [];

    if (greetingPattern.test(text)) candidates.push(this.greeting(context.locale, product));
    if (product && !afterSalesPattern.test(text)) candidates.push(this.productFollowUp(context.locale, product));
    if (afterSalesPattern.test(text) || !candidates.length) candidates.push(this.handoff(context.locale));

    return Promise.resolve({ providerName: "deterministic", providerVersion: "v1", candidates: candidates.slice(0, input.maxSuggestions), latencyMs: Date.now() - startedAt });
  }

  private greeting(locale: QuickReplyLocale, product?: string): QuickReplyProviderCandidate {
    const text = locale === "en" ? `Hello, thank you for contacting OPPO.${product ? ` I can help with ${product}.` : " How can we help you today?"}` : locale === "zh" ? `您好，感谢联系 OPPO。${product ? `我可以协助您了解 ${product}。` : "请问有什么可以帮您？"}` : `สวัสดีค่ะ ขอบคุณที่ติดต่อ OPPO${product ? ` ยินดีให้ข้อมูลเกี่ยวกับ ${product} ค่ะ` : "ค่ะ"}`;
    return { text, intent: "GREETING", source: "RULE", confidence: 0.92, grounded: true, riskFlags: [] };
  }

  private productFollowUp(locale: QuickReplyLocale, product: string): QuickReplyProviderCandidate {
    const text = locale === "en" ? `I can help explain the ${product} features. Which information would you like to know?` : locale === "zh" ? `我可以为您介绍 ${product} 的功能，请问您想了解哪方面的信息？` : `ยินดีให้ข้อมูลเกี่ยวกับ ${product} ค่ะ ไม่ทราบว่าต้องการสอบถามข้อมูลด้านใดเพิ่มเติมคะ`;
    return { text, intent: "PRODUCT_INFORMATION", source: "CATALOG", confidence: 0.84, grounded: true, riskFlags: [] };
  }

  private handoff(locale: QuickReplyLocale): QuickReplyProviderCandidate {
    const text = locale === "en" ? "Thank you for the details. Let me confirm the information with the store team and get back to you." : locale === "zh" ? "感谢您提供信息。我先与门店团队确认后再回复您。" : "ขอบคุณสำหรับข้อมูลนะคะ ขออนุญาตตรวจสอบกับทีมหน้าร้านเพิ่มเติมแล้วจะแจ้งให้ทราบค่ะ";
    return { text, intent: "HUMAN_HANDOFF", source: "FALLBACK", confidence: 0.65, grounded: true, riskFlags: ["HANDOFF_REQUIRED"] };
  }
}
