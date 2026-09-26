import { performance } from "node:perf_hooks";

const MAX_EVENT_JSON_LENGTH = 8_192;
const MAX_ERROR_MESSAGE_LENGTH = 1_600;
const MAX_LAUNCH_COMMAND_LENGTH = 1_600;
const MAX_STDERR_LENGTH = 2_600;
const MAX_STDOUT_LENGTH = 1_200;
const MAX_CALL_LOG_LENGTH = 2_000;
const ANSI_ESCAPE_SEQUENCE = new RegExp(String.raw`\u001b\[[0-?]*[ -/]*[@-~]`, "gu");

type LaunchFailureDiagnostic = {
  event: "line_chat_chromium_launch_failed";
  launchId: string | null;
  profileId: string | null;
  operationKind: string | null;
  sessionId: string | null;
  storeCode: string | null;
  workerPid: number;
  errorName: string | null;
  errorCode: string | null;
  errno: number | null;
  syscall: string | null;
  errorMessage: string;
  launchDurationMs: number;
  executablePath: string | null;
  launchCommand: string | null;
  chromiumPid: number | null;
  browserSpawned: boolean | null;
  exitCode: number | null;
  terminationSignal: string | null;
  processClosed: boolean | null;
  exitedByItself: boolean | null;
  forceKillRequired: boolean | null;
  cleanupCompleted: boolean | null;
  chromiumStderr: string | null;
  chromiumStdout: string | null;
  playwrightCallLog: string | null;
};

function readProperty(value: unknown, property: string): unknown {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return undefined;
  try {
    return Reflect.get(value, property);
  } catch {
    return undefined;
  }
}

function safeScalar(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function safeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return Number(value);
  return null;
}

function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return "";
}

function redactAndNormalize(input: string, profilePath: string): string {
  let text = input;
  const resolvedProfilePath = profilePath.trim();
  if (resolvedProfilePath) {
    const pathForms = new Set([
      resolvedProfilePath,
      resolvedProfilePath.replace(/\\/gu, "/"),
      JSON.stringify(resolvedProfilePath).slice(1, -1),
    ]);
    for (const pathForm of pathForms) {
      if (pathForm) text = text.split(pathForm).join("<PROFILE>");
    }
  }

  return text
    .replace(ANSI_ESCAPE_SEQUENCE, "")
    .replace(/(--user-data-dir)(?:=|\s+)(?:"[^"]*"|'[^']*'|[^\s]+)/giu, "$1=<PROFILE>")
    .replace(/(--profile-directory)(?:=|\s+)(?:"[^"]*"|'[^']*'|[^\s]+)/giu, "$1=<PROFILE>")
    .replace(/\b(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/giu, "$1<REDACTED>")
    .replace(/\bbearer\s+[A-Za-z0-9._~+/-]+=*/giu, "Bearer <REDACTED>")
    .replace(/\b(set-cookie|cookie)\s*[:=]\s*[^\r\n]*/giu, "$1=<REDACTED>")
    .replace(/([?&](?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key)=)[^&\s]+/giu, "$1<REDACTED>")
    .replace(/\b(token|access[_-]?token|refresh[_-]?token|id[_-]?token|session(?:[_-]?(?:id|key))?|password|passwd|secret|api[_-]?key)\s*([=:])\s*(?:"[^"]*"|'[^']*'|[^\s,&;]+)/giu, "$1$2<REDACTED>")
    .replace(/(\/data\/line-chat-profiles\/)[^/\s"']+/giu, "$1<PROFILE>")
    .replace(/\r\n?/gu, "\n")
    .replace(/[^\t\n\x20-\x7e]/gu, "?");
}

function boundedText(input: string, profilePath: string, maxLength: number): string | null {
  const normalized = redactAndNormalize(input, profilePath).trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 14))}[TRUNCATED]`;
}

function captureSection(message: string, startMarker: string, endMarker: string): string {
  const start = message.indexOf(startMarker);
  if (start < 0) return "";
  const bodyStart = start + startMarker.length;
  const end = endMarker ? message.indexOf(endMarker, bodyStart) : -1;
  return message.slice(bodyStart, end < 0 ? undefined : end).trim();
}

function firstMatchingLines(text: string, pattern: RegExp, maxLength: number): string {
  const lines = text.split(/\r?\n/u).filter((line) => pattern.test(line));
  return lines.join("\n").slice(0, maxLength);
}

function parseLogNumber(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  return match?.[1] ? safeNumber(match[1]) : null;
}

function parseLogValue(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  const value = match?.[1]?.trim();
  return value && value.toLowerCase() !== "null" ? value : null;
}

function setDiagnosticTextField(
  diagnostic: LaunchFailureDiagnostic,
  field: "playwrightCallLog" | "chromiumStdout" | "chromiumStderr" | "launchCommand" | "errorMessage",
  value: string | null,
): void {
  switch (field) {
    case "playwrightCallLog":
      diagnostic.playwrightCallLog = value;
      break;
    case "chromiumStdout":
      diagnostic.chromiumStdout = value;
      break;
    case "chromiumStderr":
      diagnostic.chromiumStderr = value;
      break;
    case "launchCommand":
      diagnostic.launchCommand = value;
      break;
    case "errorMessage":
      diagnostic.errorMessage = value ?? "Launch failed; diagnostic message unavailable.";
      break;
  }
}

function collectDiagnostic(error: unknown, profilePath: string, durationMs: number): LaunchFailureDiagnostic {
  const message = safeText(readProperty(error, "message")) || safeText(error);
  const stderrProperty = safeText(readProperty(error, "stderr"));
  const stdoutProperty = safeText(readProperty(error, "stdout"));
  const childProcess = readProperty(error, "spawnedProcess") ?? readProperty(error, "childProcess");
  const browserLogs = captureSection(message, "Browser logs:", "Call log:");
  const callLog = captureSection(message, "Call log:", "");
  const launchLine = message.split(/\r?\n/u).find((line) => /<launching>\s+/iu.test(line)) ?? "";
  const commandMatch = /<launching>\s+(.+)$/iu.exec(launchLine);
  const rawCommand = safeText(readProperty(error, "command")) || commandMatch?.[1]?.trim() || "";
  const executableProperty = safeText(readProperty(error, "executablePath"));
  const rawExecutable = executableProperty || rawCommand.match(/^(?:"([^"]+)"|'([^']+)'|(\S+))/u)?.slice(1).find(Boolean) || "";
  const processPid = safeNumber(readProperty(childProcess, "pid"));
  const chromiumPid = processPid
    ?? safeNumber(readProperty(error, "pid"))
    ?? parseLogNumber(message, /<launched>\s+pid=(\d+)/iu)
    ?? parseLogNumber(message, /\bpid=(\d+)/iu);
  const exitCode = safeNumber(readProperty(childProcess, "exitCode"))
    ?? safeNumber(readProperty(error, "exitCode"))
    ?? parseLogNumber(message, /\bexitCode=(-?\d+)/iu);
  const terminationSignal = safeScalar(readProperty(childProcess, "signalCode"))
    ?? safeScalar(readProperty(childProcess, "signal"))
    ?? safeScalar(readProperty(error, "signal"))
    ?? parseLogValue(message, /\bsignal=([^\s>]+)/iu);
  const processClosed = safeBoolean(readProperty(error, "processClosed"))
    ?? safeBoolean(readProperty(childProcess, "processClosed"))
    ?? (/\bprocessClosed\s*=\s*true/iu.test(message) ? true : null)
    ?? (/\bprocessClosed\s*=\s*false/iu.test(message) ? false : null)
    ?? (/<process did exit:/iu.test(message) ? true : null);
  const processKilled = safeBoolean(readProperty(childProcess, "killed"))
    ?? safeBoolean(readProperty(error, "killed"))
    ?? (/(?:spawnedProcess|childProcess)\.killed\s*=\s*true/iu.test(message) ? true : null)
    ?? (/(?:spawnedProcess|childProcess)\.killed\s*=\s*false/iu.test(message) ? false : null);
  const explicitSpawned = safeBoolean(readProperty(childProcess, "spawned"))
    ?? safeBoolean(readProperty(error, "spawned"));
  const errorCode = safeScalar(readProperty(error, "code"));
  const syscall = safeScalar(readProperty(error, "syscall"));
  const browserSpawned = chromiumPid !== null
    ? true
    : explicitSpawned
      ?? (errorCode === "EAGAIN" && syscall === "spawn" ? false : null);
  const logStderr = firstMatchingLines(browserLogs, /\[(?:pid=\d+\])?\[?err\]|\bstderr\b/iu, MAX_STDERR_LENGTH);
  const logStdout = firstMatchingLines(browserLogs, /\[(?:pid=\d+\])?\[?out\]|\bstdout\b/iu, MAX_STDOUT_LENGTH);
  const stderr = stderrProperty || logStderr;
  const stdout = stdoutProperty || logStdout;
  const forceKillMarker = /<will force kill>|<forcefully close>|killed by Playwright/iu.test(message);
  const forceKillRequired = processKilled === true || forceKillMarker
    ? true
    : processKilled === false
      ? false
      : null;
  const cleanupCompleted = safeBoolean(readProperty(error, "cleanupCompleted"))
    ?? safeBoolean(readProperty(childProcess, "cleanupCompleted"))
    ?? (/finished temporary directories cleanup/iu.test(message) ? true : null);

  return {
    event: "line_chat_chromium_launch_failed",
    launchId: null,
    profileId: null,
    operationKind: null,
    sessionId: null,
    storeCode: null,
    workerPid: process.pid,
    errorName: boundedText(safeText(readProperty(error, "name")), profilePath, 100),
    errorCode: boundedText(errorCode ?? "", profilePath, 100),
    errno: safeNumber(readProperty(error, "errno")),
    syscall: boundedText(syscall ?? "", profilePath, 100),
    errorMessage: boundedText(message, profilePath, MAX_ERROR_MESSAGE_LENGTH) ?? "Launch failed; diagnostic message unavailable.",
    launchDurationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0,
    executablePath: boundedText(rawExecutable, profilePath, 400),
    launchCommand: boundedText(rawCommand, profilePath, MAX_LAUNCH_COMMAND_LENGTH),
    chromiumPid,
    browserSpawned,
    exitCode,
    terminationSignal: boundedText(terminationSignal ?? "", profilePath, 100),
    processClosed,
    exitedByItself: processClosed === true && processKilled === false
      ? true
      : processKilled === true
        ? false
        : null,
    forceKillRequired,
    cleanupCompleted,
    chromiumStderr: boundedText(stderr, profilePath, MAX_STDERR_LENGTH),
    chromiumStdout: boundedText(stdout, profilePath, MAX_STDOUT_LENGTH),
    playwrightCallLog: boundedText(callLog, profilePath, MAX_CALL_LOG_LENGTH),
  };
}

function formatFailureDiagnostic(
  error: unknown,
  profilePath: string,
  durationMs: number,
  metadata: {
    launchId?: string;
    profileId?: string;
    operationKind?: string;
    sessionId?: string;
    storeCode?: string;
    workerPid?: number;
  } = {},
): string {
  try {
    const diagnostic = collectDiagnostic(error, profilePath, durationMs);
    diagnostic.launchId = metadata.launchId ?? null;
    diagnostic.profileId = metadata.profileId ?? null;
    diagnostic.operationKind = metadata.operationKind?.slice(0, 80) ?? null;
    diagnostic.sessionId = metadata.sessionId?.slice(0, 120) ?? null;
    diagnostic.storeCode = metadata.storeCode?.slice(0, 80) ?? null;
    diagnostic.workerPid = metadata.workerPid ?? process.pid;
    const trimOrder: Array<keyof Pick<LaunchFailureDiagnostic,
      "playwrightCallLog" | "chromiumStdout" | "chromiumStderr" | "launchCommand" | "errorMessage">> = [
      "playwrightCallLog",
      "chromiumStdout",
      "chromiumStderr",
      "launchCommand",
      "errorMessage",
    ];

    let serialized = JSON.stringify(diagnostic);
    for (const field of trimOrder) {
      while (serialized.length > MAX_EVENT_JSON_LENGTH && diagnostic[field]) {
        const current = diagnostic[field] ?? "";
        const nextLength = Math.max(0, Math.floor(current.length * 0.6));
        const replacement = nextLength > 0
          ? `${current.slice(0, nextLength)}[TRUNCATED]`
          : field === "errorMessage"
            ? "Launch failure detail truncated."
            : null;
        setDiagnosticTextField(diagnostic, field, replacement);
        serialized = JSON.stringify(diagnostic);
        if (field === "errorMessage" && nextLength === 0) break;
      }
    }
    if (serialized.length <= MAX_EVENT_JSON_LENGTH) return serialized;
  } catch {
    // Diagnostics must never replace the original Playwright launch error.
  }
  return JSON.stringify({
    event: "line_chat_chromium_launch_failed",
    launchId: metadata.launchId ?? null,
    profileId: metadata.profileId ?? null,
    operationKind: metadata.operationKind?.slice(0, 80) ?? null,
    sessionId: metadata.sessionId?.slice(0, 120) ?? null,
    storeCode: metadata.storeCode?.slice(0, 80) ?? null,
    workerPid: metadata.workerPid ?? process.pid,
    errorMessage: "Diagnostic extraction failed; original launch error preserved.",
  });
}

export async function withChromiumLaunchFailureDiagnostics<T>(
  launch: () => Promise<T>,
  profilePath: string,
  logError: (event: string) => void,
  metadata: {
    launchId?: string;
    profileId?: string;
    operationKind?: string;
    sessionId?: string;
    storeCode?: string;
    workerPid?: number;
  } = {},
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await launch();
  } catch (error: unknown) {
    try {
      const durationMs = performance.now() - startedAt;
      logError(formatFailureDiagnostic(error, profilePath, durationMs, metadata));
    } catch {
      // Preserve the original launch error even if formatting or logging fails.
    }
    throw error;
  }
}
