import { Injectable, Logger } from "@nestjs/common";

export type QuickReplyMetricName = "requested" | "generated" | "fallback" | "failed" | "rate_limited" | "lifecycle";

@Injectable()
export class QuickReplyMetricsService {
  private readonly logger = new Logger(QuickReplyMetricsService.name);
  private readonly counts = new Map<QuickReplyMetricName, number>();

  record(name: QuickReplyMetricName, metadata: Record<string, boolean | number | string | undefined> = {}) {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
    this.logger.log(JSON.stringify({ event: "quick_reply_metric", metric: name, ...metadata }));
  }

  snapshot() {
    return Object.fromEntries(this.counts.entries()) as Partial<Record<QuickReplyMetricName, number>>;
  }
}
