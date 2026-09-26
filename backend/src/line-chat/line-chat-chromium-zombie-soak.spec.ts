import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";

interface ProcessSnapshot {
  processCount: number;
  chromiumProcessCount: number;
  zombieCount: number;
  reparentedProcessCount: number;
  threadCount: number;
  pidsCurrent: number | null;
}

interface ProcessInfo {
  pid: number;
  name: string;
  state: string;
  parentPid: number;
  threads: number;
}

const soakEnabled = process.env.RUN_LINUX_CHROMIUM_SOAK === "1";
const defaultRotations = 50;
const settleTimeoutMs = 2_000;
const sampleIntervalMs = 100;

function parseStatus(text: string): Omit<ProcessInfo, "pid"> {
  const fields = new Map<string, string>();
  for (const line of text.split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields.set(line.slice(0, separator), line.slice(separator + 1).trim());
  }
  const threads = Number(fields.get("Threads"));
  const parentPid = Number(fields.get("PPid"));
  return {
    name: fields.get("Name") ?? "",
    state: fields.get("State")?.split(/\s+/u)[0] ?? "",
    parentPid: Number.isSafeInteger(parentPid) ? parentPid : -1,
    threads: Number.isSafeInteger(threads) && threads > 0 ? threads : 0,
  };
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

async function processSnapshot(): Promise<ProcessSnapshot> {
  const entries = await fs.readdir("/proc", { withFileTypes: true });
  const pids = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/u.test(entry.name))
    .map((entry) => entry.name);
  const scanned = await mapWithLimit(pids, 8, async (pid): Promise<ProcessInfo | null> => {
    try {
      return { pid: Number(pid), ...parseStatus(await fs.readFile(`/proc/${pid}/status`, "utf8")) };
    } catch {
      // A process can exit between reading /proc and opening its status file.
      return null;
    }
  });
  const processes = scanned.filter((process): process is ProcessInfo => process !== null);

  let pidsCurrent: number | null = null;
  try {
    const value = Number((await fs.readFile("/sys/fs/cgroup/pids.current", "utf8")).trim());
    if (Number.isSafeInteger(value) && value >= 0) pidsCurrent = value;
  } catch {
    // Cgroup telemetry is optional on Linux hosts without cgroup v2.
  }

  return {
    processCount: processes.length,
    chromiumProcessCount: processes.filter((process) => /^(?:chrome|chromium|headless_shell)/iu.test(process.name)).length,
    zombieCount: processes.filter((process) => process.state === "Z").length,
    reparentedProcessCount: processes.filter((process) => process.pid !== 1 && process.parentPid === 1).length,
    threadCount: processes.reduce((total, process) => total + process.threads, 0),
    pidsCurrent,
  };
}

function updatePeak(peak: ProcessSnapshot, sample: ProcessSnapshot): void {
  peak.processCount = Math.max(peak.processCount, sample.processCount);
  peak.chromiumProcessCount = Math.max(peak.chromiumProcessCount, sample.chromiumProcessCount);
  peak.zombieCount = Math.max(peak.zombieCount, sample.zombieCount);
  peak.reparentedProcessCount = Math.max(peak.reparentedProcessCount, sample.reparentedProcessCount);
  peak.threadCount = Math.max(peak.threadCount, sample.threadCount);
  if (sample.pidsCurrent !== null) {
    peak.pidsCurrent = Math.max(peak.pidsCurrent ?? sample.pidsCurrent, sample.pidsCurrent);
  }
}

function isAtBaseline(sample: ProcessSnapshot, baseline: ProcessSnapshot): boolean {
  return sample.zombieCount <= baseline.zombieCount
    && sample.chromiumProcessCount <= baseline.chromiumProcessCount
    && sample.processCount <= baseline.processCount + 1
    && sample.reparentedProcessCount <= baseline.reparentedProcessCount + 1;
}

async function waitForBaseline(baseline: ProcessSnapshot, peak: ProcessSnapshot): Promise<ProcessSnapshot> {
  const deadline = Date.now() + settleTimeoutMs;
  let latest = await processSnapshot();
  updatePeak(peak, latest);
  while (!isAtBaseline(latest, baseline) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, sampleIntervalMs));
    latest = await processSnapshot();
    updatePeak(peak, latest);
  }
  return latest;
}

test("Linux Chromium context rotations return process counts to baseline under tini", {
  skip: soakEnabled ? false : "Set RUN_LINUX_CHROMIUM_SOAK=1 inside the worker Linux container.",
}, async () => {
  assert.equal(process.platform, "linux", "The Chromium zombie soak must run in Linux.");
  const rotations = Number(process.env.CHROMIUM_SOAK_ROTATIONS ?? defaultRotations);
  assert.ok(Number.isSafeInteger(rotations) && rotations >= 30, "Use at least 30 context rotations.");

  const pid1 = (await fs.readFile("/proc/1/comm", "utf8")).trim();
  assert.match(pid1, /tini/iu, "The worker container must run tini as PID 1 for this soak.");

  const profileDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "line-chat-chromium-zombie-soak-"));
  const baseline = await processSnapshot();
  const peak = { ...baseline };
  let final = baseline;

  try {
    assert.equal(baseline.zombieCount, 0, "The soak container must start without zombies.");
    assert.equal(baseline.chromiumProcessCount, 0, "The soak container must start without Chromium processes.");

    for (let rotation = 1; rotation <= rotations; rotation += 1) {
      const context = await chromium.launchPersistentContext(profileDirectory, {
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await context.newPage();
        await page.setContent(`<title>rotation-${rotation}</title><main>ok</main>`);
        await page.title();
        const activeSnapshot = await processSnapshot();
        updatePeak(peak, activeSnapshot);
        assert.ok(
          activeSnapshot.chromiumProcessCount > baseline.chromiumProcessCount,
          `Chromium was not visible in /proc during rotation ${rotation}: ${JSON.stringify(activeSnapshot)}`,
        );
      } finally {
        await context.close();
      }

      final = await waitForBaseline(baseline, peak);
      assert.ok(isAtBaseline(final, baseline), `Process counts did not return to baseline after rotation ${rotation}: ${JSON.stringify(final)}`);
    }
  } finally {
    await fs.rm(profileDirectory, { force: true, recursive: true });
  }

  assert.ok(final.zombieCount <= baseline.zombieCount, "Zombie count must not accumulate across rotations.");
  assert.ok(final.chromiumProcessCount <= baseline.chromiumProcessCount, "Chromium processes must not accumulate across rotations.");

  process.stdout.write(`${JSON.stringify({
    result: "LINUX_CONTAINER_PASS",
    pid1,
    rotations,
    zombieCount: { baseline: baseline.zombieCount, peak: peak.zombieCount, final: final.zombieCount },
    processCount: { baseline: baseline.processCount, peak: peak.processCount, final: final.processCount },
    chromiumProcessCount: { baseline: baseline.chromiumProcessCount, peak: peak.chromiumProcessCount, final: final.chromiumProcessCount },
    threadCount: { baseline: baseline.threadCount, peak: peak.threadCount, final: final.threadCount },
    pidsCurrent: { baseline: baseline.pidsCurrent, peak: peak.pidsCurrent, final: final.pidsCurrent },
  })}\n`);
});
