#!/usr/bin/env node
// Push/merge gate around the existing Local CI runner and evidence verifier.
// `run` executes the existing supervisor (local-ci.mjs) and verifier
// (evidence.py) for HEAD; `check` is a fast, read-only verification of the
// recorded evidence for one exact commit (used by `.githooks/pre-push`).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shaPattern = /^[0-9a-f]{40}$/;
export const recordSchemaVersion = 1;

function git(args, { cwd = root, allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  }
  return { status: result.status, stdout: (result.stdout || '').trim() };
}

function isAncestor(ancestor, descendant, cwd) {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], { cwd, allowFailure: true }).status === 0;
}

export function evidenceRoot(cwd = root) {
  return join(resolve(cwd, git(['rev-parse', '--git-common-dir'], { cwd }).stdout), 'codex-local-ci');
}

export function recordPath(store, sha) {
  if (!shaPattern.test(sha)) throw new Error('Commit identity must be a full 40-character SHA');
  return join(store, 'verified', `${sha}.json`);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Pure decision over a verified-evidence record and its raw result.json bytes.
// Returns a list of problems; an empty list means the commit may be pushed.
export function evaluateEvidence({ sha, mainSha, record, resultBytes, baseIsAncestor, mainIsAncestor }) {
  const problems = [];
  if (!record) return ['No verified Local CI evidence is recorded for this exact commit'];
  if (record.schemaVersion !== recordSchemaVersion) problems.push('Unsupported evidence record schema');
  if (record.headSha !== sha) problems.push('Evidence record belongs to a different commit');
  const verification = record.verification ?? {};
  if (verification.evidence !== 'VERIFIED') problems.push('evidence.py did not verify this run');
  if (verification.testedCommit !== sha || verification.publishedHead !== sha) problems.push('Verified evidence was produced for an older or different commit');
  if (verification.requiredSkips !== 0) problems.push('Mandatory steps were skipped');
  if (!resultBytes) return [...problems, 'Recorded result.json is missing'];
  if (sha256(resultBytes) !== record.resultSha256) problems.push('result.json changed after verification');

  let result;
  try { result = JSON.parse(resultBytes.toString('utf8')); }
  catch { return [...problems, 'result.json is not valid JSON']; }
  if (result.commitSha !== sha) problems.push('Tested commit differs from the pushed commit');
  if (result.sourceTreeMatchesAtFinish !== true) problems.push('Source changed while Local CI was running');
  if (result.localDecision?.localRequiredChecks !== 'PASS') problems.push('Local CI did not pass every mandatory job');
  if (result.runFailure) problems.push(`Local CI run failed: ${result.runFailure.reason}`);

  const requiredIds = Array.isArray(result.requiredJobIds) ? result.requiredJobIds : [];
  if (!requiredIds.length) problems.push('Mandatory job list is missing (incomplete run)');
  const jobs = new Map((result.jobs ?? []).map((job) => [job.id, job]));
  let steps = 0;
  for (const id of requiredIds) {
    const job = jobs.get(id);
    if (!job) { problems.push(`Mandatory job missing: ${id}`); continue; }
    if (job.status !== 'PASS') problems.push(`Mandatory job not passing: ${id} (${job.status})`);
    if (job.guestCreated !== true || job.guestDisposed !== true) problems.push(`Guest cleanup unverified: ${id}`);
    for (const step of job.steps ?? []) {
      steps++;
      if (step.status !== 'PASS' || step.exitCode !== 0 || step.skipped === true) problems.push(`Mandatory step not passing: ${id}: ${step.name}`);
    }
  }
  if (verification.mandatoryJobs !== requiredIds.length) problems.push('Verified mandatory job count differs from the result');
  if (verification.mandatorySteps !== steps) problems.push('Verified mandatory step count differs from the result');
  const cleanup = result.cleanup ?? {};
  if (cleanup.createdGuestCount !== requiredIds.length || cleanup.disposedGuestCount !== requiredIds.length) problems.push('Not every disposable guest was confirmed deleted');
  if (cleanup.baseAfterRun?.status !== 'Stopped') problems.push('oppo-ci base was not confirmed stopped after the run');

  if (!shaPattern.test(mainSha ?? '')) problems.push('origin/main is unknown; run git fetch origin main');
  else {
    if (!mainIsAncestor) problems.push('Commit does not contain the current origin/main tip; merge origin/main and rerun npm run ci:local');
    if (record.baseSha !== mainSha) problems.push('Evidence base is not the current origin/main tip; rerun npm run ci:local');
  }
  if (!baseIsAncestor) problems.push('Evidence base is not an ancestor of the commit');
  return problems;
}

async function readOptional(path) {
  try { return await readFile(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function checkCommit(sha, { cwd = root } = {}) {
  const store = evidenceRoot(cwd);
  const recordBytes = await readOptional(recordPath(store, sha));
  let record = null;
  if (recordBytes) {
    try { record = JSON.parse(recordBytes.toString('utf8')); }
    catch { return { problems: ['Evidence record is not valid JSON'] }; }
  }
  const mainSha = git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}'], { cwd, allowFailure: true }).stdout || null;
  const resultBytes = record?.evidenceDir ? await readOptional(join(record.evidenceDir, 'result.json')) : null;
  const problems = evaluateEvidence({
    sha, mainSha, record, resultBytes,
    baseIsAncestor: shaPattern.test(record?.baseSha ?? '') && isAncestor(record.baseSha, sha, cwd),
    mainIsAncestor: mainSha ? isAncestor(mainSha, sha, cwd) : false,
  });
  return { problems, record, mainSha };
}

async function privateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.uid !== process.getuid()) throw new Error(`Unsafe evidence directory: ${path}`);
}

function runInherited(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  return result.status ?? 2;
}

async function run() {
  if (git(['status', '--porcelain=v1', '--untracked-files=all']).stdout) {
    throw new Error('Working tree must be clean: Local CI evidence is bound to the committed source. Commit or stash changes first.');
  }
  try { await lstat(join(root, 'tools/codex-ci/node_modules/js-yaml')); }
  catch { throw new Error('Install the pinned workflow parser first: npm ci --prefix tools/codex-ci --ignore-scripts --no-audit --no-fund'); }

  git(['fetch', '--quiet', 'origin', 'main']);
  const head = git(['rev-parse', 'HEAD']).stdout;
  const mainSha = git(['rev-parse', 'refs/remotes/origin/main^{commit}']).stdout;
  if (!isAncestor(mainSha, head, root)) {
    throw new Error(`HEAD ${head} does not contain current origin/main ${mainSha}. Run "git merge origin/main" (merge commit) and rerun npm run ci:local.`);
  }
  const base = git(['merge-base', 'HEAD', mainSha]).stdout;

  const { expectedJobs } = await import('./workflow-inventory.mjs');
  const required = expectedJobs.filter((job) => job.required).map((job) => job.id);
  const store = evidenceRoot();
  const runDirectory = join(store, 'runs', head, new Date().toISOString().replace(/[-:.TZ]/g, ''));
  await privateDirectory(join(store, 'runs', head));
  await privateDirectory(join(store, 'verified'));
  process.stdout.write(`Local CI: head=${head} base=${base} jobs=${required.join(',')}\nEvidence: ${runDirectory}\n`);

  const runStatus = runInherited(process.execPath, [join(root, 'tools/codex-ci/local-ci.mjs'), 'run', `--jobs=${required.join(',')}`, `--evidence-dir=${runDirectory}`]);
  if (runStatus !== 0) throw new Error(`Local CI did not pass (exit ${runStatus}); no evidence was recorded as verified. See ${runDirectory}/result.json`);

  const verify = spawnSync('python3', [join(root, 'tools/codex-ci/evidence.py'), 'verify', `--evidence-dir=${runDirectory}`, `--repo=${root}`, `--base=${base}`, `--head=${head}`], { cwd: root, encoding: 'utf8' });
  process.stderr.write(verify.stderr || '');
  if (verify.status !== 0) throw new Error('evidence.py verify failed; evidence not recorded');
  const verification = JSON.parse(verify.stdout);

  if (git(['rev-parse', 'HEAD']).stdout !== head) throw new Error('HEAD moved during Local CI; evidence not recorded');
  const resultBytes = await readFile(join(runDirectory, 'result.json'));
  const record = {
    schemaVersion: recordSchemaVersion,
    headSha: head,
    baseSha: base,
    evidenceDir: runDirectory,
    resultSha256: sha256(resultBytes),
    verification,
    verifiedAt: new Date().toISOString(),
  };
  const destination = recordPath(store, head);
  await writeFile(`${destination}.tmp`, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  await rename(`${destination}.tmp`, destination);
  process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', head, base, mandatoryJobs: verification.mandatoryJobs, mandatorySteps: verification.mandatorySteps, requiredSkips: verification.requiredSkips, sourceTreeSha256: verification.sourceTreeSha256, resultSha256: record.resultSha256, record: destination }, null, 2)}\n`);
  return 0;
}

async function check(argv) {
  const shaArg = argv.find((arg) => arg.startsWith('--sha='))?.slice('--sha='.length) ?? 'HEAD';
  const sha = git(['rev-parse', '--verify', `${shaArg}^{commit}`]).stdout;
  const { problems, record, mainSha } = await checkCommit(sha);
  if (problems.length) {
    process.stderr.write(`Local CI evidence: NOT VERIFIED for ${sha}\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    return 1;
  }
  process.stdout.write(`Local CI evidence: VERIFIED for ${sha} (base ${mainSha}, ${record.verification.mandatoryJobs} jobs, ${record.verification.mandatorySteps} steps, 0 skips)\n`);
  return 0;
}

// Never overwrite a developer's own hook configuration.
export function hooksInstallDecision(current) {
  if (!current) return { action: 'set' };
  if (current === '.githooks') return { action: 'keep' };
  return { action: 'refuse', reason: `core.hooksPath is already "${current}". Refusing to replace a developer hook configuration; chain .githooks/pre-push from your hooks or unset core.hooksPath and rerun npm run hooks:install.` };
}

function installHooks() {
  const decision = hooksInstallDecision(git(['config', '--get', 'core.hooksPath'], { allowFailure: true }).stdout);
  if (decision.action === 'refuse') { process.stderr.write(`${decision.reason}\n`); return 1; }
  if (decision.action === 'set') git(['config', 'core.hooksPath', '.githooks']);
  process.stdout.write(`core.hooksPath = .githooks (${decision.action === 'set' ? 'installed' : 'already installed'}). pre-push now requires verified Local CI evidence. Local hooks can be bypassed and are not server-side protection.\n`);
  return 0;
}

async function main(argv) {
  if (argv[0] === 'run') return run();
  if (argv[0] === 'check') return check(argv.slice(1));
  if (argv[0] === 'install-hooks') return installHooks();
  process.stdout.write('Usage:\n  node tools/codex-ci/local-gate.mjs run\n  node tools/codex-ci/local-gate.mjs check [--sha=COMMIT]\n  node tools/codex-ci/local-gate.mjs install-hooks\n');
  return argv[0] === 'help' ? 0 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}
