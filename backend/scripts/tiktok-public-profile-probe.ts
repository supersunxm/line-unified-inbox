import { probeTikTokPublicProfile } from "../src/tiktok/tiktok-public-profile";

async function main(): Promise<void> {
  const username = process.argv[2]?.trim() || "o_centralworld";
  const result = await probeTikTokPublicProfile(username);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (result.status === "BLOCKED_OR_CHANGED") {
    process.exitCode = 2;
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "TikTok public profile probe failed";
  console.error(message);
  process.exitCode = 1;
});
