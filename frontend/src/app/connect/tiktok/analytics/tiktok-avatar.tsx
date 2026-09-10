"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getTikTokAvatarCandidates } from "./tiktok-avatar-utils";

type TikTokAvatarProps = {
  avatarUrl?: string | null;
  avatarUrl100?: string | null;
  avatarLargeUrl?: string | null;
  displayName?: string | null;
  className?: string;
};

export function TikTokAvatar({
  avatarUrl,
  avatarUrl100,
  avatarLargeUrl,
  displayName,
  className = "h-20 w-20 shrink-0 rounded-3xl",
}: TikTokAvatarProps) {
  const candidates = useMemo(
    () => getTikTokAvatarCandidates({ avatarUrl, avatarUrl100, avatarLargeUrl }),
    [avatarUrl, avatarUrl100, avatarLargeUrl],
  );
  const avatarStateKey = [displayName ?? "", ...candidates].join("\u0000");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [previousAvatarStateKey, setPreviousAvatarStateKey] = useState(avatarStateKey);

  if (previousAvatarStateKey !== avatarStateKey) {
    setPreviousAvatarStateKey(avatarStateKey);
    setCandidateIndex(0);
  }

  const currentAvatarUrl = candidates[candidateIndex];
  const alt = displayName || "TikTok avatar";

  if (!currentAvatarUrl) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-white/10 text-3xl font-black`}
        aria-label={`${alt} fallback avatar`}
      >
        T
      </div>
    );
  }

  return (
    <div className={`${className} overflow-hidden`}>
      <Image
        key={currentAvatarUrl}
        src={currentAvatarUrl}
        alt={alt}
        width={80}
        height={80}
        unoptimized
        className="h-full w-full object-cover"
        onError={() => setCandidateIndex((index) => Math.min(index + 1, candidates.length))}
      />
    </div>
  );
}
