import "reflect-metadata";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaService } from "../prisma.service";
import { evidenceHash } from "./nickname-source-contract";
import { NicknameSourceMappingService, type NicknameManifest } from "./nickname-source-mapping.service";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!["--since", "--file", "--sha256", "--offset", "--limit"].includes(args[i]) || !args[i + 1] || values.has(args[i])) throw new Error("INVALID_ARGUMENTS");
    values.set(args[i], args[i + 1]);
  }
  const db = new PrismaService();
  try {
    const service = new NicknameSourceMappingService(db);
    if (command === "audit" || command === "manifest") {
      const since = new Date(values.get("--since") ?? "");
      if (command === "audit") console.log(JSON.stringify((await service.audit(since)).report));
      else {
        const file = values.get("--file");
        if (!file) throw new Error("MANIFEST_FILE_REQUIRED");
        const manifest = await service.buildManifest(since);
        const body = JSON.stringify(manifest, null, 2) + "\n";
        writeFileSync(file, body, { flag: "wx", mode: 0o600 }); // immutable, no overwrite
        console.log(JSON.stringify({ rows: manifest.rowCount, oas: manifest.oaCount, stores: manifest.storeCount,
          sha256: evidenceHash(body), rowSetSha256: manifest.rowSetSha256 }));
      }
    } else if (command === "dry-run" || command === "apply") {
      const body = readFileSync(values.get("--file") ?? "", "utf8");
      const digest = evidenceHash(body);
      if (digest !== values.get("--sha256")) throw new Error("MANIFEST_FILE_HASH_MISMATCH");
      console.log(JSON.stringify(await service.processManifest(JSON.parse(body) as NicknameManifest, digest, command === "apply", Number(values.get("--offset") ?? 0), Number(values.get("--limit") ?? 25))));
    } else throw new Error("EXPECTED_AUDIT_MANIFEST_DRY_RUN_OR_APPLY");
  } finally { await db.$disconnect(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.name : "NICKNAME_SOURCE_FAILED"); process.exitCode = 1; });
