import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { isLineChatUserId } from "./line-chat-chat-discovery";

const IDENTITY_MAPPING_POLL_INTERVAL_MS = 5_000;
const MIN_MATCHING_EVIDENCE = 3;
const EVIDENCE_SAMPLE_LIMIT = 100;
const PENDING_JOB_LIMIT = 100;

type PendingIdentityJob = {
  id: string;
  conversationId: string;
  lineOfficialAccountId: string;
};

type IdentityTarget = {
  id: string;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  customer: { lineUserId: string };
};

/**
 * DB-only bridge between the Messaging API webhook identity and the LINE OA
 * Manager chat identity. It never opens a browser or acquires a profile lease.
 *
 * Safety rule: an OA is eligible only after existing durable mappings prove
 * that webhook user IDs and Manager chat IDs are identical for at least three
 * conversations, with zero mismatches in the sampled evidence. If that proof
 * is absent, the normal browser resolver remains the fallback.
 */
@Injectable()
export class LineChatWebhookIdentityMapperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatWebhookIdentityMapperService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.processCycle(), IDENTITY_MAPPING_POLL_INTERVAL_MS);
    this.timer.unref?.();
    void this.processCycle();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  public async processCycle(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    try {
      const jobs = await this.prisma.lineChatNicknameSyncJob.findMany({
        where: {
          status: LineChatNicknameSyncJobStatus.PENDING,
          lineChatUserId: null,
        },
        orderBy: { createdAt: "asc" },
        take: PENDING_JOB_LIMIT,
        select: { id: true, conversationId: true, lineOfficialAccountId: true },
      }) as PendingIdentityJob[];
      if (jobs.length === 0) return 0;

      let mapped = 0;
      const jobsByOa = new Map<string, PendingIdentityJob[]>();
      for (const job of jobs) {
        const list = jobsByOa.get(job.lineOfficialAccountId) ?? [];
        list.push(job);
        jobsByOa.set(job.lineOfficialAccountId, list);
      }

      for (const [lineOfficialAccountId, oaJobs] of jobsByOa) {
        if (!(await this.hasVerifiedIdentityEquivalence(lineOfficialAccountId))) continue;
        mapped += await this.mapOaJobs(lineOfficialAccountId, oaJobs);
      }
      if (mapped > 0) {
        this.logger.log(JSON.stringify({
          event: "line_chat_webhook_identity_mapping_applied",
          mappedCount: mapped,
        }));
      }
      return mapped;
    } catch (error: unknown) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_webhook_identity_mapping_cycle_failed",
        error: error instanceof Error ? error.message : "UNKNOWN",
      }));
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  private async hasVerifiedIdentityEquivalence(lineOfficialAccountId: string): Promise<boolean> {
    const evidence = await this.prisma.conversation.findMany({
      where: {
        lineOfficialAccountId,
        lineChatUserId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: EVIDENCE_SAMPLE_LIMIT,
      select: {
        lineChatUserId: true,
        customer: { select: { lineUserId: true } },
      },
    });

    let matches = 0;
    let mismatches = 0;
    for (const row of evidence) {
      const managerId = row.lineChatUserId?.trim() || "";
      const webhookId = row.customer.lineUserId?.trim() || "";
      if (!isLineChatUserId(managerId) || !isLineChatUserId(webhookId)) continue;
      if (managerId === webhookId) matches += 1;
      else mismatches += 1;
    }

    const verified = matches >= MIN_MATCHING_EVIDENCE && mismatches === 0;
    if (!verified) {
      this.logger.warn(JSON.stringify({
        event: "line_chat_webhook_identity_mapping_not_verified",
        lineOfficialAccountId,
        matchingEvidence: matches,
        mismatchEvidence: mismatches,
        minimumMatchingEvidence: MIN_MATCHING_EVIDENCE,
      }));
    }
    return verified;
  }

  private async mapOaJobs(lineOfficialAccountId: string, jobs: PendingIdentityJob[]): Promise<number> {
    const conversationIds = [...new Set(jobs.map((job) => job.conversationId))];
    const targets = await this.prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
        lineOfficialAccountId,
        lineChatUserId: null,
      },
      select: {
        id: true,
        lineOfficialAccountId: true,
        lineChatUserId: true,
        customer: { select: { lineUserId: true } },
      },
    }) as IdentityTarget[];

    const candidateByConversation = new Map<string, string>();
    const conversationsByCandidate = new Map<string, string[]>();
    for (const target of targets) {
      const candidate = target.customer.lineUserId?.trim() || "";
      if (!isLineChatUserId(candidate)) continue;
      candidateByConversation.set(target.id, candidate);
      const ids = conversationsByCandidate.get(candidate) ?? [];
      ids.push(target.id);
      conversationsByCandidate.set(candidate, ids);
    }
    const candidates = [...conversationsByCandidate.keys()];
    if (candidates.length === 0) return 0;

    const conflicts = await this.prisma.conversation.findMany({
      where: {
        lineOfficialAccountId,
        lineChatUserId: { in: candidates },
      },
      select: { id: true, lineChatUserId: true },
    });
    const existingByCandidate = new Map(
      conflicts.flatMap((row) => row.lineChatUserId ? [[row.lineChatUserId, row.id] as const] : []),
    );

    let mapped = 0;
    for (const target of targets) {
      const candidate = candidateByConversation.get(target.id);
      if (!candidate) continue;
      // Current durable mapping semantics require one conversation per Manager
      // chat ID inside an OA. Duplicate target candidates stay on browser fallback.
      if ((conversationsByCandidate.get(candidate)?.length ?? 0) !== 1) continue;
      const existingConversationId = existingByCandidate.get(candidate);
      if (existingConversationId && existingConversationId !== target.id) continue;

      const applied = await this.prisma.$transaction(async (tx) => {
        const write = await tx.conversation.updateMany({
          where: {
            id: target.id,
            lineOfficialAccountId,
            lineChatUserId: null,
          },
          data: { lineChatUserId: candidate },
        });
        if (write.count !== 1) return false;
        await tx.lineChatNicknameSyncJob.updateMany({
          where: {
            conversationId: target.id,
            lineOfficialAccountId,
            status: LineChatNicknameSyncJobStatus.PENDING,
          },
          data: {
            lineChatUserId: candidate,
            lineUserId: candidate,
            scheduledAt: new Date(),
            lastError: null,
          },
        });
        return true;
      });
      if (applied) mapped += 1;
    }
    return mapped;
  }
}
