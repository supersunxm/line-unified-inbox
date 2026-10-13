import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { inspectSourceTree, createSourceArchive } from './source-identity.mjs';
import { expectedJobs, inspectWorkflowInventory } from './workflow-inventory.mjs';
import { workflowNeedsResult, mergeDecision, redactLog } from './policy.mjs';
import { environmentPreflightCommand, parseArgs, renderWorkflowCommand } from './local-ci.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);

async function gitFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'codex-local-ci-test-'));
  execFileSync('git', ['init', '-q', directory]);
  execFileSync('git', ['-C', directory, 'config', 'user.name', 'Local CI Test']);
  execFileSync('git', ['-C', directory, 'config', 'user.email', 'local-ci-test@example.invalid']);
  execFileSync('git', ['-C', directory, 'commit', '--allow-empty', '-qm', 'fixture']);
  return directory;
}

test('inventory is exactly the nine active CI jobs and detects all seven setup-node npm caches', async () => {
  const inventory = await inspectWorkflowInventory(root);
  assert.deepEqual(inventory.errors, []);
  assert.deepEqual(inventory.jobs.map(({ id }) => id), expectedJobs.map(({ id }) => id));
  assert.equal(inventory.jobs.reduce((sum, job) => sum + job.npmCacheActionsNotUsed, 0), 7);
  assert.equal(inventory.jobs.find(({ id }) => id === 'backend').steps.length, 30);
  assert.equal(inventory.jobs.find(({ id }) => id === 'frontend').steps.length, 6);
  assert.equal(inventory.jobs.find(({ id }) => id === 'auth-foundation').postgresImage, 'postgres:16');
  assert.equal(inventory.jobs.find(({ id }) => id === 'live-probe').required, false);
  assert.equal(inventory.jobs.find(({ id }) => id === 'live-probe').steps.some(({ name }) => name.includes('Upload')), false);
});

test('workflow commands retain env references and replace only the non-root Chromium installer', async () => {
  const inventory = await inspectWorkflowInventory(root);
  const backend = inventory.jobs.find(({ id }) => id === 'backend');
  const settings = backend.steps.find(({ name }) => name === 'Sunn Secretary secure owner settings');
  const rendered = renderWorkflowCommand(backend, settings);
  assert.match(rendered.wrapper, /SECRETARY_SETTINGS_TEST_DATABASE_URL='postgresql:\/\/ci:ci@localhost:5432\/ci'/);
  assert.match(rendered.wrapper, /2>&1/);
  assert.match(rendered.wrapper, /bash --noprofile --norc -eo pipefail '\/home\/oppo-ci-runner\/work\/.codex-local-ci\/workflow-step\.sh'/);
  assert.doesNotMatch(rendered.wrapper, /node <<'JS'/);
  assert.equal(rendered.env.SUNN_SECRETARY_WEBHOOK_ENABLED, 'false');

  const heredoc = backend.steps.find(({ name }) => name === 'v2 monthly lint and database regression');
  const heredocCommand = renderWorkflowCommand(backend, heredoc);
  assert.match(heredocCommand.commandText, /node <<'JS'/);
  assert.match(heredocCommand.commandText, /`src\/v2-monthly\/\$\{name\}`/);
  assert.doesNotMatch(heredocCommand.wrapper, /\$\{name\}/);

  const probe = inventory.jobs.find(({ id }) => id === 'live-probe');
  const install = probe.steps.find(({ name }) => name === 'Install Chromium');
  const adapted = renderWorkflowCommand(probe, install, {}, 'synthetic_public_profile');
  assert.match(adapted.commandText, /playwright install chromium/);
  assert.doesNotMatch(adapted.commandText, /--with-deps|sudo|apt-get/);
  assert.equal(adapted.env.PLAYWRIGHT_BROWSERS_PATH, '/home/oppo-ci-runner/.cache/ms-playwright');
});

test('TikTok live probe requires an explicit non-production handle and rejects the production default', () => {
  assert.throws(() => parseArgs(['run', '--allow-public-tiktok-probe']), /explicit non-production --username/);
  assert.throws(() => parseArgs(['run', '--allow-public-tiktok-probe', '--username=o_centralworld']), /refuses the workflow production-profile default/);
  assert.equal(parseArgs(['run', '--allow-public-tiktok-probe', '--username=synthetic_public_profile']).username, 'synthetic_public_profile');
  assert.equal(parseArgs(['run']).username, null);
});

test('the browser base preflight is non-root and checks the reviewed package inventory', () => {
  const command = environmentPreflightCommand({ externalProbe: true });
  assert.match(command, /dpkg-query/);
  assert.match(command, /awk '\$1 == "ii" \{ pkg=\$2/);
  assert.match(command, /xvfb/);
  assert.doesNotMatch(command, /apt-get|--with-deps/);
  const parsed = spawnSync('/bin/bash', ['-n', '-c', command], { encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
});

test('local merge policy fails closed for missing or non-passing mandatory checks', () => {
  const required = ['backend', 'frontend'];
  assert.equal(mergeDecision([{ id: 'backend', status: 'PASS' }], required).localRequiredChecks, 'NOT_MERGEABLE');
  assert.equal(mergeDecision([{ id: 'backend', status: 'PASS' }, { id: 'frontend', status: 'BLOCKED' }], required).localRequiredChecks, 'NOT_MERGEABLE');
  assert.equal(mergeDecision(required.map((id) => ({ id, status: 'PASS' })), required, { sourceTreeMatches: false }).localRequiredChecks, 'NOT_MERGEABLE');
  assert.equal(mergeDecision(required.map((id) => ({ id, status: 'PASS' })), required).localRequiredChecks, 'PASS');
  assert.equal(workflowNeedsResult('BLOCKED'), 'skipped');
});

test('logs redact synthetic credentials and PEM material before evidence retention', () => {
  const output = redactLog([
    'synthetic github_pat_abcdefghijklmnopqrstuvwxyz1234567890',
    'Authorization: Bearer opaque-token-value',
    '-----BEGIN PRIVATE KEY-----\nsynthetic-private-key\n-----END PRIVATE KEY-----',
    'TEST_PASSWORD_VALUE',
  ].join('\n'), ['TEST_PASSWORD_VALUE']);
  assert.doesNotMatch(output, /github_pat_|opaque-token-value|synthetic-private-key|TEST_PASSWORD_VALUE/);
  assert.match(output, /REDACTED GITHUB TOKEN/);
  assert.match(output, /REDACTED PRIVATE KEY/);
});

test('source identity includes dirty and untracked sources but omits generated and credential files', async (t) => {
  const directory = await gitFixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, '.gitignore'), '.env.local\nnode_modules/\n');
  await writeFile(join(directory, 'source.js'), 'export const answer = 1;\n');
  await writeFile(join(directory, 'AI_PROGRESS.md'), 'before\n');
  await writeFile(join(directory, '.env.local.example'), 'SAMPLE=not-a-credential\n');
  await mkdir(join(directory, 'node_modules'), { recursive: true });
  await writeFile(join(directory, 'node_modules', 'ignored.js'), 'generated\n');
  await writeFile(join(directory, '.env.local'), 'PRIVATE=synthetic\n');
  await symlink('source.js', join(directory, 'source-link'));
  execFileSync('git', ['-C', directory, 'add', '.gitignore', 'source.js', 'AI_PROGRESS.md', '.env.local.example', 'source-link']);

  const first = await inspectSourceTree(directory);
  assert.equal(first.entries.some(({ path }) => path === '.env.local'), false);
  assert.equal(first.entries.some(({ path }) => path.startsWith('node_modules/')), false);
  assert.equal(first.entries.some(({ path }) => path === 'AI_PROGRESS.md'), false);
  assert.equal(first.entries.some(({ path }) => path === '.env.local.example'), true);

  await writeFile(join(directory, 'source.js'), 'export const answer = 2;\n');
  await writeFile(join(directory, 'new-source.js'), 'untracked\n');
  const second = await inspectSourceTree(directory);
  assert.notEqual(first.sourceTreeSha256, second.sourceTreeSha256);

  const archiveDir = await mkdtemp(join(tmpdir(), 'codex-local-ci-archive-test-'));
  t.after(() => rm(archiveDir, { recursive: true, force: true }));
  const archivePath = join(archiveDir, 'source.tar.gz');
  await createSourceArchive(directory, second, archivePath, join(archiveDir, 'manifest.json'));
  const entries = execFileSync('/usr/bin/tar', ['-tzf', archivePath], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(entries.sort(), second.entries.filter(({ type }) => type === 'file' || type === 'symlink').map(({ path }) => path).sort());
  assert.equal(entries.some((path) => path.split('/').some((part) => part.startsWith('._'))), false);
  assert.equal(entries.includes('new-source.js'), true);
  assert.equal(entries.includes('.env.local'), false);
  assert.equal(entries.some((path) => path.startsWith('.git/')), false);
  assert.equal(JSON.parse(await readFile(join(archiveDir, 'manifest.json'), 'utf8')).sourceTreeSha256, second.sourceTreeSha256);
});

test('tracked credential-like files stop snapshot creation', async (t) => {
  const directory = await gitFixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'signing.pem'), 'synthetic only\n');
  execFileSync('git', ['-C', directory, 'add', 'signing.pem']);
  await assert.rejects(inspectSourceTree(directory), /Tracked credential-like file/);
});
