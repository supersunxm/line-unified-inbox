import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getTikTokAvatarCandidates } from "../src/app/connect/tiktok/analytics/tiktok-avatar-utils.ts";

const avatarComponentSource = readFileSync(
  new URL("../src/app/connect/tiktok/analytics/tiktok-avatar.tsx", import.meta.url),
  "utf8",
);

test("TikTokAvatar candidates prefer avatarUrl, then avatarUrl100, then avatarLargeUrl", () => {
  assert.deepEqual(
    getTikTokAvatarCandidates({ avatarUrl: "primary", avatarUrl100: "medium", avatarLargeUrl: "large" }),
    ["primary", "medium", "large"],
  );
});

test("TikTokAvatar deduplicates non-empty URLs and ignores whitespace-only values", () => {
  assert.deepEqual(
    getTikTokAvatarCandidates({ avatarUrl: " primary ", avatarUrl100: "primary", avatarLargeUrl: "  " }),
    ["primary"],
  );
});

test("TikTokAvatar advances once per failed candidate and then renders the T fallback", () => {
  assert.match(avatarComponentSource, /onError=\{\(\) => setCandidateIndex\(\(index\) => Math\.min\(index \+ 1, candidates\.length\)\)\}/);
  assert.match(avatarComponentSource, /const avatarStateKey = \[displayName \?\? "", \.\.\.candidates\]\.join/);
  assert.match(avatarComponentSource, /previousAvatarStateKey !== avatarStateKey\)\s*\{\s*setPreviousAvatarStateKey\(avatarStateKey\);\s*setCandidateIndex\(0\);/s);
  assert.match(avatarComponentSource, />\s*T\s*<\/div>/s);
});

test("TikTokAvatar has explicit dimensions and safe alt text for every image candidate", () => {
  assert.match(avatarComponentSource, /alt=\{alt\}/);
  assert.match(avatarComponentSource, /width=\{80\}/);
  assert.match(avatarComponentSource, /height=\{80\}/);
  assert.match(avatarComponentSource, /unoptimized/);
  assert.match(avatarComponentSource, /h-20 w-20 shrink-0/);
});

test("TikTokAvatar returns no candidates when all avatar URLs are missing", () => {
  assert.deepEqual(getTikTokAvatarCandidates({}), []);
  assert.deepEqual(getTikTokAvatarCandidates({ avatarUrl: null, avatarUrl100: "", avatarLargeUrl: "   " }), []);
});
