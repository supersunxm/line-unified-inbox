#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inspectSourceTree } from './source-identity.mjs';
import { hooksInstallDecision } from './local-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const gateRecordSchemaVersion = 1;
const policyPath = 'tools/codex-ci/push-policy.json';

function safeBranchRef(value) {
  return typeof value === 'string' && value.length <= 255 &&
    /^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) &&
    !value.includes('..') && value.split('/').every((part) => part && !part.startsWith('.') && !part.endsWith('.') && !part.endsWith('.lock'));
}

export function validatePushPolicy(policy) {
  const keys = ['allowedBranchRefs', 'baseRef', 'remoteName', 'remoteUrl', 'schemaVersion'];
  if (!policy || JSON.stringify(Object.keys(policy).sort()) !== JSON.stringify(keys) || policy.schemaVersion !== 1 ||
      policy.remoteName !== 'origin' || policy.baseRef !== 'refs/heads/main' ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(policy.remoteUrl ?? '')) {
    throw new Error('unsupported committed Agent CI push policy');
  }
  const branches = policy.allowedBranchRefs;
  if (!Array.isArray(branches) || branches.length === 0 || branches.length > 16 || new Set(branches).size !== branches.length ||
      branches.some((ref) => !safeBranchRef(ref) || /^refs\/heads\/(?:main|master|prod|production|release)(?:\/|$)/i.test(ref))) {
    throw new Error('push policy requires an explicit non-production branch allowlist without wildcards');
  }
  return policy;
}

export function verifyRemoteTarget(policy, { name, url, fetchUrl, pushUrl }) {
  validatePushPolicy(policy);
  if (name !== policy.remoteName || url !== policy.remoteUrl || fetchUrl !== policy.remoteUrl || pushUrl !== policy.remoteUrl) {
    throw new Error('remote target differs from the committed owner-reviewed push policy');
  }
}

async function readCommittedPushPolicy() {
  const path = join(root, policyPath);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('push policy is not a regular file');
  const bytes = await readFile(path, 'utf8');
  if (bytes.trim() !== git(['show', `HEAD:${policyPath}`])) throw new Error('push policy differs from the committed policy');
  return validatePushPolicy(JSON.parse(bytes));
}

function verifyConfiguredRemote(policy, name = policy.remoteName, url = policy.remoteUrl) {
  verifyRemoteTarget(policy, {
    name, url,
    fetchUrl: git(['remote', 'get-url', '--all', policy.remoteName]),
    pushUrl: git(['remote', 'get-url', '--push', '--all', policy.remoteName]),
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(args, { cwd = root, timeout = 30_000 } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error || result.status !== 0) throw new Error('required Git state could not be verified');
  return (result.stdout || '').trim();
}

function gitRefSha(ref, cwd = root) {
  try {
    const value = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd });
    return shaPattern.test(value) ? value : null;
  } catch {
    return null;
  }
}

function isAncestor(ancestor, descendant, cwd = root) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd, encoding: 'utf8', timeout: 30_000, stdio: 'ignore',
  });
  return !result.error && result.status === 0;
}

function privateStatus(cwd = root) {
  return git(['status', '--porcelain=v1', '--untracked-files=all'], { cwd }) === '';
}

function recordStore(cwd = root) {
  const common = git(['rev-parse', '--git-common-dir'], { cwd });
  return join(resolve(cwd, common), 'codex-agent-ci', 'verified');
}

export function evaluateGate({
  pushedSha, headSha, workingTreeClean, mainSha, mainIsAncestor,
  record, resultBytes, result, currentSource, verification,
}) {
  const problems = [];
  if (!shaPattern.test(pushedSha ?? '') || pushedSha !== headSha) problems.push('pushed commit must be the exact checked-out HEAD');
  if (workingTreeClean !== true) problems.push('working tree must be clean');
  if (!shaPattern.test(mainSha ?? '')) problems.push('current origin/main is unavailable');
  if (mainIsAncestor !== true) problems.push('current origin/main must be an ancestor of the pushed commit');
  if (!record || record.schemaVersion !== gateRecordSchemaVersion) problems.push('verified Agent CI record is missing or unsupported');
  if (!resultBytes || !result) problems.push('verified Agent CI result is missing or malformed');
  if (!currentSource || currentSource.commitSha !== pushedSha || result?.sourceTreeSha256 !== currentSource.sourceTreeSha256) {
    problems.push('tested source fingerprint does not match the clean pushed commit');
  }
  if (!resultBytes || record?.resultSha256 !== sha256(resultBytes)) problems.push('CI result changed after verification');
  if (record?.commitSha !== pushedSha || result?.commitSha !== pushedSha) problems.push('CI evidence belongs to a different commit');
  if (record?.sourceTreeSha256 !== result?.sourceTreeSha256 || record?.baseSha !== result?.baseSha) {
    problems.push('verified record source or main-base identity differs from the result');
  }
  if (result?.sourceTreeMatchesAtFinish !== true || result?.cleanWorktreeAtStart !== true || result?.cleanWorktreeAtFinish !== true) {
    problems.push('CI did not verify an unchanged clean worktree');
  }
  if (!shaPattern.test(mainSha ?? '') || record?.baseSha !== mainSha || result?.baseSha !== mainSha || result?.baseShaMatchesAtFinish !== true || result?.baseContainsHead !== true) {
    problems.push('CI evidence was not tested against the current main base');
  }
  if (result?.localOnly !== true || result?.githubActionsInvoked !== false || result?.runnerRegistered !== false) {
    problems.push('CI evidence is not from the approved local Agent CI runner');
  }
  if (record?.evidenceDir !== result?.evidenceDir || record?.runId !== result?.runId) problems.push('verified record does not identify the result evidence directory and run');
  if (verification?.status !== 'PASS' || verification?.mandatoryJobs !== 8 || verification?.requiredSkips !== 0 ||
      !Number.isSafeInteger(verification?.mandatorySteps) || verification.mandatorySteps !== result?.mandatoryStepCount ||
      verification?.testedCommit !== pushedSha || verification?.sourceTreeSha256 !== currentSource?.sourceTreeSha256 ||
      verification?.baseSha !== mainSha || verification?.cleanup !== 'PASS' || verification?.productionAccess !== 'NONE' ||
      verification?.githubActions !== 'NOT_USED') {
    problems.push('full Agent CI evidence verification did not pass');
  }
  if (record?.verification?.status !== 'PASS' || record?.verification?.mandatoryJobs !== verification?.mandatoryJobs ||
      record?.verification?.mandatorySteps !== verification?.mandatorySteps || record?.verification?.requiredSkips !== verification?.requiredSkips ||
      record?.verification?.sourceTreeSha256 !== verification?.sourceTreeSha256 || record?.verification?.baseSha !== verification?.baseSha ||
      record?.verification?.testedCommit !== verification?.testedCommit || record?.verification?.cleanup !== verification?.cleanup ||
      record?.verification?.productionAccess !== verification?.productionAccess || record?.verification?.githubActions !== verification?.githubActions) {
    problems.push('recorded verification summary differs from the fresh verification');
  }
  return problems;
}

export function parsePrePushUpdates(input, policy) {
  validatePushPolicy(policy);
  if (typeof input !== 'string' || input.length > 64 * 1024) throw new Error('pre-push input is missing or exceeds the safe limit');
  const lines = input.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length !== 1) throw new Error('Agent CI gate supports exactly one branch update per push');
  const fields = lines[0].trim().split(/\s+/);
  if (fields.length !== 4) throw new Error('pre-push update has an unexpected shape');
  const [localRef, localSha, remoteRef, remoteSha] = fields;
  if (!safeBranchRef(localRef) || !safeBranchRef(remoteRef)) throw new Error('Agent CI gate accepts branch refs only');
  if (!shaPattern.test(localSha) || !shaPattern.test(remoteSha) || localSha.length !== remoteSha.length) throw new Error('pre-push update contains an invalid object ID');
  if (/^0+$/.test(localSha)) throw new Error('Agent CI gate does not authorize branch deletion');
  if (localRef !== remoteRef || !policy.allowedBranchRefs.includes(remoteRef)) throw new Error('branch update is outside the explicit committed allowlist');
  return { localRef, localSha, remoteRef, remoteSha };
}

async function ensurePrivateDirectory(path) {
  try {
    const current = await lstat(path);
    if (!current.isDirectory() || current.isSymbolicLink() || current.uid !== process.getuid() || current.mode & 0o077) {
      throw new Error('unsafe private evidence-record directory');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(path, { mode: 0o700 });
    await chmod(path, 0o700);
  }
}

function safeTemporaryEvidencePath(path) {
  const candidate = resolve(path);
  const roots = [tmpdir(), '/private/tmp', '/tmp'];
  return roots.some((value) => {
    const allowed = resolve(value);
    return candidate === allowed || candidate.startsWith(`${allowed}/`);
  });
}

async function verifyEvidenceDirectory(evidenceDir) {
  const resolved = resolve(evidenceDir);
  if (!safeTemporaryEvidencePath(resolved)) throw new Error('evidence directory is outside the approved temporary locations');
  const info = await lstat(resolved);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || info.mode & 0o077) {
    throw new Error('evidence directory is not private and user-owned');
  }
  const resultPath = join(resolved, 'result.json');
  const resultStat = await lstat(resultPath);
  if (!resultStat.isFile() || resultStat.isSymbolicLink() || resultStat.uid !== process.getuid() || resultStat.mode & 0o077) {
    throw new Error('evidence result is not a private regular file');
  }
  return { resolved, resultPath };
}

export async function persistVerifiedRunRecord({ repo = root, evidenceDir, report, verification }) {
  if (report?.cleanWorktreeAtStart !== true || report?.cleanWorktreeAtFinish !== true ||
      report?.sourceTreeMatchesAtFinish !== true || report?.baseShaMatchesAtFinish !== true ||
      report?.baseContainsHead !== true || verification?.status !== 'PASS' ||
      !shaPattern.test(report?.baseSha ?? '')) {
    return { status: 'BLOCKED', reason: 'run is not eligible for an Agent CI push record' };
  }
  const { resolved, resultPath } = await verifyEvidenceDirectory(evidenceDir);
  const bytes = await readFile(resultPath);
  const result = JSON.parse(bytes.toString('utf8'));
  if (result.commitSha !== report.commitSha || result.sourceTreeSha256 !== report.sourceTreeSha256 || result.runId !== report.runId) {
    return { status: 'BLOCKED', reason: 'verified evidence no longer matches the completed run' };
  }
  const store = recordStore(repo);
  const parent = dirname(store);
  await ensurePrivateDirectory(parent);
  await ensurePrivateDirectory(store);
  const destination = join(store, `${report.commitSha}.json`);
  const temporary = `${destination}.${process.pid}.tmp`;
  const verificationSummary = typeof verification.summary === 'string' ? JSON.parse(verification.summary) : verification;
  const record = {
    schemaVersion: gateRecordSchemaVersion,
    runId: report.runId,
    commitSha: report.commitSha,
    sourceTreeSha256: report.sourceTreeSha256,
    baseSha: report.baseSha,
    evidenceDir: resolved,
    resultSha256: sha256(bytes),
    verification: verificationSummary,
    verifiedAt: new Date().toISOString(),
  };
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temporary, destination);
  await chmod(destination, 0o600);
  return { status: 'RECORDED' };
}

async function readPrivateRecord(path) {
  const directory = await lstat(dirname(path)).catch(() => null);
  if (!directory || !directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== process.getuid() || directory.mode & 0o077) {
    throw new Error('verified Agent CI record directory is not private and user-owned');
  }
  let info;
  try { info = await lstat(path); }
  catch { throw new Error('verified Agent CI record is unavailable'); }
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || info.mode & 0o077) {
    throw new Error('verified Agent CI record is not a private regular file');
  }
  try { return JSON.parse((await readFile(path, 'utf8'))); }
  catch { throw new Error('verified Agent CI record is malformed'); }
}

function runFreshVerifier(evidenceDir) {
  const verifier = join(root, 'tools/codex-ci/agent-evidence.py');
  const result = spawnSync('python3', [verifier, 'verify', `--evidence-dir=${evidenceDir}`, `--repo=${root}`], {
    cwd: root, encoding: 'utf8', timeout: 100_000, maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) throw new Error('fresh Agent CI evidence verification failed');
  try { return JSON.parse(result.stdout.trim()); }
  catch { throw new Error('Agent CI verifier returned malformed evidence'); }
}

async function checkCommit(pushedSha, policy) {
  if (!shaPattern.test(pushedSha ?? '')) throw new Error('pushed commit identity must be a full SHA');
  verifyConfiguredRemote(policy);
  const headSha = git(['rev-parse', '--verify', 'HEAD^{commit}']);
  if (headSha !== pushedSha) throw new Error('pushed commit must equal the checked-out HEAD');
  const workingTreeClean = privateStatus();
  if (!workingTreeClean) throw new Error('working tree must be clean');
  const store = recordStore();
  const record = await readPrivateRecord(join(store, `${pushedSha}.json`));
  const { resolved, resultPath } = await verifyEvidenceDirectory(record.evidenceDir);
  const resultBytes = await readFile(resultPath);
  let result;
  try { result = JSON.parse(resultBytes.toString('utf8')); }
  catch { throw new Error('verified Agent CI result is malformed'); }
  const fetched = spawnSync('git', ['fetch', '--quiet', policy.remoteName, `${policy.baseRef}:refs/remotes/origin/main`], {
    cwd: root, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (fetched.error || fetched.status !== 0) throw new Error('could not refresh origin/main; push is blocked');
  const mainSha = gitRefSha('refs/remotes/origin/main');
  if (!mainSha) throw new Error('current origin/main is unavailable; push is blocked');
  const mainIsAncestor = isAncestor(mainSha, pushedSha);
  const verification = runFreshVerifier(resolved);
  const currentSource = await inspectSourceTree(root);
  const problems = evaluateGate({
    pushedSha,
    headSha,
    workingTreeClean,
    mainSha,
    mainIsAncestor,
    record,
    resultBytes,
    result,
    currentSource,
    verification,
  });
  if (problems.length) throw new Error(`Agent CI push gate blocked:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  if (!privateStatus() || gitRefSha('HEAD') !== pushedSha || gitRefSha('refs/remotes/origin/main') !== mainSha) {
    throw new Error('Git state changed during evidence verification; push is blocked');
  }
  return { status: 'PASS', commitSha: pushedSha, baseSha: mainSha, mandatoryJobs: verification.mandatoryJobs, mandatorySteps: verification.mandatorySteps, sourceTreeSha256: currentSource.sourceTreeSha256 };
}

async function readPrePushInput(stream) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let bytes = 0;
    const timer = setTimeout(() => {
      stream.destroy();
      reject(new Error('timed out reading pre-push update input'));
    }, 10_000);
    timer.unref();
    stream.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        clearTimeout(timer);
        stream.destroy();
        reject(new Error('pre-push input exceeds the safe limit'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.once('error', () => {
      clearTimeout(timer);
      reject(new Error('could not read pre-push update input'));
    });
    stream.once('end', () => {
      clearTimeout(timer);
      resolvePromise(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

async function main(argv) {
  const sha = argv.find((arg) => arg.startsWith('--sha='))?.slice('--sha='.length);
  try {
    if (argv[0] === 'install-hooks' && argv.length === 1) {
      await readCommittedPushPolicy();
      if (!privateStatus()) throw new Error('hook installation requires a clean committed migration candidate');
      const query = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
      if (query.error || ![0, 1].includes(query.status)) throw new Error('existing hook configuration could not be verified');
      const current = (query.stdout || '').trim();
      if (query.status === 1 && current) throw new Error('existing hook configuration is ambiguous');
      const decision = hooksInstallDecision(current);
      if (decision.action === 'refuse') throw new Error('refusing to replace an existing developer hook configuration');
      if (decision.action === 'set') git(['config', 'core.hooksPath', '.githooks']);
      process.stdout.write('Agent CI hook path configured; policy activation requires explicit owner approval.\n');
      return 0;
    }
    const policy = await readCommittedPushPolicy();
    let pushedSha = sha;
    if (argv[0] === 'hook' && argv.length === 3) {
      verifyConfiguredRemote(policy, argv[1], argv[2]);
      const update = parsePrePushUpdates(await readPrePushInput(process.stdin), policy);
      if (git(['symbolic-ref', '--quiet', 'HEAD']) !== update.localRef) throw new Error('pushed branch must be the checked-out branch');
      if (!/^0+$/.test(update.remoteSha) && !isAncestor(update.remoteSha, update.localSha)) throw new Error('non-fast-forward or unverifiable remote update is blocked');
      pushedSha = update.localSha;
    } else if (argv[0] === 'check' && (argv.length === 1 || (argv.length === 2 && argv[1].startsWith('--sha=')))) {
      pushedSha = sha ?? gitRefSha('HEAD');
      if (!policy.allowedBranchRefs.includes(git(['symbolic-ref', '--quiet', 'HEAD']))) throw new Error('checked-out branch is outside the explicit committed allowlist');
    } else {
      throw new Error('usage: node tools/codex-ci/agent-pre-push-gate.mjs hook <remote-name> <remote-url> | check --sha=<full-commit-sha> | install-hooks');
    }
    const result = await checkCommit(pushedSha, policy);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
