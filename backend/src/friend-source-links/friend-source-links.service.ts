import { BadRequestException, GoneException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { FriendAttributionSessionStatus, FriendSource, Prisma } from "@prisma/client";
import { createHmac, randomBytes } from "crypto";
import { PrismaService } from "../prisma.service";
import {
  getFriendAttributionHashSecret,
  getFriendAttributionLiffBaseUrl,
  getFriendAttributionLineLoginChannelId,
  getFriendAttributionPilotLineOaId,
  getFriendAttributionSessionTtlSeconds,
  hashLineUserId,
  hashPublicSessionToken,
} from "./friend-attribution.config";
import { IdentifyFriendAttributionDto, UpdateFriendshipStatusDto, UpsertFriendAttributionConfigDto } from "./friend-attribution.dto";
import { getFriendSourceIpHashKey, getFriendSourcePublicBaseUrl } from "./friend-source-links.config";
import { GenerateFriendSourceLinksDto, QueryFriendSourceLinksDto, UpdateFriendSourceLinkDto } from "./friend-source-links.dto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

type LinkWithRelations = Prisma.FriendSourceLinkGetPayload<{
  include: { store: true; lineOa: true; _count: { select: { clicks: true } } };
}>;

export function generateShortCode(length = 8): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

export function deriveDefaultDestinationUrl(basicId: string): string {
  const trimmed = basicId.trim();
  const normalized = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  return `https://line.me/R/ti/p/${encodeURIComponent(normalized)}`;
}

@Injectable()
export class FriendSourceLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async generateLinks(dto: GenerateFriendSourceLinksDto) {
    const distinctIds = Array.from(new Set(dto.lineOaIds.map((id) => id.trim()).filter(Boolean)));
    if (distinctIds.length === 0 || distinctIds.length > 5) {
      throw new BadRequestException("Minimum 1 and maximum 5 distinct LINE OA IDs allowed per request");
    }

    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: {
        id: { in: distinctIds },
        isActive: true,
        store: { isActive: true },
      },
      include: { store: true },
    });

    const foundIds = new Set(accounts.map((a) => a.id));
    const missing = distinctIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`One or more requested LINE OA IDs are invalid, inactive, or belong to an inactive store: ${missing.join(", ")}`);
    }

    for (const acc of accounts) {
      if (!["CONNECTED", "READY"].includes(acc.connectionStatus)) {
        throw new BadRequestException(`LINE OA ${acc.id} (${acc.name}) connection status '${acc.connectionStatus}' is not CONNECTED or READY`);
      }
      if (!acc.basicId || !acc.basicId.trim()) {
        throw new BadRequestException(`LINE OA ${acc.id} (${acc.name}) is missing basicId`);
      }
    }

    let createdCount = 0;
    let existingCount = 0;
    const allLinks: ReturnType<typeof this.formatLinkResponse>[] = [];
    const ALL_SOURCES = [FriendSource.STORE_QR, FriendSource.TIKTOK, FriendSource.FACEBOOK, FriendSource.INSTAGRAM];

    for (const acc of accounts) {
      const destinationUrl = deriveDefaultDestinationUrl(acc.basicId!);

      for (const source of ALL_SOURCES) {
        let existing: LinkWithRelations | null = await this.prisma.friendSourceLink.findUnique({
          where: { lineOaId_source: { lineOaId: acc.id, source } },
          include: { store: true, lineOa: true, _count: { select: { clicks: true } } },
        });

        if (existing) {
          existingCount++;
          allLinks.push(this.formatLinkResponse(existing));
          continue;
        }

        let created: LinkWithRelations | null = null;
        let attempts = 0;
        while (attempts < 5 && !created) {
          attempts++;
          const shortCode = generateShortCode(8);
          try {
            created = await this.prisma.friendSourceLink.create({
              data: {
                storeId: acc.storeId,
                lineOaId: acc.id,
                source,
                shortCode,
                destinationUrl,
                isActive: true,
              },
              include: { store: true, lineOa: true, _count: { select: { clicks: true } } },
            });
          } catch (err: unknown) {
            const errWithMeta = err as { code?: string; meta?: { target?: unknown } } | null | undefined;
            if (errWithMeta && typeof errWithMeta === "object" && errWithMeta.code === "P2002") {
              const target = errWithMeta.meta?.target;
              const targetArray = Array.isArray(target) ? (target as string[]) : typeof target === "string" ? [target] : [];
              if (targetArray.includes("shortCode")) {
                continue;
              }
              if (targetArray.includes("lineOaId")) {
                existing = await this.prisma.friendSourceLink.findUnique({
                  where: { lineOaId_source: { lineOaId: acc.id, source } },
                  include: { store: true, lineOa: true, _count: { select: { clicks: true } } },
                });
                if (existing) {
                  existingCount++;
                  allLinks.push(this.formatLinkResponse(existing));
                  break;
                }
              }
            }
            throw err;
          }
        }

        if (created) {
          createdCount++;
          allLinks.push(this.formatLinkResponse(created));
        }
      }
    }

    return { createdCount, existingCount, items: allLinks };
  }

  async getLinks(query: QueryFriendSourceLinksDto) {
    const where: Prisma.FriendSourceLinkWhereInput = {};

    if (query.storeId) where.storeId = query.storeId;
    if (query.lineOaId) where.lineOaId = query.lineOaId;
    if (query.source) where.source = query.source;
    if (query.isActive !== undefined && query.isActive !== "") {
      where.isActive = query.isActive === "true" || query.isActive === "1";
    }

    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { shortCode: { contains: searchTerm, mode: "insensitive" } },
        { store: { name: { contains: searchTerm, mode: "insensitive" } } },
        { lineOa: { name: { contains: searchTerm, mode: "insensitive" } } },
      ];
    }

    const links = await this.prisma.friendSourceLink.findMany({
      where,
      include: { store: true, lineOa: true, _count: { select: { clicks: true } } },
      orderBy: [{ store: { name: "asc" } }, { source: "asc" }],
    });

    const sessions = await this.prisma.friendAttributionSession.findMany({
      where: {
        friendSourceLinkId: { in: links.map((l) => l.id) },
      },
      select: {
        friendSourceLinkId: true,
        attributionStatus: true,
        identifiedAt: true,
        friendshipBefore: true,
        confirmedFollowAt: true,
      },
    });

    const linkMetricsMap = new Map<string, { identifiedVisits: number; alreadyFriends: number; promptedAdds: number; confirmedAdds: number }>();
    for (const s of sessions) {
      let m = linkMetricsMap.get(s.friendSourceLinkId);
      if (!m) {
        m = { identifiedVisits: 0, alreadyFriends: 0, promptedAdds: 0, confirmedAdds: 0 };
        linkMetricsMap.set(s.friendSourceLinkId, m);
      }
      if (s.identifiedAt || s.attributionStatus !== "CLICKED") m.identifiedVisits++;
      if (s.attributionStatus === "ALREADY_FRIEND" || s.friendshipBefore === true) m.alreadyFriends++;
      if (s.attributionStatus === "ADD_FRIEND_PROMPTED") m.promptedAdds++;
      if (s.attributionStatus === "CONFIRMED" || s.confirmedFollowAt !== null) m.confirmedAdds++;
    }

    return links.map((link) => {
      const m = linkMetricsMap.get(link.id) || { identifiedVisits: 0, alreadyFriends: 0, promptedAdds: 0, confirmedAdds: 0 };
      const clicks = link._count?.clicks ?? 0;
      const conversionRate = clicks > 0 ? Number((m.confirmedAdds / clicks).toFixed(4)) : 0;
      return {
        ...this.formatLinkResponse(link),
        identifiedVisits: m.identifiedVisits,
        alreadyFriends: m.alreadyFriends,
        promptedAdds: m.promptedAdds,
        confirmedAdds: m.confirmedAdds,
        conversionRate,
      };
    });
  }

  async updateLink(id: string, dto: UpdateFriendSourceLinkDto) {
    if (dto.destinationUrl !== undefined) {
      try {
        const parsed = new URL(dto.destinationUrl);
        if (parsed.protocol !== "https:") {
          throw new BadRequestException("destinationUrl must be a valid HTTPS URL");
        }
      } catch {
        throw new BadRequestException("destinationUrl must be a valid HTTPS URL");
      }
    }

    const existing = await this.prisma.friendSourceLink.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`FriendSourceLink with ID '${id}' not found`);
    }

    const data: Prisma.FriendSourceLinkUpdateInput = {};
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.destinationUrl !== undefined) data.destinationUrl = dto.destinationUrl;

    const updated = await this.prisma.friendSourceLink.update({
      where: { id },
      data,
      include: { store: true, lineOa: true, _count: { select: { clicks: true } } },
    });

    return this.formatLinkResponse(updated);
  }

  async getSummary() {
    const links = await this.prisma.friendSourceLink.findMany({
      include: {
        store: true,
        _count: { select: { clicks: true } },
      },
      orderBy: [{ store: { name: "asc" } }, { source: "asc" }],
    });

    const sessions = await this.prisma.friendAttributionSession.findMany({
      select: {
        friendSourceLinkId: true,
        attributionStatus: true,
        identifiedAt: true,
        friendshipBefore: true,
        confirmedFollowAt: true,
      },
    });

    const linkMetricsMap = new Map<string, { identifiedVisits: number; alreadyFriends: number; promptedAdds: number; confirmedAdds: number }>();
    for (const s of sessions) {
      let m = linkMetricsMap.get(s.friendSourceLinkId);
      if (!m) {
        m = { identifiedVisits: 0, alreadyFriends: 0, promptedAdds: 0, confirmedAdds: 0 };
        linkMetricsMap.set(s.friendSourceLinkId, m);
      }
      if (s.identifiedAt || s.attributionStatus !== "CLICKED") m.identifiedVisits++;
      if (s.attributionStatus === "ALREADY_FRIEND" || s.friendshipBefore === true) m.alreadyFriends++;
      if (s.attributionStatus === "ADD_FRIEND_PROMPTED") m.promptedAdds++;
      if (s.attributionStatus === "CONFIRMED" || s.confirmedFollowAt !== null) m.confirmedAdds++;
    }

    const summaryMap = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        storeCode: string | null;
        source: FriendSource;
        totalLinks: number;
        activeLinks: number;
        clicks: number;
        identifiedVisits: number;
        alreadyFriends: number;
        promptedAdds: number;
        confirmedAdds: number;
        conversionRate: number;
      }
    >();

    for (const link of links) {
      const key = `${link.storeId}:${link.source}`;
      let item = summaryMap.get(key);
      if (!item) {
        item = {
          storeId: link.storeId,
          storeName: link.store?.name || link.storeId,
          storeCode: link.store?.code || null,
          source: link.source,
          totalLinks: 0,
          activeLinks: 0,
          clicks: 0,
          identifiedVisits: 0,
          alreadyFriends: 0,
          promptedAdds: 0,
          confirmedAdds: 0,
          conversionRate: 0,
        };
        summaryMap.set(key, item);
      }
      item.totalLinks++;
      if (link.isActive) item.activeLinks++;

      const m = linkMetricsMap.get(link.id) || { identifiedVisits: 0, alreadyFriends: 0, promptedAdds: 0, confirmedAdds: 0 };
      item.clicks += link._count.clicks;
      item.identifiedVisits += m.identifiedVisits;
      item.alreadyFriends += m.alreadyFriends;
      item.promptedAdds += m.promptedAdds;
      item.confirmedAdds += m.confirmedAdds;
    }

    return Array.from(summaryMap.values()).map((item) => ({
      ...item,
      conversionRate: item.clicks > 0 ? Number((item.confirmedAdds / item.clicks).toFixed(4)) : 0,
    }));
  }

  async handleRedirect(shortCode: string, referrer?: string, userAgent?: string, clientIp?: string): Promise<string> {
    if (!shortCode || shortCode.length < 7 || shortCode.length > 10 || !/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
      throw new NotFoundException("Short code not found");
    }

    const link = await this.prisma.friendSourceLink.findUnique({
      where: { shortCode },
    });

    if (!link) {
      throw new NotFoundException("Short code not found");
    }

    if (!link.isActive) {
      throw new GoneException("Link is inactive");
    }

    const trackingSessionId = `tr_${randomBytes(16).toString("hex")}`;

    let ipHash: string | null = null;
    const secret = getFriendSourceIpHashKey();
    if (clientIp && clientIp.trim() && secret) {
      ipHash = createHmac("sha256", secret).update(clientIp.trim()).digest("hex");
    }

    await this.prisma.friendSourceClick.create({
      data: {
        friendSourceLinkId: link.id,
        trackingSessionId,
        referrer: referrer || null,
        userAgent: userAgent || null,
        ipHash,
      },
    });

    let isAttributionEnabled = false;
    let configuredLiffId: string | null = null;

    const dbConfig = await this.prisma.friendAttributionConfig?.findUnique({
      where: { lineOaId: link.lineOaId },
    });

    if (dbConfig) {
      isAttributionEnabled = dbConfig.isEnabled;
      configuredLiffId = dbConfig.liffId;
    } else {
      const pilotOaId = getFriendAttributionPilotLineOaId();
      if (pilotOaId && (link.lineOaId === pilotOaId || pilotOaId === "*")) {
        isAttributionEnabled = true;
        configuredLiffId = process.env.FRIEND_ATTRIBUTION_LIFF_ID || null;
      }
    }

    if (isAttributionEnabled) {
      const rawSessionToken = `sat_${randomBytes(24).toString("hex")}`;
      const hashSecret = getFriendAttributionHashSecret();
      const publicSessionTokenHash = hashPublicSessionToken(rawSessionToken, hashSecret);
      const ttlSeconds = getFriendAttributionSessionTtlSeconds();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await this.prisma.friendAttributionSession.create({
        data: {
          publicSessionTokenHash,
          friendSourceLinkId: link.id,
          lineOaId: link.lineOaId,
          source: link.source,
          clickedAt: new Date(),
          expiresAt,
          attributionStatus: "CLICKED",
        },
      });

      let liffBaseUrl = getFriendAttributionLiffBaseUrl();
      if (!liffBaseUrl && configuredLiffId) {
        liffBaseUrl = `https://liff.line.me/${configuredLiffId}`;
      }
      if (!liffBaseUrl) {
        liffBaseUrl = "https://frontend-production-e5c6.up.railway.app/friend-attribution";
      }

      const targetUrl = new URL(liffBaseUrl);
      targetUrl.searchParams.set("token", rawSessionToken);
      return targetUrl.toString();
    }

    const targetUrl = new URL(link.destinationUrl);
    targetUrl.searchParams.set("friend_tracking_id", trackingSessionId);
    return targetUrl.toString();
  }

  async identifySession(dto: IdentifyFriendAttributionDto) {
    if (!dto.consentGiven) {
      throw new BadRequestException("Explicit user consent is required before linking LINE account");
    }

    if (!dto.sessionToken || !dto.sessionToken.trim()) {
      throw new BadRequestException("sessionToken is required");
    }

    const hashSecret = getFriendAttributionHashSecret();
    const tokenHash = hashPublicSessionToken(dto.sessionToken, hashSecret);

    const session = await this.prisma.friendAttributionSession.findUnique({
      where: { publicSessionTokenHash: tokenHash },
    });

    if (!session) {
      throw new NotFoundException("Attribution session not found or invalid");
    }

    if (session.attributionStatus === "EXPIRED" || session.expiresAt <= new Date()) {
      if (session.attributionStatus !== "EXPIRED") {
        await this.prisma.friendAttributionSession.update({
          where: { id: session.id },
          data: { attributionStatus: "EXPIRED" },
        });
      }
      throw new GoneException("Attribution session has expired");
    }

    if (session.attributionStatus === "FAILED") {
      throw new BadRequestException("Attribution session is in a failed state");
    }

    let verifiedLineUserId: string | null = null;
    let channelId: string | null = null;

    const dbConfig = await this.prisma.friendAttributionConfig?.findUnique({
      where: { lineOaId: session.lineOaId },
    });

    if (dbConfig) {
      if (!dbConfig.isEnabled) {
        throw new UnauthorizedException("Friend attribution is disabled for this LINE OA");
      }
      channelId = dbConfig.lineLoginChannelId;
    } else {
      const pilotOaId = getFriendAttributionPilotLineOaId();
      if (!pilotOaId || pilotOaId === "*" || session.lineOaId === pilotOaId) {
        channelId = getFriendAttributionLineLoginChannelId();
      }
    }

    if (!channelId) {
      throw new UnauthorizedException("No attribution configuration found for this LINE OA");
    }

    if (dto.idToken && dto.idToken.trim()) {
      try {
        const body = new URLSearchParams();
        body.append("id_token", dto.idToken.trim());
        if (channelId) body.append("client_id", channelId);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const verifyRes = await globalThis.fetch("https://api.line.me/oauth2/v2.1/verify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!verifyRes.ok) {
          throw new UnauthorizedException(`LINE ID token verification failed with status ${verifyRes.status}`);
        }

        const data = (await verifyRes.json()) as { sub?: string; aud?: string; iss?: string; exp?: number };
        if (!data.sub) {
          throw new UnauthorizedException("LINE ID token did not return a valid user identity (sub)");
        }
        if (channelId && data.aud && data.aud !== channelId) {
          throw new UnauthorizedException(`LINE ID token audience '${data.aud}' does not match configured channel '${channelId}'`);
        }
        if (data.iss && data.iss !== "https://access.line.me") {
          throw new UnauthorizedException(`LINE ID token issuer '${data.iss}' is invalid`);
        }
        if (data.exp && data.exp * 1000 <= Date.now()) {
          throw new UnauthorizedException("LINE ID token has expired");
        }
        verifiedLineUserId = data.sub;
      } catch (err: unknown) {
        if (err instanceof UnauthorizedException || err instanceof BadRequestException) throw err;
        throw new UnauthorizedException("Failed to verify LINE ID token: " + (err instanceof Error ? err.message : "Network error"));
      }
    } else if (dto.accessToken && dto.accessToken.trim()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const verifyRes = await globalThis.fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(dto.accessToken.trim())}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!verifyRes.ok) {
          throw new UnauthorizedException("LINE access token verification failed");
        }
        const verifyData = (await verifyRes.json()) as { client_id?: string };
        if (channelId && verifyData.client_id && verifyData.client_id !== channelId) {
          throw new UnauthorizedException(`LINE access token client_id '${verifyData.client_id}' does not match configured channel '${channelId}'`);
        }

        const profileRes = await globalThis.fetch("https://api.line.me/v2/profile", {
          headers: { Authorization: `Bearer ${dto.accessToken.trim()}` },
        });
        if (!profileRes.ok) {
          throw new UnauthorizedException("Failed to fetch LINE profile");
        }
        const profileData = (await profileRes.json()) as { userId?: string };
        if (!profileData.userId) {
          throw new UnauthorizedException("LINE profile did not return a valid userId");
        }
        verifiedLineUserId = profileData.userId;
      } catch (err: unknown) {
        if (err instanceof UnauthorizedException || err instanceof BadRequestException) throw err;
        throw new UnauthorizedException("Failed to verify LINE access token");
      }
    } else {
      throw new BadRequestException("LINE ID token or access token is required");
    }

    const lineUserIdHash = hashLineUserId(verifiedLineUserId, hashSecret);

    // Reconcile any early follow event that occurred before identifySession was called
    const unmatchedFollow = await this.prisma.friendAttributionUnmatchedFollow.findFirst({
      where: {
        lineOaId: session.lineOaId,
        lineUserIdHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { receivedAt: "desc" },
    });

    const isConfirmedByEarlyFollow = Boolean(unmatchedFollow);
    const nextStatus: FriendAttributionSessionStatus = session.attributionStatus === "CONFIRMED"
      ? "CONFIRMED"
      : isConfirmedByEarlyFollow
      ? "CONFIRMED"
      : "IDENTIFIED";

    const confirmedFollowAt = session.confirmedFollowAt || (unmatchedFollow ? unmatchedFollow.receivedAt : null);

    const updated = await this.prisma.friendAttributionSession.update({
      where: { id: session.id },
      data: {
        lineUserIdHash,
        identifiedAt: session.identifiedAt || new Date(),
        attributionStatus: nextStatus,
        confirmedFollowAt,
        friendshipAfter: isConfirmedByEarlyFollow ? true : session.friendshipAfter,
      },
    });

    if (unmatchedFollow) {
      await this.prisma.friendAttributionUnmatchedFollow.update({
        where: { id: unmatchedFollow.id },
        data: { consumedAt: new Date() },
      });

      await this.prisma.friendSourceAttribution.create({
        data: {
          friendSourceLinkId: session.friendSourceLinkId,
          lineUserIdHash,
          followedAt: unmatchedFollow.receivedAt,
          status: "CONFIRMED",
        },
      });
    }

    return {
      status: updated.attributionStatus,
      expiresAt: updated.expiresAt,
      fallbackUrl: await this.resolveFallbackUrl(session.lineOaId),
    };
  }

  async updateFriendshipStatus(dto: UpdateFriendshipStatusDto) {
    if (!dto.sessionToken || !dto.sessionToken.trim()) {
      throw new BadRequestException("sessionToken is required");
    }

    const hashSecret = getFriendAttributionHashSecret();
    const tokenHash = hashPublicSessionToken(dto.sessionToken, hashSecret);

    const session = await this.prisma.friendAttributionSession.findUnique({
      where: { publicSessionTokenHash: tokenHash },
    });

    if (!session) {
      throw new NotFoundException("Attribution session not found or invalid");
    }

    if (session.attributionStatus === "EXPIRED" || session.expiresAt <= new Date()) {
      if (session.attributionStatus !== "EXPIRED") {
        await this.prisma.friendAttributionSession.update({
          where: { id: session.id },
          data: { attributionStatus: "EXPIRED" },
        });
      }
      throw new GoneException("Attribution session has expired");
    }

    if (session.attributionStatus === "FAILED") {
      throw new BadRequestException("Attribution session is in a failed state");
    }

    // State Transition Guard: CONFIRMED sessions can NEVER revert to an earlier status!
    const nextStatus: FriendAttributionSessionStatus = session.attributionStatus === "CONFIRMED"
      ? "CONFIRMED"
      : dto.isFriend
      ? "ALREADY_FRIEND"
      : "ADD_FRIEND_PROMPTED";

    const nextAction = dto.isFriend ? "ALREADY_FRIEND" : "REQUEST_FRIENDSHIP";

    const updated = await this.prisma.friendAttributionSession.update({
      where: { id: session.id },
      data: {
        friendshipBefore: session.friendshipBefore ?? dto.isFriend,
        friendshipAfter: dto.isFriend,
        attributionStatus: nextStatus,
      },
    });

    return {
      action: nextAction,
      status: updated.attributionStatus,
      expiresAt: updated.expiresAt,
      fallbackUrl: await this.resolveFallbackUrl(session.lineOaId),
    };
  }

  async cleanupExpiredUnmatchedFollows(): Promise<number> {
    const result = await this.prisma.friendAttributionUnmatchedFollow.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          { consumedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  async getSessionStatus(sessionToken: string) {
    if (!sessionToken || !sessionToken.trim()) {
      throw new BadRequestException("sessionToken is required");
    }

    const hashSecret = getFriendAttributionHashSecret();
    const tokenHash = hashPublicSessionToken(sessionToken, hashSecret);

    const session = await this.prisma.friendAttributionSession.findUnique({
      where: { publicSessionTokenHash: tokenHash },
    });

    if (!session) {
      throw new NotFoundException("Attribution session not found");
    }

    if (session.expiresAt <= new Date()) {
      if (session.attributionStatus !== "EXPIRED") {
        await this.prisma.friendAttributionSession.update({
          where: { id: session.id },
          data: { attributionStatus: "EXPIRED" },
        });
      }
      return {
        status: "EXPIRED" as const,
        confirmed: false,
        confirmedFollowAt: null,
        expiresAt: session.expiresAt,
        fallbackUrl: await this.resolveFallbackUrl(session.lineOaId),
      };
    }

    return {
      status: session.attributionStatus,
      confirmed: session.attributionStatus === "CONFIRMED" && Boolean(session.confirmedFollowAt),
      confirmedFollowAt: session.confirmedFollowAt,
      expiresAt: session.expiresAt,
      fallbackUrl: await this.resolveFallbackUrl(session.lineOaId),
    };
  }

  private async resolveFallbackUrl(lineOaId: string): Promise<string> {
    try {
      const oa = await this.prisma.lineOfficialAccount?.findUnique({
        where: { id: lineOaId },
        select: { basicId: true },
      });

      const rawId = oa?.basicId || process.env.NEXT_PUBLIC_FRIEND_ATTRIBUTION_FALLBACK_BASIC_ID || "@oppo_thailand";
      const clean = rawId.trim();
      const normalized = clean.startsWith("@") ? clean : `@${clean}`;
      return `https://line.me/R/ti/p/${encodeURIComponent(normalized)}`;
    } catch {
      return "https://line.me/R/ti/p/@oppo_thailand";
    }
  }

  async getAttributionConfigs() {
    const oas = await this.prisma.lineOfficialAccount.findMany({
      select: {
        id: true,
        name: true,
        basicId: true,
        isActive: true,
        store: { select: { name: true, code: true } },
        friendAttributionConfig: true,
      },
      orderBy: { name: "asc" },
    });

    return oas.map((oa) => ({
      lineOaId: oa.id,
      lineOaName: oa.name,
      basicId: oa.basicId,
      storeName: oa.store?.name || null,
      storeCode: oa.store?.code || null,
      lineLoginChannelId: oa.friendAttributionConfig?.lineLoginChannelId || null,
      liffId: oa.friendAttributionConfig?.liffId || null,
      isEnabled: oa.friendAttributionConfig?.isEnabled ?? false,
      isConfigured: Boolean(oa.friendAttributionConfig),
      updatedAt: oa.friendAttributionConfig?.updatedAt || null,
    }));
  }

  async upsertAttributionConfig(lineOaId: string, dto: UpsertFriendAttributionConfigDto) {
    const targetOaId = (dto.lineOaId || lineOaId).trim();
    const oa = await this.prisma.lineOfficialAccount.findUnique({
      where: { id: targetOaId },
    });

    if (!oa) {
      throw new NotFoundException(`LINE OA with ID '${targetOaId}' not found`);
    }

    const updated = await this.prisma.friendAttributionConfig.upsert({
      where: { lineOaId: targetOaId },
      create: {
        lineOaId: targetOaId,
        lineLoginChannelId: dto.lineLoginChannelId.trim(),
        liffId: dto.liffId.trim(),
        isEnabled: dto.isEnabled,
      },
      update: {
        lineLoginChannelId: dto.lineLoginChannelId.trim(),
        liffId: dto.liffId.trim(),
        isEnabled: dto.isEnabled,
      },
    });

    return {
      id: updated.id,
      lineOaId: updated.lineOaId,
      lineLoginChannelId: updated.lineLoginChannelId,
      liffId: updated.liffId,
      isEnabled: updated.isEnabled,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteAttributionConfig(lineOaId: string) {
    try {
      await this.prisma.friendAttributionConfig.delete({
        where: { lineOaId },
      });
      return { success: true, lineOaId };
    } catch {
      throw new NotFoundException(`Attribution configuration for LINE OA '${lineOaId}' not found`);
    }
  }

  async backfillLegacyPilotAttributionConfig(): Promise<boolean> {
    const pilotOaId = getFriendAttributionPilotLineOaId();
    const channelId = getFriendAttributionLineLoginChannelId();
    const liffId = process.env.FRIEND_ATTRIBUTION_LIFF_ID;

    if (!pilotOaId || !channelId || !liffId) return false;

    const existing = await this.prisma.friendAttributionConfig.findUnique({
      where: { lineOaId: pilotOaId },
    });

    if (!existing) {
      const oa = await this.prisma.lineOfficialAccount.findUnique({ where: { id: pilotOaId } });
      if (oa) {
        await this.prisma.friendAttributionConfig.create({
          data: {
            lineOaId: pilotOaId,
            lineLoginChannelId: channelId,
            liffId,
            isEnabled: true,
          },
        });
        return true;
      }
    }
    return false;
  }

  private formatLinkResponse(link: LinkWithRelations) {
    const baseUrl = getFriendSourcePublicBaseUrl();
    return {
      id: link.id,
      storeId: link.storeId,
      storeName: link.store?.name || null,
      storeCode: link.store?.code || null,
      lineOaId: link.lineOaId,
      lineOaName: link.lineOa?.name || null,
      source: link.source,
      shortCode: link.shortCode,
      shortUrl: `${baseUrl}/f/${link.shortCode}`,
      destinationUrl: link.destinationUrl,
      isActive: link.isActive,
      clickCount: link._count?.clicks ?? 0,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }
}
