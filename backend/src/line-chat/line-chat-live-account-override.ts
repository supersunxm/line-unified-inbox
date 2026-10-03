export type LiveMirrorAccountOverride = {
  profile: "A" | "B";
  managerAccountKey: string;
};

/** A NORMAL Live-only correction bound to the exact configured Store/OA identity. */
export function readLiveMirrorAccountOverride(input: {
  mode: "NORMAL" | "HISTORICAL";
  storeCode: string;
  lineOfficialAccountId: string;
  storedBasicId: string | null;
}, raw = process.env.LINE_CHAT_MIRROR_MANAGER_ACCOUNT_OVERRIDES): LiveMirrorAccountOverride | undefined {
  if (input.mode !== "NORMAL" || !raw?.trim()) return undefined;
  if (raw.length > 64_000) throw new Error("LIVE_ACCOUNT_OVERRIDE_INVALID");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("LIVE_ACCOUNT_OVERRIDE_INVALID");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("LIVE_ACCOUNT_OVERRIDE_INVALID");
  }

  const value = (parsed as Record<string, unknown>)[input.storeCode];
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("LIVE_ACCOUNT_OVERRIDE_INVALID");
  }
  const entry = value as Record<string, unknown>;
  if (
    entry.lineOfficialAccountId !== input.lineOfficialAccountId
    || entry.storedBasicId !== input.storedBasicId
    || (entry.profile !== "A" && entry.profile !== "B")
    || typeof entry.managerAccountKey !== "string"
    || !/^@[a-zA-Z0-9._-]{1,64}$/u.test(entry.managerAccountKey)
  ) {
    throw new Error("LIVE_ACCOUNT_OVERRIDE_IDENTITY_MISMATCH");
  }
  return { profile: entry.profile, managerAccountKey: entry.managerAccountKey };
}

export function liveMirrorTargetCacheKey(oaId: string, override?: LiveMirrorAccountOverride): string {
  return override ? `${oaId}:LIVE:${override.profile}:${override.managerAccountKey}` : oaId;
}
