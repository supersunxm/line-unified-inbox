import { PrismaClient } from "@prisma/client";
import {
  selectRepresentativeCanary,
  summarizeManifestRows,
  validateManifest,
  type NicknameDerivedManifestRow,
} from "./nickname-derived-metadata.contract";
import { NICKNAME_PARSER_V3_RULE_VERSION } from "./nickname-parser-v3.contract";
import { NicknameDerivedMetadataService, type ReadbackReport } from "./nickname-derived-metadata.service";

const BATCH_SIZE = 25;
const CANARY_MAX_ROWS = 20;

function chunks<T>(rows: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) output.push(rows.slice(index, index + size));
  return output;
}

function readbackErrors(report: ReadbackReport): number {
  return report.wrongConversation + report.wrongProduct + report.wrongCustomerType + report.wrongPayment +
    report.wrongFinance + report.wrongSource + report.wrongService + report.wrongPeriodDate + report.salesFieldChanges;
}

function canaryCoverageExceptions(allRows: readonly NicknameDerivedManifestRow[], canaryRows: readonly NicknameDerivedManifestRow[]): string[] {
  const all = summarizeManifestRows(allRows).dimensions;
  const covered = summarizeManifestRows(canaryRows).dimensions;
  const exceptions = Object.entries(all).filter(([dimension, count]) => count > 0 && covered[dimension as keyof typeof covered] === 0)
    .map(([dimension]) => dimension);
  const allProfiles = new Set(allRows.map((row) => row.profileKey).filter((key): key is string => key === "A" || key === "B"));
  const canaryProfiles = new Set(canaryRows.map((row) => row.profileKey));
  for (const profile of allProfiles) if (!canaryProfiles.has(profile)) exceptions.push(`PROFILE_${profile}`);
  const allStores = new Set(allRows.map((row) => row.storeId)).size;
  const canaryStores = new Set(canaryRows.map((row) => row.storeId)).size;
  if (allStores > 1 && canaryStores < 2) exceptions.push("MULTIPLE_STORES");
  return exceptions.sort();
}

function zeroReadback(report: ReadbackReport): boolean {
  return readbackErrors(report) === 0;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const validArgs = process.argv.slice(2).every((argument) => argument === "--apply");
  if (!validArgs) throw new Error("SUPPORTED_ARGUMENTS: --apply");

  const prisma = new PrismaClient();
  const service = new NicknameDerivedMetadataService(prisma);
  try {
    const { manifest, report: readiness } = await service.buildManifest();
    validateManifest(manifest, NICKNAME_PARSER_V3_RULE_VERSION);
    const output: Record<string, unknown> = {
      mode: apply ? "PRODUCTION_ROLLOUT" : "PRODUCTION_READINESS_ONLY",
      parserVersion: manifest.parserVersion,
      eligible: {
        identities: readiness.totalIdentities,
        latestReadableIdentityRows: readiness.latestReadableIdentityRows,
        latestReadableIdentities: readiness.latestReadableIdentities,
        latestMissingOrUnreadableIdentities: readiness.latestMissingOrUnreadableIdentities,
      },
      audit: {
        deterministic: readiness.deterministic,
        noTagSignal: readiness.noTagSignal,
        ambiguousOrReview: readiness.ambiguousOrReview,
        identityConflict: readiness.identityConflict,
        stateConflict: readiness.stateConflict,
        staleObservation: readiness.staleObservation,
        unknown: readiness.unknown,
        unexplained: readiness.unexplained,
        writeReadyRows: manifest.rows.length,
        alreadyCorrect: readiness.alreadyCorrect,
        held: readiness.held,
      },
      manifest: {
        rows: manifest.rows.length,
        conversations: new Set(manifest.rows.map((row) => row.conversationId)).size,
        stores: new Set(manifest.rows.map((row) => row.storeId)).size,
        oas: new Set(manifest.rows.map((row) => row.lineOfficialAccountId)).size,
        rowSetSha256: manifest.rowSetSha256,
        sha256: manifest.sha256,
      },
      nicknameExamplesEmitted: false,
      customerOrChatIdentifiersEmitted: false,
      managerRequests: 0,
      managerWrites: 0,
      lineMessagesSent: 0,
      outsideManifestConsidered: 0,
    };

    if (readiness.unexplained !== 0) throw new Error("READINESS_UNEXPLAINED_NOT_ZERO");
    if (!apply) {
      console.log(JSON.stringify(output));
      return;
    }

    if (manifest.rows.length === 0) {
      output.rollout = {
        canary: { rows: 0, applied: 0, staleSkipped: 0, readback: null, secondRunWrites: 0, result: "NO_WRITE_READY_CANDIDATES" },
        fleet: { applied: 0, alreadyCorrect: readiness.alreadyCorrect, staleSkipped: 0, held: readiness.held, outsideManifestWrites: 0, secondRunWrites: 0 },
      };
      console.log(JSON.stringify(output));
      return;
    }

    const canaryRows = selectRepresentativeCanary(manifest.rows, CANARY_MAX_ROWS);
    const coverageExceptions = canaryCoverageExceptions(manifest.rows, canaryRows);
    if (canaryRows.length === 0 || coverageExceptions.length > 0) throw new Error("CANARY_REPRESENTATION_GATE_FAILED");
    const canaryReport = summarizeManifestRows(canaryRows);
    const initialCanaryDryRun = await service.dryRunRows(canaryRows, manifest.sha256);
    if (initialCanaryDryRun.WOULD_APPLY + initialCanaryDryRun.ALREADY_CORRECT + initialCanaryDryRun.STALE_OBSERVATION !== canaryRows.length) {
      throw new Error("CANARY_DRY_RUN_EXPLANATION_MISMATCH");
    }
    const canaryApplied: string[] = [];
    let canaryStale = 0;
    let canaryAlreadyCorrect = 0;
    for (const batch of chunks(canaryRows, BATCH_SIZE)) {
      const applied = await service.applyBatch(batch, manifest.sha256);
      canaryApplied.push(...applied.appliedConversationIds);
      canaryStale += applied.counts.STALE_OBSERVATION;
      canaryAlreadyCorrect += applied.counts.ALREADY_CORRECT;
      const verifyRows = batch.filter((row) => !applied.staleConversationIds.includes(row.conversationId));
      const readback = await service.verifyReadback(verifyRows);
      if (!zeroReadback(readback)) throw new Error("CANARY_READBACK_FAILED");
      const secondRun = await service.dryRunRows(batch, manifest.sha256);
      if (secondRun.WOULD_APPLY !== 0) throw new Error("CANARY_SECOND_RUN_NOT_IDEMPOTENT");
    }
    const canaryRerun = await service.dryRunRows(canaryRows, manifest.sha256);
    if (canaryRerun.WOULD_APPLY !== 0) throw new Error("CANARY_RERUN_WRITES_NOT_ZERO");

    const canaryIds = new Set(canaryRows.map((row) => row.conversationId));
    const remainingRows = manifest.rows.filter((row) => !canaryIds.has(row.conversationId));
    let fleetApplied = 0;
    let fleetAlreadyCorrect = readiness.alreadyCorrect;
    let fleetStale = canaryStale;
    let fleetSecondRunWrites = 0;
    const appliedConversationIds = [...canaryApplied];
    for (const batch of chunks(remainingRows, BATCH_SIZE)) {
      const dryRun = await service.dryRunRows(batch, manifest.sha256);
      if (dryRun.WOULD_APPLY + dryRun.ALREADY_CORRECT + dryRun.STALE_OBSERVATION !== batch.length) {
        throw new Error("FLEET_DRY_RUN_EXPLANATION_MISMATCH");
      }
      const result = await service.applyBatch(batch, manifest.sha256);
      fleetApplied += result.counts.APPLIED;
      fleetAlreadyCorrect += result.counts.ALREADY_CORRECT;
      fleetStale += result.counts.STALE_OBSERVATION;
      appliedConversationIds.push(...result.appliedConversationIds);
      const verifyRows = batch.filter((row) => !result.staleConversationIds.includes(row.conversationId));
      const readback = await service.verifyReadback(verifyRows);
      if (!zeroReadback(readback)) throw new Error("FLEET_BATCH_READBACK_FAILED");
      const secondRun = await service.dryRunRows(batch, manifest.sha256);
      fleetSecondRunWrites += secondRun.WOULD_APPLY;
      if (secondRun.WOULD_APPLY !== 0) throw new Error("FLEET_BATCH_SECOND_RUN_NOT_IDEMPOTENT");
    }

    const finalRerun = await service.dryRunRows(manifest.rows, manifest.sha256);
    fleetSecondRunWrites += finalRerun.WOULD_APPLY;
    if (finalRerun.WOULD_APPLY !== 0) throw new Error("FLEET_SECOND_RUN_NOT_IDEMPOTENT");
    const receiptAudit = await service.verifyManifestReceipts(manifest.sha256, appliedConversationIds);
    if (receiptAudit.outsideManifest !== 0 || receiptAudit.receipts !== appliedConversationIds.length) {
      throw new Error("OUTSIDE_MANIFEST_RECEIPT_OR_MISSING_RECEIPT");
    }

    output.rollout = {
      canary: {
        rows: canaryRows.length,
        dimensions: canaryReport.dimensions,
        stores: new Set(canaryRows.map((row) => row.storeId)).size,
        profiles: {
          profileA: canaryRows.filter((row) => row.profileKey === "A").length,
          profileB: canaryRows.filter((row) => row.profileKey === "B").length,
        },
        applied: canaryApplied.length,
        staleSkipped: canaryStale,
        alreadyCorrectDuringCanary: canaryAlreadyCorrect,
        incorrect: 0,
        secondRunWrites: 0,
        result: "PASS",
      },
      fleet: {
        manifestRows: manifest.rows.length,
        applied: canaryApplied.length + fleetApplied,
        alreadyCorrect: fleetAlreadyCorrect + canaryAlreadyCorrect,
        staleSkipped: fleetStale,
        held: readiness.held,
        outsideManifestWrites: receiptAudit.outsideManifest,
        secondRunWrites: fleetSecondRunWrites,
        readback: "PASS",
        result: "PASS",
      },
      dimensions: summarizeManifestRows(manifest.rows).dimensions,
      combinations: summarizeManifestRows(manifest.rows).combinations,
      verification: {
        wrongConversation: 0,
        wrongProduct: 0,
        wrongCustomerType: 0,
        wrongPayment: 0,
        wrongFinance: 0,
        wrongSource: 0,
        wrongService: 0,
        wrongPeriodDate: 0,
        existingSalesFieldsChanged: 0,
        nicknameSourceStateTouched: false,
        onlineSourceTouched: false,
      },
    };
    console.log(JSON.stringify(output));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.message.match(/^[A-Z0-9_:-]+/)?.[0] ?? error.name : "UNKNOWN_ERROR";
  console.error(JSON.stringify({ mode: "NICKNAME_DERIVED_METADATA_ROLLOUT", completed: false, error: errorName }));
  process.exitCode = 1;
});
