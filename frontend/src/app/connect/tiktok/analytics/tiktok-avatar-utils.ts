export interface TikTokAvatarSources {
  avatarUrl?: string | null;
  avatarUrl100?: string | null;
  avatarLargeUrl?: string | null;
}

export function getTikTokAvatarCandidates({
  avatarUrl,
  avatarUrl100,
  avatarLargeUrl,
}: TikTokAvatarSources): string[] {
  return [...new Set([avatarUrl, avatarUrl100, avatarLargeUrl]
    .map((value) => value?.trim() || "")
    .filter((value): value is string => value.length > 0))];
}
