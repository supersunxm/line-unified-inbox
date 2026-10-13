import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma, StoreMasterDataQualityStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  extractTikTokUsernameFromUrl,
  isValidGoogleMapsUrl,
  isValidManagerUrl,
  isValidTikTokProfileUrl,
  hasRequiredStoreMasterCsvHeaders,
  normalizeSearchText,
  parseStoreMasterCsv,
  regionFromProvince,
  similarity,
} from "./store-master.utils";
import { syncConnectedLineOaMetadata } from "./sync-connected-line-oa";
import { getStoreGoogleMapsReadiness } from "./template-variable-resolver";
import { StoreLifecycleService } from "./store-lifecycle.service";
import {
  assertStoreMasterCsvSnapshot,
  createStoreMasterCsvSnapshot,
  fetchStoreMasterCsvSnapshot,
  type StoreMasterCsvSnapshot,
} from "./store-master-source";
import {
  assertStoreMasterChangeSetApproved,
  type StoreMasterApprovedChange,
} from "./store-master-approval";
import { acquireStoreMasterApplyLock } from "./store-master-transaction";

type MasterRecord = Prisma.StoreMasterGetPayload<Record<string, never>>;
type ParsedRows = ReturnType<typeof parseStoreMasterCsv>;
type StoreMasterDbClient = Prisma.TransactionClient | PrismaService;

function assertExpectedStoreMasterSourceHash(snapshot: StoreMasterCsvSnapshot, expectedSha256?: string): void {
  if (!expectedSha256 || !/^[a-fA-F0-9]{64}$/u.test(expectedSha256)) {
    throw new Error("--apply requires a valid --expected-sha256 fingerprint; no data was changed");
  }
  if (expectedSha256.toLocaleLowerCase() !== snapshot.sha256) {
    throw new Error("Store Master source fingerprint does not match the approved snapshot; no data was changed");
  }
}

function assertWellFormedExpectedStoreMasterHash(expectedSha256?: string): void {
  if (!expectedSha256 || !/^[a-fA-F0-9]{64}$/u.test(expectedSha256)) {
    throw new Error("--apply requires a valid --expected-sha256 fingerprint; no data was changed");
  }
}

function assertExpectedStoreMasterTextHash(csv: string, expectedSha256?: string): void {
  assertWellFormedExpectedStoreMasterHash(expectedSha256);
  const actual = createHash("sha256").update(Buffer.from(csv, "utf8")).digest("hex");
  if (expectedSha256?.toLocaleLowerCase() !== actual) {
    throw new Error("Store Master source fingerprint does not match the approved snapshot; no data was changed");
  }
}

type ImportAction = {
  kind: "CREATE" | "UPDATE" | "UNCHANGED";
  row: ParsedRows[number];
  existing: MasterRecord | null;
  data: Prisma.StoreMasterUncheckedCreateInput;
};

@Injectable()
export class StoreMasterService {
  private readonly lifecycle: StoreLifecycleService;

  constructor(private readonly prisma: PrismaService, lifecycle?: StoreLifecycleService) {
    this.lifecycle = lifecycle ?? new StoreLifecycleService(prisma);
  }

  private duplicateCount(values: Array<string | null>) {
    const counts = new Map<string, number>();
    for (const raw of values) {
      const value = raw?.trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.values()]
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + count, 0);
  }

  private assertUniqueStoreIds(items: ReturnType<typeof parseStoreMasterCsv>) {
    const duplicateExternalStoreIds = this.duplicateCount(
      items.map((item) => item.externalStoreId),
    );
    if (duplicateExternalStoreIds > 0) {
      throw new Error(
        `Store ID integrity check failed: ${duplicateExternalStoreIds} duplicate Store ID row(s); no data was changed`,
      );
    }
  }

  private buildImportData(
    row: ParsedRows[number],
    existingRow: MasterRecord | null,
    source: string,
    duplicateNames: Set<string>,
  ): Prisma.StoreMasterUncheckedCreateInput {
    let storeName = row.storeName;
    let accountName = row.accountName;
    let normalizedAccountName = row.normalizedAccountName;
    const tiktokUsername = row.tiktokUsername ?? existingRow?.tiktokUsername ?? null;
    const tiktokProfileUrl = row.tiktokProfileUrl ?? existingRow?.tiktokProfileUrl ?? null;
    const googleMapsUrl = row.googleMapsUrl ?? existingRow?.googleMapsUrl ?? null;

    if (!storeName && existingRow?.storeName) storeName = existingRow.storeName;
    if (!accountName) {
      if (existingRow?.accountName) {
        accountName = existingRow.accountName;
        normalizedAccountName = existingRow.normalizedAccountName;
      } else if (storeName) {
        accountName = storeName;
        normalizedAccountName = normalizeSearchText(storeName);
      }
    }

    const incomplete = !storeName || !accountName;
    let dataQualityStatus: StoreMasterDataQualityStatus;
    if (incomplete) dataQualityStatus = "INCOMPLETE";
    else if (!row.externalStoreId) dataQualityStatus = "MISSING_STORE_ID";
    else if (!isValidManagerUrl(row.lineManagerUrl)) dataQualityStatus = "INVALID_MANAGER_URL";
    else if (duplicateNames.has(normalizedAccountName)) dataQualityStatus = "DUPLICATE_ACCOUNT_NAME";
    else dataQualityStatus = "COMPLETE";

    return {
      externalStoreId: row.externalStoreId,
      storeName,
      accountName,
      normalizedAccountName,
      lineOaLink: row.lineOaLink,
      lineId: row.lineId,
      lineManagerUrl: row.lineManagerUrl,
      tiktokUsername,
      tiktokProfileUrl,
      googleMapsUrl,
      province: row.province,
      region: row.region ?? regionFromProvince(row.province),
      source,
      sourceRowNumber: row.sourceRowNumber,
      sourceUpdatedAt: new Date(),
      dataQualityStatus,
      isActive: row.isActive,
    };
  }

  private comparableMaster(data: Prisma.StoreMasterUncheckedCreateInput) {
    const stable: Record<string, unknown> = { ...data };
    delete stable.id;
    delete stable.createdAt;
    delete stable.updatedAt;
    delete stable.sourceUpdatedAt;
    return stable;
  }

  async previewCsv(csv: string, source = "GOOGLE_SHEET", client: StoreMasterDbClient = this.prisma) {
    if (!hasRequiredStoreMasterCsvHeaders(csv)) {
      throw new Error("Store Master source is missing or duplicates required headers; no data was changed");
    }
    const parsed = parseStoreMasterCsv(csv);
    if (parsed.length === 0) throw new Error("Store Master source is empty; no data was changed");
    this.assertUniqueStoreIds(parsed);
    const existingMasters = await client.storeMaster.findMany({
      where: { source },
      orderBy: { createdAt: "asc" },
    });
    const byExternalId = new Map<string, MasterRecord[]>();
    for (const master of existingMasters) {
      if (!master.externalStoreId) continue;
      const matches = byExternalId.get(master.externalStoreId) ?? [];
      matches.push(master);
      byExternalId.set(master.externalStoreId, matches);
    }
    const duplicateNames = new Set(
      parsed
        .map((row) => row.normalizedAccountName)
        .filter((name, index, all) => name && name !== "ref" && all.indexOf(name) !== index)
    );

    const actions: ImportAction[] = [];
    const identityConflicts: Array<Record<string, unknown>> = [];
    for (const row of parsed) {
      let existing: MasterRecord | null = null;
      if (row.externalStoreId) {
        const matches = byExternalId.get(row.externalStoreId) ?? [];
        if (matches.length > 1) {
          identityConflicts.push({ externalStoreId: row.externalStoreId, reason: "MULTIPLE_EXISTING_CANONICAL_MATCHES", masterIds: matches.map(({ id }) => id) });
          continue;
        }
        existing = matches[0] ?? null;
      } else {
        const matches = existingMasters.filter((master) =>
          !master.externalStoreId && (
            (row.lineId && master.lineId === row.lineId) ||
            (row.normalizedAccountName && master.normalizedAccountName === row.normalizedAccountName)
          )
        );
        if (matches.length !== 1) {
          identityConflicts.push({ sourceRowNumber: row.sourceRowNumber, reason: matches.length > 1 ? "AMBIGUOUS_LEGACY_IDENTITY" : "UNRESOLVED_LEGACY_IDENTITY" });
          continue;
        }
        existing = matches[0];
      }
      const data = this.buildImportData(row, existing, source, duplicateNames);
      const comparableExisting = existing ? this.comparableMaster(existing) : null;
      const comparableData = this.comparableMaster(data);
      const unchanged = comparableExisting !== null && JSON.stringify(comparableExisting) === JSON.stringify(comparableData);
      actions.push({ kind: existing ? (unchanged ? "UNCHANGED" : "UPDATE") : "CREATE", row, existing, data });
    }

    const oldRowOverwriteRisks = parsed.flatMap((row) => existingMasters
      .filter((master) => master.sourceRowNumber === row.sourceRowNumber && master.externalStoreId !== row.externalStoreId)
      .map((master) => ({ sourceRowNumber: row.sourceRowNumber, incomingExternalStoreId: row.externalStoreId, existingMasterId: master.id, existingExternalStoreId: master.externalStoreId })));
    const closedActions = actions.filter(({ row }) => !row.isActive);
    const closedStoreOperationalReview = [];
    for (const action of closedActions) {
      if (!action.existing) continue;
      const stores = await client.store.findMany({
        where: { storeMasterId: action.existing.id },
        select: { id: true, code: true, name: true, isActive: true, archivedAt: true,
          lineOfficialAccounts: { where: { isActive: true, archivedAt: null }, select: { id: true } },
          _count: { select: { conversations: true } } },
      });
      const operational = stores.filter((store) => store.isActive || store.archivedAt === null || store.lineOfficialAccounts.length > 0 || store._count.conversations > 0);
      if (operational.length > 0) closedStoreOperationalReview.push({ externalStoreId: action.row.externalStoreId, masterId: action.existing.id, stores: operational });
    }

    return {
      parsed,
      actions,
      summary: {
        parsedTotalRows: parsed.length,
        activeRows: parsed.filter(({ isActive }) => isActive).length,
        closedRows: parsed.filter(({ isActive }) => !isActive).length,
        creates: actions.filter(({ kind }) => kind === "CREATE").length,
        updates: actions.filter(({ kind }) => kind === "UPDATE").length,
        unchanged: actions.filter(({ kind }) => kind === "UNCHANGED").length,
        deactivations: actions.filter(({ existing, row }) => Boolean(existing?.isActive && !row.isActive)).length,
        reopens: actions.filter(({ existing, row }) => Boolean(existing && !existing.isActive && row.isActive)).length,
        lifecycleChanges: actions.filter(({ existing, row }) => Boolean(
          row.externalStoreId && (row.isActive ? existing?.isActive === false : existing?.isActive !== false),
        )).length,
        identityConflicts: identityConflicts.length,
        duplicateStoreIds: this.duplicateCount(parsed.map(({ externalStoreId }) => externalStoreId)),
        oldRowOverwriteRisks: oldRowOverwriteRisks.length,
        closedStoreOperationalReview: closedStoreOperationalReview.length,
      },
      identityConflicts,
      oldRowOverwriteRisks,
      closedStoreOperationalReview,
      lifecycleReview: actions
        .filter(({ existing, row }) => Boolean(
          row.externalStoreId && (row.isActive ? existing?.isActive === false : existing?.isActive !== false),
        ))
        .map(({ existing, row }) => ({
          externalStoreId: row.externalStoreId,
          storeName: row.storeName,
          sourceRowNumber: row.sourceRowNumber,
          operation: row.isActive ? "REOPEN" as const : "CLOSE" as const,
          previousStoreMasterActive: existing?.isActive ?? null,
          nextStoreMasterActive: row.isActive,
        })),
    };
  }

  private async applyPreview(client: StoreMasterDbClient, preview: Awaited<ReturnType<StoreMasterService["previewCsv"]>>) {
    for (const action of preview.actions) {
      const wasActive = action.existing?.isActive;
      let storeMasterId = action.existing?.id ?? null;
      if (action.kind === "CREATE") {
        storeMasterId = (await client.storeMaster.create({ data: action.data })).id;
      } else if (action.kind === "UPDATE") {
        const updated = await client.storeMaster.updateMany({
          where: { id: action.existing?.id, externalStoreId: action.row.externalStoreId },
          data: action.data,
        });
        if (updated.count !== 1) {
          throw new Error(`Store Master identity changed during import for Store ID ${action.row.externalStoreId ?? "legacy"}; no data was changed`);
        }
      }
      if (action.row.externalStoreId && !action.row.isActive && wasActive !== false) {
        await this.lifecycle.closeStoreFromMaster(client, {
          storeMasterId,
          externalStoreId: action.row.externalStoreId,
        });
      } else if (action.row.externalStoreId && action.row.isActive && action.existing && wasActive === false) {
        await this.lifecycle.reopenStoreFromMaster(client, {
          storeMasterId,
          externalStoreId: action.row.externalStoreId,
        });
      }
    }
  }

  async importCsv(csv: string, source?: string): Promise<Awaited<ReturnType<StoreMasterService["previewCsv"]>>>;
  async importCsv(
    csv: string,
    source: string | undefined,
    options: { apply?: false; expectedSha256?: string; approvedChangeSet?: readonly StoreMasterApprovedChange[] },
  ): Promise<Awaited<ReturnType<StoreMasterService["previewCsv"]>>>;
  async importCsv(
    csv: string,
    source: string | undefined,
    options: { apply: true; expectedSha256: string; approvedChangeSet?: readonly StoreMasterApprovedChange[] },
  ): Promise<Awaited<ReturnType<StoreMasterService["validate"]>>>;
  async importCsv(
    csv: string,
    source = "GOOGLE_SHEET",
    options?: {
      apply?: boolean;
      expectedSha256?: string;
      approvedChangeSet?: readonly StoreMasterApprovedChange[];
    },
  ) {
    if (!options?.apply) {
      if (options?.expectedSha256 !== undefined || (options?.approvedChangeSet?.length ?? 0) > 0) {
        throw new Error("Source approval options require apply; no data was changed");
      }
      return this.previewCsv(csv, source);
    }
    assertExpectedStoreMasterTextHash(csv, options.expectedSha256);
    return this.applyCsv(csv, source, options.approvedChangeSet ?? []);
  }

  private async applyCsv(
    csv: string,
    source: string,
    approvedChangeSet: readonly StoreMasterApprovedChange[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await acquireStoreMasterApplyLock(tx);
      const preview = await this.previewCsv(csv, source, tx);
      if (preview.identityConflicts.length > 0) throw new Error(`Store Master identity conflicts: ${preview.identityConflicts.length}; no data was changed`);
      const lifecycleChanges: StoreMasterApprovedChange[] = preview.lifecycleReview.flatMap((change) => {
        if (!change.externalStoreId) return [];
        return [{ kind: "STORE_LIFECYCLE", storeId: change.externalStoreId, action: change.operation }];
      });
      assertStoreMasterChangeSetApproved(lifecycleChanges, approvedChangeSet);
      await this.applyPreview(tx, preview);
      const validation = await this.validate(tx);
      if (validation.duplicateExternalStoreIds > 0) {
        throw new Error(`Store Master post-import validation found ${validation.duplicateExternalStoreIds} duplicate Store ID(s); no data was changed`);
      }
      return validation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 60000 });
  }

  private async configuredSnapshot(csvPath?: string): Promise<StoreMasterCsvSnapshot> {
    if (csvPath) {
      const { readFile } = await import("node:fs/promises");
      return createStoreMasterCsvSnapshot(await readFile(csvPath), "local-file");
    }
    const configured = process.env.STORE_MASTER_GOOGLE_SHEET_URL?.trim();
    if (!configured) throw new Error("Set STORE_MASTER_GOOGLE_SHEET_URL or provide a CSV file path");
    return fetchStoreMasterCsvSnapshot(configured);
  }

  async previewFromConfiguredSource(csvPath?: string) {
    const snapshot = await this.configuredSnapshot(csvPath);
    return {
      mode: "PREVIEW" as const,
      source: { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, sha256: snapshot.sha256 },
      ...(await this.previewCsv(snapshot.csv)),
    };
  }

  async importFromConfiguredSource(
    csvPath?: string,
    options: { apply?: boolean; expectedSha256?: string; approvedChangeSet?: readonly StoreMasterApprovedChange[] } = {},
  ) {
    if (!options.apply && (options.expectedSha256 !== undefined || (options.approvedChangeSet?.length ?? 0) > 0)) {
      throw new Error("Source approval options require --apply; no data was changed");
    }
    if (options.apply) assertWellFormedExpectedStoreMasterHash(options.expectedSha256);
    const snapshot = await this.configuredSnapshot(csvPath);
    assertStoreMasterCsvSnapshot(snapshot);
    if (!hasRequiredStoreMasterCsvHeaders(snapshot.csv)) {
      throw new Error("Store Master source is missing or duplicates required headers; no data was changed");
    }
    if (parseStoreMasterCsv(snapshot.csv).length === 0) {
      throw new Error("Store Master source is empty; no data was changed");
    }
    if (!options.apply) {
      const preview = await this.previewCsv(snapshot.csv);
      return {
        mode: "PREVIEW" as const,
        source: { sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt, sha256: snapshot.sha256 },
        ...preview,
      };
    }
    assertExpectedStoreMasterSourceHash(snapshot, options.expectedSha256);
    return this.applyCsv(snapshot.csv, "GOOGLE_SHEET", options.approvedChangeSet ?? []);
  }

  async syncFromGoogleSheet(
    snapshot?: StoreMasterCsvSnapshot,
    options: {
      apply?: boolean;
      expectedSha256?: string;
      approvedChangeSet?: readonly StoreMasterApprovedChange[];
    } = {},
  ) {
    if (!options.apply && (options.expectedSha256 !== undefined || (options.approvedChangeSet?.length ?? 0) > 0)) {
      throw new Error("Source approval options require apply; no data was changed");
    }
    if (options.apply) assertWellFormedExpectedStoreMasterHash(options.expectedSha256);
    const sourceSnapshot = snapshot ?? await fetchStoreMasterCsvSnapshot();
    assertStoreMasterCsvSnapshot(sourceSnapshot);
    const csv = sourceSnapshot.csv;
    if (!hasRequiredStoreMasterCsvHeaders(csv)) {
      throw new Error("Google Sheet source is missing or duplicates required Store Master headers; no data was changed");
    }
    const parsed = parseStoreMasterCsv(csv);
    const validation = this.validationForRows(parsed);
    if (validation.total === 0)
      throw new Error("Google Sheet returned no Store Master rows; no data was changed");
    if (validation.duplicateExternalStoreIds > 0)
      throw new Error(
        `Store ID integrity check failed: ${validation.duplicateExternalStoreIds} duplicate Store ID row(s); no data was changed`
      );
    if (validation.invalidManagerUrls > 0)
      throw new Error(
        `Google Sheet validation failed: ${validation.invalidManagerUrls} invalid manager URL(s); no data was changed`
      );
    if (!options.apply) {
      const preview = await this.previewCsv(csv);
      return {
        mode: "PREVIEW" as const,
        applied: false,
        source: {
          type: "GOOGLE_SHEET",
          sheetName: process.env.STORE_MASTER_GOOGLE_SHEET_TAB?.trim() || "LINE OA",
          fetchedAt: sourceSnapshot.fetchedAt,
          rows: parsed.length,
          sha256: sourceSnapshot.sha256,
        },
        validation,
        preview: preview.summary,
        lifecycleReview: preview.lifecycleReview,
        oldRowOverwriteRisks: preview.oldRowOverwriteRisks,
        closedStoreOperationalReview: preview.closedStoreOperationalReview,
      };
    }
    assertExpectedStoreMasterSourceHash(sourceSnapshot, options.expectedSha256);
    const syncResult = await this.prisma.$transaction(async (tx) => {
      await acquireStoreMasterApplyLock(tx);
      const preview = await this.previewCsv(csv, "GOOGLE_SHEET", tx);
      if (preview.identityConflicts.length > 0) {
        throw new Error(`Store Master identity conflicts: ${preview.identityConflicts.length}; no data was changed`);
      }
      await this.applyPreview(tx, preview);
      const connectedOaPlan = await syncConnectedLineOaMetadata(tx, true);
      const lifecycleChanges: StoreMasterApprovedChange[] = preview.lifecycleReview.flatMap((change) => {
        if (!change.externalStoreId) return [];
        return [{ kind: "STORE_LIFECYCLE", storeId: change.externalStoreId, action: change.operation }];
      });
      assertStoreMasterChangeSetApproved(
        [...lifecycleChanges, ...connectedOaPlan.changeSet],
        options.approvedChangeSet ?? [],
      );
      const connectedOaSync = await syncConnectedLineOaMetadata(tx, false, connectedOaPlan.changeSet);
      if (connectedOaSync.identityConflict > 0 || connectedOaSync.storeIdConflicts > 0 || connectedOaSync.failed > 0) {
        throw new Error(
          `Connected LINE OA reconciliation blocked (identity conflicts: ${connectedOaSync.identityConflict}, Store ID conflicts: ${connectedOaSync.storeIdConflicts}, failed records: ${connectedOaSync.failed}); no data was changed`,
        );
      }
      const linkedStores = await tx.store.findMany({
        where: { archivedAt: null, isActive: true, storeMasterId: { not: null } },
        select: {
          code: true,
          name: true,
          region: true,
          area: true,
          storeMaster: { select: { externalStoreId: true, storeName: true, region: true, province: true } },
        },
      });
      const mismatchCount = linkedStores.filter((store) => {
        const master = store.storeMaster;
        if (!master?.externalStoreId) return false;
        return (
          store.code?.trim() !== master.externalStoreId.trim() ||
          store.name !== master.storeName ||
          store.region !== master.region ||
          store.area !== master.province
        );
      }).length;
      if (mismatchCount > 0) {
        throw new Error(`Post-sync Store ID verification failed for ${mismatchCount} linked store(s); no data was changed`);
      }
      const imported = await this.validate(tx);
      if (imported.duplicateExternalStoreIds > 0) {
        throw new Error(`Store Master post-sync validation found ${imported.duplicateExternalStoreIds} duplicate Store ID(s); no data was changed`);
      }
      return { preview, imported, connectedOaSync };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 120000 });
    return {
      mode: "APPLIED" as const,
      applied: true,
      source: {
        type: "GOOGLE_SHEET",
        sheetName: process.env.STORE_MASTER_GOOGLE_SHEET_TAB?.trim() || "LINE OA",
        fetchedAt: sourceSnapshot.fetchedAt,
        rows: parsed.length,
        sha256: sourceSnapshot.sha256,
      },
      validation,
      import: { validation: syncResult.imported, failed: 0 },
      preview: syncResult.preview.summary,
      oldRowOverwriteRisks: syncResult.preview.oldRowOverwriteRisks,
      closedStoreOperationalReview: syncResult.preview.closedStoreOperationalReview,
      connectedOaSync: syncResult.connectedOaSync,
    };
  }

  private validationForRows(items: ReturnType<typeof parseStoreMasterCsv>) {
    const duplicate = (values: Array<string | null>) => this.duplicateCount(values);
    const complete = items.filter(
      (item) =>
        item.storeName &&
        item.storeName !== "#REF!" &&
        item.accountName &&
        item.accountName !== "#REF!" &&
        item.externalStoreId &&
        isValidManagerUrl(item.lineManagerUrl)
    ).length;

    const mismatchedTikTok = items.filter((item) => {
      if (!item.tiktokUsername || !item.tiktokProfileUrl) return false;
      const fromUrl = extractTikTokUsernameFromUrl(item.tiktokProfileUrl);
      return fromUrl !== null && fromUrl !== item.tiktokUsername.toLocaleLowerCase();
    }).length;

    return {
      total: items.length,
      complete,
      incomplete: items.length - complete,
      missingStoreId: items.filter((item) => !item.externalStoreId).length,
      invalidManagerUrls: items.filter(
        (item) => Boolean(item.lineManagerUrl) && !isValidManagerUrl(item.lineManagerUrl)
      ).length,
      duplicateAccountNames: duplicate(items.map((item) => item.normalizedAccountName)),
      missingProvince: items.filter((item) => !item.province).length,
      missingRegion: items.filter((item) => !item.region).length,
      duplicateLineIds: duplicate(items.map((item) => item.lineId)),
      duplicateExternalStoreIds: duplicate(items.map((item) => item.externalStoreId)),
      missingTikTokUsernames: items.filter((item) => !item.tiktokUsername).length,
      duplicateTikTokUsernames: duplicate(items.map((item) => item.tiktokUsername)),
      invalidTikTokProfileUrls: items.filter(
        (item) => Boolean(item.tiktokProfileUrl) && !isValidTikTokProfileUrl(item.tiktokProfileUrl)
      ).length,
      mismatchedTikTokUsernames: mismatchedTikTok,
      invalidGoogleMapsUrls: items.filter(
        (item) => Boolean(item.googleMapsUrl) && !isValidGoogleMapsUrl(item.googleMapsUrl)
      ).length,
      missingGoogleMapsUrls: items.filter((item) => !item.googleMapsUrl).length,
    };
  }

  async search(query: string, limit = 10) {
    const q = query.trim();
    if (!q) return [];
    const normalized = normalizeSearchText(q);
    const candidates = await this.prisma.storeMaster.findMany({
      where: {
        isActive: true,
        OR: [
          { accountName: { contains: q, mode: "insensitive" } },
          { storeName: { contains: q, mode: "insensitive" } },
          { lineId: { contains: q, mode: "insensitive" } },
          { tiktokUsername: { contains: q, mode: "insensitive" } },
          { province: { contains: q, mode: "insensitive" } },
          { region: { contains: q, mode: "insensitive" } },
          { normalizedAccountName: { contains: normalized } },
        ],
      },
      include: { stores: { where: { isActive: true, archivedAt: null }, select: { id: true, name: true }, take: 1 } },
      take: 100,
    });
    if (candidates.length < limit) {
      const fuzzyPool = await this.prisma.storeMaster.findMany({
        where: { isActive: true },
        include: { stores: { where: { isActive: true, archivedAt: null }, select: { id: true, name: true }, take: 1 } },
        take: 1000,
      });
      for (const item of fuzzyPool)
        if (
          !candidates.some(({ id }) => id === item.id) &&
          similarity(normalized, item.normalizedAccountName) >= 0.52
        )
          candidates.push(item);
    }
    return candidates
      .map((item) => {
        const score =
          item.accountName.toLocaleLowerCase() === q.toLocaleLowerCase()
            ? 1
            : item.normalizedAccountName === normalized
            ? 0.98
            : item.normalizedAccountName.includes(normalized)
            ? 0.92
            : similarity(normalized, item.normalizedAccountName);
        const reason =
          score === 1
            ? "EXACT_ACCOUNT_NAME"
            : score >= 0.98
            ? "NORMALIZED_ACCOUNT_NAME"
            : score >= 0.9
            ? "PARTIAL_ACCOUNT_NAME"
            : "FUZZY_SUGGESTION";
        return {
          id: item.id,
          accountName: item.accountName,
          storeName: item.storeName,
          externalStoreId: item.externalStoreId,
          province: item.province,
          region: item.region,
          lineId: item.lineId,
          lineOaLink: item.lineOaLink,
          lineManagerUrl: isValidManagerUrl(item.lineManagerUrl) ? item.lineManagerUrl : null,
          tiktokUsername: item.tiktokUsername,
          tiktokProfileUrl: item.tiktokProfileUrl,
          googleMapsUrl: item.googleMapsUrl ?? null,
          googleMapsStatus: getStoreGoogleMapsReadiness(item.googleMapsUrl).status,
          googleMapsStatusReason: getStoreGoogleMapsReadiness(item.googleMapsUrl).reason,
          matchScore: Number(score.toFixed(3)),
          matchReason: reason,
          dataQualityStatus: item.dataQualityStatus,
          existingStore: item.stores[0] ?? null,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || a.accountName.localeCompare(b.accountName))
      .slice(0, Math.min(Math.max(limit, 1), 50));
  }

  async validate(client: StoreMasterDbClient = this.prisma) {
    const items = await client.storeMaster.findMany({ where: { isActive: true } });
    const duplicate = (values: Array<string | null>) => this.duplicateCount(values);
    const byStatus = (status: StoreMasterDataQualityStatus) =>
      items.filter((item) => item.dataQualityStatus === status).length;

    const mismatchedTikTok = items.filter((item) => {
      if (!item.tiktokUsername || !item.tiktokProfileUrl) return false;
      const fromUrl = extractTikTokUsernameFromUrl(item.tiktokProfileUrl);
      return fromUrl !== null && fromUrl !== item.tiktokUsername.toLocaleLowerCase();
    }).length;

    return {
      total: items.length,
      complete: byStatus("COMPLETE"),
      missingStoreId: items.filter((item) => !item.externalStoreId).length,
      invalidManagerUrls: items.filter(
        (item) => Boolean(item.lineManagerUrl) && !isValidManagerUrl(item.lineManagerUrl)
      ).length,
      duplicateAccountNames: duplicate(items.map((item) => item.normalizedAccountName)),
      missingProvince: items.filter((item) => !item.province).length,
      missingRegion: items.filter((item) => !item.region).length,
      duplicateLineIds: duplicate(items.map((item) => item.lineId)),
      duplicateExternalStoreIds: duplicate(items.map((item) => item.externalStoreId)),
      missingTikTokUsernames: items.filter((item) => !item.tiktokUsername).length,
      duplicateTikTokUsernames: duplicate(items.map((item) => item.tiktokUsername)),
      invalidTikTokProfileUrls: items.filter(
        (item) => Boolean(item.tiktokProfileUrl) && !isValidTikTokProfileUrl(item.tiktokProfileUrl)
      ).length,
      mismatchedTikTokUsernames: mismatchedTikTok,
      invalidGoogleMapsUrls: items.filter(
        (item) => Boolean(item.googleMapsUrl) && !isValidGoogleMapsUrl(item.googleMapsUrl)
      ).length,
      missingGoogleMapsUrls: items.filter((item) => !item.googleMapsUrl).length,
      incomplete: items.filter((item) => item.dataQualityStatus !== "COMPLETE").length,
    };
  }
}
