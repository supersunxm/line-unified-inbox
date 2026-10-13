export type StoreMasterSyncCliOptions = {
  apply: boolean;
  expectedSha256?: string;
  approvedChangeSetPath?: string;
};

export type StoreMasterPreviewCliOutcome = {
  exitCode: number;
  diagnostic: {
    event: "store_master_sync_preview_blocked";
    reason: "IDENTITY_CONFLICTS";
    identityConflicts: number;
    message: string;
  } | null;
};

export function getStoreMasterPreviewCliOutcome(identityConflictCount: number): StoreMasterPreviewCliOutcome {
  if (!Number.isSafeInteger(identityConflictCount) || identityConflictCount < 0) {
    throw new Error("Invalid Store Master identity conflict count");
  }
  if (identityConflictCount === 0) return { exitCode: 0, diagnostic: null };
  return {
    exitCode: 2,
    diagnostic: {
      event: "store_master_sync_preview_blocked",
      reason: "IDENTITY_CONFLICTS",
      identityConflicts: identityConflictCount,
      message: "Identity conflicts must be resolved before Store Master can be applied; no data was changed",
    },
  };
}

export function parseStoreMasterSyncCliArgs(args: readonly string[]): StoreMasterSyncCliOptions {
  let apply = false;
  let preview = false;
  let expectedSha256: string | undefined;
  let approvedChangeSetPath: string | undefined;
  const seen = new Set<string>();

  for (const arg of args) {
    const key = arg.startsWith("--") ? arg.slice(0, arg.indexOf("=") < 0 ? undefined : arg.indexOf("=")) : arg;
    if (seen.has(key)) throw new Error(`Duplicate Store Master option: ${key}`);
    seen.add(key);
    if (arg === "--apply") apply = true;
    else if (arg === "--preview") preview = true;
    else if (arg.startsWith("--expected-sha256=")) expectedSha256 = arg.slice("--expected-sha256=".length);
    else if (arg.startsWith("--approved-change-set=")) approvedChangeSetPath = arg.slice("--approved-change-set=".length);
    else throw new Error(`Unsupported Store Master option: ${arg}`);
  }

  if (apply && preview) throw new Error("Choose either --preview or --apply");
  if (apply && !/^[a-fA-F0-9]{64}$/u.test(expectedSha256 ?? "")) {
    throw new Error("--apply requires --expected-sha256=<64 hex characters>");
  }
  if (!apply && (expectedSha256 !== undefined || approvedChangeSetPath !== undefined)) {
    throw new Error("Source approval options require --apply");
  }
  if (approvedChangeSetPath !== undefined && approvedChangeSetPath.trim().length === 0) {
    throw new Error("--approved-change-set requires a file path");
  }

  return { apply, expectedSha256, approvedChangeSetPath };
}
