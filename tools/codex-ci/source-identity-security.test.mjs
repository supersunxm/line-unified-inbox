import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectSourceTree } from './source-identity.mjs';

test('Agent source snapshot refuses a symbolic link outside its isolated source', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-source-boundary-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', directory]);
  execFileSync('git', ['-C', directory, '-c', 'user.name=Synthetic', '-c', 'user.email=synthetic@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']);
  await writeFile(join(directory, 'inside.txt'), 'synthetic only');
  await symlink('inside.txt', join(directory, 'safe-link'));
  assert.ok((await inspectSourceTree(directory)).entries.some(entry => entry.path === 'safe-link'));
  await symlink('../outside.txt', join(directory, 'unsafe-link'));
  await assert.rejects(inspectSourceTree(directory), /symlink escapes/);
});
