import { Injectable } from "@nestjs/common";
import type { QuickReplyContext, QuickReplyLocale, QuickReplyProviderCandidate, QuickReplySafetyResult } from "./quick-reply.types";

const highRiskPattern = /(รับประกัน|รับรอง|ราคา|สต็อก|ผ่อน|คืนเงิน|refund|guarantee|warranty|stock|price|payment|法律|退款)/iu;
const promptInjectionPattern = /(ignore\s+(all\s+)?previous|system\s+prompt|developer\s+message|reveal\s+(the\s+)?(token|secret|prompt)|bearer\s+[a-z0-9._-]+)/iu;
const sensitiveOutputPattern = /(https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{8,}\b)/iu;

@Injectable()
export class QuickReplySafetyService {
  validate(context: QuickReplyContext, candidates: QuickReplyProviderCandidate[], maxSuggestions: number): QuickReplySafetyResult {
    const accepted: QuickReplyProviderCandidate[] = [];
    const rejected: QuickReplySafetyResult["rejected"] = [];
    candidates.forEach((candidate, index) => {
      const text = candidate.text.trim();
      if (!text) { rejected.push({ index, reason: "EMPTY_TEXT", riskFlags: [] }); return; }
      if (text.length > 600 || candidate.confidence < 0 || candidate.confidence > 1) { rejected.push({ index, reason: "INVALID_OUTPUT", riskFlags: [] }); return; }
      const hasControlCharacters = [...text].some((character) => {
        const code = character.charCodeAt(0);
        return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31);
      });
      if (text.split(/\r?\n/u).length > 6 || hasControlCharacters) { rejected.push({ index, reason: "INVALID_OUTPUT", riskFlags: [] }); return; }
      if (promptInjectionPattern.test(text)) { rejected.push({ index, reason: "PROMPT_INJECTION", riskFlags: ["PII"] }); return; }
      if (sensitiveOutputPattern.test(text)) { rejected.push({ index, reason: "HIGH_RISK_CONTENT", riskFlags: ["PII"] }); return; }
      if (!candidate.grounded && candidate.source !== "FALLBACK") { rejected.push({ index, reason: "UNGROUNDED_FACT", riskFlags: ["UNVERIFIED_FACT"] }); return; }
      if (highRiskPattern.test(text) && candidate.source !== "FALLBACK") { rejected.push({ index, reason: "HIGH_RISK_CONTENT", riskFlags: ["HANDOFF_REQUIRED"] }); return; }
      if (candidate.source === "CATALOG" && (context.signals.productModels.length === 0 || !context.signals.productModels.some((product) => text.includes(product)))) { rejected.push({ index, reason: "UNSUPPORTED_INTENT", riskFlags: ["UNVERIFIED_FACT"] }); return; }
      accepted.push({ ...candidate, text });
    });
    if (accepted.length > 0) return { accepted: accepted.slice(0, maxSuggestions), rejected, fallbackRequired: rejected.length > 0 && accepted.every((candidate) => candidate.source === "FALLBACK") };
    return { accepted: [this.safeFallback(context.locale)], rejected, fallbackRequired: true };
  }

  private safeFallback(locale: QuickReplyLocale): QuickReplyProviderCandidate {
    const text = locale === "en" ? "Thank you for contacting OPPO. Let me confirm the details with the store team and get back to you." : locale === "zh" ? "感谢您联系 OPPO。我先与门店团队确认详情后再回复您。" : "ขอบคุณที่ติดต่อ OPPO นะคะ ขออนุญาตตรวจสอบรายละเอียดกับทีมหน้าร้านแล้วจะแจ้งให้ทราบค่ะ";
    return { text, intent: "HUMAN_HANDOFF", source: "FALLBACK", confidence: 0.5, grounded: true, riskFlags: ["HANDOFF_REQUIRED"] };
  }
}
