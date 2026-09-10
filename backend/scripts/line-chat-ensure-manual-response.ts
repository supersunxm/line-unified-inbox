import { PrismaClient, LineChatSessionStatus } from "@prisma/client";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import * as fs from "node:fs";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

const prisma = new PrismaClient();
const sessionService = new LineChatSessionService();

const DEFAULT_STORES = ["25610", "27627", "25391", "24804", "27789", "3791"];
const MANAGER_ORIGIN = "https://manager.line.biz";

type Args = { storeCodes: Set<string>; apply: boolean };
type MethodState = "MANUAL_CHAT" | "MANUAL_CHAT_AUTO_RESPONSE" | "UNKNOWN";
type ResponseUrlResolution = { url: string; source: "STORED" | "DISCOVERED" };
type AccountLink = { href: string; text: string };

type AccountRow = {
  id: string;
  name: string;
  store: {
    name: string;
    code: string | null;
    storeMaster: {
      externalStoreId: string | null;
      accountName: string;
      lineId: string | null;
      lineManagerUrl: string | null;
    } | null;
  } | null;
  lineChatSession: {
    id: string;
    sessionKey: string;
    profilePath: string | null;
    profileStorageKey: string | null;
    status: LineChatSessionStatus;
  } | null;
};

function parseArgs(argv: string[]): Args {
  let storeCodes = new Set(DEFAULT_STORES);
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--stores") {
      storeCodes = new Set((argv[++i] || "").split(",").map((v) => v.trim()).filter(Boolean));
    } else if (arg.startsWith("--stores=")) {
      storeCodes = new Set(arg.slice("--stores=".length).split(",").map((v) => v.trim()).filter(Boolean));
    } else if (arg === "--apply") {
      apply = true;
    }
  }
  return { storeCodes, apply };
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[\s\u200b\u200c\u200d\ufeff]+/gu, "")
    .replace(/[.,'"`’‘“”()\[\]{}\-_/\\|:&+]/gu, "")
    .trim();
}

function storeCodeOf(account: AccountRow): string {
  return account.store?.code?.trim()
    || account.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

function responseUrlFromManagerHref(raw: string): string | null {
  try {
    const parsed = new URL(raw, MANAGER_ORIGIN);
    if (parsed.origin !== MANAGER_ORIGIN) return null;
    const match = parsed.pathname.match(/\/account\/([^/]+)/i);
    if (!match?.[1]) return null;
    return `${parsed.origin}/account/${match[1]}/setting/response`;
  } catch {
    return null;
  }
}

function storedResponseSettingsUrl(account: AccountRow): string | null {
  const raw = account.store?.storeMaster?.lineManagerUrl?.trim();
  if (raw) {
    const resolved = responseUrlFromManagerHref(raw);
    if (resolved) return resolved;
  }

  const lineId = account.store?.storeMaster?.lineId?.trim();
  if (lineId?.startsWith("@")) {
    return `${MANAGER_ORIGIN}/account/${lineId}/setting/response`;
  }
  return null;
}

function targetNames(account: AccountRow): string[] {
  return [
    account.store?.storeMaster?.accountName ?? "",
    account.name,
    account.store?.name ?? "",
  ].map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function candidateScore(link: AccountLink, account: AccountRow): number {
  const href = responseUrlFromManagerHref(link.href);
  if (!href) return -1;
  const normalizedText = normalizeName(link.text);
  const lineId = account.store?.storeMaster?.lineId?.trim();
  let score = lineId && link.href.includes(lineId) ? 200 : 0;
  for (const name of targetNames(account)) {
    const normalizedTarget = normalizeName(name);
    if (!normalizedTarget || !normalizedText) continue;
    if (normalizedText === normalizedTarget) score = Math.max(score, 150);
    else if (normalizedText.includes(normalizedTarget)) score = Math.max(score, 120);
    else if (normalizedTarget.length >= 8 && normalizedTarget.includes(normalizedText)) score = Math.max(score, 90);
  }
  return score;
}

async function collectAccountLinks(page: Page): Promise<AccountLink[]> {
  const links: AccountLink[] = [];
  for (const frame of page.frames()) {
    const rows = await frame.locator('a[href*="/account/"]').evaluateAll((anchors) => anchors.map((anchor) => ({
      href: (anchor as HTMLAnchorElement).href,
      text: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 220),
    }))).catch(() => [] as AccountLink[]);
    links.push(...rows);
  }
  const deduped = new Map<string, AccountLink>();
  for (const link of links) {
    const responseUrl = responseUrlFromManagerHref(link.href);
    if (!responseUrl) continue;
    const key = `${responseUrl}|${normalizeName(link.text)}`;
    if (!deduped.has(key)) deduped.set(key, link);
  }
  return [...deduped.values()];
}

function bestLink(links: AccountLink[], account: AccountRow): AccountLink | null {
  const scored = links
    .map((link) => ({ link, score: candidateScore(link, account) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].link;
}

async function visibleSearchInput(page: Page): Promise<Locator | null> {
  const selectors = [
    'input[type="search"]',
    'input[placeholder*="search" i]',
    'input[placeholder*="ค้นหา"]',
    '[role="searchbox"]',
  ];
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const nodes = frame.locator(selector);
      const count = Math.min(await nodes.count().catch(() => 0), 10);
      for (let i = 0; i < count; i += 1) {
        const node = nodes.nth(i);
        if (await node.isVisible().catch(() => false)) return node;
      }
    }
  }
  return null;
}

async function openAccountSwitcher(page: Page): Promise<boolean> {
  const before = (await collectAccountLinks(page)).length;
  const selectors = [
    'button[aria-haspopup="menu"]',
    'button[aria-haspopup="listbox"]',
    '[role="button"][aria-haspopup="menu"]',
    '[role="button"][aria-haspopup="listbox"]',
    '[role="button"]',
    'button',
  ];

  for (const selector of selectors) {
    const nodes = page.locator(selector);
    const count = Math.min(await nodes.count().catch(() => 0), 35);
    for (let i = 0; i < count; i += 1) {
      const node = nodes.nth(i);
      if (!(await node.isVisible().catch(() => false))) continue;
      const box = await node.boundingBox().catch(() => null);
      if (!box || box.y > 140 || box.x > 700) continue;

      await node.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const search = await visibleSearchInput(page);
      const after = (await collectAccountLinks(page)).length;
      if (search || after > before) return true;
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  return false;
}

async function clickExactAccountName(page: Page, account: AccountRow): Promise<string | null> {
  for (const name of targetNames(account)) {
    const matches = page.getByText(name, { exact: true });
    const count = Math.min(await matches.count().catch(() => 0), 10);
    for (let i = 0; i < count; i += 1) {
      const match = matches.nth(i);
      if (!(await match.isVisible().catch(() => false))) continue;
      await match.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(800);
      const responseUrl = responseUrlFromManagerHref(page.url());
      if (responseUrl) return responseUrl;
    }
  }
  return null;
}

async function discoverResponseSettingsUrl(page: Page, account: AccountRow): Promise<string | null> {
  await page.goto(MANAGER_ORIGIN, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  const currentUrl = responseUrlFromManagerHref(page.url());
  if (currentUrl) {
    const body = normalizeName(await page.locator("body").innerText().catch(() => ""));
    if (targetNames(account).some((name) => body.includes(normalizeName(name)))) return currentUrl;
  }

  let links = await collectAccountLinks(page);
  let match = bestLink(links, account);
  if (match) return responseUrlFromManagerHref(match.href);

  await openAccountSwitcher(page);
  links = await collectAccountLinks(page);
  match = bestLink(links, account);
  if (match) return responseUrlFromManagerHref(match.href);

  const search = await visibleSearchInput(page);
  if (search) {
    for (const name of targetNames(account)) {
      await search.fill(name).catch(() => {});
      await page.waitForTimeout(700);
      links = await collectAccountLinks(page);
      match = bestLink(links, account);
      if (match) return responseUrlFromManagerHref(match.href);
      const clicked = await clickExactAccountName(page, account);
      if (clicked) return clicked;
      await search.fill("").catch(() => {});
    }
  }

  return clickExactAccountName(page, account);
}

async function resolveResponseSettingsUrl(page: Page, account: AccountRow): Promise<ResponseUrlResolution | null> {
  const stored = storedResponseSettingsUrl(account);
  if (stored) return { url: stored, source: "STORED" };
  const discovered = await discoverResponseSettingsUrl(page, account);
  return discovered ? { url: discovered, source: "DISCOVERED" } : null;
}

async function radioText(radio: Locator): Promise<string> {
  return radio.evaluate((element) => {
    const input = element as HTMLInputElement;
    const labels = Array.from(input.labels ?? [])
      .map((label) => (label.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (labels.length > 0) return labels.join(" ").toLowerCase();

    const closestLabel = input.closest("label");
    if (closestLabel?.textContent) return closestLabel.textContent.replace(/\s+/g, " ").trim().toLowerCase();

    const aria = input.getAttribute("aria-label") || "";
    if (aria.trim()) return aria.replace(/\s+/g, " ").trim().toLowerCase();

    return (input.parentElement?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }).catch(() => "");
}

async function findMethodRadios(page: Page): Promise<{ manual: Locator | null; hybrid: Locator | null }> {
  let manual: Locator | null = null;
  let hybrid: Locator | null = null;
  for (const frame of page.frames()) {
    const radios = frame.locator('input[type="radio"]');
    const count = Math.min(await radios.count().catch(() => 0), 20);
    for (let i = 0; i < count; i += 1) {
      const radio = radios.nth(i);
      const text = await radioText(radio);
      if (!text) continue;
      if (text.includes("manual chat + auto-response messages")) {
        hybrid = hybrid ?? radio;
      } else if (/\bmanual chat\b/i.test(text) && !text.includes("auto-response")) {
        manual = manual ?? radio;
      }
    }
  }
  return { manual, hybrid };
}

async function detectMethod(page: Page): Promise<{ state: MethodState; manual: Locator | null; hybrid: Locator | null }> {
  const { manual, hybrid } = await findMethodRadios(page);
  const manualChecked = manual ? await manual.isChecked().catch(() => false) : false;
  const hybridChecked = hybrid ? await hybrid.isChecked().catch(() => false) : false;
  if (manualChecked) return { state: "MANUAL_CHAT", manual, hybrid };
  if (hybridChecked) return { state: "MANUAL_CHAT_AUTO_RESPONSE", manual, hybrid };
  return { state: "UNKNOWN", manual, hybrid };
}

async function ensureManualChat(page: Page): Promise<boolean> {
  const initial = await detectMethod(page);
  if (initial.state === "MANUAL_CHAT") return true;
  if (initial.state !== "MANUAL_CHAT_AUTO_RESPONSE" || !initial.manual) return false;

  await initial.manual.check({ force: true, timeout: 5_000 }).catch(async () => {
    await initial.manual!.evaluate((element) => {
      const input = element as HTMLInputElement;
      const label = input.labels?.[0];
      if (label) label.click();
      else input.click();
    }).catch(() => {});
  });
  await page.waitForTimeout(1_500);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

  const afterClick = await detectMethod(page);
  if (afterClick.state !== "MANUAL_CHAT") return false;

  await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  const afterReload = await detectMethod(page);
  return afterReload.state === "MANUAL_CHAT";
}

function maskedManagerAccount(responseUrl: string): string {
  const match = responseUrl.match(/\/account\/([^/]+)/i);
  const value = match?.[1] ?? "";
  if (value.length <= 5) return value;
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const requested = [...args.storeCodes];
  const accounts = await prisma.lineOfficialAccount.findMany({
    where: {
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      store: {
        OR: [
          { code: { in: requested } },
          { storeMaster: { externalStoreId: { in: requested } } },
        ],
      },
    },
    select: {
      id: true,
      name: true,
      store: {
        select: {
          name: true,
          code: true,
          storeMaster: {
            select: {
              externalStoreId: true,
              accountName: true,
              lineId: true,
              lineManagerUrl: true,
            },
          },
        },
      },
      lineChatSession: {
        select: {
          id: true,
          sessionKey: true,
          profilePath: true,
          profileStorageKey: true,
          status: true,
        },
      },
    },
  }) as AccountRow[];

  const grouped = new Map<string, AccountRow[]>();
  const failures: string[] = [];

  for (const account of accounts) {
    const code = storeCodeOf(account);
    const session = account.lineChatSession;
    if (!session || session.status !== LineChatSessionStatus.ACTIVE) {
      console.log(JSON.stringify({ event: "line_chat_response_method_row", storeCode: code, storeName: account.store?.name ?? account.name, status: "SESSION_NOT_ACTIVE" }));
      failures.push(code || account.id);
      continue;
    }
    const list = grouped.get(session.id) ?? [];
    list.push(account);
    grouped.set(session.id, list);
  }

  const foundCodes = new Set(accounts.map(storeCodeOf));
  for (const code of requested) {
    if (!foundCodes.has(code)) {
      console.log(JSON.stringify({ event: "line_chat_response_method_row", storeCode: code, status: "ACCOUNT_NOT_FOUND" }));
      failures.push(code);
    }
  }

  for (const group of grouped.values()) {
    const session = group[0].lineChatSession!;
    const profilePath = sessionService.resolveProfilePath(session);
    if (!fs.existsSync(profilePath)) {
      for (const account of group) {
        const code = storeCodeOf(account);
        console.log(JSON.stringify({ event: "line_chat_response_method_row", storeCode: code, storeName: account.store?.name ?? account.name, status: "PROFILE_MISSING" }));
        failures.push(code);
      }
      continue;
    }

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(profilePath, {
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      });

      const auth = await sessionService.probeApiAuthentication(context);
      if (auth.authenticated !== "YES") {
        for (const account of group) {
          const code = storeCodeOf(account);
          console.log(JSON.stringify({ event: "line_chat_response_method_row", storeCode: code, storeName: account.store?.name ?? account.name, status: "AUTH_FAILED", detail: `authenticated=${auth.authenticated}` }));
          failures.push(code);
        }
        continue;
      }

      const page = context.pages()[0] || await context.newPage();
      for (const account of group) {
        const code = storeCodeOf(account);
        const storeName = account.store?.name?.trim() || account.name;
        const response = await resolveResponseSettingsUrl(page, account);
        if (!response) {
          console.log(JSON.stringify({ event: "line_chat_response_method_row", storeCode: code, storeName, status: "MANAGER_ACCOUNT_NOT_DISCOVERED" }));
          failures.push(code);
          continue;
        }

        try {
          await page.goto(response.url, { waitUntil: "domcontentloaded", timeout: 15_000 });
          await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
          const before = await detectMethod(page);

          let changed = false;
          let verified = before.state === "MANUAL_CHAT";
          if (before.state === "MANUAL_CHAT_AUTO_RESPONSE" && args.apply) {
            verified = await ensureManualChat(page);
            changed = verified;
          }

          const finalState = verified ? "MANUAL_CHAT" : before.state;
          console.log(JSON.stringify({
            event: "line_chat_response_method_row",
            storeCode: code,
            storeName,
            sessionKey: session.sessionKey,
            managerAccountMasked: maskedManagerAccount(response.url),
            responseUrlSource: response.source,
            before: before.state,
            after: finalState,
            changed,
            apply: args.apply,
            verified,
          }));

          if (finalState !== "MANUAL_CHAT") failures.push(code);
        } catch (error) {
          console.log(JSON.stringify({
            event: "line_chat_response_method_row",
            storeCode: code,
            storeName,
            status: "ERROR",
            error: error instanceof Error ? error.message : String(error),
          }));
          failures.push(code);
        }
      }
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  console.log(JSON.stringify({
    event: "line_chat_response_method_ensure_complete",
    requested: requested.length,
    scanned: accounts.length,
    apply: args.apply,
    failureCount: failures.length,
    failures,
  }));

  if (failures.length > 0) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: "line_chat_response_method_ensure_failed", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
