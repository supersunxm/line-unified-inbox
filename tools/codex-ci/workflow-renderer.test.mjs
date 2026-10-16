import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectWorkflowInventory } from './workflow-inventory.mjs';
import { renderWorkflowCommand } from './workflow-renderer.mjs';

const root = new URL('../..', import.meta.url).pathname;

test('Agent renderer preserves required commands and remaps only disposable localhost PostgreSQL', async () => {
  const inventory = await inspectWorkflowInventory(root);
  const backend = inventory.jobs.find(job => job.id === 'backend');
  const step = backend.steps.find(step => step.name === 'Sunn Secretary secure owner settings');
  const rendered = renderWorkflowCommand(backend, step, {}, '', {
    runnerHome: '/tmp/synthetic-ci/home', workspace: '/tmp/synthetic-ci/work', tempRoot: '/tmp/synthetic-ci/temp',
    databaseServiceHost: 'postgres', env: { HTTPS_PROXY: 'http://agent-ci-proxy:3128' },
  });
  assert.equal(rendered.commandText, step.run);
  assert.match(rendered.wrapper, /postgresql:\/\/ci:ci@postgres:5432\/ci/);
  assert.equal(rendered.env.HTTPS_PROXY, 'http://agent-ci-proxy:3128');
  assert.throws(() => renderWorkflowCommand({ ...backend, jobEnv: { DATABASE_URL: 'postgresql://synthetic@not-local.invalid:5432/test' } }, step, {}, '', { databaseServiceHost: 'postgres' }), /Unreviewed database service/);
});

test('static asset and Node TypeScript compatibility adapters reject unexpected commands', async () => {
  const inventory = await inspectWorkflowInventory(root);
  const frontend = inventory.jobs.find(job => job.id === 'frontend');
  const build = frontend.steps.find(step => step.name === 'Build');
  const rendered = renderWorkflowCommand(frontend, build);
  assert.equal(rendered.env.CODEX_AGENT_CI_BUILD_ASSET_PROXY, '1');
  assert.match(rendered.env.NODE_OPTIONS, /google-font-fetch-proxy\.cjs$/);
  assert.throws(() => renderWorkflowCommand(frontend, { ...build, run: 'npm run altered' }), /command changed/);
  const auth = inventory.jobs.find(job => job.id === 'web-adaptive-auth');
  const step = auth.steps.find(step => step.name === 'Adaptive authorization regression tests');
  assert.equal(renderWorkflowCommand(auth, step).commandText, 'node --experimental-strip-types --test test/authorization.test.mts');
  assert.throws(() => renderWorkflowCommand(auth, { ...step, run: 'node arbitrary.mts' }), /command changed/);
});

test('rendered wrapper preserves a child failure in its exact exit marker', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-renderer-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const runnerHome = join(directory, 'home');
  const stage = join(runnerHome, 'work/.codex-local-ci');
  await mkdir(stage, { recursive: true });
  const rendered = renderWorkflowCommand({ id: 'synthetic', jobEnv: {}, workingDirectory: '.' }, { name: 'failure', run: 'exit 7', env: {}, shell: 'bash' }, {}, '', {
    runnerHome, workspace: directory, tempRoot: join(directory, 'temp'),
  });
  await writeFile(join(stage, 'workflow-step.sh'), rendered.commandText);
  const child = spawnSync('bash', ['--noprofile', '--norc'], { input: rendered.wrapper, encoding: 'utf8', timeout: 10_000 });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /__CODEX_STEP_RC__7\s*$/);
});


test('actual database fixture predicates allow only the flagged exact disposable PostgreSQL alias', async () => {
  const files = [
    'backend/scripts/test-sunn-secretary-owner-http.cjs',
    'backend/src/ai/sunn-secretary/sunn-secretary-credentials.integration.spec.ts',
    'backend/src/ai/sunn-secretary/sunn-secretary-event-receipt.spec.ts',
  ];
  for (const file of files) {
    const source = await readFile(join(root, file), 'utf8');
    const expression = source.match(/const agentCiDatabaseAlias = ([^;]+);/);
    assert.ok(expression, `${file}: missing explicit disposable-alias predicate`);
    const evaluate = new Function('url', 'process', `const hostname=url.hostname.toLowerCase();return (${expression[1]});`);
    const allowed = 'postgresql://ci:ci@postgres:5432/ci';
    assert.equal(evaluate(new URL(allowed), { env: { CODEX_AGENT_CI_POSTGRES: 'true' } }), true, file);
    for (const value of [undefined, '', 'false', 'TRUE']) {
      assert.equal(evaluate(new URL(allowed), { env: { CODEX_AGENT_CI_POSTGRES: value } }), false, file);
    }
    for (const value of [
      'postgresql://ci:ci@other.invalid:5432/ci',
      'https://ci:ci@postgres:5432/ci',
      'postgresql://other:ci@postgres:5432/ci',
      'postgresql://ci:other@postgres:5432/ci',
      'postgresql://ci:ci@postgres:5433/ci',
      'postgresql://ci:ci@postgres:5432/production',
      'postgresql://ci:ci@postgres:5432/ci?schema=public',
      'postgresql://ci:ci@postgres:5432/ci#fragment',
    ]) assert.equal(evaluate(new URL(value), { env: { CODEX_AGENT_CI_POSTGRES: 'true' } }), false, `${file}: unsafe alias allowed`);
  }
});
