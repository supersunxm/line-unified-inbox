import { Inject, Injectable } from "@nestjs/common";
import * as fs from "node:fs";
import { confirmLineManagerAuthentication } from "./line-chat-manager-auth-confirmation";
import {
  LineChatProfileOperationCoordinator,
  type LineChatProfileOperationContext,
} from "./line-chat-profile-operation-coordinator.service";
import {
  LineChatMirrorService,
  managerAccountKeyFromInputs,
  managerBotIdFromRedirect,
  type MirrorStoreTargetInputs,
} from "./line-chat-mirror.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { normalizeSearchText } from "../store-master/store-master.utils";

export type TargetProofProfile = "A" | "B";
export type TargetProofResolution =
  | "UNIQUE_VERIFIED"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "PROFILE_MISMATCH"
  | "AUTH_FAILED"
  | "TRANSPORT_FAILED";

export interface LineChatTargetProofInput {
  assignedProfile: unknown;
  storeCode: unknown;
  lineOfficialAccountId: unknown;
  basicId: unknown;
  normalizedName: unknown;
}

export interface LineChatTargetProofResult {
  assignedProfile: TargetProofProfile;
  authStatus: "AUTHENTICATED" | "AUTH_FAILED" | "NOT_CHECKED";
  managerBotId: string | null;
  managerStableOaId: string | null;
  targetResolution: TargetProofResolution;
  targetResolutionSource: string;
  recentChatHttpStatus: number | null;
  chatListRequestObserved: boolean;
  responseStructureValid: boolean;
  latestEventPresent: boolean;
  itemCount: number | null;
  discoveryDurationMs: number;
}

interface ValidTargetProofInput {
  assignedProfile: TargetProofProfile;
  storeCode: string;
  lineOfficialAccountId: string;
  basicId: string;
  normalizedName: string;
}

function profileSlot(value: string | null | undefined): TargetProofProfile | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/(?:^|[^a-z0-9])account[\s_-]*1(?:$|[^a-z0-9])/iu.test(normalized)) return "A";
  const match = /(?:^|[^a-z0-9])profile[\s_-]*([ab])(?:$|[^a-z0-9])/iu.exec(normalized);
  return match?.[1]?.toLocaleUpperCase() === "A" || match?.[1]?.toLocaleUpperCase() === "B"
    ? match[1].toLocaleUpperCase() as TargetProofProfile
    : null;
}

function validateInput(input: LineChatTargetProofInput): ValidTargetProofInput | null {
  const assigned = typeof input.assignedProfile === "string"
    ? input.assignedProfile.trim().replace(/[\s_]+/gu, "-").toLocaleUpperCase()
    : "";
  const assignedProfile = assigned === "A" || assigned === "PROFILE-A"
    ? "A"
    : assigned === "B" || assigned === "PROFILE-B"
      ? "B"
      : null;
  const values = [input.storeCode, input.lineOfficialAccountId, input.basicId, input.normalizedName];
  if (!assignedProfile || values.some((value) => typeof value !== "string" || !value.trim())) return null;
  const [storeCode, lineOfficialAccountId, basicId, normalizedName] = values as string[];
  if (
    storeCode.length > 100
    || lineOfficialAccountId.length > 200
    || basicId.length > 200
    || normalizedName.length > 300
  ) return null;
  return {
    assignedProfile,
    storeCode: storeCode.trim(),
    lineOfficialAccountId: lineOfficialAccountId.trim(),
    basicId: basicId.trim(),
    normalizedName: normalizedName.trim(),
  };
}

function safeResult(
  assignedProfile: TargetProofProfile,
  targetResolution: TargetProofResolution,
  targetResolutionSource: string,
  extra: Partial<Pick<LineChatTargetProofResult,
    "authStatus" | "managerBotId" | "managerStableOaId" | "recentChatHttpStatus"
    | "chatListRequestObserved" | "responseStructureValid" | "latestEventPresent" | "itemCount" | "discoveryDurationMs"
  >> = {},
): LineChatTargetProofResult {
  return {
    assignedProfile,
    authStatus: "NOT_CHECKED",
    managerBotId: null,
    managerStableOaId: null,
    targetResolution,
    targetResolutionSource,
    recentChatHttpStatus: null,
    chatListRequestObserved: false,
    responseStructureValid: false,
    latestEventPresent: false,
    itemCount: null,
    discoveryDurationMs: 0,
    ...extra,
  };
}

@Injectable()
export class LineChatTargetProofService {
  constructor(
    @Inject(LineChatMirrorService) private readonly mirrorService: LineChatMirrorService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly profileCoordinator: LineChatProfileOperationCoordinator,
  ) {}

  public async prove(input: LineChatTargetProofInput): Promise<LineChatTargetProofResult | null> {
    const validated = validateInput(input);
    if (!validated) return null;

    const base = (resolution: TargetProofResolution, source: string) =>
      safeResult(validated.assignedProfile, resolution, source);
    let target: MirrorStoreTargetInputs;
    try {
      target = await this.mirrorService.getStoreMirrorTargetInputs(validated.storeCode);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (/MIRROR_OA_IDENTITY_.*AMBIGUOUS|MIRROR_OA_IDENTITY_MULTIPLE_ACTIVE_OAS/u.test(reason)) {
        return base("AMBIGUOUS", "STORE_MASTER");
      }
      if (
        reason === "MIRROR_STORE_NOT_FOUND"
        || /MIRROR_OA_IDENTITY_.*NOT_FOUND|MIRROR_OA_IDENTITY_.*NO_ACTIVE_OA/u.test(reason)
      ) {
        return base("NOT_FOUND", "STORE_MASTER");
      }
      return base("TRANSPORT_FAILED", "STORE_MASTER");
    }

    const expectedName = normalizeSearchText(validated.normalizedName);
    const masterName = normalizeSearchText(target.storeMasterAccountName ?? "");
    const oaName = normalizeSearchText(target.oa.name);
    const isUniqueTarget = target.effectiveStoreCode.trim().toLocaleUpperCase() === validated.storeCode.toLocaleUpperCase()
      && target.oa.id === validated.lineOfficialAccountId
      && (target.oa.basicId ?? "").trim().toLocaleLowerCase() === validated.basicId.toLocaleLowerCase()
      && expectedName.length > 0
      && (expectedName === masterName || expectedName === oaName);
    if (!isUniqueTarget) {
      return base(target.oa.id === validated.lineOfficialAccountId ? "PROFILE_MISMATCH" : "NOT_FOUND", target.selectionSource);
    }

    const session = target.oa.lineChatSession;
    if (!session || session.status !== "ACTIVE") {
      return base("PROFILE_MISMATCH", target.selectionSource);
    }
    const sessionProfile = profileSlot(session.sessionKey);
    const profileHints = [session.profileStorageKey, session.profilePath]
      .map(profileSlot)
      .filter((profile): profile is TargetProofProfile => profile !== null);
    if (
      sessionProfile !== validated.assignedProfile
      || profileHints.some((profile) => profile !== validated.assignedProfile)
    ) return base("PROFILE_MISMATCH", target.selectionSource);

    const managerAccountKey = managerAccountKeyFromInputs({
      lineChatWorkspaceUrl: target.oa.lineChatWorkspaceUrl,
      storeManagerUrl: target.storeManagerUrl,
      basicId: target.oa.basicId,
    });
    if (!managerAccountKey) return base("NOT_FOUND", target.selectionSource);

    let profilePath: string;
    try {
      profilePath = this.sessionService.resolveProfilePath(session);
    } catch {
      return base("TRANSPORT_FAILED", target.selectionSource);
    }
    if (!fs.existsSync(profilePath)) return base("TRANSPORT_FAILED", target.selectionSource);

    const coordinated = await this.profileCoordinator.withProfileOperation(
      { sessionId: session.id, operationKind: "TARGET_PROOF" },
      async (operationContext) => this.runProof({
        input: validated,
        targetResolutionSource: target.selectionSource,
        managerAccountKey,
        profilePath,
        session,
        operationContext,
      }),
      { waitForLock: true, waitForLockMs: 5_000 },
    );
    return coordinated.acquired
      ? coordinated.value
      : base("TRANSPORT_FAILED", target.selectionSource);
  }

  private async runProof(input: {
    input: ValidTargetProofInput;
    targetResolutionSource: string;
    managerAccountKey: string;
    profilePath: string;
    session: NonNullable<Awaited<ReturnType<LineChatMirrorService["getStoreMirrorTargetInputs"]>>["oa"]["lineChatSession"]>;
    operationContext: LineChatProfileOperationContext;
  }): Promise<LineChatTargetProofResult> {
    const startedAt = Date.now();
    const base = (resolution: TargetProofResolution, extra: Partial<LineChatTargetProofResult> = {}) => safeResult(
      input.input.assignedProfile,
      resolution,
      input.targetResolutionSource,
      { discoveryDurationMs: Math.max(0, Date.now() - startedAt), ...extra },
    );
    let context: Awaited<ReturnType<LineChatSessionService["launchManagedPersistentContext"]>> | null = null;
    let resolvedBotId: string | null = null;
    let authStatus: LineChatTargetProofResult["authStatus"] = "NOT_CHECKED";
    let cleanupFailed = false;
    let proofResult: LineChatTargetProofResult | null = null;
    try {
      input.operationContext.assertOwnership();
      context = await this.sessionService.launchManagedPersistentContext(
        input.profilePath,
        {
          profilePath: input.profilePath,
          headless: true,
          viewport: { width: 1280, height: 800 },
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
        },
        {
          sessionId: input.session.id,
          sessionKey: input.session.sessionKey,
          profileStorageKey: input.session.profileStorageKey ?? undefined,
          storeCode: input.input.storeCode,
          operationKind: "TARGET_PROOF",
        },
      );
      const page = context.pages()[0] || await context.newPage();
      const targetUrl = `https://chat.line.biz/account/${encodeURIComponent(input.managerAccountKey)}`;
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(1_000).catch(() => {});
      input.operationContext.assertOwnership();
      const auth = await confirmLineManagerAuthentication(
        () => this.sessionService.probeApiAuthentication(context!),
        (ms) => page.waitForTimeout(ms),
      );
      if (auth.outcome !== "AUTHENTICATED") {
        authStatus = "AUTH_FAILED";
        proofResult = base("AUTH_FAILED", { authStatus });
      } else {
        authStatus = "AUTHENTICATED";
        resolvedBotId = managerBotIdFromRedirect(page.url());
        if (!resolvedBotId) {
          proofResult = base("NOT_FOUND", { authStatus });
        } else {
          input.operationContext.assertOwnership();
          const recent = await this.sessionService.discoverRecentChats({
            botId: resolvedBotId,
            profilePath: input.profilePath,
            headless: true,
            existingManagedContext: context,
            maxPages: 1,
            maxChats: 5,
            includeTransportMetadata: true,
            operationContext: input.operationContext,
          });
          input.operationContext.assertOwnership();
          const recentChatHttpStatus = recent.recentChatHttpStatus ?? null;
          const chatListRequestObserved = recent.chatListRequestObserved ?? false;
          const responseStructureValid = recent.responseStructureValid ?? false;
          const latestEventPresent = recent.latestEventPresent ?? false;
          const itemCount = recent.itemCount ?? null;
          const discoveryDurationMs = Math.max(0, recent.discoveryDurationMs ?? (Date.now() - startedAt));
          const managerFields = {
            authStatus: recent.failureReason === "SESSION_AUTH" ? "AUTH_FAILED" as const : "AUTHENTICATED" as const,
            managerBotId: resolvedBotId,
            managerStableOaId: resolvedBotId,
            recentChatHttpStatus,
            chatListRequestObserved,
            responseStructureValid,
            latestEventPresent,
            itemCount,
            discoveryDurationMs,
          };
          if (
            recent.status !== "READY"
            || recent.pagesFetched !== 1
            || recentChatHttpStatus !== 200
            || !chatListRequestObserved
            || !responseStructureValid
          ) {
            proofResult = base(
              recent.failureReason === "SESSION_AUTH" ? "AUTH_FAILED" : "TRANSPORT_FAILED",
              managerFields,
            );
          } else {
            proofResult = base("UNIQUE_VERIFIED", managerFields);
          }
        }
      }
    } catch {
      proofResult = base("TRANSPORT_FAILED", {
        authStatus,
        managerBotId: resolvedBotId,
        ...(resolvedBotId ? { managerStableOaId: resolvedBotId } : {}),
      });
    } finally {
      if (context) {
        try {
          await this.sessionService.closeManagedPersistentContext(context, input.profilePath, {
            sessionId: input.session.id,
            sessionKey: input.session.sessionKey,
            storeCode: input.input.storeCode,
            operationKind: "TARGET_PROOF",
          });
        } catch {
          cleanupFailed = true;
        }
      }
    }
    if (cleanupFailed) return base("TRANSPORT_FAILED", { authStatus, managerBotId: resolvedBotId });
    return proofResult ?? base("TRANSPORT_FAILED", { authStatus, managerBotId: resolvedBotId });
  }
}
