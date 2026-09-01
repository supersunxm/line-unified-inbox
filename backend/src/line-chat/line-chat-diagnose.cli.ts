import { LineChatSessionService } from "./line-chat-session.service";
import type { DiagnosticsCliArgs, DiagnosticsResult } from "./line-chat.types";

export function parseDiagnosticsArgs(argv: string[]): DiagnosticsCliArgs {
  let profilePath = "";
  let botId: string | undefined;
  let lineUserId: string | undefined;
  let knownChatId: string | undefined;
  let headless = false;
  let surface: DiagnosticsCliArgs["surface"] = "bot";

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
    } else if (arg === "--known-chat-id") {
      knownChatId = argv[++i];
    } else if (arg.startsWith("--known-chat-id=")) {
      knownChatId = arg.slice("--known-chat-id=".length);
    } else if (arg === "--surface") {
      const value = argv[++i];
      if (value !== "bot" && value !== "chat-list") {
        throw new Error("Invalid --surface. Expected \"bot\" or \"chat-list\".");
      }
      surface = value;
    } else if (arg.startsWith("--surface=")) {
      const value = arg.slice("--surface=".length);
      if (value !== "bot" && value !== "chat-list") {
        throw new Error("Invalid --surface. Expected \"bot\" or \"chat-list\".");
      }
      surface = value;
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
    knownChatId: knownChatId?.trim(),
    headless,
    surface,
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
  --known-chat-id <value>  Compare a known ID in memory; the value is never printed
  --surface <surface>      Diagnostic surface: bot (default) or chat-list
  --headless               Run Chromium headlessly (default: false / visible window)
  --no-headless            Run Chromium with visible browser window
  --help, -h               Show this help message

Example:
  npm run line-chat:diagnose -- --profile ./local-data/line-chat-profile-a --bot Uxxxxxxxxxxxxxxxx --user Uyyyyyyyyyyyyyyyy
  npm run line-chat:diagnose -- --profile ./local-data/line-chat-profile-a --bot Uxxxxxxxxxxxxxxxx --surface chat-list --headless
`);
}

export function formatDiagnosticsResult(result: DiagnosticsResult): string {
  const lines: string[] = [];
  lines.push("===============================================================");
  lines.push(" LINE Chat Session Diagnostic Report");
  lines.push("===============================================================");
  lines.push(` Profile Path   : ${result.profilePath}`);
  lines.push(` Surface        : ${result.surface}`);
  lines.push(` Requested URL  : ${result.targetUrl}`);
  lines.push(` Final Page URL : ${result.finalPageUrl}`);
  lines.push(` Final Origin   : ${result.finalOrigin}`);
  lines.push(` Final Path     : ${result.finalPath}`);
  lines.push(` Document Title : ${result.documentTitle ?? "(unavailable)"}`);
  lines.push(` Main Doc HTTP  : ${result.mainDocumentStatus ?? "UNAVAILABLE"}`);
  lines.push(` Chat Origin    : ${result.finalOriginIsChatLine ? "YES" : "NO"}`);
  lines.push(` Workspace Path : ${result.finalPathMatchesWorkspace ? "YES" : "NO"}`);
  lines.push(` Redirected     : ${result.redirected ? "YES" : "NO"}`);
  lines.push(` Auth Destination: ${result.authDestinationDetected ? "YES" : "NO"}`);
  lines.push(` Navigation     : ${result.navigationSucceeded ? "SUCCEEDED" : "FAILED"}`);
  if (result.navigationError) lines.push(` Navigation Err : ${result.navigationError}`);
  if (result.surface === "chat-list") {
    lines.push(` Chat List Response: ${result.chatListResponseObserved ? "OBSERVED" : "NOT OBSERVED"}`);
    if (result.chatListIdentifierShape && result.chatListPagination) {
      const shape = result.chatListIdentifierShape;
      lines.push(" Chat Identifier Shape:");
      lines.push(`   listCount: ${shape.listCount}`);
      formatIdentifierField(lines, "chatId", shape.chatId);
      formatIdentifierField(lines, "userId", shape.userId);
      lines.push(`   presence BOTH_PRESENT: ${shape.presenceCounts.bothPresent}`);
      lines.push(`   presence CHAT_ID_ONLY: ${shape.presenceCounts.chatIdOnly}`);
      lines.push(`   presence USER_ID_ONLY: ${shape.presenceCounts.userIdOnly}`);
      lines.push(`   presence NEITHER: ${shape.presenceCounts.neither}`);

      if (result.chatIdStructure) {
        const structure = result.chatIdStructure;
        lines.push(" Chat ID Structure:");
        lines.push(`   totalStrings: ${structure.totalStrings}`);
        lines.push("   prefixClass:");
        lines.push(`     valid USER ID: ${structure.prefixClass.validUserId}`);
        lines.push(`     invalid U-prefixed: ${structure.prefixClass.invalidU}`);
        lines.push(`     R: ${structure.prefixClass.R}`);
        lines.push(`     C: ${structure.prefixClass.C}`);
        lines.push(`     other: ${structure.prefixClass.other}`);
        lines.push("   lengthBuckets:");
        lines.push(`     <=16: ${structure.lengthBuckets.lte16}`);
        lines.push(`     17-32: ${structure.lengthBuckets.from17To32}`);
        lines.push(`     33-40: ${structure.lengthBuckets.from33To40}`);
        lines.push(`     41+: ${structure.lengthBuckets.gte41}`);
      }

      if (result.chatTypeCorrelation) {
        const correlation = result.chatTypeCorrelation;
        lines.push(" Chat Type / ID Shape:");
        for (const row of correlation.matrix) {
          lines.push(`   ${row.category}:`);
          lines.push(`     count: ${row.count}`);
          lines.push(`     valid USER ID: ${row.idShape.validUserId}`);
          lines.push(`     invalid U-prefixed: ${row.idShape.invalidU}`);
          lines.push(`     R: ${row.idShape.R}`);
          lines.push(`     C: ${row.idShape.C}`);
          lines.push(`     other: ${row.idShape.other}`);
        }
        lines.push(`   chatType present: ${correlation.chatTypePresence.present}`);
        lines.push(`   chatType missing: ${correlation.chatTypePresence.missing}`);
        lines.push(`   friend true: ${correlation.friend.trueCount}`);
        lines.push(`   friend false: ${correlation.friend.falseCount}`);
        lines.push(`   friend other/missing: ${correlation.friend.otherOrMissing}`);
        lines.push(`   profile present: ${correlation.profile.present}`);
        lines.push(`   profile missing: ${correlation.profile.missing}`);
      }

      const pagination = result.chatListPagination;
      lines.push(" Pagination:");
      lines.push(`   nextPresent: ${pagination.nextPresent}`);
      lines.push(`   nextType: ${pagination.nextType}`);
      lines.push(`   nextStringClassification: ${pagination.nextStringClassification}`);
      lines.push(`   nextLengthBucket: ${pagination.nextLengthBucket}`);
      if (pagination.nextType === "object") {
        lines.push(`   nextObjectKeys: [${pagination.nextObjectKeys.join(", ")}]`);
      }
    } else {
      lines.push(" Chat Identifier Shape: NOT AVAILABLE");
      lines.push(" Pagination: NOT AVAILABLE");
    }
    if (result.knownChatIdMatch) {
      lines.push(" Known Chat ID Match:");
      lines.push(`   chatId: ${result.knownChatIdMatch.chatId}`);
      lines.push(`   userId: ${result.knownChatIdMatch.userId}`);
    }
    lines.push(` Wheel Probe Attempts: ${result.wheelProbeAttempts}`);
    lines.push(` Second Page Request: ${result.secondPageRequestObserved ? "OBSERVED" : "NOT OBSERVED"}`);
    lines.push(` Second Page Query Names: ${result.secondPageQueryNames.length > 0 ? `[${result.secondPageQueryNames.join(", ")}]` : "[]"}`);
    lines.push(` New Query Names vs First Page: ${result.secondPageNewQueryNames.length > 0 ? `[${result.secondPageNewQueryNames.join(", ")}]` : "[]"}`);
    if (result.secondPageQueryMetadata) {
      lines.push(" Second Page Query Metadata:");
      for (const [name, value] of Object.entries(result.secondPageQueryMetadata.safeScalars)) {
        lines.push(`   ${name}=${value}`);
      }
      for (const redacted of result.secondPageQueryMetadata.redactedParameters) {
        lines.push(`   ${redacted}`);
      }
    }
  }
  lines.push(` Session State  : ${result.sessionStatePresent ? "PRESENT" : "NONE"}`);
  lines.push(" API Auth Probe:");
  lines.push(`   Endpoint     : ${result.apiAuthProbe.endpoint}`);
  lines.push(`   Transport    : ${result.apiAuthProbe.transport}`);
  lines.push(`   Status       : ${result.apiAuthProbe.status ?? "UNAVAILABLE"}`);
  lines.push(`   Content-Type : ${result.apiAuthProbe.contentType ?? "(absent)"}`);
  lines.push(`   JSON         : ${result.apiAuthProbe.responseWasJson ? "YES" : "NO"}`);
  lines.push(`   Top-level Keys: ${result.apiAuthProbe.topLevelKeyNames.length > 0 ? result.apiAuthProbe.topLevelKeyNames.join(", ") : "(none)"}`);
  lines.push(`   Authenticated: ${result.apiAuthenticated}`);
  lines.push(` Authenticated  : ${result.apiAuthenticated}`);
  lines.push(` Total Cookies  : ${result.cookiesCount}`);
  lines.push(` Cookie State   : ${result.cookieStatePresent ? "PRESENT" : "NONE"}`);
  lines.push(` LocalStorage   : ${result.localStoragePresent ? "PRESENT" : "NONE"}`);
  lines.push(` SessionStorage : ${result.sessionStoragePresent ? "PRESENT" : "NONE"}`);
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
      formatQueryMetadata(lines, req.query, "      ");
      lines.push(`      - X-Xsrf-Token: ${req.hasXsrfHeader ? "PRESENT" : "ABSENT"}`);
      lines.push(`      - Client Version: ${req.hasClientVersionHeader ? "PRESENT" : "ABSENT"}`);
      lines.push(`      - Origin: ${req.hasOriginHeader ? "PRESENT" : "ABSENT"}`);
      lines.push(`      - Referer: ${req.hasRefererHeader ? "PRESENT" : "ABSENT"}`);
    });
  }
  lines.push("---------------------------------------------------------------");
  lines.push(` REST API Requests: ${result.restApiRequestsObserved}`);
  lines.push(` Streaming SSE   : ${result.streamingSseObserved ? "OBSERVED" : "NOT OBSERVED"}`);
  lines.push(" Observed API Responses:");
  if (result.observedResponses.length === 0) {
    lines.push("   (No relevant API responses captured during page load)");
  } else {
    result.observedResponses.forEach((response, idx) => {
      lines.push(`   ${idx + 1}. status: ${response.status}`);
      lines.push(`      content-type: ${response.contentType}`);
      lines.push(`      path: ${response.url}`);
      formatQueryMetadata(lines, response.query, "      ");
      lines.push(`      schema: ${formatResponseSchema(response.schema)}`);
    });
  }
  lines.push("===============================================================");
  return lines.join("\n");
}

function formatQueryMetadata(
  lines: string[],
  query: { parameterNames: string[]; safeScalars: Record<string, string>; redactedParameters: string[] },
  indent: string
): void {
  lines.push(`${indent}query parameter names: ${query.parameterNames.length > 0 ? query.parameterNames.join(", ") : "(none)"}`);
  for (const [name, value] of Object.entries(query.safeScalars)) {
    lines.push(`${indent}  ${name}=${value}`);
  }
  for (const redacted of query.redactedParameters) {
    lines.push(`${indent}  ${redacted}`);
  }
}

function formatIdentifierField(
  lines: string[],
  fieldName: string,
  summary: { stringCount: number; matchesUserIdPattern: number; otherStringCount: number; nullOrMissing: number },
): void {
  lines.push(`   ${fieldName}:`);
  lines.push(`     stringCount: ${summary.stringCount}`);
  lines.push(`     matchesUserIdPattern: ${summary.matchesUserIdPattern}`);
  lines.push(`     otherStringCount: ${summary.otherStringCount}`);
  lines.push(`     nullOrMissing: ${summary.nullOrMissing}`);
}

function formatResponseSchema(schema: DiagnosticsResult["observedResponses"][number]["schema"]): string {
  if (schema.parseStatus === "NOT_JSON") return "not-json";
  if (schema.parseStatus === "PARSE_FAILED") return "json-parse-failed";
  const parts = [`top-level=${schema.topLevelType}`];
  if (schema.topLevelKeyNames.length > 0) parts.push(`keys=[${schema.topLevelKeyNames.join(", ")}]`);
  if (schema.nestedKeyNames.length > 0) parts.push(`nestedKeys=[${schema.nestedKeyNames.join(", ")}]`);
  if (schema.arrayLengths.length > 0) {
    parts.push(`arrays=[${schema.arrayLengths.map((item) => `${item.path}:${item.length}`).join(", ")}]`);
  }
  if (schema.paginationKeyNames.length > 0) parts.push(`paginationKeys=[${schema.paginationKeyNames.join(", ")}]`);
  if (schema.candidateFieldNames.length > 0) parts.push(`candidateFields=[${schema.candidateFieldNames.join(", ")}]`);
  return parts.join(" ");
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
      knownChatId: args.knownChatId,
      headless: args.headless,
      surface: args.surface,
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
