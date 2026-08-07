import { Injectable } from "@nestjs/common";
import { BIQueryIntent, BIQueryAnalysisResult } from "./bi-assistant.types";

@Injectable()
export class QueryAnalyzerService {
  analyzeQuery(question: string): BIQueryAnalysisResult {
    const q = (question || "").toLowerCase().trim();

    // Intent 1: SLA Analysis
    if (
      q.includes("sla") ||
      q.includes("ทำไม sla") ||
      q.includes("sla ตก") ||
      q.includes("response rate") ||
      q.includes("why sla dropped") ||
      q.includes("sla 下降")
    ) {
      return {
        intent: BIQueryIntent.SLA_ANALYSIS,
        confidence: 0.95,
        entities: { timeRange: "today" },
      };
    }

    // Intent 2: Root Cause
    if (
      q.includes("cause") ||
      q.includes("สาเหตุ") ||
      q.includes("ทำไมช้า") ||
      q.includes("ทำไมเกิดขึ้น") ||
      q.includes("root cause") ||
      q.includes("เหตุผล") ||
      q.includes("根因") ||
      q.includes("原因")
    ) {
      return {
        intent: BIQueryIntent.ROOT_CAUSE,
        confidence: 0.94,
        entities: { timeRange: "today" },
      };
    }

    // Intent 3: Store Risk
    if (
      q.includes("store") ||
      q.includes("สาขา") ||
      q.includes("ร้านไหน") ||
      q.includes("เสี่ยง") ||
      q.includes("risk") ||
      q.includes("attention") ||
      q.includes("门店") ||
      q.includes("哪个门店")
    ) {
      return {
        intent: BIQueryIntent.STORE_RISK,
        confidence: 0.94,
        entities: { timeRange: "today" },
      };
    }

    // Intent 4: BM Performance
    if (
      q.includes("bm") ||
      q.includes("branch manager") ||
      q.includes("ตอบช้า") ||
      q.includes("slowest") ||
      q.includes("ผู้จัดการสาขา") ||
      q.includes("经理")
    ) {
      return {
        intent: BIQueryIntent.BM_PERFORMANCE,
        confidence: 0.93,
        entities: { timeRange: "today" },
      };
    }

    // Intent 5: Customer Demand
    if (
      q.includes("demand") ||
      q.includes("product") ||
      q.includes("สินค้า") ||
      q.includes("ลูกค้าถาม") ||
      q.includes("topic") ||
      q.includes("inquiry") ||
      q.includes("complaint") ||
      q.includes("ความต้องการ") ||
      q.includes("产品") ||
      q.includes("需求")
    ) {
      return {
        intent: BIQueryIntent.CUSTOMER_DEMAND,
        confidence: 0.92,
        entities: { timeRange: "today" },
      };
    }

    // Intent 6: Operation Recommendation (Default)
    return {
      intent: BIQueryIntent.OPERATION_RECOMMENDATION,
      confidence: 0.90,
      entities: { timeRange: "today" },
    };
  }
}
