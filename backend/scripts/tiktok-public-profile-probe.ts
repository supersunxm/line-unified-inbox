import { probeTikTokPublicProfile } from "../src/tiktok/tiktok-public-profile";

async function runProbeWithRetry(username: string): Promise<Awaited<ReturnType<typeof probeTikTokPublicProfile>>> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await probeTikTokPublicProfile(username);
    } catch (error: unknown) {
      lastError = error;
      if (attempt < 2) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("TikTok public profile probe failed");
}

async function main(): Promise<void> {
  const username = process.argv[2]?.trim() || "o_centralworld";
  const result = await runProbeWithRetry(username);

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
