import { normalizeSearchText } from "../store-master/store-master.utils";

export type LineChatStoreMasterIdentity = {
  accountName: string | null;
  normalizedAccountName: string | null;
  lineId: string | null;
};

export type LineChatStoreOaCandidate = {
  id: string;
  name: string;
  basicId: string | null;
};

export type LineChatStoreOaSelection =
  | { ok: true; oaId: string; source: "MASTER_LINE_ID" | "MASTER_ACCOUNT_NAME" | "ONLY_ACTIVE_OA" }
  | { ok: false; reason: "NO_ACTIVE_OA" | "MASTER_LINE_ID_AMBIGUOUS" | "MASTER_ACCOUNT_NAME_AMBIGUOUS" | "MULTIPLE_ACTIVE_OAS_NO_MASTER_MATCH" };

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function selectLineChatStoreOa(
  master: LineChatStoreMasterIdentity | null | undefined,
  candidates: readonly LineChatStoreOaCandidate[],
): LineChatStoreOaSelection {
  if (candidates.length === 0) return { ok: false, reason: "NO_ACTIVE_OA" };

  const masterLineId = clean(master?.lineId).toLocaleLowerCase();
  if (masterLineId) {
    const byLineId = candidates.filter(
      (candidate) => clean(candidate.basicId).toLocaleLowerCase() === masterLineId,
    );
    if (byLineId.length === 1) {
      return { ok: true, oaId: byLineId[0].id, source: "MASTER_LINE_ID" };
    }
    if (byLineId.length > 1) {
      return { ok: false, reason: "MASTER_LINE_ID_AMBIGUOUS" };
    }
  }

  const masterAccountName = clean(master?.normalizedAccountName)
    || normalizeSearchText(clean(master?.accountName));
  if (masterAccountName) {
    const byAccountName = candidates.filter(
      (candidate) => normalizeSearchText(candidate.name) === masterAccountName,
    );
    if (byAccountName.length === 1) {
      return { ok: true, oaId: byAccountName[0].id, source: "MASTER_ACCOUNT_NAME" };
    }
    if (byAccountName.length > 1) {
      return { ok: false, reason: "MASTER_ACCOUNT_NAME_AMBIGUOUS" };
    }
  }

  if (candidates.length === 1) {
    return { ok: true, oaId: candidates[0].id, source: "ONLY_ACTIVE_OA" };
  }

  return { ok: false, reason: "MULTIPLE_ACTIVE_OAS_NO_MASTER_MATCH" };
}
