import { LineChatSessionService } from "./line-chat-session.service";
import type { NicknameCliArgs, UpdateNicknameResult } from "./line-chat.types";

export function parseNicknameArgs(argv: string[]): NicknameCliArgs {
  let profilePath = "";
  let botId = "";
  let lineUserId = "";
  let nickname = "";
  let dryRun = false;
  let headless = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile" || arg === "-p") {
      profilePath = argv[++i] || "";
    } else if (arg.startsWith("--profile=")) {
      profilePath = arg.slice("--profile=".length);
    } else if (arg === "--bot" || arg === "-b") {
      botId = argv[++i] || "";
    } else if (arg.startsWith("--bot=")) {
      botId = arg.slice("--bot=".length);
    } else if (arg === "--user" || arg === "-u") {
      lineUserId = argv[++i] || "";
    } else if (arg.startsWith("--user=")) {
      lineUserId = arg.slice("--user=".length);
    } else if (arg === "--nickname" || arg === "-n") {
      nickname = argv[++i] || "";
    } else if (arg.startsWith("--nickname=")) {
      nickname = arg.slice("--nickname=".length);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--headless") {
      headless = true;
    } else if (arg === "--no-headless" || arg === "--headless=false") {
      headless = false;
    } else if (arg === "--help" || arg === "-h") {
      printNicknameHelp();
      process.exit(0);
    }
  }

  return {
    profilePath: profilePath.trim(),
    botId: botId.trim(),
    lineUserId: lineUserId.trim(),
    nickname: nickname.trim(),
    dryRun,
    headless,
  };
}

function printNicknameHelp(): void {
  console.log(`
LINE Official Account Chat Nickname Sync CLI

Usage:
  npm run line-chat:nickname -- [options]

Options:
  --profile, -p <path>     Path to persistent Chromium profile directory (required)
  --bot, -b <botId>        LINE OA Bot ID (required)
  --user, -u <userId>      LINE User ID (required)
  --nickname, -n <name>    New customer nickname to set (required)
  --dry-run                Print target information without sending PUT request
  --headless               Run Chromium in headless mode (default: true)
  --no-headless            Run Chromium with visible browser window
  --help, -h               Show this help message

Examples:
  # Dry-run validation
  npm run line-chat:nickname -- \\
    --profile ./local-data/line-chat-profile-a \\
    --bot Uxxxxxxxxxxxxxxxx \\
    --user Uyyyyyyyyyyyyyyyy \\
    --nickname "Find X9 สด 08/26" \\
    --dry-run

  # Live update
  npm run line-chat:nickname -- \\
    --profile ./local-data/line-chat-profile-a \\
    --bot Uxxxxxxxxxxxxxxxx \\
    --user Uyyyyyyyyyyyyyyyy \\
    --nickname "Find X9 สด 08/26"
`);
}

export function formatNicknameResult(result: UpdateNicknameResult): string {
  const lines: string[] = [];
  lines.push("===============================================================");
  lines.push(result.dryRun ? " LINE Chat Customer Nickname Sync [DRY-RUN]" : " LINE Chat Customer Nickname Sync");
  lines.push("===============================================================");
  lines.push(` Profile  : ${result.profilePath}`);
  lines.push(` Bot ID   : ${result.botId}`);
  lines.push(` User ID  : ${result.lineUserId}`);
  lines.push(` Nickname : "${result.nickname}"`);
  if (result.status !== undefined) {
    lines.push(` HTTP Status : ${result.status}`);
  }
  if (result.xsrfTokenFound !== undefined) {
    lines.push(` XSRF Token  : ${result.xsrfTokenFound ? `Found (source: ${result.tokenSource || "runtime"})` : "Not detected"}`);
  }
  if (result.clientVersionFound !== undefined) {
    lines.push(` Client Ver  : ${result.clientVersionFound ? "Found in runtime" : "Not detected"}`);
  }
  lines.push("---------------------------------------------------------------");

  if (result.success) {
    lines.push(`✓ Result : ${result.message || "Success"}`);
  } else {
    lines.push(`✗ Error  : ${result.error || "Failed"}`);
  }
  lines.push("===============================================================");
  return lines.join("\n");
}

export async function runNicknameCli(
  argv: string[] = process.argv.slice(2),
  service: LineChatSessionService = new LineChatSessionService()
): Promise<UpdateNicknameResult> {
  const args = parseNicknameArgs(argv);

  const missing: string[] = [];
  if (!args.profilePath) missing.push("--profile");
  if (!args.botId) missing.push("--bot");
  if (!args.lineUserId) missing.push("--user");
  if (!args.nickname) missing.push("--nickname");

  if (missing.length > 0) {
    console.error(`Error: Missing required arguments: ${missing.join(", ")}\n`);
    printNicknameHelp();
    process.exit(1);
  }

  const result = await service.updateNickname({
    profilePath: args.profilePath,
    botId: args.botId,
    lineUserId: args.lineUserId,
    nickname: args.nickname,
    dryRun: args.dryRun,
    headless: args.headless,
  });

  console.log(formatNicknameResult(result));

  if (!result.success) {
    process.exit(1);
  }

  return result;
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("line-chat-nickname.cli.ts"))) {
  void runNicknameCli();
}
