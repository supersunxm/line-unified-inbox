import "reflect-metadata";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaService } from "../prisma.service";
import { bridgeHash } from "./mirror-identity-contract";
import { MirrorIdentityBridgeService, type BridgeManifest } from "./mirror-identity-bridge.service";

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const value = (flag: string) => args[args.indexOf(flag)+1];
  if (!["audit","freeze","dry-run","apply"].includes(mode)) throw new Error("INVALID_BRIDGE_COMMAND");
  const db = new PrismaService();
  try {
    const service = new MirrorIdentityBridgeService(db);
    if (mode === "audit") { console.log(JSON.stringify((await service.audit()).report)); return; }
    const file = args.includes("--file") ? value("--file") : null;
    if (!file) throw new Error("BRIDGE_FILE_REQUIRED");
    if (mode === "freeze") {
      const manifest = await service.buildManifest();
      const text = JSON.stringify(manifest,null,2)+"\n";
      writeFileSync(file,text,{flag:"wx",mode:0o600});
      console.log(JSON.stringify({ rows:manifest.rows.length,oaCount:new Set(manifest.rows.map(r=>r.lineOfficialAccountId)).size,storeCount:new Set(manifest.rows.map(r=>r.storeId)).size,sha256:bridgeHash(text),rowSetSha256:manifest.rowSetSha256 })); return;
    }
    const text = readFileSync(file,"utf8");
    if (!args.includes("--sha256") || bridgeHash(text)!==value("--sha256")) throw new Error("BRIDGE_FILE_HASH_MISMATCH");
    const manifest = JSON.parse(text) as BridgeManifest;
    console.log(JSON.stringify(await service.processManifest(manifest,mode==="apply",args.includes("--offset")?Number(value("--offset")):0,args.includes("--limit")?Number(value("--limit")):25)));
  } finally { await db.$disconnect(); }
}
main().catch(()=>{console.error("MIRROR_IDENTITY_BRIDGE_COMMAND_FAILED");process.exitCode=1;});
