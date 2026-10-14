import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, stat, writeFile, cp, rm } from 'node:fs/promises';
import yaml from 'js-yaml';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { expectedJobs, inspectWorkflowInventory } from './workflow-inventory.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const path = await mkdtemp(join(tmpdir(), 'ci-policy-test-'));
  await mkdir(join(path, '.github'), { recursive: true });
  await cp(join(root, '.github/workflows'), join(path, '.github/workflows'), { recursive: true });
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('all five workflows are valid YAML, manual-only, read-only, with all eight mandatory jobs', async () => {
  const inventory = await inspectWorkflowInventory(root);
  assert.deepEqual(inventory.errors, []);
  assert.equal(inventory.jobs.filter(job => job.required).length, 8);
  assert.equal(inventory.jobs.filter(job => job.required).reduce((n, job) => n + job.steps.length, 0), 54);
  assert.deepEqual(inventory.jobs.filter(job => job.required).map(job => job.id), expectedJobs.filter(job => job.required).map(job => job.id));
  for (const job of inventory.jobs.filter(job => job.required)) assert.equal(job.steps.length > 0, true);
});

test('baseline coverage preserves all original 53 commands, plus a mandatory policy/isolation step', async () => {
  const baseline = JSON.parse(await readFile(join(root, 'tools/codex-ci/workflow-coverage.json'), 'utf8'));
  const inventory = await inspectWorkflowInventory(root);
  let count = 0;
  for (const job of inventory.jobs.filter(job => job.required)) {
    const original = baseline.jobs[job.id];
    assert.equal(original.workflow, job.workflow);
    assert.equal(job.steps.length, original.steps.length + (job.id === 'enforce' ? 1 : 0));
    for (let index = 0; index < original.steps.length; index++) {
      let command = job.steps[index].run;
      if (job.id === 'enforce') {
        const guard = 'workflows = sorted(Path(".github/workflows").glob("*.y*ml"))\nif not workflows:\n    sys.exit("Artifact retention policy requires the checked-out workflow files")\nfor path in workflows:';
        assert.ok(command.includes(guard), 'retention must fail closed on absent workflow files');
        command = command.replace(guard, 'for path in sorted(Path(".github/workflows").glob("*.y*ml")):');
      }
      assert.equal(hash(command), original.steps[index].sha256, `${job.id}:${index} lost baseline coverage`);
      count++;
    }
  }
  assert.equal(count, 53);
  const enforcement = inventory.jobs.find(job => job.id === 'enforce');
  assert.match(enforcement.steps.at(-1).run, /npm ci --prefix tools\/codex-ci --ignore-scripts --no-audit --no-fund/);
  assert.match(enforcement.steps.at(-1).run, /node --test tools\/codex-ci\/\*\.test\.mjs tools\/ci-runner\/disposable-guest\.test\.mjs/);
  assert.match(enforcement.steps.at(-1).run, /python3 tools\/codex-ci\/evidence-verifier-test\.py/);
  const source = await readFile(join(root, '.github/workflows/artifact-retention-policy.yml'), 'utf8');
  assert.match(source, /actions\/checkout@v4/);
  assert.match(source, /MAX_DAYS = 3/);
  assert.match(await readFile(join(root, '.github/workflows/tiktok-public-profile-poc.yml'), 'utf8'), /retention-days: 1/);
});

for (const trigger of ['pull_request', 'pull_request_target', 'push', 'schedule', 'workflow_run', 'repository_dispatch', 'workflow_call', 'merge_group', 'check_suite', 'check_run', 'release', 'issue_comment', 'pull_request_review', 'deployment_status', 'status']) {
  test(`automatic trigger ${trigger} blocks Local CI policy`, async t => {
    const path = await fixture(t), workflow = join(path, '.github/workflows/backend-ci.yml');
    const source = await readFile(workflow, 'utf8');
    await writeFile(workflow, source.replace('on:\n', `on:\n  ${trigger}:\n`));
    const inventory = await inspectWorkflowInventory(path);
    assert.ok(inventory.errors.some(message => message.includes('Manual-only')));
  });
}

test('missing manual dispatch and elevated workflow permissions fail closed', async t => {
  const path = await fixture(t), workflow = join(path, '.github/workflows/backend-ci.yml');
  const source = await readFile(workflow, 'utf8');
  await writeFile(workflow, source.replace('  workflow_dispatch:', '  push:').replace('contents: read', 'contents: write'));
  const inventory = await inspectWorkflowInventory(path);
  assert.ok(inventory.errors.some(message => message.includes('Manual-only')));
  assert.ok(inventory.errors.some(message => message.includes('permissions')));
});

test('unknown automatic workflow is rejected rather than silently omitted', async t => {
  const path = await fixture(t);
  await writeFile(join(path, '.github/workflows/unreviewed.yml'), 'name: unreviewed\non: push\njobs: {}\n');
  assert.ok((await inspectWorkflowInventory(path)).errors.some(message => message.includes('inventory drift')));
});

test('repository policy keeps owner approval separate from Local CI and GitHub Checks', async () => {
  const policy = await readFile(join(root, 'docs/LOCAL_CI_POLICY.md'), 'utf8');
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  for (const text of [policy, agents]) {
    assert.match(text, /Local CI is the default mandatory merge verification mechanism/);
    assert.match(text, /Owner authorization is still required for each merge and each production release/);
  }
  assert.match(policy, /does not.*GitHub Checks/);
  assert.match(policy, /never Production/);
  assert.match(policy, /unsigned/);
});

test('every workflow declares exactly one trigger: workflow_dispatch (D1)', async () => {
  for (const name of (await readdir(join(root, '.github/workflows'))).filter(file => /\.ya?ml$/i.test(file))) {
    const document = yaml.load(await readFile(join(root, '.github/workflows', name), 'utf8'));
    assert.ok(document.on && typeof document.on === 'object' && !Array.isArray(document.on), `${name}: on must be a mapping`);
    assert.deepEqual(Object.keys(document.on), ['workflow_dispatch'], `${name} gained an automatic trigger`);
  }
});

for (const [label, replacement] of [['string form', 'on: push\n'], ['list form', 'on: [workflow_dispatch, push]\n']]) {
  test(`automatic trigger in ${label} blocks Local CI policy`, async t => {
    const path = await fixture(t), workflow = join(path, '.github/workflows/backend-ci.yml');
    const source = await readFile(workflow, 'utf8');
    await writeFile(workflow, source.replace(/^on:\n  workflow_dispatch:.*\n/m, replacement));
    assert.notEqual(await readFile(workflow, 'utf8'), source);
    assert.ok((await inspectWorkflowInventory(path)).errors.some(message => message.includes('Manual-only')));
  });
}

test('CLAUDE.md defers CI, merge and deploy to AGENTS.md and never reintroduces auto-merge', async () => {
  const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
  for (const forbidden of [/gh pr merge/i, /--auto\b/, /merge\s+(?:it\s+|them\s+|the PR\s+)?automatically/i, /automatically merge/i, /CI must be green before merge/i, /once every CI check[\s\S]{0,80}green/i, /gh pr checks/i]) {
    assert.doesNotMatch(claude, forbidden, `CLAUDE.md reintroduced auto-merge or hosted-CI gate language: ${forbidden}`);
  }
  assert.match(claude, /except for CI, merge, push, and deploy rules:\s+there `AGENTS\.md`/);
  assert.match(claude, /Agents never merge/);
  assert.match(claude, /agents never merge, enable auto-merge, or deploy/);
  assert.match(claude, /\*\*Local CI evidence is the gate\*\*/);
  assert.match(claude, /never a merge\s+signal/);
  assert.match(claude, /never\s+"green"/);
  assert.match(claude, /Never use\s+`--no-verify`/);
  assert.match(claude, /## Current phase: frontend UI\/UX only/);
  assert.match(claude, /## Store Chats guardrails/);
});

test('AGENTS.md and the policy record owner decisions D1-D4, the push gate and the pre-merge checklist', async () => {
  const policy = await readFile(join(root, 'docs/LOCAL_CI_POLICY.md'), 'utf8');
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  for (const text of [policy, agents]) {
    assert.match(text, /D1\.\*{0,2} GitHub Actions stay `workflow_dispatch`-only permanently/);
    assert.match(text, /D2\.\*{0,2} Railway configuration stays unchanged \(`checkSuites=false`\)/);
    assert.match(text, /D3\.\*{0,2} Merge-commit identity/);
    assert.match(text, /D4\.\*{0,2} Agents may push a branch and open a PR\. Agents never merge/);
    assert.match(text, /No push without verified (?:Local CI )?evidence for the exact HEAD/);
    assert.match(text, /Never use `--no-verify`/);
    assert.match(text, /Pre-merge checklist/);
    assert.match(text, /Railway services whose watch paths match the diff/);
    assert.match(text, /backend pre-deploy migration/);
  }
});

test('root package exposes the Local CI gate scripts and the pre-push hook exists', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['ci:local'], 'node tools/codex-ci/local-gate.mjs run');
  assert.equal(pkg.scripts['ci:local:check'], 'node tools/codex-ci/local-gate.mjs check');
  assert.equal(pkg.scripts['hooks:install'], 'node tools/codex-ci/local-gate.mjs install-hooks');
  const hook = await readFile(join(root, '.githooks/pre-push'), 'utf8');
  assert.match(hook, /^#!\/bin\/sh\n/);
  assert.match(hook, /local-gate\.mjs/);
  assert.equal((await stat(join(root, '.githooks/pre-push'))).mode & 0o111, 0o111);
});
