import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

export interface MappingRow {
  lineOfficialAccountId: string;
  chatBotId: string;
  sessionKey: string;
}

export interface ValidationSummary {
  valid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  plans: {
    lineOfficialAccountId: string;
    oaName: string;
    chatBotId: string;
    sessionKey: string;
    sessionId: string;
    currentChatBotId: string | null;
    currentSessionKey: string | null;
  }[];
}

export function parseMappingCsv(content: string): MappingRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) {
    return [];
  }

  // Parse header
  const header = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const oaIndex = header.findIndex((h) => /^lineOfficialAccountId$/i.test(h) || /^oaId$/i.test(h) || /^id$/i.test(h));
  const botIndex = header.findIndex((h) => /^chatBotId$/i.test(h) || /^botId$/i.test(h));
  const sessionIndex = header.findIndex((h) => /^sessionKey$/i.test(h) || /^session$/i.test(h) || /^profile$/i.test(h));

  if (oaIndex === -1 || botIndex === -1 || sessionIndex === -1) {
    throw new Error(
      `Invalid CSV header. Expected columns: lineOfficialAccountId, chatBotId, sessionKey. Got: ${header.join(", ")}`
    );
  }

  const rows: MappingRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 3) continue;

    const lineOfficialAccountId = cols[oaIndex];
    const chatBotId = cols[botIndex];
    const sessionKey = cols[sessionIndex];

    if (lineOfficialAccountId && chatBotId && sessionKey) {
      rows.push({ lineOfficialAccountId, chatBotId, sessionKey });
    }
  }

  return rows;
}

export async function validateAndPlanMappings(
  prisma: PrismaClient,
  rows: MappingRow[]
): Promise<ValidationSummary> {
  const errors: string[] = [];
  const plans: ValidationSummary["plans"] = [];
  const seenOas = new Set<string>();
  const seenBotIds = new Set<string>();

  // Pre-load all sessions
  const sessions = await prisma.lineChatSession.findMany();
  const sessionMap = new Map(sessions.map((s) => [s.sessionKey, s]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Accounting for 1-based index + header

    // 1. Validate OA ID format
    if (!row.lineOfficialAccountId || row.lineOfficialAccountId.trim().length === 0) {
      errors.push(`Row ${rowNum}: Invalid lineOfficialAccountId "${row.lineOfficialAccountId}"`);
      continue;
    }

    // 2. Duplicate check in CSV
    if (seenOas.has(row.lineOfficialAccountId)) {
      errors.push(`Row ${rowNum}: Duplicate lineOfficialAccountId "${row.lineOfficialAccountId}" in CSV`);
      continue;
    }
    seenOas.add(row.lineOfficialAccountId);

    // 3. Validate chatBotId format (Must be non-empty and start with U)
    if (!/^U[0-9a-zA-Z]{10,40}$/.test(row.chatBotId)) {
      errors.push(
        `Row ${rowNum}: Invalid chatBotId "${row.chatBotId}". Expected LINE OA bot ID format starting with 'U' (e.g. U092441d025f688e389d25779dd8debf4)`
      );
      continue;
    }

    if (seenBotIds.has(row.chatBotId)) {
      errors.push(`Row ${rowNum}: Duplicate chatBotId "${row.chatBotId}" assigned to multiple OAs in CSV`);
      continue;
    }
    seenBotIds.add(row.chatBotId);

    // 4. Validate session exists
    const session = sessionMap.get(row.sessionKey);
    if (!session) {
      errors.push(
        `Row ${rowNum}: LineChatSession with sessionKey "${row.sessionKey}" does not exist in database. Available sessions: ${Array.from(sessionMap.keys()).join(", ") || "(none)"}`
      );
      continue;
    }

    // 5. Validate OA exists in DB
    const oa = await prisma.lineOfficialAccount.findUnique({
      where: { id: row.lineOfficialAccountId },
      include: { lineChatSession: true },
    });

    if (!oa) {
      errors.push(`Row ${rowNum}: LineOfficialAccount "${row.lineOfficialAccountId}" not found in database.`);
      continue;
    }

    plans.push({
      lineOfficialAccountId: oa.id,
      oaName: oa.name,
      chatBotId: row.chatBotId,
      sessionKey: session.sessionKey,
      sessionId: session.id,
      currentChatBotId: oa.chatBotId,
      currentSessionKey: oa.lineChatSession?.sessionKey ?? null,
    });
  }

  return {
    valid: errors.length === 0,
    totalRows: rows.length,
    validRows: plans.length,
    invalidRows: errors.length,
    errors,
    plans,
  };
}

export async function applyMappings(
  prisma: PrismaClient,
  plans: ValidationSummary["plans"]
): Promise<{ updatedCount: number }> {
  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      await tx.lineOfficialAccount.update({
        where: { id: plan.lineOfficialAccountId },
        data: {
          chatBotId: plan.chatBotId,
          lineChatSessionId: plan.sessionId,
        },
      });
      updatedCount++;
    }
  });

  return { updatedCount };
}

export async function runMappingImportCli(args: string[]) {
  const fileArgIndex = args.findIndex((a) => a === "--file" || a === "-f");
  const filePath = fileArgIndex !== -1 ? args[fileArgIndex + 1] : undefined;
  const isApply = args.includes("--apply");

  if (!filePath) {
    console.error("Error: Missing --file argument.");
    console.error("Usage: npm run line-chat:mapping:import -- --file <path-to-csv> [--apply | --dry-run]");
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found at "${resolvedPath}"`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(resolvedPath, "utf8");
  const rows = parseMappingCsv(csvContent);

  console.log(`\n======================================================`);
  console.log(`  LINE OA NICKNAME CHAT MAPPING IMPORT`);
  console.log(`======================================================`);
  console.log(`Mode : ${isApply ? "🚀 APPLY (COMMITTING TO DATABASE)" : "🔍 DRY-RUN (VALIDATION ONLY)"}`);
  console.log(`File : ${resolvedPath}`);
  console.log(`Rows : ${rows.length}\n`);

  if (rows.length === 0) {
    console.warn("No data rows found in CSV file.");
    process.exit(0);
  }

  const prisma = new PrismaClient();

  try {
    const summary = await validateAndPlanMappings(prisma, rows);

    if (!summary.valid) {
      console.error("❌ Validation failed with errors:\n");
      for (const err of summary.errors) {
        console.error(`  - ${err}`);
      }
      console.error(`\nFound ${summary.invalidRows} error(s). No changes were made.`);
      process.exit(1);
    }

    console.log(`✅ All ${summary.validRows} rows validated successfully.\n`);
    console.log(`Planned changes:`);
    console.log(`---------------------------------------------------------------------------------------------`);
    console.log(
      `OA ID`.padEnd(38) +
      `OA Name`.padEnd(30) +
      `chatBotId`.padEnd(36) +
      `Session`
    );
    console.log(`---------------------------------------------------------------------------------------------`);

    for (const plan of summary.plans) {
      console.log(
        `${plan.lineOfficialAccountId.padEnd(38)}` +
        `${plan.oaName.slice(0, 28).padEnd(30)}` +
        `${plan.chatBotId.padEnd(36)}` +
        `${plan.sessionKey}`
      );
    }
    console.log(`---------------------------------------------------------------------------------------------\n`);

    if (!isApply) {
      console.log(`[DRY-RUN] Validation completed. Zero database modifications performed.`);
      console.log(`To apply these mappings, run with the --apply flag:`);
      console.log(`  npm run line-chat:mapping:import -- --file ${filePath} --apply\n`);
      return;
    }

    console.log(`Applying mappings to PostgreSQL database...`);
    const { updatedCount } = await applyMappings(prisma, summary.plans);
    console.log(`🎉 Successfully updated ${updatedCount} LINE Official Account mapping(s).\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("import-line-chat-mappings.ts")) {
  void runMappingImportCli(process.argv.slice(2));
}
