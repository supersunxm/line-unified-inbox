import { PrismaClient } from "@prisma/client";
import { chromium, type Response } from "playwright";
import * as fs from "node:fs";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

const prisma = new PrismaClient();
const sessionService = new LineChatSessionService();
const BOT_ID_RE = /^U[a-f0-9]{32}$/i;
const BOTS_ENDPOINT = "https://chat.line.biz/api/v1/bots";
const NAME_KEYS = ["displayName", "accountName", "officialAccountName", "oaName", "name", "title"] as const;

type Candidate = { sessionKey: string; botId: string; displayName: string };
type PlanRow = Candidate & {
  lineOfficialAccountId: string;
  storeCode: string;
  oaName: string;
  action: "APPLY" | "ALREADY_MATCHED" | "SKIP_AMBIGUOUS" | "SKIP_UNMATCHED" | "SKIP_CONFLICT";
  reason: string;
};

function parseCsvArg(name: string, fallback: string[]): string[] {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3).split(",").map((v) => v.trim()).filter(Boolean);
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index >= 0) return (args[index + 1] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return fallback;
}

function applyRequested(): boolean {
  return process.argv.includes("--apply") || process.env.LINE_CHAT_FLEET_MAPPING_APPLY === "true";
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[\s\u200b\u200c\u200d\ufeff]+/gu, "")
    .replace(/[.,'"`’‘“”()\[\]{}\-_/\\|:&+]/gu, "")
    .trim();
}

function objectDisplayName(value: Record<string, unknown>): string {
  for (const key of NAME_KEYS) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim() && !BOT_ID_RE.test(candidate.trim())) {
      return candidate.replace(/\s+/g, " ").trim().slice(0, 160);
    }
  }
  return "";
}

function collectBotObjects(value: unknown, out: Candidate[], sessionKey: string, depth = 0): void {
  if (depth > 10 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectBotObjects(item, out, sessionKey, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const displayName = objectDisplayName(record);
  const ids = new Set<string>();
  for (const child of Object.values(record)) {
    if (typeof child === "string" && BOT_ID_RE.test(child.trim())) ids.add(child.trim());
  }
  for (const botId of ids) out.push({ sessionKey, botId, displayName });
  for (const child of Object.values(record)) collectBotObjects(child, out, sessionKey, depth + 1);
}

async function readBotsResponse(response: Response, sessionKey: string): Promise<Candidate[]> {
  try {
    const url = new URL(response.url());
    if (`${url.origin}${url.pathname}` !== BOTS_ENDPOINT || response.status() !== 200) return [];
    const contentType = (await response.headerValue("content-type").catch(() => null)) || "";
    if (!contentType.toLowerCase().includes("json")) return [];
    const body = await response.json();
    const result: Candidate[] = [];
    collectBotObjects(body, result, sessionKey);
    const byBot = new Map<string, Candidate>();
    for (const row of result) {
      const previous = byBot.get(row.botId);
      if (!previous || (!previous.displayName && row.displayName)) byBot.set(row.botId, row);
    }
    return [...byBot.values()];
  } catch {
    return [];
  }
}

async function discoverSessionBots(session: {
  sessionKey: string;
  profilePath: string | null;
  profileStorageKey: string | null;
}): Promise<Candidate[]> {
  const profilePath = sessionService.resolveProfilePath(session);
  if (!fs.existsSync(profilePath)) throw new Error(`Profile missing for ${session.sessionKey}`);
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  try {
    const auth = await sessionService.probeApiAuthentication(context);
    if (auth.authenticated !== "YES") throw new Error(`Authentication failed for ${session.sessionKey}: ${auth.authenticated}`);
    const page = context.pages()[0] || await context.newPage();
    let bots: Candidate[] = [];
    const tasks: Promise<void>[] = [];
    page.on("response", (response) => {
      const task = readBotsResponse(response, session.sessionKey).then((rows) => {
        if (rows.length > 0) bots = rows;
      });
      tasks.push(task);
    });
    await page.goto("https://chat.line.biz/", { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(3_000);
    await Promise.allSettled(tasks);
    if (bots.length === 0) throw new Error(`No ${BOTS_ENDPOINT} account list observed for ${session.sessionKey}`);
    return bots;
  } finally {
    await context.close().catch(() => {});
  }
}

async function main(): Promise<void> {
  const sessionKeys = parseCsvArg("sessions", ["profile-b", "account-1"]);
  const doApply = applyRequested();
  const sessions = await prisma.lineChatSession.findMany({
    where: { sessionKey: { in: sessionKeys } },
    select: { id: true, sessionKey: true, profilePath: true, profileStorageKey: true, status: true },
  });
  const accounts = await prisma.lineOfficialAccount.findMany({
    where: { accountType: "STORE", isActive: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      chatBotId: true,
      lineChatSessionId: true,
      store: { select: { code: true, name: true, storeMaster: { select: { externalStoreId: true, accountName: true } } } },
    },
  });

  const plans: PlanRow[] = [];
  for (const sessionKey of sessionKeys) {
    const session = sessions.find((item) => item.sessionKey === sessionKey);
    if (!session) throw new Error(`Missing session ${sessionKey}`);
    if (session.status !== "CONNECTED" && session.status !== "ACTIVE") throw new Error(`Session ${sessionKey} is not active (${session.status})`);
    const bots = await discoverSessionBots(session);
    for (const candidate of bots) {
      const normalizedDisplay = normalizeName(candidate.displayName);
      const matched = normalizedDisplay ? accounts.filter((account) =>
        [account.name, account.store?.storeMaster?.accountName ?? "", account.store?.name ?? ""]
          .some((name) => normalizeName(name) === normalizedDisplay)) : [];
      if (matched.length === 0) {
        plans.push({ ...candidate, lineOfficialAccountId: "", storeCode: "", oaName: "", action: "SKIP_UNMATCHED", reason: "No exact OA/store name match" });
        continue;
      }
      if (matched.length > 1) {
        plans.push({ ...candidate, lineOfficialAccountId: "", storeCode: "", oaName: "", action: "SKIP_AMBIGUOUS", reason: `Exact normalized name matches ${matched.length} records` });
        continue;
      }
      const account = matched[0];
      const storeCode = account.store?.code?.trim() || account.store?.storeMaster?.externalStoreId?.trim() || "";
      const sameBot = !account.chatBotId || account.chatBotId === candidate.botId;
      const sameSession = !account.lineChatSessionId || account.lineChatSessionId === session.id;
      if (!sameBot || !sameSession) {
        plans.push({ ...candidate, lineOfficialAccountId: account.id, storeCode, oaName: account.name, action: "SKIP_CONFLICT", reason: "Existing bot/session mapping conflicts with discovered exact mapping" });
        continue;
      }
      if (account.chatBotId === candidate.botId && account.lineChatSessionId === session.id) {
        plans.push({ ...candidate, lineOfficialAccountId: account.id, storeCode, oaName: account.name, action: "ALREADY_MATCHED", reason: "Existing mapping already matches" });
        continue;
      }
      plans.push({ ...candidate, lineOfficialAccountId: account.id, storeCode, oaName: account.name, action: "APPLY", reason: "Exact match with no conflicting existing mapping" });
    }
  }

  const targetIds = plans.filter((row) => row.action === "APPLY").map((row) => row.lineOfficialAccountId);
  const duplicateTargets = targetIds.filter((id, index) => targetIds.indexOf(id) !== index);
  if (duplicateTargets.length > 0) throw new Error(`Duplicate OA apply targets detected: ${new Set(duplicateTargets).size}`);

  let applied = 0;
  if (doApply) {
    await prisma.$transaction(async (tx) => {
      for (const row of plans.filter((item) => item.action === "APPLY")) {
        const session = sessions.find((item) => item.sessionKey === row.sessionKey)!;
        const updated = await tx.lineOfficialAccount.updateMany({
          where: {
            id: row.lineOfficialAccountId,
            AND: [
              { OR: [{ chatBotId: null }, { chatBotId: row.botId }] },
              { OR: [{ lineChatSessionId: null }, { lineChatSessionId: session.id }] },
            ],
          },
          data: { chatBotId: row.botId, lineChatSessionId: session.id },
        });
        if (updated.count !== 1) throw new Error(`Concurrent/conflicting mapping change for store ${row.storeCode || row.oaName}`);
        applied += 1;
      }
    });
  }

  const summary = plans.reduce<Record<string, number>>((acc, row) => {
    acc[row.action] = (acc[row.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({
    event: "line_chat_fleet_exact_mapping_complete",
    sessions: sessionKeys,
    mode: doApply ? "APPLY" : "DRY_RUN",
    summary,
    applied,
    mutationPerformed: doApply && applied > 0,
  }));
  for (const row of plans) console.log(JSON.stringify({ event: "line_chat_fleet_exact_mapping_row", ...row }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "line_chat_fleet_exact_mapping_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
