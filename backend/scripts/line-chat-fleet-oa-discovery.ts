import { PrismaClient } from "@prisma/client";
import { chromium, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

const prisma = new PrismaClient();
const sessionService = new LineChatSessionService();
const BOT_ID_RE = /^U[a-f0-9]{32}$/i;

type Candidate = {
  sessionKey: string;
  botId: string;
  displayName: string;
  source: "DOM" | "NETWORK";
};

type MatchRow = Candidate & {
  matchStatus: "MATCH_EXACT" | "MATCH_AMBIGUOUS" | "UNMATCHED";
  storeCode: string;
  oaName: string;
};

function parseCsvArg(name: string, fallback: string[]): string[] {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).split(",").map((v) => v.trim()).filter(Boolean);
  const index = process.argv.slice(2).findIndex((arg) => arg === `--${name}`);
  if (index >= 0) {
    const value = process.argv.slice(2)[index + 1] ?? "";
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
}

function parseOutput(): string {
  const inline = process.argv.slice(2).find((arg) => arg.startsWith("--output="));
  if (inline) return inline.slice("--output=".length);
  const index = process.argv.slice(2).findIndex((arg) => arg === "--output");
  return index >= 0 ? process.argv.slice(2)[index + 1] || "/tmp/line-chat-fleet-oa-discovery.csv" : "/tmp/line-chat-fleet-oa-discovery.csv";
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\u200b\u200c\u200d\ufeff]+/gu, "")
    .replace(/[.,'"`’‘“”()\[\]{}\-_/\\|:&+]/gu, "")
    .trim();
}

function extractBotIdsFromUrl(raw: string): string[] {
  try {
    const url = new URL(raw, "https://chat.line.biz");
    if (url.origin !== "https://chat.line.biz") return [];
    const segments = url.pathname.split("/").filter(Boolean);
    const result = new Set<string>();
    for (let i = 0; i < segments.length; i += 1) {
      const decoded = decodeURIComponent(segments[i]);
      if (BOT_ID_RE.test(decoded)) result.add(decoded);
      if (segments[i] === "bots" && segments[i + 1]) {
        const next = decodeURIComponent(segments[i + 1]);
        if (BOT_ID_RE.test(next)) result.add(next);
      }
    }
    return [...result];
  } catch {
    return [];
  }
}

async function collectDomCandidates(page: Page, sessionKey: string): Promise<Candidate[]> {
  const raw = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => ({
    href: (anchor as HTMLAnchorElement).href,
    text: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
  })));
  const byBot = new Map<string, Candidate>();
  for (const item of raw) {
    for (const botId of extractBotIdsFromUrl(item.href)) {
      const previous = byBot.get(botId);
      if (!previous || (!previous.displayName && item.text)) {
        byBot.set(botId, { sessionKey, botId, displayName: item.text, source: "DOM" });
      }
    }
  }
  return [...byBot.values()];
}

async function tryOpenAccountSwitcher(page: Page): Promise<boolean> {
  const buttons = page.locator("button");
  const count = Math.min(await buttons.count().catch(() => 0), 80);
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if (!(await button.isVisible().catch(() => false))) continue;
    const meta = await button.evaluate((element) => ({
      text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
      aria: element.getAttribute("aria-label") || "",
      title: element.getAttribute("title") || "",
      hasPopup: element.getAttribute("aria-haspopup") || "",
    })).catch(() => null);
    if (!meta) continue;
    const hint = `${meta.text} ${meta.aria} ${meta.title}`.toLowerCase();
    const looksLikeAccountSwitcher = /official\s*account|switch\s*account|account\s*switch|บัญชี|สลับบัญชี/u.test(hint);
    if (!looksLikeAccountSwitcher && !meta.hasPopup) continue;
    await button.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

function csv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
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
    select: {
      id: true,
      name: true,
      chatBotId: true,
      store: {
        select: {
          code: true,
          name: true,
          storeMaster: { select: { externalStoreId: true, accountName: true } },
        },
      },
    },
  });

  const candidates = new Map<string, Candidate>();
  const sessionResults: Record<string, unknown>[] = [];

  for (const sessionKey of sessionKeys) {
    const session = sessions.find((item) => item.sessionKey === sessionKey);
    if (!session) {
      sessionResults.push({ sessionKey, status: "NO_SESSION" });
      continue;
    }
    const profilePath = sessionService.resolveProfilePath(session);
    if (!fs.existsSync(profilePath)) {
      sessionResults.push({ sessionKey, status: "PROFILE_MISSING", profilePath });
      continue;
    }

    const networkBotIds = new Set<string>();
    let context = null as Awaited<ReturnType<typeof chromium.launchPersistentContext>> | null;
    try {
      context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      });
      const auth = await sessionService.probeApiAuthentication(context);
      if (auth.authenticated !== "YES") {
        sessionResults.push({ sessionKey, status: "AUTH_FAILED", authenticated: auth.authenticated });
        continue;
      }

      const page = context.pages()[0] || await context.newPage();
      page.on("request", (request) => {
        for (const botId of extractBotIdsFromUrl(request.url())) networkBotIds.add(botId);
      });
      page.on("response", (response) => {
        for (const botId of extractBotIdsFromUrl(response.url())) networkBotIds.add(botId);
      });

      await page.goto("https://chat.line.biz/", { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(2_500);
      const before = await collectDomCandidates(page, sessionKey);
      const switcherOpened = await tryOpenAccountSwitcher(page);
      const after = switcherOpened ? await collectDomCandidates(page, sessionKey) : [];

      for (const candidate of [...before, ...after]) {
        const key = `${sessionKey}:${candidate.botId}`;
        const previous = candidates.get(key);
        if (!previous || (!previous.displayName && candidate.displayName)) candidates.set(key, candidate);
      }
      for (const botId of networkBotIds) {
        const key = `${sessionKey}:${botId}`;
        if (!candidates.has(key)) candidates.set(key, { sessionKey, botId, displayName: "", source: "NETWORK" });
      }

      sessionResults.push({
        sessionKey,
        status: "OK",
        switcherOpened,
        domCandidatesBefore: before.length,
        domCandidatesAfter: after.length,
        networkCandidates: networkBotIds.size,
      });
    } catch (error) {
      sessionResults.push({ sessionKey, status: "ERROR", error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  const matches: MatchRow[] = [];
  for (const candidate of candidates.values()) {
    const normalizedDisplay = normalizeName(candidate.displayName);
    const matched = normalizedDisplay
      ? accounts.filter((account) => {
          const names = [account.name, account.store?.storeMaster?.accountName ?? "", account.store?.name ?? ""];
          return names.some((name) => normalizeName(name) === normalizedDisplay);
        })
      : [];
    const exact = matched.length === 1 ? matched[0] : null;
    matches.push({
      ...candidate,
      matchStatus: exact ? "MATCH_EXACT" : matched.length > 1 ? "MATCH_AMBIGUOUS" : "UNMATCHED",
      storeCode: exact?.store?.code?.trim() || exact?.store?.storeMaster?.externalStoreId?.trim() || "",
      oaName: exact?.name || "",
    });
  }

  matches.sort((a, b) => a.sessionKey.localeCompare(b.sessionKey) || a.displayName.localeCompare(b.displayName) || a.botId.localeCompare(b.botId));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const header: (keyof MatchRow)[] = ["sessionKey", "botId", "displayName", "source", "matchStatus", "storeCode", "oaName"];
  fs.writeFileSync(output, [
    header.map(csv).join(","),
    ...matches.map((row) => header.map((key) => csv(row[key])).join(",")),
  ].join("\n") + "\n", "utf8");

  const summary = matches.reduce<Record<string, number>>((acc, row) => {
    acc[row.matchStatus] = (acc[row.matchStatus] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    event: "line_chat_fleet_oa_discovery_complete",
    sessionsRequested: sessionKeys,
    sessions: sessionResults,
    candidates: matches.length,
    summary,
    output,
    mutationPerformed: false,
  }));
  for (const row of matches) console.log(JSON.stringify({ event: "line_chat_fleet_oa_discovery_row", ...row }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: "line_chat_fleet_oa_discovery_failed", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
