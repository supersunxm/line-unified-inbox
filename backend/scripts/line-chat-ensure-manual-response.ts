import { PrismaClient, LineChatSessionStatus } from "@prisma/client";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import * as fs from "node:fs";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

const prisma = new PrismaClient();
const sessionService = new LineChatSessionService();

const DEFAULT_STORES = ["25610", "27627", "25391", "24804", "27789", "3791"];

type Args = { storeCodes: Set<string>; apply: boolean };
type MethodState = "MANUAL_CHAT" | "MANUAL_CHAT_AUTO_RESPONSE" | "UNKNOWN";

type AccountRow = {
  id: string;
  name: string;
  store: {
    name: string;
    code: string | null;
    storeMaster: {
      externalStoreId: string | null;
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

function storeCodeOf(account: AccountRow): string {
  return account.store?.code?.trim()
    || account.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

function buildResponseSettingsUrl(account: AccountRow): string | null {
  const raw = account.store?.storeMaster?.lineManagerUrl?.trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname !== "manager.line.biz") return null;
      const match = parsed.pathname.match(/\/account\/([^/]+)/i);
      if (!match?.[1]) return null;
      return `${parsed.origin}/account/${match[1]}/setting/response`;
    } catch {
      return null;
    }
  }

  const lineId = account.store?.storeMaster?.lineId?.trim();
  if (lineId?.startsWith("@")) {
    return `https://manager.line.biz/account/${lineId}/setting/response`;
  }
  return null;
}

async function radioText(radio: Locator): Promise<string> {
  return radio.evaluate((element) => {
    const input = element as HTMLInputElement;
    const chunks: string[] = [];
    for (const label of Array.from(input.labels ?? [])) {
      if (label.textContent) chunks.push(label.textContent);
    }
    let parent: HTMLElement | null = input.parentElement;
    for (let depth = 0; parent && depth < 3; depth += 1) {
      if (parent.innerText) chunks.push(parent.innerText);
      parent = parent.parentElement;
    }
    return chunks.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
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
    await initial.manual!.evaluate((element) => (element as HTMLInputElement).click()).catch(() => {});
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
        const responseUrl = buildResponseSettingsUrl(account);
        if (!responseUrl) {
          console.log(JSON.stringify({ event: "line_chat_response_method_row", storeCode: code, storeName, status: "MANAGER_URL_MISSING_OR_INVALID" }));
          failures.push(code);
          continue;
        }

        try {
          await page.goto(responseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
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
