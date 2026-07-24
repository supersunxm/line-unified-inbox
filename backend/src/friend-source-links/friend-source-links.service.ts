import { BadRequestException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { FriendSource, Prisma } from "@prisma/client";
import { createHmac, randomBytes } from "crypto";
import { PrismaService } from "../prisma.service";
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

    return links.map((link) => this.formatLinkResponse(link));
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

    const summaryMap = new Map<string, { storeId: string; storeName: string; storeCode: string | null; source: FriendSource; totalLinks: number; activeLinks: number; clicks: number }>();

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
        };
        summaryMap.set(key, item);
      }
      item.totalLinks++;
      if (link.isActive) item.activeLinks++;
      item.clicks += link._count.clicks;
    }

    return Array.from(summaryMap.values());
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

    const targetUrl = new URL(link.destinationUrl);
    targetUrl.searchParams.set("friend_tracking_id", trackingSessionId);
    return targetUrl.toString();
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
