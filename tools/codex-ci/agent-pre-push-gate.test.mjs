import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { evaluateGate, parsePrePushUpdates, persistVerifiedRunRecord, validatePushPolicy, verifyRemoteTarget } from './agent-pre-push-gate.mjs';

const policy = JSON.parse(await readFile(new URL('./push-policy.json', import.meta.url), 'utf8'));
const branch = policy.allowedBranchRefs[0];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const commitSha = 'a'.repeat(40);
  const baseSha = 'b'.repeat(40);
  const sourceTreeSha256 = 'c'.repeat(64);
  const result = {
    runId: '20261016000000-0123456789',
    commitSha,
    baseSha,
    baseShaMatchesAtFinish: true,
    baseContainsHead: true,
    cleanWorktreeAtStart: true,
    cleanWorktreeAtFinish: true,
    sourceTreeSha256,
    sourceTreeMatchesAtFinish: true,
    evidenceDir: '/private/tmp/agent-ci-evidence-test',
    localOnly: true,
    githubActionsInvoked: false,
    runnerRegistered: false,
    mandatoryStepCount: 55,
  };
  const resultBytes = Buffer.from(JSON.stringify(result));
  const verification = {
    status: 'PASS',
    mandatoryJobs: 8,
    mandatorySteps: 55,
    requiredSkips: 0,
    testedCommit: commitSha,
    baseSha,
    sourceTreeSha256,
    cleanup: 'PASS',
    productionAccess: 'NONE',
    githubActions: 'NOT_USED',
  };
  const record = {
    schemaVersion: 1,
    runId: result.runId,
    commitSha,
    sourceTreeSha256,
    baseSha,
    evidenceDir: result.evidenceDir,
    resultSha256: sha256(resultBytes),
    verification,
  };
  return {
    pushedSha: commitSha,
    headSha: commitSha,
    workingTreeClean: true,
    mainSha: baseSha,
    mainIsAncestor: true,
    record,
    resultBytes,
    result,
    currentSource: { commitSha, sourceTreeSha256 },
    verification,
  };
}

test('complete exact clean evidence bound to the current main base passes', () => {
  assert.deepEqual(evaluateGate(fixture()), []);
});

test('dirty worktree and pushed commit different from HEAD are rejected', () => {
  const dirty = fixture();
  dirty.workingTreeClean = false;
  assert.ok(evaluateGate(dirty).some((problem) => problem.includes('working tree must be clean')));

  const wrongHead = fixture();
  wrongHead.pushedSha = 'd'.repeat(40);
  assert.ok(evaluateGate(wrongHead).some((problem) => problem.includes('exact checked-out HEAD')));
});

test('stale or non-ancestor main base is rejected', () => {
  const stale = fixture();
  stale.mainSha = 'e'.repeat(40);
  assert.ok(evaluateGate(stale).some((problem) => problem.includes('current main base')));

  const unrelated = fixture();
  unrelated.mainIsAncestor = false;
  assert.ok(evaluateGate(unrelated).some((problem) => problem.includes('ancestor')));
});

test('commit and tested source fingerprint must agree across record, result and checkout', () => {
  const changedSource = fixture();
  changedSource.currentSource.sourceTreeSha256 = 'd'.repeat(64);
  assert.ok(evaluateGate(changedSource).some((problem) => problem.includes('source fingerprint')));

  const wrongRecord = fixture();
  wrongRecord.record.commitSha = 'd'.repeat(40);
  assert.ok(evaluateGate(wrongRecord).some((problem) => problem.includes('different commit')));

  const mismatchedRecordSource = fixture();
  mismatchedRecordSource.record.sourceTreeSha256 = 'd'.repeat(64);
  assert.ok(evaluateGate(mismatchedRecordSource).some((problem) => problem.includes('record source or main-base identity')));

  const mismatchedRecordBase = fixture();
  mismatchedRecordBase.record.baseSha = 'd'.repeat(40);
  assert.ok(evaluateGate(mismatchedRecordBase).some((problem) => problem.includes('record source or main-base identity')));
});

test('unsigned changed result cannot reuse a prior verified record', () => {
  const changedResult = fixture();
  changedResult.result.sourceTreeSha256 = 'd'.repeat(64);
  changedResult.resultBytes = Buffer.from(JSON.stringify(changedResult.result));
  assert.ok(evaluateGate(changedResult).some((problem) => problem.includes('changed after verification')));
});

test('partial jobs, steps, skips or cleanup never satisfy the gate', () => {
  const partial = fixture();
  partial.verification.mandatoryJobs = 7;
  assert.ok(evaluateGate(partial).some((problem) => problem.includes('full Agent CI evidence')));

  const skipped = fixture();
  skipped.verification.requiredSkips = 1;
  assert.ok(evaluateGate(skipped).some((problem) => problem.includes('full Agent CI evidence')));

  const cleanup = fixture();
  cleanup.verification.cleanup = 'UNKNOWN';
  assert.ok(evaluateGate(cleanup).some((problem) => problem.includes('full Agent CI evidence')));
});

test('verified record summary must retain zero skips, cleanup, and restricted execution claims', () => {
  for (const [key, value] of [['requiredSkips', 1], ['cleanup', 'UNKNOWN'], ['productionAccess', 'AVAILABLE'], ['githubActions', 'USED']]) {
    const tampered = fixture();
    tampered.record.verification = { ...tampered.record.verification, [key]: value };
    assert.ok(evaluateGate(tampered).some((problem) => problem.includes('recorded verification summary differs')));
  }
});

test('pre-push adapter accepts one branch update, including a new remote branch', () => {
  const localSha = 'a'.repeat(40);
  const update = parsePrePushUpdates(`${branch} ${localSha} ${branch} ${'0'.repeat(40)}\n`, policy);
  assert.equal(update.localSha, localSha);
  assert.equal(update.remoteSha, '0'.repeat(40));
});

test('pre-push adapter rejects multiple updates, tags, deletions, malformed and oversized input', () => {
  const valid = `${branch} ${'a'.repeat(40)} ${branch} ${'b'.repeat(40)}\n`;
  assert.throws(() => parsePrePushUpdates(`${valid}${valid}`, policy), /exactly one branch update/);
  assert.throws(() => parsePrePushUpdates(`refs/tags/release ${'a'.repeat(40)} refs/tags/release ${'b'.repeat(40)}\n`, policy), /branch refs only/);
  assert.throws(() => parsePrePushUpdates(`refs/heads/recovery ${'a'.repeat(40)} refs/heads/main ${'b'.repeat(40)}\n`, policy), /explicit committed allowlist/);
  assert.throws(() => parsePrePushUpdates(`refs/heads/recovery ${'0'.repeat(40)} refs/heads/recovery ${'b'.repeat(40)}\n`, policy), /branch deletion/);
  assert.throws(() => parsePrePushUpdates('not a git', policy), /unexpected shape/);
  assert.throws(() => parsePrePushUpdates('x'.repeat(64 * 1024 + 1), policy), /safe limit/);
});

test('eligible run record is written privately under the Git common directory', async () => {
  const temporary = await import('node:fs/promises').then(({ mkdtemp }) => mkdtemp(join(tmpdir(), 'agent-ci-gate-record-test-')));
  try {
    const repo = join(temporary, 'repo');
    const evidenceDir = join(temporary, 'evidence');
    await mkdir(repo, { mode: 0o700 });
    await mkdir(evidenceDir, { mode: 0o700 });
    execFileSync('git', ['init', '--quiet', repo]);
    const commitSha = 'a'.repeat(40);
    const sourceTreeSha256 = 'c'.repeat(64);
    const baseSha = 'b'.repeat(40);
    const report = {
      runId: '20261016000000-0123456789', commitSha, sourceTreeSha256, baseSha,
      cleanWorktreeAtStart: true, cleanWorktreeAtFinish: true,
      sourceTreeMatchesAtFinish: true, baseShaMatchesAtFinish: true, baseContainsHead: true,
    };
    const resultPath = join(evidenceDir, 'result.json');
    await writeFile(resultPath, JSON.stringify({ ...report, evidenceDir }), { mode: 0o600 });
    await chmod(resultPath, 0o600);
    const verification = {
      status: 'PASS',
      summary: JSON.stringify({
        status: 'PASS', mandatoryJobs: 8, mandatorySteps: 55, requiredSkips: 0,
        testedCommit: commitSha, baseSha, sourceTreeSha256, cleanup: 'PASS',
        productionAccess: 'NONE', githubActions: 'NOT_USED',
      }),
    };
    const written = await persistVerifiedRunRecord({ repo, evidenceDir, report, verification });
    assert.equal(written.status, 'RECORDED');
    const recordPath = join(repo, '.git', 'codex-agent-ci', 'verified', `${commitSha}.json`);
    const recordInfo = await lstat(recordPath);
    assert.equal(recordInfo.mode & 0o077, 0);
    assert.equal(recordInfo.isFile(), true);
    assert.equal(JSON.parse(await readFile(recordPath, 'utf8')).verification.mandatoryJobs, 8);

    const blocked = await persistVerifiedRunRecord({
      repo,
      evidenceDir,
      report: { ...report, cleanWorktreeAtStart: false, commitSha: randomBytes(20).toString('hex') },
      verification,
    });
    assert.equal(blocked.status, 'BLOCKED');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});


test('committed allowlist is exact, reusable and cannot contain wildcards or protected refs', () => {
  assert.equal(validatePushPolicy(policy), policy);
  const future = { ...policy, allowedBranchRefs: ['refs/heads/feature/reviewed-task'] };
  const update = `${future.allowedBranchRefs[0]} ${'a'.repeat(40)} ${future.allowedBranchRefs[0]} ${'b'.repeat(40)}\n`;
  assert.equal(parsePrePushUpdates(update, future).remoteRef, future.allowedBranchRefs[0]);
  for (const refs of [[], ['refs/heads/codex/*'], ['refs/heads/main'], ['refs/heads/release/v1'], [branch, branch], ['refs/heads/codex/../x'], ['refs/heads/codex/x.lock/a']]) {
    assert.throws(() => validatePushPolicy({ ...policy, allowedBranchRefs: refs }), /explicit non-production branch allowlist/);
  }
  assert.throws(() => validatePushPolicy({ ...policy, allowOverride: true }), /unsupported committed/);
  assert.throws(() => parsePrePushUpdates(`${branch} ${'a'.repeat(41)} ${branch} ${'b'.repeat(40)}\n`, policy), /invalid object ID/);
  assert.throws(() => parsePrePushUpdates(`${branch} ${'a'.repeat(40)} refs/heads/codex/other ${'b'.repeat(40)}\n`, policy), /explicit committed allowlist/);
});

test('configured remote and actual push target must exactly match the committed origin', () => {
  const target = { name: 'origin', url: policy.remoteUrl, fetchUrl: policy.remoteUrl, pushUrl: policy.remoteUrl };
  verifyRemoteTarget(policy, target);
  for (const key of Object.keys(target)) {
    assert.throws(() => verifyRemoteTarget(policy, { ...target, [key]: 'unexpected' }), /remote target differs/);
  }
  assert.throws(() => validatePushPolicy({ ...policy, remoteUrl: 'https://credential@example.invalid/project.git' }), /unsupported committed/);
});

test('actual shell hook fails closed without evidence, including every prohibited ref operation', async (t) => {
  const root = new URL('../..', import.meta.url).pathname;
  const directory = await mkdtemp(join(root, '.agent-hook-fixture-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Synthetic Gate Test');
  git('config', 'user.email', 'synthetic-gate@example.invalid');
  git('checkout', '-qb', branch.slice('refs/heads/'.length));
  await mkdir(join(directory, 'tools/codex-ci'), { recursive: true });
  await mkdir(join(directory, '.githooks'));
  for (const name of ['agent-pre-push-gate.mjs', 'source-identity.mjs', 'local-gate.mjs', 'push-policy.json']) {
    await copyFile(join(root, 'tools/codex-ci', name), join(directory, 'tools/codex-ci', name));
  }
  await copyFile(join(root, '.githooks/pre-push'), join(directory, '.githooks/pre-push'));
  await chmod(join(directory, '.githooks/pre-push'), 0o755);
  git('add', '.');
  git('commit', '-qm', 'synthetic fixture');
  git('remote', 'add', 'origin', policy.remoteUrl);
  const sha = git('rev-parse', 'HEAD');
  const valid = `${branch} ${sha} ${branch} ${'0'.repeat(40)}\n`;
  const run = (input, url = policy.remoteUrl) => spawnSync(join(directory, '.githooks/pre-push'), ['origin', url], { cwd: directory, input, encoding: 'utf8', timeout: 10_000 });
  const absent = run(valid);
  assert.equal(absent.status, 1, JSON.stringify({ status: absent.status, error: absent.error?.code, stderr: absent.stderr }));
  assert.match(absent.stderr, /record directory is not private/);
  const unverifiable = run(`${branch} ${sha} ${branch} ${'b'.repeat(40)}\n`);
  assert.match(unverifiable.stderr, /non-fast-forward or unverifiable/);
  for (const input of [valid + valid, `refs/tags/test ${sha} refs/tags/test ${'0'.repeat(40)}\n`, `${branch} ${'0'.repeat(40)} ${branch} ${sha}\n`, `refs/heads/main ${sha} refs/heads/main ${'0'.repeat(40)}\n`, 'not git\n']) {
    const denied = run(input);
    assert.equal(denied.status, 1, denied.stderr);
  }
  assert.match(run(valid, 'file:///unapproved').stderr, /remote target differs/);
  await writeFile(join(directory, 'tools/codex-ci/push-policy.json'), JSON.stringify({ ...policy, allowedBranchRefs: ['refs/heads/feature/tampered'] }));
  assert.match(run(valid).stderr, /differs from the committed policy/);
});
