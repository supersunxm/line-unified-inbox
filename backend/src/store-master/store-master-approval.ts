export type StoreMasterApprovedChange =
  | { kind: "STORE_LIFECYCLE"; storeId: string; action: "CLOSE" | "REOPEN" }
  | {
      kind: "LINE_OA_REASSIGNMENT" | "CONVERSATION_REASSIGNMENT";
      lineOaId: string;
      fromStoreId: string;
      toStoreId: string;
      fromExternalStoreId: string | null;
      toExternalStoreId: string | null;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

export function parseStoreMasterApprovedChangeSet(value: unknown): StoreMasterApprovedChange[] {
  if (!Array.isArray(value)) throw new Error("Approved Store Master change set must be a JSON array");
  return value.map((item: unknown, index: number) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Approved Store Master change ${index + 1} is invalid`);
    }
    const record = item as Record<string, unknown>;
    if (record.kind === "STORE_LIFECYCLE") {
      if (
        !hasExactKeys(record, ["kind", "storeId", "action"]) ||
        !isNonEmptyString(record.storeId) ||
        (record.action !== "CLOSE" && record.action !== "REOPEN")
      ) {
        throw new Error(`Approved Store Master lifecycle change ${index + 1} is invalid`);
      }
      return { kind: record.kind, storeId: record.storeId, action: record.action };
    }
    if (record.kind === "LINE_OA_REASSIGNMENT" || record.kind === "CONVERSATION_REASSIGNMENT") {
      if (
        !hasExactKeys(record, ["kind", "lineOaId", "fromStoreId", "toStoreId", "fromExternalStoreId", "toExternalStoreId"]) ||
        !isNonEmptyString(record.lineOaId) ||
        !isNonEmptyString(record.fromStoreId) ||
        !isNonEmptyString(record.toStoreId) ||
        record.fromStoreId === record.toStoreId ||
        !(record.fromExternalStoreId === null || isNonEmptyString(record.fromExternalStoreId)) ||
        !(record.toExternalStoreId === null || isNonEmptyString(record.toExternalStoreId))
      ) {
        throw new Error(`Approved Store Master reassignment ${index + 1} is invalid`);
      }
      return {
        kind: record.kind,
        lineOaId: record.lineOaId,
        fromStoreId: record.fromStoreId,
        toStoreId: record.toStoreId,
        fromExternalStoreId: record.fromExternalStoreId,
        toExternalStoreId: record.toExternalStoreId,
      };
    }
    throw new Error(`Approved Store Master change ${index + 1} has an unsupported kind`);
  });
}

function stableChangeKey(change: StoreMasterApprovedChange): string {
  return change.kind === "STORE_LIFECYCLE"
    ? JSON.stringify([change.kind, change.storeId, change.action])
    : JSON.stringify([
        change.kind,
        change.lineOaId,
        change.fromStoreId,
        change.toStoreId,
        change.fromExternalStoreId,
        change.toExternalStoreId,
      ]);
}

export function assertStoreMasterChangeSetApproved(
  actual: readonly StoreMasterApprovedChange[],
  approved: readonly StoreMasterApprovedChange[] = [],
): void {
  const actualKeys = actual.map(stableChangeKey).sort();
  const approvedKeys = approved.map(stableChangeKey).sort();
  if (new Set(approvedKeys).size !== approvedKeys.length) {
    throw new Error("Approved Store Master change set contains duplicate entries; no data was changed");
  }
  if (actualKeys.length !== approvedKeys.length || actualKeys.some((key, index) => key !== approvedKeys[index])) {
    throw new Error(
      `Store Master changes do not match the approved change set; no data was changed. Actual change set: ${JSON.stringify(actual)}`,
    );
  }
}
