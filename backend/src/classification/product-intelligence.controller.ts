import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
  ProductCorrectionInsightService,
  ProductCorrectionInsightResponse,
  ApproveAliasResponse,
  RejectAliasResponse,
  TargetedReanalysisResponse,
} from "./product-correction-insight.service";
import { ProductAccuracyService, NetworkAccuracyReport } from "./product-accuracy.service";
import {
  ProductReviewQueueService,
  ProductReviewQueueResponse,
  ConfirmProductReviewDto,
  CorrectProductReviewDto,
  NoProductReviewDto,
} from "./product-review-queue.service";

export type ApproveAliasDto = {
  phrase: string;
  modelName: string;
  createdByName?: string;
};

export type RejectAliasDto = {
  phrase: string;
  modelName: string;
  reason?: string;
  createdByName?: string;
};

export type ReanalyzeAliasDto = {
  phrase: string;
};

@Controller("product-intelligence")
export class ProductIntelligenceController {
  constructor(
    private readonly correctionInsightService: ProductCorrectionInsightService,
    private readonly accuracyService: ProductAccuracyService,
    private readonly reviewQueueService: ProductReviewQueueService,
  ) {}

  @Get("corrections")
  getCorrections(
    @Query("storeId") storeId?: string,
  ): Promise<ProductCorrectionInsightResponse> {
    return this.correctionInsightService.getInsights(storeId);
  }

  @Get("accuracy")
  getAccuracy(
    @Query("storeId") storeId?: string,
  ): Promise<NetworkAccuracyReport> {
    return this.accuracyService.generateReport(storeId);
  }

  @Get("review-queue")
  getReviewQueue(
    @Query("storeId") storeId?: string,
    @Query("reason") reason?: string,
    @Query("productModelId") productModelId?: string,
    @Query("page") page?: number,
    @Query("pageSize") pageSize?: number,
  ): Promise<ProductReviewQueueResponse> {
    return this.reviewQueueService.getReviewQueue({
      storeId,
      reason,
      productModelId,
      page,
      pageSize,
    });
  }

  @Post("review-queue/confirm")
  confirmReview(
    @Body() dto: ConfirmProductReviewDto,
  ) {
    return this.reviewQueueService.confirmProduct(dto);
  }

  @Post("review-queue/correct")
  correctReview(
    @Body() dto: CorrectProductReviewDto,
  ) {
    return this.reviewQueueService.correctProduct(dto);
  }

  @Post("review-queue/no-product")
  confirmNoProduct(
    @Body() dto: NoProductReviewDto,
  ) {
    return this.reviewQueueService.confirmNoProduct(dto);
  }

  @Post("aliases/approve")
  approveAlias(@Body() dto: ApproveAliasDto): Promise<ApproveAliasResponse> {
    return this.correctionInsightService.approveAlias(dto);
  }

  @Post("aliases/reject")
  rejectAlias(@Body() dto: RejectAliasDto): Promise<RejectAliasResponse> {
    return this.correctionInsightService.rejectAlias(dto);
  }

  @Post("aliases/reanalyze")
  reanalyzeAlias(@Body() dto: ReanalyzeAliasDto): Promise<TargetedReanalysisResponse> {
    return this.correctionInsightService.targetedReanalyze(dto);
  }
}
