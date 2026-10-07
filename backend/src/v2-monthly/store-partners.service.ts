import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { normalizePartnerInput, partnerFromStoreName } from "./partner-parse";

export const PARTNER_SEED_SOURCE = "SEED";
export const PARTNER_ADMIN_SOURCE = "ADMIN";
/** Serialises seed runs across processes (pg_advisory_xact_lock key). */
const SEED_LOCK_KEY = 732_017_001;

export type PartnerActor = { id: string | null; name: string };

export type StorePartnerRow = {
  /** Store record id (internal). */
  storeUuid: string;
  /** Canonical Store ID (StoreMaster.externalStoreId); null when the store has none and cannot be mapped. */
  storeId: string | null;
  storeName: string;
  partner: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type SeedResult = { skipped: boolean; seeded: number; unmatched: number; withoutStoreId: number; partners: Record<string, number> };

type Db = PrismaService | PrismaClient;

@Injectable()
export class StorePartnersService implements OnModuleInit {
  private readonly logger = new Logger(StorePartnersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The one-time seed runs in the background after start-up; it is a no-op once it has run. */
  onModuleInit() {
    if (process.env.NODE_ENV === "test" || process.env.V2_PARTNER_SEED_DISABLED === "true") return;
    setTimeout(() => {
      void this.seedFromStoreNames().then(
        (result) => { if (!result.skipped) this.logger.log(`store_partner_seed seeded=${result.seeded} unmatched=${result.unmatched} withoutStoreId=${result.withoutStoreId}`); },
        (error: unknown) => this.logger.error(`store_partner_seed failed: ${error instanceof Error ? error.message : "unknown"}`),
      );
    }, 5_000).unref?.();
  }

  /** Active, non-archived stores in the caller's scope, with their Store ID and mapped partner. */
  async list(accessibleStoreIds: string[] | null): Promise<StorePartnerRow[]> {
    return listStorePartners(this.prisma, accessibleStoreIds);
  }

  async changes(storeId: string | null, limit = 50) {
    return this.prisma.storePartnerMappingChange.findMany({
      where: storeId ? { storeId } : undefined,
      orderBy: { changedAt: "desc" },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  async setPartner(storeId: string, partnerInput: string | null | undefined, actor: PartnerActor, reason?: string | null) {
    return setStorePartner(this.prisma, storeId, partnerInput, actor, reason);
  }

  async seedFromStoreNames(): Promise<SeedResult> {
    return seedStorePartners(this.prisma);
  }
}

export async function listStorePartners(db: Db, accessibleStoreIds: string[] | null): Promise<StorePartnerRow[]> {
  const stores = await db.store.findMany({
    where: { isActive: true, archivedAt: null, ...(accessibleStoreIds === null ? {} : { id: { in: accessibleStoreIds } }) },
    select: { id: true, name: true, storeMaster: { select: { externalStoreId: true } } },
    orderBy: { name: "asc" },
  });
  const storeIds = stores.map((store) => store.storeMaster?.externalStoreId?.trim()).filter((value): value is string => Boolean(value));
  const mappings = storeIds.length === 0 ? [] : await db.storePartnerMapping.findMany({ where: { storeId: { in: storeIds } } });
  const byStoreId = new Map(mappings.map((mapping) => [mapping.storeId, mapping]));
  return stores.map((store) => {
    const storeId = store.storeMaster?.externalStoreId?.trim() || null;
    const mapping = storeId ? byStoreId.get(storeId) : undefined;
    return {
      storeUuid: store.id,
      storeId,
      storeName: store.name,
      partner: mapping?.partnerName ?? null,
      updatedAt: mapping?.updatedAt.toISOString() ?? null,
      updatedByName: mapping?.updatedByName ?? null,
    };
  });
}

/** Admin edit: one mapping row per Store ID, and an append-only change row with actor and time. */
export async function setStorePartner(db: Db, storeIdInput: string, partnerInput: string | null | undefined, actor: PartnerActor, reason?: string | null) {
  const storeId = storeIdInput.trim();
  if (!storeId) throw new BadRequestException("Store ID is required");
  let partner: string | null;
  try {
    partner = normalizePartnerInput(partnerInput);
  } catch {
    throw new BadRequestException("Partner name must be at most 100 characters");
  }
  const store = await db.storeMaster.findFirst({ where: { externalStoreId: storeId }, select: { id: true } });
  if (!store) throw new NotFoundException("Unknown Store ID");
  return (db as PrismaClient).$transaction(async (tx) => {
    const existing = await tx.storePartnerMapping.findUnique({ where: { storeId } });
    // Same value, including clearing a store that has no partner: nothing to record.
    if ((existing?.partnerName ?? null) === partner) return { changed: false, mapping: existing };
    const mapping = await tx.storePartnerMapping.upsert({
      where: { storeId },
      create: { storeId, partnerName: partner, updatedById: actor.id, updatedByName: actor.name },
      update: { partnerName: partner, updatedById: actor.id, updatedByName: actor.name },
    });
    await tx.storePartnerMappingChange.create({
      data: { storeId, previousPartner: existing?.partnerName ?? null, partnerName: partner, source: PARTNER_ADMIN_SOURCE, actorId: actor.id, actorName: actor.name, reason: reason?.trim() || null },
    });
    return { changed: true, mapping };
  });
}

/**
 * One-time seed from the "By <partner>" store-name suffix. Runs once: when any SEED change
 * exists it does nothing. Never overwrites an existing mapping row. Stores whose name has no
 * suffix get no row (they read as "ไม่ระบุ partner"); stores without a Store ID cannot be mapped.
 */
export async function seedStorePartners(db: Db): Promise<SeedResult> {
  return (db as PrismaClient).$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SEED_LOCK_KEY})`;
    const result: SeedResult = { skipped: false, seeded: 0, unmatched: 0, withoutStoreId: 0, partners: {} };
    if ((await tx.storePartnerMappingChange.count({ where: { source: PARTNER_SEED_SOURCE } })) > 0) return { ...result, skipped: true };
    const stores = await tx.store.findMany({
      where: { isActive: true, archivedAt: null },
      select: { name: true, storeMaster: { select: { externalStoreId: true } } },
      orderBy: { name: "asc" },
    });
    const existing = new Set((await tx.storePartnerMapping.findMany({ select: { storeId: true } })).map((row) => row.storeId));
    const seen = new Set<string>();
    for (const store of stores) {
      const storeId = store.storeMaster?.externalStoreId?.trim();
      if (!storeId) { result.withoutStoreId += 1; continue; }
      if (existing.has(storeId) || seen.has(storeId)) continue;
      seen.add(storeId);
      const partner = partnerFromStoreName(store.name);
      if (!partner) { result.unmatched += 1; continue; }
      await tx.storePartnerMapping.create({ data: { storeId, partnerName: partner, updatedById: null, updatedByName: "system (seed)" } });
      await tx.storePartnerMappingChange.create({ data: { storeId, previousPartner: null, partnerName: partner, source: PARTNER_SEED_SOURCE, actorId: null, actorName: "system (seed)", reason: "seed from store name suffix \"By <partner>\"" } });
      result.seeded += 1;
      result.partners[partner] = (result.partners[partner] ?? 0) + 1;
    }
    // A run that found nothing to seed still leaves a marker, so the seed never runs twice.
    if (result.seeded === 0) {
      await tx.storePartnerMappingChange.create({ data: { storeId: "*", previousPartner: null, partnerName: null, source: PARTNER_SEED_SOURCE, actorId: null, actorName: "system (seed)", reason: "seed ran; nothing to seed" } });
    }
    return result;
  }, { timeout: 60_000 });
}
