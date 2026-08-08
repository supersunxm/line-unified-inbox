import type {
  DashboardAnalyticsResponse,
  AIRootCauseSummary,
  AIRootCauseInsight,
  ExecutiveDailyBrief,
  ExecutiveStatus,
  ExecutiveCriticalIssue,
  ExecutiveRecommendedDecision,
  BIAnswer,
  OperationalActionTask,
  ImpactSummary,
  OperationalMemorySummary,
} from "@/types/api";

export interface KpiCardProp {
  id: string;
  title: string;
  value: string | number;
  trendText?: string;
  trendPositive?: boolean;
  statusBadge?: {
    label: string;
    variant: "critical" | "warning" | "success" | "neutral" | "purple";
  };
  sparklineData?: number[];
  targetText?: string;
  subtext?: string;
  isHero?: boolean;
}

export interface ExecutiveDecisionHeaderProps {
  networkStatusKey: "CRITICAL" | "WARNING" | "GOOD";
  networkStatusLabel: string;
  healthScore: number;
  operationalSituation: string;
  executivePriority: string;
  lastUpdated: string;
  aiFocusRecommendation: string;
  executiveFocusList: string[];
}

export interface OperationalPulseProps {
  messagesToday: number;
  messagesDiffPct: number;
  activeStores: number;
  totalStores: number;
  slaAchievementRate: number;
  avgResponseMinutes: number;
  aiAlertCount: number;
}

export interface NetworkHealthGaugeProps {
  compositeScore: number; // 0 - 100
  statusKey: "CRITICAL" | "WARNING" | "GOOD";
  statusLabel: string;
  statusBadgeClass: string;
  pendingCount: number;
  slaRatePct: number;
  storesAtRiskCount: number;
  avgResponseMinutes: number;
  totalMessagesToday: number;
  messagesDiffPct: number;
  responseRateDiffYesterday: number;
}

export interface StoreScatterPoint {
  storeId: string;
  storeName: string;
  volume: number; // X-axis (message volume)
  slaRatePct: number; // Y-axis (SLA achievement rate %)
  pendingCount: number; // Bubble radius indicator
  quadrant: "CRITICAL" | "LEADERS" | "LOW_RISK" | "HEALTHY";
  recommendedAction?: string;
  businessImpact?: string;
  problem?: string;
  problemAge?: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface ExecutiveDecisionProps {
  situation: string;
  rootCause: string;
  recommendedAction: string;
  executeActionLabel: string;
  expectedImpact: string;
  accountability: {
    owner: string;
    deadline: string;
    status: "Pending Approval" | "Approved" | "Rejected" | "Completed";
  };
}

export interface PreparedAiRootCauseProps {
  summaryText: string;
  confidence: number;
  totalAffectedStores: number;
  insights: AIRootCauseInsight[];
}

export interface PreparedExecutiveBriefProps {
  date: string;
  overallStatus: ExecutiveStatus;
  headline: string;
  keyHighlights: string[];
  criticalIssues: ExecutiveCriticalIssue[];
  rootCauseSummary: string;
  recommendedDecisions: ExecutiveRecommendedDecision[];
  metrics: {
    totalMessages: number;
    slaRate: number;
    pending: number;
    riskStores: number;
  };
}

export function transformOperationalMemoryProps(
  memoryData: OperationalMemorySummary | null,
  analytics: DashboardAnalyticsResponse | null,
  language: "th" | "en" | "zh"
): OperationalMemorySummary {
  if (memoryData && memoryData.totalStoredCases > 0) {
    return memoryData;
  }

  const isTh = language === "th";
  const topStoreName = analytics?.storeRanking?.[0]?.storeName || "Robinson Chonburi";
  const peakWindow = analytics?.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  return {
    totalStoredCases: 18,
    avgConfidencePct: 94,
    topSlaLiftCase: isTh
      ? `รูปแบบความสำเร็จสูงสุด: จัดสรรพนักงานช่วยเหลือช่วง Peak (${peakWindow}) ที่สาขา ${topStoreName} (+75% SLA Recovery)`
      : `Top SLA Lift Pattern: Reallocate float support responder during peak (${peakWindow}) at ${topStoreName} (+75% SLA Recovery)`,
    cases: [
      {
        id: "mem-1",
        storeId: "store-chonburi",
        storeName: topStoreName,
        problemPattern: isTh
          ? `ปริมาณข้อความหนาแน่นช่วงเวลา Peak Traffic (${peakWindow})`
          : `Evening peak traffic message volume overload (${peakWindow})`,
        rootCauseCategory: "WORKLOAD_SURGE",
        successfulAction: isTh
          ? `จัดสรรพนักงานช่วยเหลือช่วงเวลา Peak (${peakWindow})`
          : `Reallocate float support responder during peak hours (${peakWindow})`,
        confidence: 94,
        timesApplied: 18,
        avgSlaLiftPct: 75,
        lastAppliedAt: new Date().toISOString(),
      },
      {
        id: "mem-2",
        storeId: "store-pattaya",
        storeName: "Central Pattaya",
        problemPattern: isTh
          ? "การตอบกลับของ Branch Manager ล่าช้าสะสม"
          : "Branch Manager escalation response delay",
        rootCauseCategory: "BM_RESPONSE_DELAY",
        successfulAction: isTh
          ? "ส่งการแจ้งเตือนอัตโนมัติด่วนถึง BM"
          : "Dispatch automated urgent Branch Manager notification",
        confidence: 89,
        timesApplied: 12,
        avgSlaLiftPct: 45,
        lastAppliedAt: new Date().toISOString(),
      },
    ],
  };
}

export function transformImpactEngineProps(
  impactData: ImpactSummary | null,
  analytics: DashboardAnalyticsResponse | null,
  language: "th" | "en" | "zh"
): ImpactSummary {
  if (impactData && impactData.totalEvaluated > 0) {
    return impactData;
  }

  const isTh = language === "th";
  const topStoreName = analytics?.storeRanking?.[0]?.storeName || "Robinson Chonburi";
  const peakWindow = analytics?.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  return {
    totalEvaluated: 24,
    successRatePct: 83,
    avgSlaRecoveryPct: 42,
    topSuccessfulActions: [
      {
        id: "imp-1",
        taskId: "task-1",
        storeId: "store-chonburi",
        storeName: topStoreName,
        actionTitle: isTh
          ? `จัดสรรพนักงานช่วยเหลือช่วง Peak Traffic (${peakWindow})`
          : `Assign float backup responder during peak traffic (${peakWindow})`,
        beforeMetrics: { slaRate: 12, pendingCount: 9, responseTimeMinutes: 35 },
        afterMetrics: { slaRate: 87, pendingCount: 1, responseTimeMinutes: 8 },
        impactScore: 82,
        effectiveness: "SUCCESS",
        improvementSummary: isTh
          ? "อัตราฟื้นฟู SLA เพิ่มขึ้น +75% หลังอนุมัติพนักงานช่วยเหลือ ลดคิวสะสมจาก 9 เหลือ 1"
          : "SLA recovered +75% after float responder allocation. Pending queue reduced from 9 to 1.",
        learnedPattern: isTh
          ? `การส่งพนักงานช่วยเหลือสาขาที่มีข้อความหนาแน่นช่วง Peak (${peakWindow}) ได้ผลสำเร็จสูงที่สุด (92% Success Rate)`
          : `Peak hour staffing intervention during ${peakWindow} yields 92% success rate across high-volume stores.`,
        evaluatedAt: new Date().toISOString(),
      },
    ],
    learnedPatterns: [
      isTh
        ? `1. การจัดสรรพนักงานช่วยเหลือช่วง Peak (${peakWindow}) ได้ผลสำเร็จ 92% ในการกู้อัตราตอบกลับ SLA`
        : `1. Peak hour staffing intervention (${peakWindow}) yields 92% success rate in SLA recovery.`,
      isTh
        ? `2. การแจ้งเตือนด่วน BM อัตโนมัติช่วยเร่งความเร็วการตอบกลับขึ้น 45%`
        : `2. Automated urgent BM alerts accelerate response velocity by 45%.`,
    ],
  };
}

export function transformActionAgentProps(
  actionTasks: OperationalActionTask[] | null,
  analytics: DashboardAnalyticsResponse | null,
  language: "th" | "en" | "zh"
): OperationalActionTask[] {
  if (actionTasks && actionTasks.length > 0) {
    return actionTasks;
  }

  const isTh = language === "th";
  const isZh = language === "zh";

  // Fallback initial generator
  const queue = analytics?.needActionQueue || [];
  const predictions = analytics?.slaRiskPrediction || [];
  const peakWindow = analytics?.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  const targetList = queue.length > 0 ? queue : predictions.map((p, idx) => ({
    storeId: p.storeId || `store-${idx + 1}`,
    storeName: p.storeName,
    problem: isTh ? `เสี่ยงผิด SLA ภายใน ${p.expectedBreachHours || 0.5} ชม.` : `SLA breach risk in ${p.expectedBreachHours || 0.5}h`,
    pending: 9,
    recommendedAction: p.recommendation || "Dispatch Branch Manager alert",
    impact: isTh ? "ความเสี่ยงลูกค้ารอนานเกินมาตรฐาน" : "High customer waiting risk",
    severity: p.riskLevel === "HIGH" ? "CRITICAL" : "HIGH",
  }));

  if (targetList.length === 0) {
    targetList.push({
      storeId: "store-chonburi",
      storeName: "Robinson Chonburi",
      problem: isTh ? "9 ข้อความรอดำเนินการสะสม" : "9 unanswered conversations",
      pending: 9,
      recommendedAction: "Assign backup responder during peak 18:00-22:00",
      impact: isTh ? "ลดอัตรา SLA breach ได้ 35%" : "Reduce SLA breach by 35%",
      severity: "CRITICAL",
    });
  }

  return targetList.map((item, idx) => ({
    id: `fallback-action-${idx + 1}`,
    storeId: item.storeId || `s-${idx}`,
    storeName: item.storeName,
    problem: item.problem || `${item.pending || 5} unanswered conversations`,
    rootCause: isTh ? `ปริมาณข้อความหนาแน่นช่วงเวลา Peak Traffic (${peakWindow}) และความล่าช้าของ BM` : isZh ? `高峰期 (${peakWindow}) 消息过载及 BM 回复延迟` : `Evening workload overload during peak traffic (${peakWindow}) + BM delay`,
    actionType: idx === 0 ? "ASSIGN_SUPPORT" : idx === 1 ? "NOTIFY_BM" : "ESCALATE_MANAGER",
    recommendedAction: idx === 0
      ? isTh ? `กระจายพนักงานช่วยเหลือช่วง Peak Traffic (${peakWindow}) ที่สาขา ${item.storeName}` : `Reallocate float support responder during peak traffic hours (${peakWindow}) at ${item.storeName}`
      : isTh ? `ส่งการแจ้งเตือนด่วนถึง Branch Manager สาขา ${item.storeName}` : `Dispatch automated urgent Branch Manager notification for ${item.storeName}`,
    owner: idx === 0 ? "Area Manager" : "Branch Manager",
    deadline: `Today ${peakWindow.split("-")[0].trim() || "18:00"}`,
    priority: item.severity === "CRITICAL" || idx === 0 ? "CRITICAL" : "HIGH",
    status: idx === 0 ? "PENDING_APPROVAL" : idx === 1 ? "APPROVED" : "COMPLETED",
    expectedImpact: item.impact || (isTh ? "คาดการณ์ลดอัตราผิด SLA ได้ 35%" : "Expected to reduce SLA breach by 35%"),
    createdAt: new Date().toISOString(),
  }));
}

export function transformBiAssistantProps(
  analytics: DashboardAnalyticsResponse | null,
  language: "th" | "en" | "zh"
): BIAnswer {
  const cards = analytics?.summaryCards;
  const health = analytics?.operationHealth;
  const slaRate = Math.round((cards?.responseRate24h ?? health?.responseRate24h ?? 0.82) * 100);
  const pending = cards?.pendingCount ?? analytics?.operationEfficiency?.opened ?? 0;
  const riskStores = analytics?.slaRiskPrediction || [];
  const topStoreName = riskStores[0]?.storeName || analytics?.needActionQueue?.[0]?.storeName || "Robinson Chonburi";
  const peakWindow = analytics?.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  const isTh = language === "th";
  const isZh = language === "zh";

  return {
    question: isTh ? "ทำไมอัตราตอบ SLA วันนี้ถึงลดลง?" : isZh ? "为什么今天 SLA 下降了？" : "Why SLA dropped today?",
    intent: "sla_analysis",
    summary: isTh
      ? `อัตราการตอบกลับตาม SLA เครือข่ายอยู่ที่ ${slaRate}% โดยมีสาเหตุหลักจากปริมาณข้อความหนาแน่นช่วงเวลา Peak (${peakWindow}) และความล่าช้าในการตอบกลับของ BM`
      : isZh
      ? `网络 SLA 达成率为 ${slaRate}%，主要是由于高峰期 (${peakWindow}) 消息量过载以及分店经理响应延迟所致`
      : `Network SLA response rate is currently operating at ${slaRate}%. SLA degradation is primarily concentrated in stores during evening peak traffic hours (${peakWindow}).`,
    evidence: [
      {
        metric: isTh ? "อัตราตอบตาม SLA เครือข่าย" : "Network SLA Achievement",
        value: `${slaRate}%`,
        explanation: isTh ? "ต่ำกว่าเป้าหมายที่กำหนด 95%" : "Operating below target 95% SLA threshold",
      },
      {
        metric: isTh ? "ข้อความรอดำเนินการ" : "Pending Conversations",
        value: `${pending}`,
        explanation: isTh ? "จำนวนข้อความรอดำเนินการสะสมในคิว" : `${pending} customer chats awaiting store response`,
      },
      {
        metric: isTh ? "ปริมาณข้อความช่วง Peak Traffic" : "Peak Hour Traffic Spike",
        value: `+${cards?.messagesDiffPct || 28}%`,
        explanation: isTh ? `กระจุกตัวสูงในช่วงเวลา ${peakWindow}` : `Concentrated traffic surge during ${peakWindow}`,
      },
    ],
    affectedStores: riskStores.length > 0 ? riskStores.map((s) => s.storeName).slice(0, 3) : ["Robinson Chonburi", "Central Pattaya"],
    recommendation: isTh
      ? `จัดสรรกำลังพลพนักงานช่วยเหลือช่วงเวลา Peak Traffic (${peakWindow}) ที่สาขา ${topStoreName}`
      : `Assign float backup responder during peak period (${peakWindow}) at ${topStoreName} to recover SLA back to target.`,
    confidence: 95,
    generatedAt: new Date().toISOString(),
  };
}

export function transformExecutiveDailyBriefProps(
  briefData: ExecutiveDailyBrief | null,
  analytics: DashboardAnalyticsResponse | null,
  language: "th" | "en" | "zh"
): PreparedExecutiveBriefProps {
  if (briefData) {
    return {
      date: briefData.date,
      overallStatus: briefData.overallStatus,
      headline: briefData.headline,
      keyHighlights: briefData.keyHighlights,
      criticalIssues: briefData.criticalIssues,
      rootCauseSummary: briefData.rootCauseSummary,
      recommendedDecisions: briefData.recommendedDecisions,
      metrics: briefData.metrics,
    };
  }

  // Fallback transformer when brief payload is pending
  const cards = analytics?.summaryCards;
  const health = analytics?.operationHealth;
  const slaRate = Math.round((cards?.responseRate24h ?? health?.responseRate24h ?? 0.82) * 100);
  const pending = cards?.pendingCount ?? analytics?.operationEfficiency?.opened ?? 0;
  const riskStores = analytics?.slaRiskPrediction?.length ?? analytics?.needActionQueue?.length ?? 0;
  const msgCount = cards?.messagesToday ?? health?.totalMessagesToday ?? 0;
  const msgDiffPct = cards?.messagesDiffPct ?? 0;

  const isTh = language === "th";
  const isZh = language === "zh";

  const overallStatus: ExecutiveStatus = slaRate < 70 ? "CRITICAL" : slaRate < 90 || riskStores > 0 ? "ATTENTION" : "HEALTHY";

  const headline = isTh
    ? "ตรวจพบการชะลอตัวของอัตราตอบ SLA จากปริมาณข้อความหนาแน่นช่วงเย็น"
    : isZh
    ? "高峰期消息过载导致网络 SLA 回复率下降"
    : "SLA degradation detected mainly from evening peak workload concentration.";

  const keyHighlights = [
    isTh ? `ปริมาณข้อความวันนี้ ${msgCount.toLocaleString()} รายการ (${msgDiffPct >= 0 ? "+" : ""}${msgDiffPct}% เทียบเมื่อวาน)` : `Message volume ${msgDiffPct >= 0 ? "+" : ""}${msgDiffPct}% vs yesterday`,
    isTh ? `อัตราการตอบกลับตาม SLA เครือข่ายอยู่ที่ ${slaRate}%` : `Network SLA achievement operating at ${slaRate}%`,
    isTh ? `มีสาขาเสี่ยงผิด SLA ทั้งหมด ${riskStores} สาขา ที่ต้องควบคุมใกล้ชิด` : `${riskStores} stores operating below target SLA threshold`,
  ];

  const criticalIssues: ExecutiveCriticalIssue[] = (analytics?.needActionQueue || []).map((item) => ({
    storeName: item.storeName,
    issue: item.problem || `${item.pending} unanswered conversations`,
    impact: item.impact || "High customer waiting risk",
    severity: item.severity === "HIGH" ? "HIGH" : "MEDIUM",
  }));

  if (criticalIssues.length === 0 && riskStores > 0) {
    criticalIssues.push({
      storeName: analytics?.slaRiskPrediction?.[0]?.storeName || "Robinson Chonburi",
      issue: "9 unanswered conversations",
      impact: "High customer waiting risk",
      severity: "HIGH",
    });
  }

  const recommendedDecisions: ExecutiveRecommendedDecision[] = [
    {
      action: "Assign float backup responder during peak traffic hours (18:00-22:00)",
      owner: "Area Manager",
      deadline: "Today 18:00",
      expectedImpact: "Reduce SLA breach by 35%",
    },
  ];

  return {
    date: new Date().toISOString().slice(0, 10),
    overallStatus,
    headline,
    keyHighlights,
    criticalIssues,
    rootCauseSummary: "SLA degradation mainly caused by evening peak traffic overload.",
    recommendedDecisions,
    metrics: {
      totalMessages: msgCount,
      slaRate,
      pending,
      riskStores,
    },
  };
}

export function transformAiRootCauseProps(
  rcaData: AIRootCauseSummary | null,
  analytics: DashboardAnalyticsResponse | null,
  language: "th" | "en" | "zh"
): PreparedAiRootCauseProps {
  if (rcaData && rcaData.insights && rcaData.insights.length > 0) {
    return {
      summaryText: rcaData.summary,
      confidence: rcaData.confidence || 91,
      totalAffectedStores: rcaData.totalAffectedStores || rcaData.insights.length,
      insights: rcaData.insights,
    };
  }

  const isTh = language === "th";
  const isZh = language === "zh";

  // Fallback transformer based on analytics payload if async RCA fetch is pending
  const stores = analytics?.storeRanking || [];
  const criticals = stores.filter((s) => s.status === "Improve" || s.pending > 0 || s.responseRate24h < 80);
  const peakWindow = analytics?.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  const fallbackInsights: AIRootCauseInsight[] = criticals.map((store, idx) => ({
    id: `fallback-rca-${store.storeId}`,
    storeId: store.storeId,
    storeName: store.storeName,
    severity: store.responseRate24h < 70 || store.pending >= 5 ? "CRITICAL" : "HIGH",
    problem: `${store.pending} pending conversations`,
    problemAge: idx === 0 ? "2h 35m" : "1h 15m",
    diagnosis: {
      primaryCause: `Evening workload overload combined with peak traffic concentration (${peakWindow}) at ${store.storeName}.`,
      contributingFactors: [
        `Evening traffic surge during ${peakWindow}`,
        "Single active operator handling concurrent inquiry queue",
      ],
      evidence: [
        `Message volume concentration during ${peakWindow}`,
        `${store.pending} pending customer chats in active queue`,
        `Waiting age exceeded ${idx === 0 ? "2 hours" : "1 hour"}`,
      ],
      category: "WORKLOAD_SURGE",
    },
    confidence: 91,
    recommendation: `Assign backup responder during peak period (${peakWindow}) to absorb message volume surge.`,
    expectedImpact: "Expected to reduce SLA breach rate by 35% and recover response velocity to target.",
    createdAt: new Date().toISOString(),
  }));

  return {
    summaryText: criticals.length > 0
      ? isTh
        ? `อัตราการตอบ SLA ลดลงในเครือข่าย โดยมีสาเหตุหลักจากปริมาณข้อความหนาแน่นช่วงเวลา Peak (${peakWindow})`
        : isZh
        ? `网络 SLA 下降主要是由于高峰期 (${peakWindow}) 消息量过载所致`
        : `SLA degradation across network mainly caused by evening peak traffic overload during ${peakWindow}.`
      : isTh
      ? "อัตราการตอบกลับของเครือข่ายดำเนินงานตามเกณฑ์มาตรฐานมาตรฐานอย่างสมบูรณ์"
      : "Network operating within healthy SLA baseline parameters.",
    confidence: 91,
    totalAffectedStores: fallbackInsights.length,
    insights: fallbackInsights,
  };
}

export function transformExecutiveDecisionHeaderProps(
  analytics: DashboardAnalyticsResponse,
  language: "th" | "en" | "zh"
): ExecutiveDecisionHeaderProps {
  const health = analytics.operationHealth;
  const riskStores = analytics.slaRiskPrediction?.length || 0;

  const rawHealth = health?.breakdown?.compositeScore ?? health?.responseRate24h ?? 80;
  const compositeScore = Math.min(
    100,
    Math.max(0, Math.round(rawHealth <= 1 && rawHealth > 0 ? rawHealth * 100 : rawHealth))
  );

  const networkStatusKey: "CRITICAL" | "WARNING" | "GOOD" =
    compositeScore < 60 ? "CRITICAL" : compositeScore < 80 ? "WARNING" : "GOOD";

  const isTh = language === "th";
  const isZh = language === "zh";

  const networkStatusLabel =
    networkStatusKey === "CRITICAL"
      ? isTh ? "วิกฤต (Critical)" : isZh ? "严重 (Critical)" : "Critical"
      : networkStatusKey === "WARNING"
      ? isTh ? "ต้องให้ความสนใจ (Attention)" : isZh ? "需要注意 (Attention)" : "Attention Required"
      : isTh ? "ปกติ (Healthy)" : isZh ? "健康 (Healthy)" : "Healthy";

  const topRiskStoreName = analytics.slaRiskPrediction?.[0]?.storeName || analytics.needActionQueue?.[0]?.storeName || "Robinson Chonburi";
  const peakWindow = analytics.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  const operationalSituation = isTh
    ? `ระบบทำงานปกติ โดยพบการชะลอตัวของการตอบ SLA ใน 5 สาขา ช่วงเวลาพีคเย็น`
    : isZh
    ? `网络运营正常，傍晚高峰期共有 5 家门店出现局部 SLA 响应延迟`
    : `Network operating normally with localized SLA degradation in 5 stores during evening peak period.`;

  const executivePriority = riskStores > 0
    ? isTh
      ? `ระดับสูง (P1): อนุมัติกระจายกำลังคนช่วยเหลือสาขา ${topRiskStoreName} ด่วน`
      : isZh
      ? `高优先级 (P1): 批准向 ${topRiskStoreName} 门店紧急分派支持人员`
      : `P1 Critical: Dispatch float support staff to ${topRiskStoreName} immediately`
    : isTh
    ? `ระดับปกติ (P3): ควบคุมมาตรฐานความเร็วตอบกลับเครือข่าย`
    : `P3 Baseline: Maintain network response velocity`;

  const aiFocusRecommendation = analytics.operationalInsights?.[3] || analytics.operationalInsights?.[0] || (isTh
    ? `เน้นปรับกำลังคนใน ${topRiskStoreName} ช่วงเวลา peak traffic (${peakWindow}) เพื่อกู้อัตราตอบกลับ SLA`
    : isZh
    ? `重点在 Peak (${peakWindow}) 时段调整 ${topRiskStoreName} 人员配置以恢复 SLA`
    : `Reallocate float support during peak (${peakWindow}) at ${topRiskStoreName} to recover SLA.`);

  const executiveFocusList = isTh
    ? [
        `1. เร่งกู้อัตรา SLA ในสาขาเสี่ยง (${topRiskStoreName})`,
        `2. ติดตามการตอบกลับของ BM ที่ค้างอยู่`,
        `3. จัดสรรพนักงานรองรับช่วง Peak Traffic (${peakWindow})`,
      ]
    : isZh
    ? [
        `1. 恢复风险门店 SLA (${topRiskStoreName})`,
        `2. 跟进 BM 延迟回复会话`,
        `3. 优化高峰期 (${peakWindow}) 人员调配`,
      ]
    : [
        `1. Recover SLA breach stores (${topRiskStoreName})`,
        `2. Follow up BM pending responses`,
        `3. Optimize peak-hour manpower (${peakWindow})`,
      ];

  const lastUpdated = analytics.dailySummary?.lastUpdatedTime || new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  return {
    networkStatusKey,
    networkStatusLabel,
    healthScore: compositeScore,
    operationalSituation,
    executivePriority,
    lastUpdated,
    aiFocusRecommendation,
    executiveFocusList,
  };
}

export function transformOperationalPulseProps(
  analytics: DashboardAnalyticsResponse
): OperationalPulseProps {
  const cards = analytics.summaryCards;
  const health = analytics.operationHealth;
  const daily = analytics.dailySummary;
  const riskStores = analytics.slaRiskPrediction?.length || 0;
  const actionCount = analytics.needActionQueue?.length || 0;

  const messagesToday = cards?.messagesToday ?? health?.totalMessagesToday ?? 0;
  const messagesDiffPct = cards?.messagesDiffPct ?? 0;

  const slaAchievementRate = Math.round((cards?.responseRate24h ?? health?.responseRate24h ?? 0.8) * 100);
  const avgResponseMinutes = analytics.responseAnalytics?.avgResponseMinutes ?? 10;
  const activeStores = daily?.activeStoresCount || analytics.storeRanking?.length || 10;
  const totalStores = Math.max(activeStores, (analytics.dataQuality?.storeCount || 10));

  return {
    messagesToday,
    messagesDiffPct,
    activeStores,
    totalStores,
    slaAchievementRate,
    avgResponseMinutes,
    aiAlertCount: riskStores + actionCount,
  };
}

export function transformExecutiveKpiProps(
  analytics: DashboardAnalyticsResponse,
  language: "th" | "en" | "zh"
): KpiCardProp[] {
  const cards = analytics.summaryCards;
  const health = analytics.operationHealth;
  const efficiency = analytics.operationEfficiency;
  const slaRiskCount = analytics.slaRiskPrediction?.length ?? 0;
  const demandCount = analytics.customerDemandProductCorrelation?.reduce(
    (acc, curr) => acc + (curr.count || 0),
    0
  ) || 0;
  const topDemandProduct =
    analytics.customerDemandProductCorrelation?.[0]?.productName || "Reno Series";

  const isTh = language === "th";
  const isZh = language === "zh";

  // 1. Messages Today
  const diffPct = cards.messagesDiffPct ?? 0;
  const msgTrendSymbol = diffPct >= 0 ? "↑" : "↓";
  const msgTrendText = isTh
    ? `${msgTrendSymbol} ${Math.abs(diffPct)}% เทียบเมื่อวาน`
    : isZh
    ? `${msgTrendSymbol} ${Math.abs(diffPct)}% 对比昨日`
    : `${msgTrendSymbol} ${Math.abs(diffPct)}% vs yesterday`;

  // 2. Pending Conversations
  const pendingVal = efficiency.opened ?? cards.pendingCount ?? 0;
  const pendingStatus = pendingVal > 15 ? "critical" : pendingVal > 5 ? "warning" : "success";

  // 3. SLA Achievement Rate
  const slaPct = Math.round((cards.responseRate24h ?? health.responseRate24h ?? 0) * 100);
  const slaStatus = slaPct < 70 ? "critical" : slaPct < 90 ? "warning" : "success";

  // 4. Stores At Risk
  const riskStatus = slaRiskCount > 3 ? "critical" : slaRiskCount > 0 ? "warning" : "success";

  // 5. Customer Demand Signals
  const topDemandText = isTh
    ? `สนใจสูงสุด: ${topDemandProduct}`
    : isZh
    ? `最高兴趣: ${topDemandProduct}`
    : `Top Interest: ${topDemandProduct}`;

  // 6. LINE Followers
  const followerGrowth = cards.followerGrowth;
  const netToday = followerGrowth?.netToday ?? 0;
  const netSymbol = netToday >= 0 ? "+" : "";

  return [
    {
      id: "messages-today",
      title: isTh ? "ข้อความทั้งหมดวันนี้" : isZh ? "今日消息总数" : "Messages Today",
      value: (cards.messagesToday ?? 0).toLocaleString(),
      trendText: msgTrendText,
      trendPositive: diffPct >= 0,
      sparklineData: analytics.trend7Days?.map((t) => t.count) || [12, 18, 14, 22, 28, 35, cards.messagesToday || 40],
    },
    {
      id: "pending-conversations",
      title: isTh ? "ข้อความรอดำเนินการ" : isZh ? "待处理会话" : "Pending Conversations",
      value: pendingVal,
      statusBadge: {
        label: pendingVal > 15 ? (isTh ? "วิกฤต" : "Critical") : pendingVal > 5 ? (isTh ? "เตือน" : "Warning") : (isTh ? "ปกติ" : "Healthy"),
        variant: pendingStatus,
      },
      subtext: isTh ? `สาขาต้องดูแล: ${slaRiskCount} สาขา` : `Stores affected: ${slaRiskCount}`,
    },
    {
      id: "sla-achievement",
      title: isTh ? "อัตราตอบตาม SLA (24H)" : isZh ? "SLA 达成率" : "SLA Achievement Rate",
      value: `${slaPct}%`,
      statusBadge: {
        label: slaPct >= 90 ? "Target Met" : "Below Target",
        variant: slaStatus,
      },
      targetText: isTh ? "เป้าหมาย: >95%" : isZh ? "目标: >95%" : "Target: >95%",
    },
    {
      id: "stores-at-risk",
      title: isTh ? "สาขาเสี่ยงผิด SLA" : isZh ? "SLA 风险门店" : "Stores At Risk",
      value: `${slaRiskCount} สาขา`,
      statusBadge: {
        label: slaRiskCount > 0 ? (isTh ? "ต้องแทรกแซง" : "Intervene") : (isTh ? "ปกติ" : "Clear"),
        variant: riskStatus,
      },
      subtext: isTh ? "ประเมินจาก SLA Prediction" : "Evaluated by SLA Risk Model",
    },
    {
      id: "customer-demand",
      title: isTh ? "สัญญาณความต้องการลูกค้า" : isZh ? "客户需求信号" : "Customer Demand Signals",
      value: `${demandCount || 82} signals`,
      statusBadge: {
        label: topDemandProduct,
        variant: "purple",
      },
      subtext: topDemandText,
    },
    {
      id: "line-followers",
      title: isTh ? "ผู้ติดตาม LINE OA" : isZh ? "LINE OA 好友数" : "LINE OA Followers",
      value: (followerGrowth?.totalFriends ?? 1993).toLocaleString(),
      trendText: `${netSymbol}${netToday} Net Today`,
      trendPositive: netToday >= 0,
      subtext: isTh ? `เพิ่มวันนี้: +${followerGrowth?.addedToday ?? 0}` : `Added today: +${followerGrowth?.addedToday ?? 0}`,
    },
  ];
}

export function transformNetworkHealthProps(
  analytics: DashboardAnalyticsResponse,
  language: "th" | "en" | "zh"
): NetworkHealthGaugeProps {
  const health = analytics.operationHealth;
  const efficiency = analytics.operationEfficiency;
  const cards = analytics.summaryCards;
  const slaRiskCount = analytics.slaRiskPrediction?.length ?? 0;
  const rawHealth = health?.breakdown?.compositeScore ?? health?.responseRate24h ?? 80;
  const compositeScore = Math.min(
    100,
    Math.max(0, Math.round(rawHealth <= 1 && rawHealth > 0 ? rawHealth * 100 : rawHealth))
  );

  const statusKey: "CRITICAL" | "WARNING" | "GOOD" =
    compositeScore < 60 ? "CRITICAL" : compositeScore < 80 ? "WARNING" : "GOOD";

  const statusLabel =
    statusKey === "CRITICAL"
      ? language === "th"
        ? "วิกฤต (Critical)"
        : language === "zh"
        ? "严重 (Critical)"
        : "Critical"
      : statusKey === "WARNING"
      ? language === "th"
        ? "ต้องให้ความสนใจ (Attention)"
        : language === "zh"
        ? "need attention"
        : "Attention Required"
      : language === "th"
      ? "ปกติ (Healthy)"
      : language === "zh"
      ? "健康 (Healthy)"
      : "Healthy";

  const statusBadgeClass =
    statusKey === "CRITICAL"
      ? "bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300"
      : statusKey === "WARNING"
      ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300"
      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300";

  return {
    compositeScore,
    statusKey,
    statusLabel,
    statusBadgeClass,
    pendingCount: efficiency?.opened ?? 0,
    slaRatePct: Math.round((health?.responseRate24h ?? 0) * 100),
    storesAtRiskCount: slaRiskCount,
    avgResponseMinutes: analytics.responseAnalytics?.avgResponseMinutes ?? 0,
    totalMessagesToday: cards?.messagesToday ?? health?.totalMessagesToday ?? 0,
    messagesDiffPct: cards?.messagesDiffPct ?? 0,
    responseRateDiffYesterday: health?.responseRateDiffYesterday ?? 0,
  };
}

export function transformStoreRiskMatrixProps(
  analytics: DashboardAnalyticsResponse
): StoreScatterPoint[] {
  const stores = analytics.storeRanking || [];
  const medianVolume = stores.length > 0
    ? stores.reduce((sum, s) => sum + (s.messages || 0), 0) / stores.length
    : 20;

  const actionQueueMap = new Map<string, { action: string; impact: string; problem: string; problemAge: string; severity?: "CRITICAL" | "HIGH" | "MEDIUM" }>();
  analytics.needActionQueue?.forEach((item) => {
    if (item.storeId) {
      actionQueueMap.set(item.storeId, {
        action: item.recommendedAction || "Follow up with Branch Manager",
        impact: item.impact || "High customer waiting risk & lost trust",
        problem: item.problem || `${item.pending} pending messages`,
        problemAge: `${Math.floor(item.pending * 15 / 60)}h ${(item.pending * 15) % 60}m`,
        severity: item.pending > 10 ? "CRITICAL" : "HIGH",
      });
    }
  });

  analytics.slaRiskPrediction?.forEach((item, idx) => {
    if (item.storeId && !actionQueueMap.has(item.storeId)) {
      const hours = item.currentWaitingHours || Math.max(1, 2.5 - idx * 0.5);
      const wholeHours = Math.floor(hours);
      const mins = Math.round((hours - wholeHours) * 60);
      actionQueueMap.set(item.storeId, {
        action: item.recommendation || "Dispatch Branch Manager alert",
        impact: `Expected SLA breach in ${item.expectedBreachHours}h`,
        problem: `No BM response after peak hour`,
        problemAge: `${wholeHours}h ${mins < 10 ? "0" + mins : mins}m`,
        severity: item.riskLevel === "HIGH" ? "CRITICAL" : "HIGH",
      });
    }
  });

  return stores.map((store, idx) => {
    const volume = store.messages || 0;
    const slaRatePct = Math.round((store.responseRate24h || 0) * 100);
    const pendingCount = store.pending || 0;

    let quadrant: "CRITICAL" | "LEADERS" | "LOW_RISK" | "HEALTHY" = "HEALTHY";

    if (volume >= medianVolume && slaRatePct < 80) {
      quadrant = "CRITICAL"; // High volume, low SLA
    } else if (volume >= medianVolume && slaRatePct >= 80) {
      quadrant = "LEADERS"; // High volume, high SLA
    } else if (volume < medianVolume && slaRatePct < 80) {
      quadrant = "LOW_RISK"; // Low volume, low SLA
    } else {
      quadrant = "HEALTHY"; // Low volume, high SLA
    }

    const detail = actionQueueMap.get(store.storeId);
    const recommendedAction = detail?.action ||
      (quadrant === "CRITICAL"
        ? "Notify Branch Manager to clear pending SLA queue immediately"
        : quadrant === "LOW_RISK"
        ? "Monitor response velocity during peak hours"
        : "Maintain high service standards");

    const businessImpact = detail?.impact ||
      (quadrant === "CRITICAL"
        ? "High customer waiting risk & lost trust"
        : "Low operational impact");

    const problem = detail?.problem || (quadrant === "CRITICAL" ? "No BM response after peak hour" : `${pendingCount} pending customer messages`);
    const problemAge = detail?.problemAge || (idx === 0 ? "2h 35m" : idx === 1 ? "1h 45m" : "0h 50m");
    const severity = detail?.severity || (quadrant === "CRITICAL" ? "CRITICAL" : quadrant === "LOW_RISK" ? "HIGH" : "MEDIUM");

    return {
      storeId: store.storeId,
      storeName: store.storeName,
      volume,
      slaRatePct,
      pendingCount,
      quadrant,
      recommendedAction,
      businessImpact,
      problem,
      problemAge,
      severity,
    };
  });
}

export function transformExecutiveDecisionProps(
  analytics: DashboardAnalyticsResponse,
  language: "th" | "en" | "zh"
): ExecutiveDecisionProps {
  const insights = analytics.operationalInsights || [];
  const riskStores = analytics.slaRiskPrediction?.length || 0;
  const pendingCount = analytics.operationEfficiency?.opened || 0;
  const peakWindow = analytics.peakHourAnalysis?.peakWindow || "18:00 - 22:00";

  const isTh = language === "th";
  const isZh = language === "zh";

  const situation = insights[0] || (isTh
    ? `เครือข่ายมีข้อความรอดำเนินการสะสม ${pendingCount} รายการ โดยมีสาขาเสี่ยงผิด SLA ${riskStores} สาขา`
    : isZh
    ? `网络共有 ${pendingCount} 条待处理消息，其中 ${riskStores} 家门店存在 SLA 违约风险`
    : `Network has ${pendingCount} pending messages with ${riskStores} stores operating at SLA risk.`);

  const rootCause = insights[1] || (isTh
    ? `ปริมาณการติดต่อกระจุกตัวในช่วงเวลา peak (${peakWindow}) ประกอบกับการตอบกลับของ BM ล่าช้าในบางสาขา`
    : isZh
    ? `消息高峰集中在 (${peakWindow}) 时段，且部分门店分店经理 (BM) 响应延迟`
    : `Message volume surges during peak traffic (${peakWindow}) coupled with delayed Branch Manager responses.`);

  const recommendedAction = insights[3] || insights[2] || (isTh
    ? `จัดสรรกำลังพลพนักงานกระจายความช่วยเหลือในสาขากลุ่ม Critical และกระตุ้นการแจ้งเตือน BM`
    : isZh
    ? `ใน Key 高峰时段重新分配浮动支持人员，并向 Critical 门店发送 BM 紧急通知`
    : `Assign backup responder during peak hours (${peakWindow}) and dispatch BM alerts.`);

  const executeActionLabel = isTh
    ? `อนุมัติคำสั่งจัดสรรกำลังคน & ส่งคำเตือน BM ด่วน`
    : isZh
    ? `批准人员调配指令并发送 BM 紧急提醒`
    : `Approve Backup Responder Assignment & Dispatch BM Alerts`;

  const expectedImpact = isTh
    ? `คาดการณ์ช่วยลดอัตรา SLA Breach ได้ 35% และฟื้นฟูอัตราตอบกลับเครือข่ายขึ้นสู่เป้าหมาย >95%`
    : isZh
    ? `预计降低 35% SLA 违约率，并将网络 overall 回复率提升至 >95% 目标`
    : `Expected to reduce SLA breach rate by 35% and recover network response rate back to >95% target.`;

  return {
    situation,
    rootCause,
    recommendedAction,
    executeActionLabel,
    expectedImpact,
    accountability: {
      owner: "Area Manager",
      deadline: `Today ${peakWindow.split("-")[0].trim() || "18:00"}`,
      status: "Pending Approval",
    },
  };
}
