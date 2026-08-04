import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export type TranslationQualityReport = {
  totalTranslations: number;
  successfulTranslations: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  feedbackCount: number;
  helpfulRate: number;
  issueBreakdown: {
    meaning_issue: number;
    terminology_issue: number;
    other: number;
  };
};

@Injectable()
export class TranslationQualityReportService {
  constructor(private readonly prisma: PrismaService) {}

  async createReport(): Promise<TranslationQualityReport> {
    const [totalTranslations, successfulTranslations, durationAggregate, feedbackCount, helpfulFeedback, issueCounts] = await Promise.all([
      this.prisma.translationEvent.count(),
      this.prisma.translationEvent.count({ where: { status: "SUCCESS" } }),
      this.prisma.translationEvent.aggregate({ _avg: { durationMs: true } }),
      this.prisma.messageTranslationFeedback.count(),
      this.prisma.messageTranslationFeedback.count({ where: { rating: "HELPFUL" } }),
      this.prisma.messageTranslationFeedback.groupBy({
        by: ["issueCategory"],
        where: { rating: "INCORRECT" },
        _count: { _all: true },
      }),
    ]);
    const failureCount = totalTranslations - successfulTranslations;
    const issueBreakdown = {
      meaning_issue: 0,
      terminology_issue: 0,
      other: 0,
    };
    for (const row of issueCounts) {
      if (row.issueCategory === "MEANING_ISSUE") issueBreakdown.meaning_issue = row._count._all;
      if (row.issueCategory === "TERMINOLOGY_ISSUE") issueBreakdown.terminology_issue = row._count._all;
      if (row.issueCategory === "OTHER") issueBreakdown.other = row._count._all;
    }

    return {
      totalTranslations,
      successfulTranslations,
      failureCount,
      successRate: totalTranslations ? Number(((successfulTranslations / totalTranslations) * 100).toFixed(2)) : 0,
      averageDurationMs: Number((durationAggregate._avg.durationMs ?? 0).toFixed(2)),
      feedbackCount,
      helpfulRate: feedbackCount ? Number(((helpfulFeedback / feedbackCount) * 100).toFixed(2)) : 0,
      issueBreakdown,
    };
  }
}
