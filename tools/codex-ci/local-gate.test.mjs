import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { evaluateEvidence, hooksInstallDecision, recordSchemaVersion } from './local-gate.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const head = 'a'.repeat(40);
const main = 'b'.repeat(40);
const required = ['backend', 'frontend'];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function passingResult(commitSha = head) {
  return {
    commitSha,
    sourceTreeMatchesAtFinish: true,
    localDecision: { localRequiredChecks: 'PASS' },
    requiredJobIds: required,
    jobs: [
      ...required.map((id) => ({ id, status: 'PASS', guestCreated: true, guestDisposed: true, steps: [{ name: `${id} step`, status: 'PASS', exitCode: 0 }] })),
      { id: 'live-probe', status: 'BLOCKED' },
    ],
    cleanup: { createdGuestCount: 2, disposedGuestCount: 2, baseAfterRun: { status: 'Stopped' } },
  };
}

function scenario(mutate = {}) {
  const result = mutate.result ?? passingResult();
  const resultBytes = Buffer.from(JSON.stringify(result));
  const record = {
    schemaVersion: recordSchemaVersion, headSha: head, baseSha: main, evidenceDir: '/evidence',
    resultSha256: sha256(resultBytes),
    verification: { evidence: 'VERIFIED', testedCommit: head, publishedHead: head, requiredSkips: 0, mandatoryJobs: 2, mandatorySteps: 2 },
    ...mutate.record,
  };
  return { sha: head, mainSha: main, record, resultBytes: mutate.resultBytes ?? resultBytes, baseIsAncestor: true, mainIsAncestor: true, ...mutate.input };
}

test('complete verified evidence for the exact commit containing origin/main passes', () => {
  assert.deepEqual(evaluateEvidence(scenario()), []);
});

const blocked = [
  ['missing evidence', { input: { record: null } }, /No verified Local CI evidence/],
  ['failed job', { result: { ...passingResult(), localDecision: { localRequiredChecks: 'NOT_MERGEABLE' }, jobs: [{ ...passingResult().jobs[0], status: 'FAIL' }, passingResult().jobs[1]] } }, /not passing/],
  ['stale evidence for an older commit', { record: { headSha: 'c'.repeat(40) }, result: passingResult('c'.repeat(40)) }, /different commit|older or different/],
  ['result tampered after verification', { resultBytes: Buffer.from(JSON.stringify({ ...passingResult(), tampered: true })) }, /changed after verification/],
  ['source changed during the run', { result: { ...passingResult(), sourceTreeMatchesAtFinish: false } }, /Source changed/],
  ['commit without origin/main', { input: { mainIsAncestor: false } }, /does not contain the current origin\/main/],
  ['evidence base older than origin/main', { record: { baseSha: 'd'.repeat(40) } }, /base is not the current origin\/main/],
  ['incomplete guest cleanup', { result: { ...passingResult(), cleanup: { createdGuestCount: 2, disposedGuestCount: 1, baseAfterRun: { status: 'Stopped' } } } }, /guest was confirmed deleted/],
  ['base left running', { result: { ...passingResult(), cleanup: { createdGuestCount: 2, disposedGuestCount: 2, baseAfterRun: { status: 'Running' } } } }, /base was not confirmed stopped/],
  ['interrupted run without final decision', { result: { ...passingResult(), requiredJobIds: undefined, localDecision: undefined } }, /incomplete run/],
  ['skipped mandatory step', { record: { verification: { evidence: 'VERIFIED', testedCommit: head, publishedHead: head, requiredSkips: 1, mandatoryJobs: 2, mandatorySteps: 2 } } }, /skipped/],
  ['unverified record', { record: { verification: { evidence: 'NOT_VERIFIED', testedCommit: head, publishedHead: head, requiredSkips: 0, mandatoryJobs: 2, mandatorySteps: 2 } } }, /did not verify/],
];
for (const [name, mutate, pattern] of blocked) {
  test(`push gate blocks ${name}`, () => {
    const problems = evaluateEvidence(scenario(mutate));
    assert.ok(problems.some((problem) => pattern.test(problem)), problems.join('; '));
  });
}

test('hooks:install never replaces a developer hook path', () => {
  assert.deepEqual(hooksInstallDecision(''), { action: 'set' });
  assert.deepEqual(hooksInstallDecision('.githooks'), { action: 'keep' });
  assert.equal(hooksInstallDecision('.husky').action, 'refuse');
});

test('pre-push hook allows deletions and blocks commits without verified evidence', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'local-gate-hook-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Local Gate Test');
  git('config', 'user.email', 'local-gate-test@example.invalid');
  await mkdir(join(directory, 'tools/codex-ci'), { recursive: true });
  await mkdir(join(directory, '.githooks'), { recursive: true });
  await copyFile(join(root, 'tools/codex-ci/local-gate.mjs'), join(directory, 'tools/codex-ci/local-gate.mjs'));
  await copyFile(join(root, '.githooks/pre-push'), join(directory, '.githooks/pre-push'));
  await chmod(join(directory, '.githooks/pre-push'), 0o755);
  await writeFile(join(directory, 'file.txt'), 'one\n');
  git('add', '.');
  git('commit', '-qm', 'fixture');
  const sha = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', sha);
  const hook = (input) => spawnSync(join(directory, '.githooks/pre-push'), ['origin', 'file:///unused'], { cwd: directory, input, encoding: 'utf8' });

  const missing = hook(`refs/heads/topic ${sha} refs/heads/topic ${'0'.repeat(40)}\n`);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /ถูกบล็อก/);
  assert.match(missing.stderr, /BLOCKED/);
  assert.match(missing.stderr, /No verified Local CI evidence/);

  const deletion = hook(`(delete) ${'0'.repeat(40)} refs/heads/topic ${sha}\n`);
  assert.equal(deletion.status, 0, deletion.stderr);
});
