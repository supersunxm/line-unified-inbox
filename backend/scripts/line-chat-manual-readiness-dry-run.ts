import { PrismaClient, LineChatSessionStatus } from "@prisma/client";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

const prisma = new PrismaClient();
const sessionService = new LineChatSessionService();

const COMPOSER_SELECTORS = [
  'textarea[placeholder*="Enter" i]',
  'textarea[placeholder*="Send" i]',
  'textarea[placeholder*="message" i]',
  'textarea[placeholder*="ส่ง"]',
  '[contenteditable="true"][role="textbox"]',
  '[role="textbox"][contenteditable]:not([contenteditable="false"])',
  '.ProseMirror[contenteditable="true"]',
  '[data-placeholder*="Send" i][contenteditable="true"]',
  '[data-placeholder*="message" i][contenteditable="true"]',
  '[aria-label*="Send" i][contenteditable="true"]',
  '[aria-label*="message" i][contenteditable="true"]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
] as const;

type ReadinessStatus =
  | "READY_MANUAL_CHAT"
  | "NO_COMPOSER"
  | "NO_CHAT_MAPPING"
  | "NO_SESSION"
  | "SESSION_NOT_ACTIVE"
  | "NO_BOT_ID"
  | "PROFILE_MISSING"
  | "AUTH_FAILED"
  | "ERROR";

type Row = {
  storeCode: string;
  storeName: string;
  lineOfficialAccountId: string;
  oaName: string;
  sessionKey: string;
  status: ReadinessStatus;
  detail: string;
};

type Args = {
  output: string;
  storeCodes: Set<string> | null;
  limit: number | null;
};

function parseArgs(argv: string[]): Args {
  let output = "/tmp/line-chat-manual-readiness.csv";
  let storeCodes: Set<string> | null = null;
  let limit: number | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") output = argv[++i] || output;
    else if (arg.startsWith("--output=")) output = arg.slice("--output=".length);
    else if (arg === "--stores") {
      storeCodes = new Set((argv[++i] || "").split(",").map((v) => v.trim()).filter(Boolean));
    } else if (arg.startsWith("--stores=")) {
      storeCodes = new Set(arg.slice("--stores=".length).split(",").map((v) => v.trim()).filter(Boolean));
    } else if (arg === "--limit") {
      const parsed = Number(argv[++i]);
      if (Number.isFinite(parsed) && parsed > 0) limit = Math.floor(parsed);
    } else if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      if (Number.isFinite(parsed) && parsed > 0) limit = Math.floor(parsed);
    }
  }

  return { output, storeCodes, limit };
}

function csv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(filePath: string, rows: Row[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const header = ["storeCode", "storeName", "lineOfficialAccountId", "oaName", "sessionKey", "status", "detail"];
  const lines = [header.map(csv).join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csv(row[key as keyof Row])).join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function findComposer(page: Page): Promise<Locator | null> {
  const viewportHeight = page.viewportSize()?.height ?? 800;
  let onlyVisibleTextarea: Locator | null = null;
  let visibleTextareaCount = 0;

  for (const frame of page.frames()) {
    const textareas = frame.locator("textarea");
    const textareaCount = Math.min(await textareas.count().catch(() => 0), 10);
    for (let i = 0; i < textareaCount; i += 1) {
      const locator = textareas.nth(i);
      if (await locator.isVisible().catch(() => false)) {
        visibleTextareaCount += 1;
        onlyVisibleTextarea = locator;
      }
    }

    for (const selector of COMPOSER_SELECTORS) {
      const matches = frame.locator(selector);
      const count = Math.min(await matches.count().catch(() => 0), 12);
      for (let i = 0; i < count; i += 1) {
        const candidate = matches.nth(i);
        if (!(await candidate.isVisible().catch(() => false))) continue;
        if (!(await candidate.isEnabled().catch(() => true))) continue;
        const metadata = await candidate.evaluate((element) => ({
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role")?.toLowerCase() ?? "",
          placeholder: element.getAttribute("placeholder")?.toLowerCase() ?? "",
          ariaLabel: element.getAttribute("aria-label")?.toLowerCase() ?? "",
          dataPlaceholder: element.getAttribute("data-placeholder")?.toLowerCase() ?? "",
          contentEditable: element.getAttribute("contenteditable")?.toLowerCase() ?? "",
        })).catch(() => null);
        if (!metadata) continue;

        const box = await candidate.boundingBox().catch(() => null);
        const hint = `${metadata.placeholder} ${metadata.ariaLabel} ${metadata.dataPlaceholder}`;
        if (/search|ค้นหา/u.test(hint)) continue;
        const lowerPane = Boolean(box && box.y + box.height / 2 >= viewportHeight * 0.55);
        const sendSemantic = /send|message|enter|ส่ง|พิมพ์ข้อความ/u.test(hint);
        const editable = metadata.tag === "textarea" || metadata.role === "textbox" || metadata.contentEditable === "true";
        if (editable && (lowerPane || sendSemantic)) return candidate;
      }
    }
  }

  // Observed on some LINE OA Manager layouts: a selected chat exposes exactly
  // one visible textarea with no useful placeholder/ARIA metadata. In a dry run
  // this is safe to classify as composer-ready because we never type or click.
  return visibleTextareaCount === 1 ? onlyVisibleTextarea : null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const accounts = await prisma.lineOfficialAccount.findMany({
    where: {
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      ...(args.storeCodes
        ? {
            store: {
              OR: [
                { code: { in: [...args.storeCodes] } },
                { storeMaster: { externalStoreId: { in: [...args.storeCodes] } } },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      chatBotId: true,
      store: {
        select: {
          name: true,
          code: true,
          storeMaster: { select: { externalStoreId: true } },
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
      conversations: {
        where: { lineChatUserId: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { lineChatUserId: true },
      },
    },
    orderBy: { name: "asc" },
    ...(args.limit ? { take: args.limit } : {}),
  });

  const rows: Row[] = [];
  const grouped = new Map<string, typeof accounts>();

  for (const account of accounts) {
    const storeCode = account.store?.code?.trim()
      || account.store?.storeMaster?.externalStoreId?.trim()
      || "";
    const storeName = account.store?.name?.trim() || account.name;
    const session = account.lineChatSession;

    if (!account.chatBotId?.trim()) {
      rows.push({ storeCode, storeName, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: session?.sessionKey ?? "", status: "NO_BOT_ID", detail: "chatBotId missing" });
      continue;
    }
    if (!session) {
      rows.push({ storeCode, storeName, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: "", status: "NO_SESSION", detail: "lineChatSession missing" });
      continue;
    }
    if (session.status !== LineChatSessionStatus.ACTIVE) {
      rows.push({ storeCode, storeName, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: session.sessionKey, status: "SESSION_NOT_ACTIVE", detail: `session status=${session.status}` });
      continue;
    }
    if (!account.conversations[0]?.lineChatUserId?.trim()) {
      rows.push({ storeCode, storeName, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: session.sessionKey, status: "NO_CHAT_MAPPING", detail: "no conversation with lineChatUserId" });
      continue;
    }

    const list = grouped.get(session.id) ?? [];
    list.push(account);
    grouped.set(session.id, list);
  }

  for (const group of grouped.values()) {
    const session = group[0].lineChatSession!;
    const profilePath = sessionService.resolveProfilePath(session);
    if (!fs.existsSync(profilePath)) {
      for (const account of group) {
        const storeCode = account.store?.code?.trim() || account.store?.storeMaster?.externalStoreId?.trim() || "";
        rows.push({ storeCode, storeName: account.store?.name ?? account.name, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: session.sessionKey, status: "PROFILE_MISSING", detail: profilePath });
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
          const storeCode = account.store?.code?.trim() || account.store?.storeMaster?.externalStoreId?.trim() || "";
          rows.push({ storeCode, storeName: account.store?.name ?? account.name, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: session.sessionKey, status: "AUTH_FAILED", detail: `authenticated=${auth.authenticated}` });
        }
        continue;
      }

      const page = context.pages()[0] || await context.newPage();
      for (const account of group) {
        const storeCode = account.store?.code?.trim() || account.store?.storeMaster?.externalStoreId?.trim() || "";
        const storeName = account.store?.name?.trim() || account.name;
        const lineChatUserId = account.conversations[0]?.lineChatUserId?.trim();
        try {
          if (!lineChatUserId) throw new Error("lineChatUserId missing after preflight");
          const targetUrl = sessionService.buildChatRefererUrl(account.chatBotId!.trim(), lineChatUserId);
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
          const composer = await findComposer(page);
          rows.push({
            storeCode,
            storeName,
            lineOfficialAccountId: account.id,
            oaName: account.name,
            sessionKey: session.sessionKey,
            status: composer ? "READY_MANUAL_CHAT" : "NO_COMPOSER",
            detail: composer ? "manual chat composer detected" : "chat opened but no usable composer detected",
          });
        } catch (error) {
          rows.push({ storeCode, storeName, lineOfficialAccountId: account.id, oaName: account.name, sessionKey: session.sessionKey, status: "ERROR", detail: error instanceof Error ? error.message : String(error) });
        }
      }
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  rows.sort((a, b) => a.storeCode.localeCompare(b.storeCode) || a.oaName.localeCompare(b.oaName));
  writeCsv(args.output, rows);

  const summary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    event: "line_chat_manual_readiness_dry_run_complete",
    scanned: rows.length,
    summary,
    output: args.output,
    mutationPerformed: false,
  }));
  for (const row of rows) console.log(JSON.stringify({ event: "line_chat_manual_readiness_row", ...row }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ event: "line_chat_manual_readiness_dry_run_failed", error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
