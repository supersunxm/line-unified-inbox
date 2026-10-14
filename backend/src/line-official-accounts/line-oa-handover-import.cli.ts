import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { LineOfficialAccountsService } from "./line-official-accounts.service";
import { parseLineOaHandoverCliArgs } from "./line-oa-handover-import-cli-args";
import {
  activateHandoverAccounts,
  applyHandoverPlan,
  buildHandoverPlan,
  findActivationTargets,
  HandoverRow,
  loadHandoverSnapshot,
  parseHandoverCsv,
  redactHandoverSecrets,
  webhookKeysetSha256,
} from "./line-oa-handover-import";

let loadedRows: readonly HandoverRow[] = [];

async function readCsv(path: string) {
  if (path !== "-") return readFile(path);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  return Buffer.concat(chunks);
}

function print(payload: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const options = parseLineOaHandoverCliArgs(process.argv.slice(2));
  const bytes = await readCsv(options.csvPath);
  const csvSha256 = createHash("sha256").update(bytes).digest("hex");
  if (options.command !== "preview" && csvSha256 !== options.expectedSha256) throw new Error("Handover CSV does not match --expected-sha256; no data was changed");
  const { rows, issues } = parseHandoverCsv(bytes.toString("utf8"), options.webhookHost);
  loadedRows = rows;

  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    if (options.command === "preview") {
      const snapshot = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return loadHandoverSnapshot(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      const plan = buildHandoverPlan(rows, issues, snapshot, options);
      print({
        event: "line_oa_handover_preview",
        applied: false,
        csv: { sha256: csvSha256, rows: rows.length + issues.length },
        existing: { lineOfficialAccounts: snapshot.oas.length, keysetSha256: webhookKeysetSha256(snapshot.oas) },
        planSha256: plan.planSha256,
        summary: plan.summary,
        optionErrors: plan.optionErrors,
        actions: plan.actions,
      });
      if (plan.summary.CONFLICT > 0 || plan.optionErrors.length > 0) process.exitCode = 2;
      return;
    }

    const encryption = new CredentialEncryptionService();
    encryption.onModuleInit();
    const service = new LineOfficialAccountsService(prisma, encryption);

    if (options.command === "apply") {
      const result = await applyHandoverPlan({ prisma, service, encryption, rows, issues, options });
      print({ event: "line_oa_handover_applied", applied: true, csvSha256, ...result });
      return;
    }

    const targets = await findActivationTargets(prisma, rows, options.selection);
    if (targets.length !== options.expectedCount) {
      throw new Error(`Found ${targets.length} disabled imported OA(s), expected ${options.expectedCount}; no data was changed`);
    }
    const outcome = await activateHandoverAccounts(service, targets);
    print({ event: "line_oa_handover_activation", csvSha256, requested: targets.length, ...outcome });
    if (outcome.failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Prisma.PrismaClientValidationError
    ? "Prisma rejected the request (details withheld)"
    : error instanceof Error ? error.message : "LINE OA handover import failed";
  process.stderr.write(`${JSON.stringify({ event: "line_oa_handover_failed", message: redactHandoverSecrets(message, loadedRows) })}\n`);
  process.exitCode = 1;
});
