import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withDisposableGuest, recoverGuest, runAsRunner } from './disposable-guest.mjs';

async function harness(t, { failStart = false, failDelete = false } = {}) {
  const stateDir = await mkdtemp(join(tmpdir(), 'ci-lifecycle-test-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const guests = new Map([['oppo-ci', { name: 'oppo-ci', status: 'Stopped' }]]);
  const calls = [];
  const driver = async (args) => {
    calls.push(args);
    if (args[0] === 'list') return [...guests.values()].map((value) => JSON.stringify(value)).join('\n');
    if (args[0] === 'clone') guests.set(args[2], { name: args[2], status: 'Stopped' });
    if (args[0] === 'start') {
      if (failStart) throw new Error('Synthetic start failure');
      guests.get(args[1]).status = 'Running';
    }
    if (args[0] === 'delete') {
      if (failDelete) throw new Error('Synthetic disposal failure');
      guests.delete(args[2]);
    }
    return '';
  };
  return { stateDir, guests, calls, driver };
}
test('fresh names and host-controlled disposal after success and job failure', async (t) => {
  const h = await harness(t);
  const first = await withDisposableGuest(async ({ name }) => name, h);
  let second;
  await assert.rejects(withDisposableGuest(async ({ name }) => {
    second = name; throw new Error('Synthetic job failure');
  }, h));
  assert.notEqual(first, second);
  assert.deepEqual([...h.guests.keys()], ['oppo-ci']);
  const clone = h.calls.find((call) => call[0] === 'clone');
  assert.ok(clone.includes('--mount-none'));
  const cloneArgs = clone.join('\n');
  for (const boundary of [
    '.ssh.forwardAgent = false', '.ssh.forwardX11 = false', '.ssh.loadDotSSHPubKeys = false',
    '.provision = []', '.mounts = []', '.propagateProxyEnv = false',
  ]) assert.ok(cloneArgs.includes(boundary), `missing guest boundary: ${boundary}`);
  assert.match(cloneArgs, /\.portForwards = \[\{\"guestPortRange\": \[1,65535\], \"ignore\": true\}\]/);
});

test('job commands use the restricted guest user and fixed guest-local network/container access', async () => {
  let call;
  const output = await runAsRunner(async (args) => { call = args; return 'synthetic output'; },
    'oppo-job-0123456789abcdef', ['node', '--version']);
  assert.equal(output, 'synthetic output');
  const command = call.join('\n');
  for (const boundary of [
    'sudo', 'runuser', '-u', 'oppo-ci-runner', 'systemd-run', '--user', '--wait', '--collect', '--pipe',
    'DOCKER_HOST=unix:///run/user/1001/docker.sock', 'HTTP_PROXY=http://127.0.0.1:3128',
    'HTTPS_PROXY=http://127.0.0.1:3128', 'NO_PROXY=localhost,127.0.0.1,::1',
    'node', '--version',
  ]) assert.ok(command.includes(boundary), `missing restricted runner boundary: ${boundary}`);
  assert.doesNotMatch(command, /GITHUB_TOKEN|GH_TOKEN|AWS_ACCESS_KEY|LINE_CHANNEL|DATABASE_URL|SSH_AUTH_SOCK|\/Users\//);
  await assert.rejects(runAsRunner(async () => '', 'oppo-ci', ['true']), /Invalid disposable command/);
});
test('runner recovery metadata is durable before guest deletion and cleanup completes before unlock', async (t) => {
  const h = await harness(t);
  const runnerName = 'oppo-ci-job-0123456789abcdef';
  let cleanupRecord;
  const guestName = await withDisposableGuest(async ({ name, updateRecord }) => {
    await updateRecord({ runnerName });
    await updateRecord({ runnerId: 123456 });
    return name;
  }, { ...h, afterDestroy: async (record) => {
    cleanupRecord = record;
    assert.deepEqual([...h.guests.keys()], ['oppo-ci']);
    await access(join(h.stateDir, 'lock', 'job.json'));
  } });
  assert.equal(cleanupRecord.name, guestName);
  assert.equal(cleanupRecord.runnerName, runnerName);
  assert.equal(cleanupRecord.runnerId, 123456);
  await assert.rejects(access(join(h.stateDir, 'lock')));
});
test('failed guest boot is disposed', async (t) => {
  const h = await harness(t, { failStart: true });
  await assert.rejects(withDisposableGuest(() => assert.fail('Job ran'), h));
  assert.deepEqual([...h.guests.keys()], ['oppo-ci']);
});
test('disposal failure retains lock and blocks another job', async (t) => {
  const h = await harness(t, { failDelete: true });
  await assert.rejects(withDisposableGuest(async () => {}, h));
  await access(join(h.stateDir, 'lock', 'job.json'));
  await assert.rejects(withDisposableGuest(async () => {}, h), /locked/);
});
test('cancellation disposes guest even if action does not return', async (t) => {
  const h = await harness(t);
  const controller = new AbortController();
  await assert.rejects(withDisposableGuest(() => {
    controller.abort(); return new Promise(() => {});
  }, { ...h, signal: controller.signal }), /cancelled/);
  assert.deepEqual([...h.guests.keys()], ['oppo-ci']);
});
test('a running base fails closed without cloning', async (t) => {
  const h = await harness(t);
  h.guests.get('oppo-ci').status = 'Running';
  await assert.rejects(withDisposableGuest(() => assert.fail('Job ran'), h), /stopped/);
  assert.ok(!h.calls.some((call) => call[0] === 'clone'));
});
test('orphan recovery deletes only the recorded disposable guest', async (t) => {
  const h = await harness(t);
  const name = 'oppo-job-0000000000000000';
  h.guests.set(name, { name, status: 'Running' });
  await mkdir(join(h.stateDir, 'lock'), { mode: 0o700 });
  await writeFile(join(h.stateDir, 'lock', 'job.json'), JSON.stringify({ name, pid: 2147483647 }));
  await recoverGuest(h);
  assert.deepEqual([...h.guests.keys()], ['oppo-ci']);
});
test('orphan recovery retains the lock until exact runner cleanup succeeds', async (t) => {
  const h = await harness(t);
  const name = 'oppo-job-1111111111111111';
  const runnerName = 'oppo-ci-job-2222222222222222';
  h.guests.set(name, { name, status: 'Running' });
  await mkdir(join(h.stateDir, 'lock'), { mode: 0o700 });
  await writeFile(join(h.stateDir, 'lock', 'job.json'), JSON.stringify({ name, pid: 2147483647, runnerName, runnerId: 789 }));
  let calls = 0;
  const recover = async () => recoverGuest({ ...h, afterDestroy: async (record) => {
    calls += 1;
    assert.equal(record.runnerName, runnerName);
    assert.equal(record.runnerId, 789);
    assert.deepEqual([...h.guests.keys()], ['oppo-ci']);
    if (calls === 1) throw new Error('Synthetic GitHub cleanup failure');
  } });
  await assert.rejects(recover(), /cleanup failure/);
  await access(join(h.stateDir, 'lock', 'job.json'));
  await recover();
  await assert.rejects(access(join(h.stateDir, 'lock')));
  assert.equal(calls, 2);
});
test('recovery cannot delete the base', async (t) => {
  const h = await harness(t);
  await mkdir(join(h.stateDir, 'lock'), { mode: 0o700 });
  await writeFile(join(h.stateDir, 'lock', 'job.json'), JSON.stringify({ name: 'oppo-ci', pid: 2147483647 }));
  await assert.rejects(recoverGuest(h), /Invalid recovery/);
  assert.ok(h.guests.has('oppo-ci'));
});
