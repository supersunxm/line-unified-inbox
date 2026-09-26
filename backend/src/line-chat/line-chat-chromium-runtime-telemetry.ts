import * as fs from "node:fs/promises";
import * as path from "node:path";

export type RuntimeReadStatus = "AVAILABLE" | "NOT_AVAILABLE" | "PERMISSION_DENIED" | "NOT_APPLICABLE";
export type RuntimeValue<T> = { status: RuntimeReadStatus; value: T | null };
export type RuntimeLimit = number | "unlimited";

export interface ChromiumRuntimeSnapshot {
  capturedAt: string;
  platform: string;
  availability: "AVAILABLE" | "PARTIAL" | "NOT_AVAILABLE" | "NOT_APPLICABLE";
  worker: {
    pid: number;
    uptimeSeconds: number;
    threads: RuntimeValue<number>;
    openFileDescriptors: RuntimeValue<number>;
    maxProcesses: RuntimeValue<{ soft: RuntimeLimit; hard: RuntimeLimit }>;
    maxOpenFiles: RuntimeValue<{ soft: RuntimeLimit; hard: RuntimeLimit }>;
  };
  processScan: {
    status: RuntimeReadStatus | "PARTIAL";
    processCount: number | null;
    threadCount: number | null;
    chromiumProcessCount: number | null;
    zombieCount: number | null;
    reparentedProcessCount: number | null;
    unreadableStatusCount: number;
  };
  cgroup: {
    pidsCurrent: RuntimeValue<number>;
    pidsMax: RuntimeValue<number | "max">;
    pidsEvents: RuntimeValue<Record<string, number>>;
    memoryCurrentBytes: RuntimeValue<number>;
    memoryMaxBytes: RuntimeValue<number | "max">;
    memoryEvents: RuntimeValue<Record<string, number>>;
  };
}

export interface ChromiumRuntimeTelemetryOptions {
  platform?: string;
  procRoot?: string;
  cgroupRoot?: string;
  capturedAt?: Date;
  workerPid?: number;
  workerUptimeSeconds?: number;
}

type ReadResult = { status: RuntimeReadStatus; text: string | null };

async function readText(filePath: string): Promise<ReadResult> {
  try {
    return { status: "AVAILABLE", text: await fs.readFile(filePath, "utf8") };
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return {
      status: code === "EACCES" || code === "EPERM" ? "PERMISSION_DENIED" : "NOT_AVAILABLE",
      text: null,
    };
  }
}

function scalarNumber(read: ReadResult): RuntimeValue<number> {
  if (read.status !== "AVAILABLE" || read.text === null) return { status: read.status, value: null };
  const value = Number(read.text.trim());
  return Number.isSafeInteger(value) && value >= 0
    ? { status: "AVAILABLE", value }
    : { status: "NOT_AVAILABLE", value: null };
}

function scalarLimit(read: ReadResult): RuntimeValue<number | "max"> {
  if (read.status !== "AVAILABLE" || read.text === null) return { status: read.status, value: null };
  const text = read.text.trim();
  if (text === "max") return { status: "AVAILABLE", value: "max" };
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 0
    ? { status: "AVAILABLE", value }
    : { status: "NOT_AVAILABLE", value: null };
}

function counterMap(read: ReadResult): RuntimeValue<Record<string, number>> {
  if (read.status !== "AVAILABLE" || read.text === null) return { status: read.status, value: null };
  const value: Record<string, number> = {};
  for (const line of read.text.split(/\r?\n/u)) {
    const match = /^([a-zA-Z_]+)\s+(\d+)$/u.exec(line.trim());
    if (!match) continue;
    value[match[1]] = Number(match[2]);
  }
  return Object.keys(value).length > 0
    ? { status: "AVAILABLE", value }
    : { status: "NOT_AVAILABLE", value: null };
}

function parseLimitValue(raw: string | undefined): RuntimeLimit | null {
  if (!raw) return null;
  if (raw.toLowerCase() === "unlimited") return "unlimited";
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function limitPair(read: ReadResult, label: "Max processes" | "Max open files"):
RuntimeValue<{ soft: RuntimeLimit; hard: RuntimeLimit }> {
  if (read.status !== "AVAILABLE" || read.text === null) return { status: read.status, value: null };
  const line = read.text.split(/\r?\n/u).find((item) => item.trim().startsWith(label));
  const match = line ? new RegExp(`^${label}\\s+(.+?)\\s+(.+?)\\s+`, "u").exec(line.trim()) : null;
  const soft = parseLimitValue(match?.[1]);
  const hard = parseLimitValue(match?.[2]);
  return soft !== null && hard !== null
    ? { status: "AVAILABLE", value: { soft, hard } }
    : { status: "NOT_AVAILABLE", value: null };
}

function statusField(text: string, name: string): string | null {
  const line = text.split(/\r?\n/u).find((item) => item.startsWith(`${name}:`));
  return line?.slice(name.length + 1).trim() ?? null;
}

async function mapWithLimit<T, R>(items: T[], limit: number, map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await map(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function processScan(procRoot: string): Promise<ChromiumRuntimeSnapshot["processScan"]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(procRoot, { withFileTypes: true });
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    return {
      status: code === "EACCES" || code === "EPERM" ? "PERMISSION_DENIED" : "NOT_AVAILABLE",
      processCount: null,
      threadCount: null,
      chromiumProcessCount: null,
      zombieCount: null,
      reparentedProcessCount: null,
      unreadableStatusCount: 0,
    };
  }
  const pids = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/u.test(entry.name))
    .map((entry) => entry.name);
  let threadCount = 0;
  let chromiumProcessCount = 0;
  let zombieCount = 0;
  let reparentedProcessCount = 0;
  let unreadableStatusCount = 0;

  await mapWithLimit(pids, 8, async (pid) => {
    const read = await readText(path.join(procRoot, pid, "status"));
    if (read.text === null) {
      unreadableStatusCount += 1;
      return;
    }
    const name = statusField(read.text, "Name") ?? "";
    const state = statusField(read.text, "State") ?? "";
    const threads = Number(statusField(read.text, "Threads"));
    const parentPid = Number(statusField(read.text, "PPid"));
    if (Number.isSafeInteger(threads) && threads > 0) threadCount += threads;
    if (/^(?:chrome|chromium|chrome-headless-shell|chrome_crashpad_handler)/iu.test(name)) chromiumProcessCount += 1;
    if (/^Z\b/u.test(state)) zombieCount += 1;
    if (pid !== "1" && parentPid === 1) reparentedProcessCount += 1;
  });

  return {
    status: unreadableStatusCount === 0 ? "AVAILABLE" : "PARTIAL",
    processCount: pids.length,
    threadCount,
    chromiumProcessCount,
    zombieCount,
    reparentedProcessCount,
    unreadableStatusCount,
  };
}

function overallAvailability(values: Array<RuntimeReadStatus | "PARTIAL">): ChromiumRuntimeSnapshot["availability"] {
  const applicable = values.filter((value) => value !== "NOT_APPLICABLE");
  if (applicable.length === 0) return "NOT_APPLICABLE";
  if (applicable.every((value) => value === "AVAILABLE")) return "AVAILABLE";
  if (applicable.every((value) => value === "NOT_AVAILABLE")) return "NOT_AVAILABLE";
  return "PARTIAL";
}

export async function collectChromiumRuntimeSnapshot(
  options: ChromiumRuntimeTelemetryOptions = {},
): Promise<ChromiumRuntimeSnapshot> {
  const platform = options.platform ?? process.platform;
  const capturedAt = (options.capturedAt ?? new Date()).toISOString();
  const workerPid = options.workerPid ?? process.pid;
  const uptimeSeconds = options.workerUptimeSeconds ?? Math.floor(process.uptime());
  if (platform !== "linux") {
    const notApplicable = <T>(): RuntimeValue<T> => ({ status: "NOT_APPLICABLE", value: null });
    return {
      capturedAt,
      platform,
      availability: "NOT_APPLICABLE",
      worker: {
        pid: workerPid,
        uptimeSeconds,
        threads: notApplicable(),
        openFileDescriptors: notApplicable(),
        maxProcesses: notApplicable(),
        maxOpenFiles: notApplicable(),
      },
      processScan: {
        status: "NOT_APPLICABLE",
        processCount: null,
        threadCount: null,
        chromiumProcessCount: null,
        zombieCount: null,
        reparentedProcessCount: null,
        unreadableStatusCount: 0,
      },
      cgroup: {
        pidsCurrent: notApplicable(),
        pidsMax: notApplicable(),
        pidsEvents: notApplicable(),
        memoryCurrentBytes: notApplicable(),
        memoryMaxBytes: notApplicable(),
        memoryEvents: notApplicable(),
      },
    };
  }

  const procRoot = options.procRoot ?? "/proc";
  const cgroupRoot = options.cgroupRoot ?? "/sys/fs/cgroup";
  const [selfStatus, selfLimits, selfFds, scan, pidsCurrent, pidsMax, pidsEvents, memoryCurrent, memoryMax, memoryEvents] = await Promise.all([
    readText(path.join(procRoot, "self", "status")),
    readText(path.join(procRoot, "self", "limits")),
    fs.readdir(path.join(procRoot, "self", "fd")).then((files) => ({ status: "AVAILABLE" as const, value: files.length }))
      .catch((error: unknown) => {
        const code = error && typeof error === "object" && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
        return { status: code === "EACCES" || code === "EPERM" ? "PERMISSION_DENIED" as const : "NOT_AVAILABLE" as const, value: null };
      }),
    processScan(procRoot),
    readText(path.join(cgroupRoot, "pids.current")),
    readText(path.join(cgroupRoot, "pids.max")),
    readText(path.join(cgroupRoot, "pids.events")),
    readText(path.join(cgroupRoot, "memory.current")),
    readText(path.join(cgroupRoot, "memory.max")),
    readText(path.join(cgroupRoot, "memory.events")),
  ]);
  const selfThreadsRaw = selfStatus.text ? Number(statusField(selfStatus.text, "Threads")) : Number.NaN;
  const workerThreads: RuntimeValue<number> = selfStatus.text && Number.isSafeInteger(selfThreadsRaw) && selfThreadsRaw > 0
    ? { status: "AVAILABLE", value: selfThreadsRaw }
    : { status: selfStatus.status === "AVAILABLE" ? "NOT_AVAILABLE" : selfStatus.status, value: null };
  const maxProcesses = limitPair(selfLimits, "Max processes");
  const maxOpenFiles = limitPair(selfLimits, "Max open files");
  const cgroup = {
    pidsCurrent: scalarNumber(pidsCurrent),
    pidsMax: scalarLimit(pidsMax),
    pidsEvents: counterMap(pidsEvents),
    memoryCurrentBytes: scalarNumber(memoryCurrent),
    memoryMaxBytes: scalarLimit(memoryMax),
    memoryEvents: counterMap(memoryEvents),
  };
  return {
    capturedAt,
    platform,
    availability: overallAvailability([
      workerThreads.status,
      selfFds.status === "AVAILABLE" ? "AVAILABLE" : selfFds.status,
      maxProcesses.status,
      maxOpenFiles.status,
      scan.status,
      cgroup.pidsCurrent.status,
      cgroup.pidsMax.status,
      cgroup.pidsEvents.status,
      cgroup.memoryCurrentBytes.status,
      cgroup.memoryMaxBytes.status,
      cgroup.memoryEvents.status,
    ]),
    worker: {
      pid: workerPid,
      uptimeSeconds,
      threads: workerThreads,
      openFileDescriptors: selfFds,
      maxProcesses,
      maxOpenFiles,
    },
    processScan: scan,
    cgroup,
  };
}
