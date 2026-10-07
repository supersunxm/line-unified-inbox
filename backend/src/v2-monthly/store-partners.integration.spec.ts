import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { listStorePartners, PARTNER_ADMIN_SOURCE, PARTNER_SEED_SOURCE, seedStorePartners, setStorePartner } from "./store-partners.service";

// Runs against a dedicated, freshly migrated database (CI creates v2_monthly_ci). Synthetic stores only.
const databaseUrl = process.env.V2_MONTHLY_TEST_DATABASE_URL;

void test("partner mapping: one-time seed, ambiguous pairs separate, admin edits audited, never overwritten by seed", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = randomUUID().slice(0, 8);
  const make = async (index: number, name: string, storeId: string | null) => {
    const master = storeId === null ? null : await db.storeMaster.create({ data: { externalStoreId: storeId, storeName: name, accountName: name, normalizedAccountName: name.toLowerCase(), source: "test", sourceRowNumber: index, dataQualityStatus: "COMPLETE" } });
    return db.store.create({ data: { id: `${prefix}-store-${index}`, name, code: `${prefix}-${index}`, storeMasterId: master?.id ?? null } });
  };
  try {
    const stores = [
      await make(1, "OBS Synthetic One By TG 2", `${prefix}01`),
      await make(2, "OBS Synthetic Two By IT CITY", `${prefix}02`),
      await make(3, "OBS Synthetic Three By JP", `${prefix}03`),
      await make(4, "OBS Synthetic Four By JP Store", `${prefix}04`),
      await make(5, "OBS Synthetic Five By INTERCOM", `${prefix}05`),
      await make(6, "OBS Synthetic Six FL.2 By Inter Computer & IT", `${prefix}06`),
      await make(7, "Synthetic placeholder", `${prefix}07`),
      await make(8, "OBS Synthetic Eight By OPPO", null),
    ];
    const ids = stores.map((store) => store.id);

    const first = await seedStorePartners(db);
    assert.equal(first.skipped, false);
    const rows = new Map((await listStorePartners(db, ids)).map((row) => [row.storeUuid, row]));
    assert.equal(rows.get(stores[0].id)?.partner, "TG");
    assert.equal(rows.get(stores[1].id)?.partner, "IT City");
    assert.equal(rows.get(stores[2].id)?.partner, "JP");
    assert.equal(rows.get(stores[3].id)?.partner, "JP Store", "ambiguous pair seeded separately");
    assert.equal(rows.get(stores[4].id)?.partner, "INTERCOM");
    assert.equal(rows.get(stores[5].id)?.partner, "Inter Computer & IT");
    assert.equal(rows.get(stores[6].id)?.partner, null, "no suffix → no row → ไม่ระบุ partner");
    assert.equal(rows.get(stores[7].id)?.storeId, null, "no Store ID → cannot be mapped");
    assert.ok(first.unmatched >= 1);
    assert.ok(first.withoutStoreId >= 1);
    const seedChanges = await db.storePartnerMappingChange.count({ where: { source: PARTNER_SEED_SOURCE, storeId: { startsWith: prefix } } });
    assert.equal(seedChanges, 6);

    // Admin edit: recorded with actor and time; a no-op edit records nothing.
    const actor = { id: null, name: "Synthetic Admin" };
    const edit = await setStorePartner(db, `${prefix}03`, "JP Store", actor, "same company");
    assert.equal(edit.changed, true);
    const again = await setStorePartner(db, `${prefix}03`, " JP  Store ", actor);
    assert.equal(again.changed, false);
    const cleared = await setStorePartner(db, `${prefix}07`, "", actor);
    assert.equal(cleared.changed, false, "clearing an absent partner is a no-op");
    const audit = await db.storePartnerMappingChange.findMany({ where: { storeId: `${prefix}03` }, orderBy: { changedAt: "asc" } });
    assert.deepEqual(audit.map((row) => [row.source, row.previousPartner, row.partnerName, row.actorName]), [
      [PARTNER_SEED_SOURCE, null, "JP", "system (seed)"],
      [PARTNER_ADMIN_SOURCE, "JP", "JP Store", "Synthetic Admin"],
    ]);
    assert.equal(audit[1].reason, "same company");
    await assert.rejects(() => setStorePartner(db, "no-such-store-id", "TG", actor), /Unknown Store ID/);

    // The seed never runs twice and never overwrites an edit.
    const second = await seedStorePartners(db);
    assert.equal(second.skipped, true);
    assert.equal((await db.storePartnerMapping.findUnique({ where: { storeId: `${prefix}03` } }))?.partnerName, "JP Store");

    // Scope: a caller limited to one store sees only that store.
    assert.deepEqual((await listStorePartners(db, [stores[0].id])).map((row) => row.storeUuid), [stores[0].id]);
  } finally {
    await db.$disconnect();
  }
});
