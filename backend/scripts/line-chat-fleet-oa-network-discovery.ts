import { PrismaClient } from "@prisma/client";
import { chromium, type Page, type Response } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

const prisma = new PrismaClient();
const sessionService = new LineChatSessionService();
const BOT_ID_RE = /^U[a-f0-9]{32}$/i;
const SAFE_ORIGINS = new Set(["https://chat.line.biz", "https://manager.line.biz"]);
const NAME_KEYS = ["displayName", "accountName", "officialAccountName", "oaName", "name", "title"] as const;

type CandidateSource = "DOM" | "URL" | "JSON";
type Candidate = { sessionKey: string; botId: string; displayName: string; source: CandidateSource; endpoint: string };
type MatchRow = Candidate & { matchStatus: "MATCH_EXACT" | "MATCH_AMBIGUOUS" | "UNMATCHED"; storeCode: string; oaName: string };

function parseCsvArg(name: string, fallback: string[]): string[] {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3).split(",").map((v) => v.trim()).filter(Boolean);
  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index >= 0) return (args[index + 1] ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return fallback;
}

function parseOutput(): string {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith("--output="));
  if (inline) return inline.slice("--output=".length);
  const index = args.findIndex((arg) => arg === "--output");
  return index >= 0 ? args[index + 1] || "/tmp/line-chat-fleet-oa-network-discovery.csv" : "/tmp/line-chat-fleet-oa-network-discovery.csv";
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[\s\u200b\u200c\u200d\ufeff]+/gu, "")
    .replace(/[.,'"`’‘“”()\[\]{}\-_/\\|:&+]/gu, "")
    .trim();
}

function safeEndpoint(raw: string): string {
  try {
    const url = new URL(raw);
    if (!SAFE_ORIGINS.has(url.origin)) return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

function extractBotIdsFromString(value: string): string[] {
  const result = new Set<string>();
  if (BOT_ID_RE.test(value.trim())) result.add(value.trim());
  try {
    const url = new URL(value, "https://chat.line.biz");
    if (!SAFE_ORIGINS.has(url.origin)) return [...result];
    for (const segment of url.pathname.split("/").filter(Boolean)) {
      const decoded = decodeURIComponent(segment);
      if (BOT_ID_RE.test(decoded)) result.add(decoded);
    }
  } catch {}
  return [...result];
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

function collectJsonCandidates(value: unknown, sessionKey: string, endpoint: string, out: Candidate[], depth = 0): void {
  if (depth > 12 || value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonCandidates(item, sessionKey, endpoint, out, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const displayName = objectDisplayName(record);
  const localBotIds = new Set<string>();
  for (const child of Object.values(record)) {
    if (typeof child === "string") {
      for (const botId of extractBotIdsFromString(child)) localBotIds.add(botId);
    }
  }
  for (const botId of localBotIds) out.push({ sessionKey, botId, displayName, source: "JSON", endpoint });
  for (const child of Object.values(record)) collectJsonCandidates(child, sessionKey, endpoint, out, depth + 1);
}

async function collectDomCandidates(page: Page, sessionKey: string): Promise<Candidate[]> {
  const rows = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => ({
    href: (anchor as HTMLAnchorElement).href,
    text: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
  })));
  const result: Candidate[] = [];
  for (const row of rows) {
    for (const botId of extractBotIdsFromString(row.href)) {
      result.push({ sessionKey, botId, displayName: row.text, source: "DOM", endpoint: safeEndpoint(row.href) });
    }
  }
  return result;
}

async function triggerReadOnlyAccountSurface(page: Page): Promise<boolean> {
  const selectors = [
    'button[aria-haspopup="menu"]',
    'button[aria-haspopup="listbox"]',
    '[role="button"][aria-haspopup="menu"]',
    '[role="button"][aria-haspopup="listbox"]',
  ];
  for (const selector of selectors) {
    const nodes = page.locator(selector);
    const count = Math.min(await nodes.count().catch(() => 0), 20);
    for (let i = 0; i < count; i += 1) {
      const node = nodes.nth(i);
      if (!(await node.isVisible().catch(() => false))) continue;
      const meta = await node.evaluate((el) => ({
        text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
        aria: el.getAttribute("aria-label") || "",
        title: el.getAttribute("title") || "",
      })).catch(() => null);
      if (!meta) continue;
      const hint = `${meta.text} ${meta.aria} ${meta.title}`.toLowerCase();
      if (!/account|official|oa|บัญชี|สลับ/u.test(hint)) continue;
      await node.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(1_500);
      return true;
    }
  }
  return false;
}

function csv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function parseJsonResponse(response: Response, sessionKey: string): Promise<{ endpoint: string; candidates: Candidate[] } | null> {
  const endpoint = safeEndpoint(response.url());
  if (!endpoint) return null;
  const contentType = (await response.headerValue("content-type").catch(() => null)) || "";
  if (!contentType.toLowerCase().includes("json")) return null;
  const status = response.status();
  if (status < 200 || status >= 300) return null;
  try {
    const body = await response.json();
    const candidates: Candidate[] = [];
    collectJsonCandidates(body, sessionKey, endpoint, candidates);
    return { endpoint, candidates };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const sessionKeys = parseCsvArg("sessions", ["profile-b", "account-1"]);
  const output = parseOutput();
  const sessions = await prisma.lineChatSession.findMany({
    where: { sessionKey: { in: sessionKeys } },
    select: { id: true, sessionKey: true, profilePath: true, profileStorageKey: true, status: true },
  });
  const accounts = await prisma.lineOfficialAccount.findMany({
    where: { accountType: "STORE", isActive: true, archivedAt: null },
    select: { id: true, name: true, chatBotId: true, store: { select: { code: true, name: true, storeMaster: { select: { externalStoreId: true, accountName: true } } } } },
  });

  const candidates = new Map<string, Candidate>();
  const sessionResults: Record<string, unknown>[] = [];
  for (const sessionKey of sessionKeys) {
    const session = sessions.find((item) => item.sessionKey === sessionKey);
    if (!session) { sessionResults.push({ sessionKey, status: "NO_SESSION" }); continue; }
    const profilePath = sessionService.resolveProfilePath(session);
    if (!fs.existsSync(profilePath)) { sessionResults.push({ sessionKey, status: "PROFILE_MISSING" }); continue; }

    let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null = null;
    const responseTasks: Promise<void>[] = [];
    const endpoints = new Set<string>();
    let jsonResponses = 0;
    let switcherTriggered = false;
    try {
      context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      });
      const auth = await sessionService.probeApiAuthentication(context);
      if (auth.authenticated !== "YES") { sessionResults.push({ sessionKey, status: "AUTH_FAILED", authenticated: auth.authenticated }); continue; }
      const page = context.pages()[0] || await context.newPage();

      page.on("request", (request) => {
        const endpoint = safeEndpoint(request.url());
        if (endpoint) endpoints.add(endpoint);
        for (const botId of extractBotIdsFromString(request.url())) {
          const key = `${sessionKey}:${botId}`;
          if (!candidates.has(key)) candidates.set(key, { sessionKey, botId, displayName: "", source: "URL", endpoint });
        }
      });
      page.on("response", (response) => {
        const task = (async () => {
          const parsed = await parseJsonResponse(response, sessionKey);
          if (!parsed) return;
          jsonResponses += 1;
          endpoints.add(parsed.endpoint);
          for (const candidate of parsed.candidates) {
            const key = `${sessionKey}:${candidate.botId}`;
            const previous = candidates.get(key);
            if (!previous || (!previous.displayName && candidate.displayName) || previous.source !== "JSON") candidates.set(key, candidate);
          }
        })();
        responseTasks.push(task);
      });

      await page.goto("https://chat.line.biz/", { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(3_000);
      for (const candidate of await collectDomCandidates(page, sessionKey)) {
        const key = `${sessionKey}:${candidate.botId}`;
        const previous = candidates.get(key);
        if (!previous || (!previous.displayName && candidate.displayName)) candidates.set(key, candidate);
      }
      switcherTriggered = await triggerReadOnlyAccountSurface(page);
      await page.waitForTimeout(2_500);
      for (const candidate of await collectDomCandidates(page, sessionKey)) {
        const key = `${sessionKey}:${candidate.botId}`;
        const previous = candidates.get(key);
        if (!previous || (!previous.displayName && candidate.displayName)) candidates.set(key, candidate);
      }
      await Promise.allSettled(responseTasks);
      sessionResults.push({ sessionKey, status: "OK", switcherTriggered, jsonResponses, endpointCount: endpoints.size, candidateCount: [...candidates.values()].filter((c) => c.sessionKey === sessionKey).length, endpoints: [...endpoints].sort().slice(0, 40) });
    } catch (error) {
      sessionResults.push({ sessionKey, status: "ERROR", error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  const matches: MatchRow[] = [];
  for (const candidate of candidates.values()) {
    const normalizedDisplay = normalizeName(candidate.displayName);
    const matched = normalizedDisplay ? accounts.filter((account) => [account.name, account.store?.storeMaster?.accountName ?? "", account.store?.name ?? ""].some((name) => normalizeName(name) === normalizedDisplay)) : [];
    const exact = matched.length === 1 ? matched[0] : null;
    matches.push({ ...candidate, matchStatus: exact ? "MATCH_EXACT" : matched.length > 1 ? "MATCH_AMBIGUOUS" : "UNMATCHED", storeCode: exact?.store?.code?.trim() || exact?.store?.storeMaster?.externalStoreId?.trim() || "", oaName: exact?.name || "" });
  }
  matches.sort((a, b) => a.sessionKey.localeCompare(b.sessionKey) || a.displayName.localeCompare(b.displayName) || a.botId.localeCompare(b.botId));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const header: (keyof MatchRow)[] = ["sessionKey", "botId", "displayName", "source", "endpoint", "matchStatus", "storeCode", "oaName"];
  fs.writeFileSync(output, [header.map(csv).join(","), ...matches.map((row) => header.map((key) => csv(row[key])).join(","))].join("\n") + "\n", "utf8");
  const summary = matches.reduce<Record<string, number>>((acc, row) => { acc[row.matchStatus] = (acc[row.matchStatus] ?? 0) + 1; return acc; }, {});
  console.log(JSON.stringify({ event: "line_chat_fleet_oa_network_discovery_complete", sessionsRequested: sessionKeys, sessions: sessionResults, candidates: matches.length, summary, output, mutationPerformed: false }));
  for (const row of matches) console.log(JSON.stringify({ event: "line_chat_fleet_oa_network_discovery_row", ...row }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "line_chat_fleet_oa_network_discovery_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
