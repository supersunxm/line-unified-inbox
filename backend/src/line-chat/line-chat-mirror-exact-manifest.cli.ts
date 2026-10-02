import { readFile } from "node:fs/promises";
import { PrismaService } from "../prisma.service";
import { LineChatMirrorReconcilerService } from "./line-chat-mirror-reconciler.service";
import {
  approvedExactMirrorManifest,
  parseExactMirrorManifestCsv,
} from "./line-chat-mirror-exact-manifest";

function manifestPathArg(): string {
  const prefix = "--manifest=";
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error("EXACT_MANIFEST_PATH_REQUIRED");
  return value;
}

function applyRequested(): boolean {
  return process.argv.includes("--apply");
}

async function main(): Promise<void> {
  const bytes = await readFile(manifestPathArg());
  parseExactMirrorManifestCsv(bytes, approvedExactMirrorManifest(bytes).sha256);

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const reconciler = new LineChatMirrorReconcilerService(prisma);
    const result = await reconciler.reconcileExactManifestCsv({
      bytes,
      apply: applyRequested(),
    });
    process.stdout.write(`${JSON.stringify({ mode: applyRequested() ? "APPLY" : "DRY_RUN", ...result }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_EXACT_MANIFEST_ERROR";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
