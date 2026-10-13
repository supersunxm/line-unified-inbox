import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const omittedDirectories = new Set([
  '.git', 'node_modules', '.next', 'dist', 'coverage', '.turbo', '.cache',
  'playwright-report', 'test-results', '.codex-ci-evidence',
]);
const operationalDocuments = new Set(['AI_PROGRESS.md', 'DECISIONS.md']);
const secretFilename = /(^|\/)(?:\.env(?:\.[^/]*)?|[^/]+\.(?:pem|p12|pfx|key))$/i;
const generatedFilename = /(^|\/)(?:\.DS_Store|npm-debug\.log|yarn-debug\.log|pnpm-debug\.log)$/i;

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseNulList(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function shouldOmit(path) {
  const parts = path.split('/');
  return operationalDocuments.has(path) || parts.some((part) => omittedDirectories.has(part)) || generatedFilename.test(path);
}

function isCredentialPath(path) {
  if (/\.(?:example|sample|template)$/i.test(path)) return false;
  return secretFilename.test(path);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertRepositoryPath(path) {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '..' || part === '')) {
    throw new Error('Unsafe source path in Git index');
  }
  if (path.includes('\n') || path.includes('\r')) throw new Error('Newline in source path is not supported');
}

export async function inspectSourceTree(rootPath) {
  const root = resolve(rootPath);
  const [headBuffer, trackedBuffer, candidateBuffer] = [
    git(root, ['rev-parse', 'HEAD']),
    git(root, ['ls-files', '--cached', '-z']),
    git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']),
  ];
  const commitSha = headBuffer.toString('utf8').trim();
  if (!/^[0-9a-f]{40,64}$/.test(commitSha)) throw new Error('Git HEAD is not a full commit SHA');
  const tracked = new Set(parseNulList(trackedBuffer));
  const paths = [...new Set(parseNulList(candidateBuffer))].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const entries = [];

  for (const path of paths) {
    assertRepositoryPath(path);
    if (shouldOmit(path)) continue;
    if (isCredentialPath(path)) {
      if (tracked.has(path)) throw new Error(`Tracked credential-like file prevents a safe source snapshot: ${path}`);
      continue;
    }
    const absolute = resolve(root, path);
    if (!absolute.startsWith(`${root}${sep}`)) throw new Error('Source path escaped the repository');
    let stat;
    try { stat = await lstat(absolute); }
    catch (error) {
      if (error.code === 'ENOENT' && tracked.has(path)) {
        entries.push({ path, type: 'deleted', mode: 0, sha256: null });
        continue;
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      const target = await readlink(absolute);
      entries.push({ path, type: 'symlink', mode: stat.mode & 0o777, sha256: hash(target) });
      continue;
    }
    if (!stat.isFile()) throw new Error(`Unsupported source entry type: ${path}`);
    const content = await readFile(absolute);
    const after = await lstat(absolute);
    if (after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
      throw new Error(`Source changed while identity was being computed: ${path}`);
    }
    entries.push({ path, type: 'file', mode: stat.mode & 0o777, size: content.length, sha256: hash(content) });
  }

  const canonical = `${JSON.stringify(entries)}\n`;
  return {
    commitSha,
    sourceTreeSha256: hash(canonical),
    fileCount: entries.filter((entry) => entry.type === 'file').length,
    entries,
  };
}

export async function createSourceArchive(rootPath, identity, archivePath, manifestPath) {
  const root = resolve(rootPath);
  const paths = identity.entries.filter((entry) => entry.type === 'file' || entry.type === 'symlink').map((entry) => entry.path);
  const listPath = `${archivePath}.paths`;
  await writeFile(listPath, paths.length ? `${paths.join('\n')}\n` : '', { mode: 0o600, flag: 'wx' });
  try {
    execFileSync('/usr/bin/tar', ['-czf', archivePath, '-C', root, '-T', listPath], {
      stdio: 'pipe',
      env: { ...process.env, COPYFILE_DISABLE: '1' },
    });
    const archivedPaths = execFileSync('/usr/bin/tar', ['-tzf', archivePath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n').filter(Boolean).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const expectedPaths = [...paths].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    if (JSON.stringify(archivedPaths) !== JSON.stringify(expectedPaths)) {
      throw new Error('Source archive contains paths outside its identity manifest');
    }
    const after = await inspectSourceTree(root);
    if (after.commitSha !== identity.commitSha || after.sourceTreeSha256 !== identity.sourceTreeSha256) {
      throw new Error('Source tree changed while the job snapshot was being archived');
    }
    await writeFile(manifestPath, `${JSON.stringify({
      commitSha: identity.commitSha,
      sourceTreeSha256: identity.sourceTreeSha256,
      fileCount: identity.fileCount,
      entries: identity.entries,
    }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  } finally {
    await rm(listPath, { force: true });
  }
}
