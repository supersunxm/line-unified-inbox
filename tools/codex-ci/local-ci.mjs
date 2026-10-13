#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, lstat, mkdtemp, readFile, rm, writeFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { withDisposableGuest, recoverGuest, limaDriver, runAsRunner } from '../ci-runner/disposable-guest.mjs';
import { createSourceArchive, inspectSourceTree } from './source-identity.mjs';
import { expectedJobs, inspectWorkflowInventory } from './workflow-inventory.mjs';
import { mergeDecision, redactLog, workflowNeedsResult } from './policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runnerHome = '/home/oppo-ci-runner';
const workspace = `${runnerHome}/work/repository`;
const allowedBrowserPackages = [
  'at-spi2-common', 'fonts-freefont-ttf', 'fonts-ipafont-gothic', 'fonts-liberation',
  'fonts-noto-color-emoji', 'fonts-tlwg-loma-otf', 'fonts-unifont', 'fonts-wqy-zenhei',
  'libasound2-data', 'libasound2t64', 'libatk-bridge2.0-0t64', 'libatk1.0-0t64',
  'libatspi2.0-0t64', 'libavahi-client3', 'libavahi-common-data', 'libavahi-common3',
  'libcups2t64', 'libfontenc1', 'libfreetype6', 'libunwind8', 'libxdamage1',
  'libxfont2', 'libxres1', 'x11-xkb-utils', 'xfonts-cyrillic', 'xfonts-encodings',
  'xfonts-scalable', 'xfonts-utils', 'xserver-common', 'xvfb',
];
const sourcePolicy = 'Git worktree files from the current commit, index, and non-ignored worktree; excludes .git, dependency/build/cache output, generated CI evidence, AI_PROGRESS.md, and DECISIONS.md. Tracked credential-like files fail closed.';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function parseArgs(argv) {
  const args = { command: argv[0] ?? 'help', jobs: null, evidenceDir: null, allowPublicTikTokProbe: false, username: null };
  for (const arg of argv.slice(1)) {
    if (arg === '--allow-public-tiktok-probe') args.allowPublicTikTokProbe = true;
    else if (arg.startsWith('--job=')) args.jobs = [arg.slice('--job='.length)];
    else if (arg.startsWith('--jobs=')) args.jobs = arg.slice('--jobs='.length).split(',').filter(Boolean);
    else if (arg.startsWith('--evidence-dir=')) args.evidenceDir = resolve(arg.slice('--evidence-dir='.length));
    else if (arg.startsWith('--username=')) args.username = arg.slice('--username='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.username !== null && !/^[A-Za-z0-9._]{1,24}$/.test(args.username)) throw new Error('TikTok username must be a plain public username');
  if (args.allowPublicTikTokProbe && !args.username) throw new Error('A public TikTok probe requires an explicit non-production --username');
  if (args.allowPublicTikTokProbe && args.username.toLowerCase() === 'o_centralworld') {
    throw new Error('The local TikTok probe refuses the workflow production-profile default');
  }
  if (args.jobs && args.jobs.some((id) => !expectedJobs.some((job) => job.id === id))) throw new Error('Unknown CI job ID');
  if (args.jobs && new Set(args.jobs).size !== args.jobs.length) throw new Error('Duplicate CI job selection');
  return args;
}

function nowId() {
  return `${new Date().toISOString().replaceAll(/[^0-9]/g, '').slice(0, 14)}-${randomBytes(5).toString('hex')}`;
}

function workflowEnvValue(value, { availableEnv, dependencies, username }) {
  if (typeof value !== 'string') return String(value);
  let output = value.replace(/\$\{\{\s*env\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_whole, key) => {
    if (!(key in availableEnv)) throw new Error(`Unresolved workflow environment reference: ${key}`);
    return availableEnv[key];
  });
  output = output.replace(/\$\{\{\s*needs\.([A-Za-z0-9_-]+)\.result\s*\}\}/g, (_whole, key) => {
    if (!(key in dependencies)) throw new Error(`Unresolved job dependency result: ${key}`);
    return workflowNeedsResult(dependencies[key]);
  });
  if (output.includes('${{ inputs.username ||')) output = username;
  if (output.includes('${{')) throw new Error('Unsupported GitHub Actions expression in workflow environment');
  return output;
}

function resolvedStepEnv(job, step, dependencyStatuses, username) {
  const merged = { ...job.jobEnv };
  for (const [key, raw] of Object.entries(job.jobEnv)) {
    merged[key] = workflowEnvValue(raw, { availableEnv: merged, dependencies: dependencyStatuses, username });
  }
  for (const [key, raw] of Object.entries(step.env)) {
    merged[key] = workflowEnvValue(raw, { availableEnv: merged, dependencies: dependencyStatuses, username });
  }
  merged.CI = 'true';
  merged.GITHUB_ACTIONS = 'true';
  merged.GITHUB_WORKSPACE = workspace;
  merged.GITHUB_OUTPUT = '/tmp/codex-local-ci/github-output';
  merged.GITHUB_STEP_SUMMARY = '/tmp/codex-local-ci/step-summary';
  merged.GITHUB_JOB = job.id;
  merged.RUNNER_TEMP = '/tmp/codex-local-ci';
  merged.NPM_CONFIG_CACHE = '/tmp/codex-local-ci/npm-cache';
  if (job.externalProbe) merged.PLAYWRIGHT_BROWSERS_PATH = `${runnerHome}/.cache/ms-playwright`;
  return merged;
}

export function renderWorkflowCommand(job, step, dependencyStatuses = {}, username = '') {
  let commandText = step.run;
  if (job.id === 'live-probe' && step.name === 'Install Chromium') {
    if (commandText !== 'npx playwright install --with-deps chromium') {
      throw new Error('TikTok browser installation command changed; local non-sudo adapter needs review');
    }
    commandText = 'npx playwright install chromium';
  }
  const env = resolvedStepEnv(job, step, dependencyStatuses, username);
  const workingDirectory = job.workingDirectory === '.' ? workspace : `${workspace}/${job.workingDirectory}`;
  const envLines = Object.entries(env).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error('Invalid workflow environment variable name');
    return `export ${key}=${shellQuote(value)}`;
  });
  const commandPath = step.shell === 'python'
    ? `${runnerHome}/work/.codex-local-ci/workflow-step.py`
    : `${runnerHome}/work/.codex-local-ci/workflow-step.sh`;
  let invocation;
  if (step.shell === 'python') invocation = `python3 ${shellQuote(commandPath)}`;
  else if (step.shell === 'bash') invocation = `bash --noprofile --norc -eo pipefail ${shellQuote(commandPath)}`;
  else throw new Error(`Unsupported workflow shell: ${step.shell}`);
  invocation += ' 2>&1';
  const wrapper = [
    'set -u',
    `mkdir -p ${shellQuote('/tmp/codex-local-ci')}`,
    `: > ${shellQuote(env.GITHUB_OUTPUT)}`,
    `: > ${shellQuote(env.GITHUB_STEP_SUMMARY)}`,
    `cd ${shellQuote(workingDirectory)}`,
    ...envLines,
    'set +e',
    invocation,
    'code=$?',
    'printf "\\n__CODEX_STEP_RC__%s\\n" "$code"',
    'exit 0',
  ].join('\n');
  return { wrapper, commandText, commandExtension: step.shell === 'python' ? 'py' : 'sh', env };
}

function logSecretValues(env) {
  return Object.entries(env)
    .filter(([key]) => /(TOKEN|PASSWORD|SECRET|PRIVATE|CREDENTIAL|KEY)/i.test(key))
    .map(([, value]) => value)
    .concat(['0123456789abcdef0123456789abcdef']);
}

async function writeLog(evidenceDir, jobId, index, text, env) {
  const path = join(evidenceDir, 'logs', jobId, `${String(index).padStart(2, '0')}.log`);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, redactLog(text, logSecretValues(env)), { mode: 0o600 });
  return path;
}

async function runAsRunnerStep(driver, name, rendered, signal) {
  const stageDir = await mkdtemp(join(tmpdir(), 'codex-local-ci-step-'));
  const commandSource = join(stageDir, `workflow-step.${rendered.commandExtension}`);
  const wrapperSource = join(stageDir, 'workflow-wrapper.sh');
  const guestStage = '/tmp/codex-local-ci-step';
  const guestDirectory = `${runnerHome}/work/.codex-local-ci`;
  const guestCommand = `${guestDirectory}/workflow-step.${rendered.commandExtension}`;
  const guestWrapper = `${guestDirectory}/workflow-wrapper.sh`;
  try {
    await writeFile(commandSource, rendered.commandText, { mode: 0o600 });
    await writeFile(wrapperSource, rendered.wrapper, { mode: 0o600 });
    await driver(['copy', commandSource, `${name}:${guestStage}-command`], { signal });
    await driver(['copy', wrapperSource, `${name}:${guestStage}-wrapper`], { signal });
    await driver(['shell', name, '--', 'sudo', 'install', '-d', '-o', 'oppo-ci-runner', '-g', 'oppo-ci-runner', '-m', '0700', guestDirectory], { signal });
    await driver(['shell', name, '--', 'sudo', 'install', '-o', 'oppo-ci-runner', '-g', 'oppo-ci-runner', '-m', '0400', `${guestStage}-command`, guestCommand], { signal });
    await driver(['shell', name, '--', 'sudo', 'install', '-o', 'oppo-ci-runner', '-g', 'oppo-ci-runner', '-m', '0500', `${guestStage}-wrapper`, guestWrapper], { signal });
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
  const output = await runAsRunner(driver, name, ['/bin/bash', '--noprofile', '--norc', guestWrapper], { signal });
  const marker = output.match(/(?:^|\n)__CODEX_STEP_RC__(\d+)\s*$/);
  if (!marker) throw new Error('Step process returned without a local CI exit marker');
  const log = output.slice(0, marker.index).replace(/\n$/, '');
  return { exitCode: Number(marker[1]), log };
}

async function verifyGuestGone(driver, name) {
  const output = await driver(['list', '--json']);
  const live = output.trim() ? output.trim().split('\n').map((line) => JSON.parse(line)) : [];
  if (live.some((instance) => instance.name === name)) return false;
  const limaHome = process.env.LIMA_HOME ?? join(process.env.HOME, '.lima');
  try { await lstat(join(limaHome, name)); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

async function writeReport(evidenceDir, report) {
  const destination = join(evidenceDir, 'result.json');
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
}

export function environmentPreflightCommand(job) {
  const browserCheck = job.externalProbe
    ? `installed=$(dpkg-query -W -f='\${db:Status-Abbrev} \${binary:Package}\\n' | awk '$1 == "ii" { pkg=$2; sub(/:.*/, "", pkg); print pkg }'); for pkg in ${allowedBrowserPackages.join(' ')}; do grep -Fxq "$pkg" <<<"$installed" || { echo BROWSER_BASE_MISSING; exit 41; }; done`
    : 'true';
  return [
    'set -euo pipefail',
    'test "$(uname -m)" = aarch64',
    'test "$(id -u)" = 1001',
    'if sudo -n true 2>/dev/null; then echo CI_USER_HAS_SUDO; exit 42; fi',
    'test ! -S /var/run/docker.sock',
    'test -S /run/user/1001/docker.sock',
    'python3 --version >/dev/null',
    'node -e \'const cp=require("node:child_process"); const p=process; const v=cp.execFileSync("node",["--version"],{encoding:"utf8"}).trim(); if(Number(v.slice(1).split(".")[0])!==22) process.exit(43); console.log("ENV="+JSON.stringify({arch:p.arch,platform:p.platform,node:v,npm:cp.execFileSync("npm",["--version"],{encoding:"utf8"}).trim(),kernel:cp.execFileSync("uname",["-r"],{encoding:"utf8"}).trim(),docker:cp.execFileSync("docker",["--version"],{encoding:"utf8"}).trim()}))\'',
    'docker info --format "ROOTLESS={{json .SecurityOptions}}" | grep -qi rootless',
    browserCheck,
  ].join('; ');
}

async function checkGuestEnvironment(driver, name, job, signal) {
  const output = await runAsRunner(driver, name, ['/bin/bash', '--noprofile', '--norc', '-c', environmentPreflightCommand(job)], { signal });
  const match = output.match(/ENV=(\{[^\n]+\})/);
  if (!match) throw new Error(job.externalProbe ? 'Trusted browser base packages are incomplete' : 'Guest architecture or toolchain preflight failed');
  return JSON.parse(match[1]);
}

async function verifyGuestSnapshot(driver, name, signal) {
  const code = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const manifest = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const root = process.argv[2];
const expectedPaths = manifest.entries.filter((entry) => entry.type === 'file' || entry.type === 'symlink').map((entry) => entry.path).sort();
const actualPaths = [];
function walk(directory, prefix = '') {
  for (const name of fs.readdirSync(directory)) {
    const relative = prefix ? prefix + '/' + name : name;
    const absolute = path.join(directory, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isDirectory()) walk(absolute, relative);
    else actualPaths.push(relative);
  }
}
walk(root);
actualPaths.sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  const actual = new Set(actualPaths);
  const expected = new Set(expectedPaths);
  const missing = expectedPaths.filter((entry) => !actual.has(entry)).slice(0, 4);
  const extra = actualPaths.filter((entry) => !expected.has(entry)).slice(0, 4);
  throw new Error('snapshot path inventory mismatch; missing=' + JSON.stringify(missing) + '; extra=' + JSON.stringify(extra));
}
for (const entry of manifest.entries) {
  const target = path.resolve(root, entry.path);
  if (!target.startsWith(root + path.sep)) throw new Error('unsafe manifest path');
  if (entry.type === 'deleted') {
    if (fs.existsSync(target)) throw new Error('deleted source path exists');
    continue;
  }
  const stat = fs.lstatSync(target);
  const value = entry.type === 'symlink'
    ? fs.readlinkSync(target)
    : fs.readFileSync(target);
  const digest = crypto.createHash('sha256').update(value).digest('hex');
  if (digest !== entry.sha256) throw new Error('source digest mismatch: ' + entry.path);
  if ((entry.type === 'symlink') !== stat.isSymbolicLink()) throw new Error('source type mismatch: ' + entry.path);
}
console.log('SOURCE_SNAPSHOT_VERIFIED=' + manifest.sourceTreeSha256 + ';files=' + manifest.fileCount);
`;
  const output = await runAsRunner(driver, name, ['node', '-e', code,
    `${runnerHome}/work/codex-source-manifest.json`, workspace], { signal });
  const match = output.match(/SOURCE_SNAPSHOT_VERIFIED=([0-9a-f]{64});files=(\d+)/);
  if (!match) throw new Error('Guest source snapshot identity did not match the host manifest');
  return { sourceTreeSha256: match[1], fileCount: Number(match[2]) };
}

async function startPostgres(driver, name, signal) {
  await runAsRunner(driver, name, [
    'docker', 'run', '--detach', '--name', 'codex-ci-postgres',
    '--publish', '127.0.0.1:5432:5432',
    '--env', 'POSTGRES_USER=ci', '--env', 'POSTGRES_PASSWORD=ci', '--env', 'POSTGRES_DB=ci',
    'postgres:16',
  ], { signal });
  const check = [
    'set -euo pipefail',
    'for attempt in $(seq 1 60); do if docker exec codex-ci-postgres pg_isready -U ci -d ci >/dev/null 2>&1; then exit 0; fi; sleep 1; done',
    'exit 1',
  ].join('; ');
  await runAsRunner(driver, name, ['/bin/bash', '--noprofile', '--norc', '-c', check], { signal });
}

async function cleanupContainers(driver, name) {
  const script = [
    'set -euo pipefail',
    'ids=$(docker ps -aq)',
    'if [ -n "$ids" ]; then docker rm --force --volumes $ids >/dev/null; fi',
    'volumes=$(docker volume ls -q)',
    'if [ -n "$volumes" ]; then docker volume rm $volumes >/dev/null; fi',
    'test -z "$(docker ps -aq)"',
    'test -z "$(docker volume ls -q)"',
    'echo ROOTLESS_CONTAINERS_AND_VOLUMES_CLEAN',
  ].join('; ');
  await runAsRunner(driver, name, ['/bin/bash', '--noprofile', '--norc', '-c', script], { signal: AbortSignal.timeout(30_000) });
}

async function runJob(job, context) {
  const { driver, stateDir, archivePath, manifestPath, evidenceDir, dependencies, username, timeoutMs, controller, hostDiagnosticPaths } = context;
  const result = {
    id: job.id,
    workflow: job.workflow,
    workflowSha256: job.workflowSha256,
    required: job.required,
    status: 'BLOCKED',
    startedAt: new Date().toISOString(),
    guestCreated: false,
    guestDisposed: false,
    rootlessContainerCleanup: job.postgres ? 'NOT_RUN' : 'NOT_APPLICABLE',
    steps: [],
  };
  let guestName = null;
  let failure = null;
  let environment = null;
  let cleanupPassed = !job.postgres;
  let stage = 'guest startup';

  try {
    await withDisposableGuest(async ({ name, signal }) => {
      guestName = name;
      result.guestCreated = true;
      stage = 'source archive transfer';
      await driver(['copy', archivePath, `${name}:/tmp/codex-local-ci-source.tar.gz`], { signal });
      await driver(['copy', manifestPath, `${name}:/tmp/codex-local-ci-source-manifest.json`], { signal });
      stage = 'trusted workspace preparation';
      await driver(['shell', name, '--', 'sudo', 'install', '-d', '-o', 'oppo-ci-runner', '-g', 'oppo-ci-runner', '-m', '0750', `${runnerHome}/work/repository`], { signal });
      await driver(['shell', name, '--', 'sudo', 'install', '-o', 'oppo-ci-runner', '-g', 'oppo-ci-runner', '-m', '0600', '/tmp/codex-local-ci-source.tar.gz', `${runnerHome}/work/codex-source.tar.gz`], { signal });
      await driver(['shell', name, '--', 'sudo', 'install', '-o', 'oppo-ci-runner', '-g', 'oppo-ci-runner', '-m', '0400', '/tmp/codex-local-ci-source-manifest.json', `${runnerHome}/work/codex-source-manifest.json`], { signal });
      const unpack = [
        'set -euo pipefail',
        `tar -xzf ${shellQuote(`${runnerHome}/work/codex-source.tar.gz`)} -C ${shellQuote(workspace)}`,
        `rm ${shellQuote(`${runnerHome}/work/codex-source.tar.gz`)}`,
        `mkdir -p ${shellQuote('/tmp/codex-local-ci')}`,
        `test -f ${shellQuote(`${workspace}/.github/workflows/${job.workflow}`)}`,
      ].join('; ');
      await runAsRunner(driver, name, ['/bin/bash', '--noprofile', '--norc', '-c', unpack], { signal });
      stage = 'guest source snapshot verification';
      result.sourceSnapshot = await verifyGuestSnapshot(driver, name, signal);

      stage = 'guest toolchain and isolation preflight';
      environment = await checkGuestEnvironment(driver, name, job, signal);
      result.environment = environment;
      if (job.postgres) {
        stage = 'rootless PostgreSQL service startup';
        await startPostgres(driver, name, signal);
        const imageId = await runAsRunner(driver, name, ['docker', 'image', 'inspect', '--format', '{{.Id}}', job.postgresImage], { signal });
        result.postgres = { status: 'READY', image: job.postgresImage, imageId: imageId.trim() };
      }

      for (let index = 0; index < job.steps.length; index += 1) {
        if (controller.signal.aborted) throw new Error('Local CI execution cancelled');
        const step = job.steps[index];
        stage = `workflow step ${step.name}`;
        let rendered;
        try { rendered = renderWorkflowCommand(job, step, dependencies, username); }
        catch (error) {
          failure = { status: 'BLOCKED', reason: error.message, stage: `workflow expression: ${step.name}` };
          break;
        }
        const stepResult = { name: step.name, startedAt: new Date().toISOString(), status: 'BLOCKED' };
        try {
          const execution = await runAsRunnerStep(driver, name, rendered, signal);
          const logPath = await writeLog(evidenceDir, job.id, index + 1, execution.log, rendered.env);
          stepResult.log = logPath;
          stepResult.exitCode = execution.exitCode;
          stepResult.status = execution.exitCode === 0 ? 'PASS' : 'FAIL';
          stepResult.outputSha256 = (await import('node:crypto')).createHash('sha256').update(redactLog(execution.log, logSecretValues(rendered.env))).digest('hex');
          if (execution.exitCode !== 0) {
            failure = {
              status: 'FAIL',
              reason: `Workflow command exited ${execution.exitCode}`,
              stage: step.name,
            };
          }
        } catch (error) {
          stepResult.status = 'BLOCKED';
          stepResult.reason = error.message;
          failure = { status: 'BLOCKED', reason: error.message, stage: step.name };
        }
        stepResult.finishedAt = new Date().toISOString();
        result.steps.push(stepResult);
        if (failure) break;
      }
      if (!failure) result.status = 'PASS';
      else if (failure.status === 'FAIL') result.status = 'FAIL';
      else result.status = 'BLOCKED';

      if (job.postgres) {
        try {
          stage = 'rootless service cleanup';
          await cleanupContainers(driver, name);
          cleanupPassed = true;
          result.rootlessContainerCleanup = 'PASS';
        } catch {
          cleanupPassed = false;
          result.rootlessContainerCleanup = 'BLOCKED';
          failure = { status: 'BLOCKED', reason: 'Rootless container/volume cleanup could not be verified', stage: 'cleanup' };
          result.status = 'BLOCKED';
        }
      }
    }, { stateDir, driver, timeoutMs, signal: controller.signal });
    result.guestDisposed = true;
  } catch (error) {
    if (!failure) failure = { status: 'BLOCKED', reason: error.message, stage };
    const diagnosticPath = hostDiagnosticPaths.at(-1);
    if (diagnosticPath) failure.diagnosticPath = diagnosticPath;
    if (guestName) {
      try { result.guestDisposed = await verifyGuestGone(driver, guestName); }
      catch { result.guestDisposed = false; }
    }
    result.status = failure.status === 'FAIL' && result.guestDisposed ? 'FAIL' : 'BLOCKED';
  }

  if (job.postgres && !cleanupPassed) result.status = 'BLOCKED';
  if (!result.guestDisposed && result.guestCreated) {
    result.status = 'BLOCKED';
    failure = { status: 'BLOCKED', reason: 'Disposable guest deletion is unverified; scheduling lock retained', stage: 'guest disposal' };
  }
  if (failure) result.failure = failure;
  result.finishedAt = new Date().toISOString();
  return result;
}

export async function inspectBase() {
  const result = spawnSync('/opt/homebrew/bin/limactl', ['--tty=false', 'list', '--json'], {
    encoding: 'utf8',
    env: {
      HOME: process.env.HOME,
      LIMA_HOME: process.env.LIMA_HOME,
      PATH: '/opt/homebrew/bin:/usr/bin:/bin',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) return { present: null, status: 'UNVERIFIED', reason: 'Read-only Lima inventory failed' };
  const diagnostic = result.stderr ?? '';
  let items;
  try { items = result.stdout.trim() ? result.stdout.trim().split('\n').map((line) => JSON.parse(line)) : []; }
  catch { return { present: null, status: 'UNVERIFIED', reason: 'Lima inventory was not valid JSON' }; }
  if (/operation not permitted|failed to determine the boot session ID/i.test(diagnostic)) {
    return { present: items.some((instance) => instance.name === 'oppo-ci'), status: 'UNVERIFIED', reason: 'Sandbox cannot inspect macOS boot-session metadata' };
  }
  const base = items.find((instance) => instance.name === 'oppo-ci');
  const arm64Image = base?.config?.images?.find((image) => image.arch === 'aarch64');
  return {
    present: Boolean(base),
    status: base?.status ?? 'ABSENT',
    arch: base?.arch ?? null,
    vmType: base?.vmType ?? null,
    limaVersion: base?.limaVersion ?? null,
    arm64ImageDigest: arm64Image?.digest ?? null,
  };
}

async function run(args) {
  const identity = await inspectSourceTree(root);
  const inventory = await inspectWorkflowInventory(root);
  const requested = new Set(args.jobs ?? expectedJobs.map(({ id }) => id));
  const runId = nowId();
  const evidenceDir = args.evidenceDir ?? join(tmpdir(), `codex-local-ci-${runId}`);
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  const evidenceStat = await lstat(evidenceDir);
  if (!evidenceStat.isDirectory() || evidenceStat.uid !== process.getuid() || (evidenceStat.mode & 0o077)) {
    throw new Error('Evidence directory must be owned by the current user and mode 0700 or stricter');
  }
  const archivePath = join(evidenceDir, 'source-snapshot.tar.gz');
  const manifestPath = join(evidenceDir, 'source-manifest.json');
  await createSourceArchive(root, identity, archivePath, manifestPath);
  const stateDir = join('/private/tmp', `codex-ci-supervisor-state-${process.getuid()}`);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  const hostDiagnosticPaths = [];
  const driver = limaDriver(undefined, {
    onFailure: async ({ operation, output, diagnostic }) => {
      const path = join(evidenceDir, 'host-diagnostics', `${String(hostDiagnosticPaths.length + 1).padStart(2, '0')}-${operation}.log`);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, redactLog(`${output}\n${diagnostic}`), { mode: 0o600 });
      hostDiagnosticPaths.push(path);
    },
  });
  const report = {
    schemaVersion: 1,
    runId,
    localOnly: true,
    githubActionsInvoked: false,
    runnerRegistered: false,
    commitSha: identity.commitSha,
    sourceTreeSha256: identity.sourceTreeSha256,
    sourceFileCount: identity.fileCount,
    sourceTreePolicy: sourcePolicy,
    workflowHashes: inventory.workflowHashes,
    startedAt: new Date().toISOString(),
    evidenceDir,
    hostDiagnosticPaths,
    environment: { guestBase: await inspectBase() },
    inventoryErrors: inventory.errors,
    jobs: [],
  };

  try {
    if (inventory.errors.length) {
      report.jobs = inventory.jobs.map((job) => ({
        id: job.id, workflow: job.workflow, required: job.required,
        status: 'BLOCKED',
        failure: { status: 'BLOCKED', stage: 'inventory', reason: inventory.errors.join('; ') },
      }));
    } else {
      await recoverGuest({ stateDir, driver });
      const base = report.environment.guestBase;
      if (!base.present || base.status !== 'Stopped') {
        throw new Error('Credential-free ARM64 oppo-ci base must exist and remain stopped');
      }
      let fatalLifecycleFailure = null;
      const resultsById = new Map();
      for (const job of inventory.jobs) {
        report.inProgressJob = job.id;
        await writeReport(evidenceDir, report);
        const dependencies = Object.fromEntries([...resultsById].map(([id, result]) => [id, result.status]));
        let jobResult;
        if (!requested.has(job.id)) {
          jobResult = { id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'selection', reason: 'Not selected in this invocation' } };
        } else if (job.externalProbe && !args.allowPublicTikTokProbe) {
          jobResult = { id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'external probe', reason: 'Public TikTok probe is opt-in; no external profile was contacted' } };
        } else if (fatalLifecycleFailure) {
          jobResult = { id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'guest lifecycle', reason: fatalLifecycleFailure } };
        } else {
          const timeoutMs = Math.min(job.timeoutMinutes * 60_000, 3_600_000);
          jobResult = await runJob(job, { driver, stateDir, archivePath, manifestPath, evidenceDir, dependencies, username: args.username, timeoutMs, controller, hostDiagnosticPaths, report });
          if (jobResult.guestCreated && !jobResult.guestDisposed) fatalLifecycleFailure = 'Guest disposal could not be verified; no further jobs scheduled';
        }
        delete report.inProgressJob;
        resultsById.set(job.id, jobResult);
        report.jobs.push(jobResult);
        report.updatedAt = new Date().toISOString();
        await writeReport(evidenceDir, report);
      }
    }
  } catch (error) {
    report.runFailure = { status: 'BLOCKED', reason: error.message };
    for (const spec of expectedJobs) {
      if (!report.jobs.some((job) => job.id === spec.id)) {
        report.jobs.push({ id: spec.id, workflow: spec.workflow, required: spec.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'run setup', reason: error.message } });
      }
    }
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }

  const finalIdentity = await inspectSourceTree(root);
  report.finishedAt = new Date().toISOString();
  report.currentSourceTreeSha256 = finalIdentity.sourceTreeSha256;
  report.sourceTreeMatchesAtFinish = finalIdentity.commitSha === identity.commitSha && finalIdentity.sourceTreeSha256 === identity.sourceTreeSha256;
  report.requiredJobIds = expectedJobs.filter((spec) => spec.required).map((spec) => spec.id);
  report.advisoryJobIds = expectedJobs.filter((spec) => !spec.required).map((spec) => spec.id);
  report.localDecision = mergeDecision(report.jobs, report.requiredJobIds, { sourceTreeMatches: report.sourceTreeMatchesAtFinish });
  report.localDecision.githubRequiredChecksEquivalent = false;
  report.localDecision.githubRequiredChecksStatus = 'NOT_VERIFIED_OR_ENFORCED_BY_LOCAL_CI';
  report.localDecision.mergeReadiness = 'NOT_MERGEABLE_WITH_LOCAL_EVIDENCE_ALONE';
  report.cleanup = {
    createdGuestCount: report.jobs.filter((job) => job.guestCreated).length,
    disposedGuestCount: report.jobs.filter((job) => job.guestDisposed).length,
    baseAfterRun: await inspectBase().catch(() => ({ present: null, status: 'UNVERIFIED' })),
    rootlessDockerSocketWasGuestLocal: true,
    githubRunnerRegistration: 'NOT_USED',
  };
  await writeReport(evidenceDir, report);
  process.stdout.write(`${JSON.stringify({ runId, commitSha: report.commitSha, sourceTreeSha256: report.sourceTreeSha256, evidenceDir, localDecision: report.localDecision, jobs: report.jobs.map(({ id, status, required, failure }) => ({ id, status, required, ...(failure ? { failure } : {}) })) }, null, 2)}\n`);
  return report.localDecision.localRequiredChecks === 'PASS' && report.sourceTreeMatchesAtFinish ? 0 : 1;
}

async function plan() {
  const [identity, inventory, base] = await Promise.all([
    inspectSourceTree(root),
    inspectWorkflowInventory(root),
    inspectBase().catch(() => ({ present: null, status: 'UNVERIFIED' })),
  ]);
  process.stdout.write(`${JSON.stringify({
    mode: 'Codex-operated local validation; no GitHub Actions invocation or runner registration',
    commitSha: identity.commitSha,
    sourceTreeSha256: identity.sourceTreeSha256,
    sourceFileCount: identity.fileCount,
    workflowHashes: inventory.workflowHashes,
    inventoryErrors: inventory.errors,
    remoteNpmCacheStepsNotUsed: inventory.jobs.reduce((sum, job) => sum + job.npmCacheActionsNotUsed, 0),
    jobs: inventory.jobs.map(({ id, name, workflow, required, postgres, postgresImage, timeoutMinutes, steps, npmCacheActionsNotUsed }) => ({ id, name, workflow, required, postgres, postgresImage, timeoutMinutes, runStepCount: steps.length, npmCacheStepsNotUsed: npmCacheActionsNotUsed })),
    base,
    sourceTreePolicy: sourcePolicy,
    localValidationIsNotGitHubRequiredChecks: true,
  }, null, 2)}\n`);
  return inventory.errors.length ? 1 : 0;
}

function usage() {
  process.stdout.write('Usage:\n  node tools/codex-ci/local-ci.mjs plan\n  node tools/codex-ci/local-ci.mjs run [--job=ID | --jobs=ID,ID] [--evidence-dir=/absolute/path] [--allow-public-tiktok-probe --username=NON_PRODUCTION_PUBLIC_NAME]\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'plan') return plan();
  if (args.command === 'run') return run(args);
  usage();
  return args.command === 'help' ? 0 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${redactLog(error.message)}\n`);
    process.exitCode = 2;
  });
}
