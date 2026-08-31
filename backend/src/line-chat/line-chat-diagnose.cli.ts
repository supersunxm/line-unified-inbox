import { LineChatSessionService } from "./line-chat-session.service";
import type { DiagnosticsCliArgs, DiagnosticsResult } from "./line-chat.types";

export function parseDiagnosticsArgs(argv: string[]): DiagnosticsCliArgs {
  let profilePath = "";
  let botId: string | undefined;
  let lineUserId: string | undefined;
  let headless = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile" || arg === "-p") {
      profilePath = argv[++i] || "";
    } else if (arg.startsWith("--profile=")) {
      profilePath = arg.slice("--profile=".length);
    } else if (arg === "--bot" || arg === "-b") {
      botId = argv[++i];
    } else if (arg.startsWith("--bot=")) {
      botId = arg.slice("--bot=".length);
    } else if (arg === "--user" || arg === "-u") {
      lineUserId = argv[++i];
    } else if (arg.startsWith("--user=")) {
      lineUserId = arg.slice("--user=".length);
    } else if (arg === "--headless") {
      headless = true;
    } else if (arg === "--no-headless") {
      headless = false;
    } else if (arg === "--help" || arg === "-h") {
      printDiagnosticsHelp();
      process.exit(0);
    }
  }

  return {
    profilePath: profilePath.trim(),
    botId: botId?.trim(),
    lineUserId: lineUserId?.trim(),
    headless,
  };
}

function printDiagnosticsHelp(): void {
  console.log(`
LINE Official Account Chat Session Diagnostics Tool

Usage:
  npm run line-chat:diagnose -- --profile <path> [options]

Options:
  --profile, -p <path>     Path to persistent Chromium profile directory (required)
  --bot, -b <botId>        LINE OA Bot ID (optional)
  --user, -u <userId>      LINE User ID (optional)
  --headless               Run Chromium headlessly (default: false / visible window)
  --no-headless            Run Chromium with visible browser window
  --help, -h               Show this help message

Example:
  npm run line-chat:diagnose -- --profile ./local-data/line-chat-profile-a --bot Uxxxxxxxxxxxxxxxx --user Uyyyyyyyyyyyyyyyy
`);
}

export function formatDiagnosticsResult(result: DiagnosticsResult): string {
  const lines: string[] = [];
  lines.push("===============================================================");
  lines.push(" LINE Chat Session Diagnostic Report");
  lines.push("===============================================================");
  lines.push(` Profile Path   : ${result.profilePath}`);
  lines.push(` Target URL     : ${result.targetUrl}`);
  lines.push(` Authenticated  : ${result.authenticated ? "YES" : "NO (No cookies/tokens found)"}`);
  lines.push(` Total Cookies  : ${result.cookiesCount}`);
  lines.push(` Cookie Names   : ${result.cookieNames.length > 0 ? result.cookieNames.join(", ") : "(none)"}`);
  lines.push(` LocalStorage   : ${result.localStorageKeys.length > 0 ? result.localStorageKeys.join(", ") : "(none)"}`);
  lines.push(` SessionStorage : ${result.sessionStorageKeys.length > 0 ? result.sessionStorageKeys.join(", ") : "(none)"}`);
  lines.push(` Meta Tags      : ${result.metaTags.length > 0 ? result.metaTags.join(", ") : "(none)"}`);
  lines.push("---------------------------------------------------------------");
  lines.push(` XSRF Token     : ${result.xsrfTokenFound ? "FOUND" : "NOT DETECTED"}`);
  lines.push(` Token Source   : ${result.tokenSource.toUpperCase()}`);
  lines.push(` Client Version : ${result.clientVersionFound ? "FOUND" : "NOT DETECTED"}`);
  lines.push("---------------------------------------------------------------");
  lines.push(" Observed Background API Requests:");
  if (result.observedRequests.length === 0) {
    lines.push("   (No background API calls captured during page load)");
  } else {
    result.observedRequests.forEach((req, idx) => {
      lines.push(`   ${idx + 1}. [${req.method}] ${req.url}`);
      lines.push(`      - X-Xsrf-Token: ${req.hasXsrfHeader ? "PRESENT" : "ABSENT"}`);
      lines.push(`      - Client Version: ${req.hasClientVersionHeader ? "PRESENT" : "ABSENT"}`);
      lines.push(`      - Origin: ${req.hasOriginHeader ? "PRESENT" : "ABSENT"}`);
      lines.push(`      - Referer: ${req.hasRefererHeader ? "PRESENT" : "ABSENT"}`);
    });
  }
  lines.push("===============================================================");
  return lines.join("\n");
}

export async function runDiagnosticsCli(
  argv: string[] = process.argv.slice(2),
  service: LineChatSessionService = new LineChatSessionService()
): Promise<DiagnosticsResult> {
  const args = parseDiagnosticsArgs(argv);

  if (!args.profilePath) {
    console.error("Error: --profile <path> is required.\n");
    printDiagnosticsHelp();
    process.exit(1);
  }

  console.log("Running session diagnostics...\n");

  try {
    const result = await service.runDiagnostics({
      profilePath: args.profilePath,
      botId: args.botId,
      lineUserId: args.lineUserId,
      headless: args.headless,
    });

    console.log(formatDiagnosticsResult(result));
    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Diagnostics failed: ${errorMsg}`);
    process.exit(1);
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("line-chat-diagnose.cli.ts"))) {
  void runDiagnosticsCli();
}
