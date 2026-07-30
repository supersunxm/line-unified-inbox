export type CoverageFunnelStep = {
  key: "ACTIVE_CONVERSATIONS" | "TEXT_ELIGIBLE" | "CLASSIFIED" | "RULE" | "MANUAL" | "NO_PRODUCT";
  count: number;
  percentageOfEligible: number | null;
};

export type ClassificationInsightsResponse = {
  generatedAt: string;
  definitions: {
    scope: "CURRENT_STATE";
    accuracyMeasured: false;
    eligibleDefinition: string;
  };
  coverage: {
    totalConversations: number;
    textEligibleConversations: number;
    classifiedConversations: number;
    coverageRate: number;
    ruleClassified: number;
    manualClassified: number;
    mixedSource: number;
    noProduct: number;
    highIntentWithoutProduct: number;
  };
  funnel: CoverageFunnelStep[];
  productRanking: Array<{
    productModelId: string;
    modelName: string;
    familyName: string;
    productGroup: string;
    conversationCount: number;
    ruleCount: number;
    manualCount: number;
    compactCount: number;
  }>;
  reviewQueue: Array<{
    conversationId: string;
    store: { id: string; name: string };
    lineOa: { id: string; name: string };
    latestMessageAt: string;
    priority: string;
    purchaseIntent: string | null;
    topics: string[];
    reasonCodes: string[];
  }>;
  compactMonitoring: {
    totalCompactMatches: number;
    percentageOfRuleMatches: number | null;
    aliases: Array<{
      matchedPhrase: string;
      modelName: string;
      safetyClass: string;
      count: number;
      latestEvidenceAt: string | null;
    }>;
  };
  catalogHealth: {
    activeModels: number;
    inactiveModels: number;
    activeAliases: number;
    inactiveAliases: number;
    catalogAliases: number;
    manualAliases: number;
    modelsWithoutActiveCatalogAliases: number;
    safeExactDeclarations: number;
    safeCompactDeclarations: number;
    reviewRequiredDeclarations: number;
    blockedDeclarations: number;
  };
  opportunityGap: {
    highIntentWithoutProduct: number;
    byIntent: Record<string, number>;
  };
};
