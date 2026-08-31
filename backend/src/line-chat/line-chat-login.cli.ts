import * as readline from "node:readline";
import { LineChatSessionService } from "./line-chat-session.service";

export function parseLoginArgs(argv: string[]): { profilePath: string; url?: string } {
  let profilePath = "";
  let url: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile" || arg === "-p") {
      profilePath = argv[++i] || "";
    } else if (arg.startsWith("--profile=")) {
      profilePath = arg.slice("--profile=".length);
    } else if (arg === "--url") {
      url = argv[++i];
    } else if (arg.startsWith("--url=")) {
      url = arg.slice("--url=".length);
    } else if (arg === "--help" || arg === "-h") {
      printLoginHelp();
      process.exit(0);
    }
  }

  return { profilePath: profilePath.trim(), url };
}

function printLoginHelp(): void {
  console.log(`
LINE Official Account Chat Session Login Tool

Usage:
  npm run line-chat:login -- --profile <path> [options]

Options:
  --profile, -p <path>   Path to persistent Chromium profile directory (required)
  --url <url>            Initial URL to open (default: https://chat.line.biz/)
  --help, -h             Show help message

Example:
  npm run line-chat:login -- --profile ./local-data/line-chat-profile-a
`);
}

export async function runLoginCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseLoginArgs(argv);

  if (!args.profilePath) {
    console.error("Error: --profile <path> is required.\n");
    printLoginHelp();
    process.exit(1);
  }

  const service = new LineChatSessionService();

  console.log("===============================================================");
  console.log(" LINE Official Account Manager Session Login Setup");
  console.log("===============================================================");
  console.log(` Target Profile : ${args.profilePath}`);
  console.log(" Status         : Launching Chromium browser...");
  console.log("===============================================================");

  try {
    const result = await service.launchLoginSession({
      profilePath: args.profilePath,
      url: args.url,
      onReady: (openedUrl) => {
        console.log(`\nBrowser opened at: ${openedUrl}`);
        console.log("\nInstructions:");
        console.log(" 1. Complete login to your LINE Business / OA Manager account.");
        console.log(" 2. Confirm you can access chat.line.biz.");
        console.log(" 3. When login is complete, press [ENTER] in this terminal.\n");
      },
      waitForConfirmation: () => {
        return new Promise<void>((resolve) => {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          rl.question("Press [ENTER] when you are finished logging in: ", () => {
            rl.close();
            resolve();
          });
        });
      },
    });

    console.log("\n===============================================================");
    console.log(`✓ ${result.message}`);
    console.log("Session is now saved and ready to use with line-chat:nickname.");
    console.log("===============================================================\n");
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Failed to launch login session: ${errorMsg}`);
    process.exit(1);
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("line-chat-login.cli.ts"))) {
  void runLoginCli();
}
