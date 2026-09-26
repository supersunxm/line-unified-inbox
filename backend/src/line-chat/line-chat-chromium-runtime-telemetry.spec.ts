import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { collectChromiumRuntimeSnapshot } from "./line-chat-chromium-runtime-telemetry";

function writeFile(root: string, relativePath: string, content: string): void {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

test("Linux runtime snapshot extracts task, process, limit, and cgroup counters", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chromium-runtime-telemetry-"));
  const procRoot = path.join(root, "proc");
  const cgroupRoot = path.join(root, "cgroup");
  const procStatus = "Name:\tnode\nState:\tS (sleeping)\nPPid:\t0\nThreads:\t6\n";
  const limits = [
    "Limit                     Soft Limit           Hard Limit           Units",
    "Max processes             1200                 1200                 processes",
    "Max open files            1024                 4096                 files",
  ].join("\n");
  writeFile(procRoot, "self/status", procStatus);
  writeFile(procRoot, "self/limits", limits);
  writeFile(procRoot, "self/fd/0", "");
  writeFile(procRoot, "self/fd/1", "");
  writeFile(procRoot, "101/status", "Name:\tnode\nState:\tS (sleeping)\nPPid:\t0\nThreads:\t4\n");
  writeFile(procRoot, "102/status", "Name:\tchrome\nState:\tZ (zombie)\nPPid:\t1\nThreads:\t2\n");
  writeFile(cgroupRoot, "pids.current", "88\n");
  writeFile(cgroupRoot, "pids.max", "512\n");
  writeFile(cgroupRoot, "pids.events", "max 3\n");
  writeFile(cgroupRoot, "memory.current", "123456\n");
  writeFile(cgroupRoot, "memory.max", "max\n");
  writeFile(cgroupRoot, "memory.events", "low 0\nhigh 0\nmax 1\noom 0\n");

  try {
    const snapshot = await collectChromiumRuntimeSnapshot({
      platform: "linux",
      procRoot,
      cgroupRoot,
      workerPid: 77,
      workerUptimeSeconds: 123,
      capturedAt: new Date("2026-09-25T00:00:00.000Z"),
    });
    assert.equal(snapshot.availability, "AVAILABLE");
    assert.equal(snapshot.worker.pid, 77);
    assert.equal(snapshot.worker.uptimeSeconds, 123);
    assert.equal(snapshot.worker.threads.value, 6);
    assert.equal(snapshot.worker.openFileDescriptors.value, 2);
    assert.deepEqual(snapshot.worker.maxProcesses.value, { soft: 1200, hard: 1200 });
    assert.deepEqual(snapshot.worker.maxOpenFiles.value, { soft: 1024, hard: 4096 });
    assert.equal(snapshot.processScan.processCount, 2);
    assert.equal(snapshot.processScan.threadCount, 6);
    assert.equal(snapshot.processScan.chromiumProcessCount, 1);
    assert.equal(snapshot.processScan.zombieCount, 1);
    assert.equal(snapshot.processScan.reparentedProcessCount, 1);
    assert.equal(snapshot.cgroup.pidsCurrent.value, 88);
    assert.equal(snapshot.cgroup.pidsMax.value, 512);
    assert.deepEqual(snapshot.cgroup.pidsEvents.value, { max: 3 });
    assert.equal(snapshot.cgroup.memoryCurrentBytes.value, 123456);
    assert.equal(snapshot.cgroup.memoryMaxBytes.value, "max");
    assert.deepEqual(snapshot.cgroup.memoryEvents.value, { low: 0, high: 0, max: 1, oom: 0 });
    assert.doesNotMatch(JSON.stringify(snapshot), /\/proc|\/sys\/fs|cookie|token|profilePath/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("unavailable Linux resource files are reported without throwing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chromium-runtime-unavailable-"));
  try {
    const snapshot = await collectChromiumRuntimeSnapshot({
      platform: "linux",
      procRoot: path.join(root, "missing-proc"),
      cgroupRoot: path.join(root, "missing-cgroup"),
    });
    assert.equal(snapshot.availability, "NOT_AVAILABLE");
    assert.equal(snapshot.processScan.status, "NOT_AVAILABLE");
    assert.equal(snapshot.cgroup.pidsCurrent.status, "NOT_AVAILABLE");
    assert.equal(snapshot.cgroup.memoryCurrentBytes.status, "NOT_AVAILABLE");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("non-Linux runtime is marked not applicable without probing host paths", async () => {
  const snapshot = await collectChromiumRuntimeSnapshot({ platform: "darwin" });
  assert.equal(snapshot.availability, "NOT_APPLICABLE");
  assert.equal(snapshot.processScan.status, "NOT_APPLICABLE");
  assert.equal(snapshot.cgroup.pidsCurrent.status, "NOT_APPLICABLE");
});
