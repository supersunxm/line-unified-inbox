#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createSourceArchive, inspectSourceTree } from './source-identity.mjs';
import { expectedJobs, inspectWorkflowInventory } from './workflow-inventory.mjs';
import { mergeDecision, redactLog } from './policy.mjs';
import { renderWorkflowCommand } from './workflow-renderer.mjs';
import { CI_EGRESS_HOSTS } from './restricted-egress-proxy.mjs';
import { persistVerifiedRunRecord } from './agent-pre-push-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dockerBinary = '/Applications/Docker.app/Contents/Resources/bin/docker';
const dockerHost = `unix://${join(homedir(), '.docker/run/docker.sock')}`;
const ciImage = 'mcr.microsoft.com/playwright:v1.50.0-noble@sha256:e46352b075b3c97e226ad9ed27d6999dbc6e7f021ba94b30d833136fcee349f1';
const ciImageId = 'sha256:e46352b075b3c97e226ad9ed27d6999dbc6e7f021ba94b30d833136fcee349f1';
const postgresImage = 'postgres:16@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d';
const postgresImageId = 'sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d';
const runnerHome = '/home/pwuser/agent-ci/home';
const workspace = '/home/pwuser/agent-ci/work/repository';
const tempRoot = '/home/pwuser/agent-ci/tmp';
const proxyAddress = 'http://agent-ci-proxy:3128';
const maxOutputBytes = 24 * 1024 * 1024;
const maxSourceArchiveBytes = 2 * 1024 ** 3;
const workspaceReserveBytes = 8 * 1024 ** 3;
const sourcePolicy = 'Exact current Git worktree snapshot from the current commit, index and non-ignored application/workflow/tool source; excludes .git, dependency/build/cache output, generated CI evidence, AI_PROGRESS.md, DECISIONS.md, and credential-like paths.';

function runId() {
  return `${new Date().toISOString().replaceAll(/[^0-9]/g, '').slice(0, 14)}-${randomBytes(5).toString('hex')}`;
}

function readCurrentMainSha() {
  try {
    const value = execFileSync('git', ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^[0-9a-f]{40,64}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function isGitWorktreeClean() {
  try {
    return execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === '';
  } catch {
    return false;
  }
}

function isCommitAncestor(ancestor, descendant) {
  if (!ancestor) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: root, stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function parseDockerInfo(raw) {
  const parts = String(raw).trim().split('|');
  if (parts.length !== 8) throw new Error('Docker daemon metadata has an unexpected shape');
  const [serverVersion, operatingSystem, architecture, cpuText, memoryText, httpProxy, httpsProxy, noProxy] = parts;
  const parseEndpoint = (value) => {
    if (!value) throw new Error('Docker Desktop upstream proxy is not configured');
    let url;
    try { url = new URL(value.includes('://') ? value : `http://${value}`); }
    catch { throw new Error('Docker Desktop upstream proxy is not parseable'); }
    if (url.protocol !== 'http:' || url.hostname !== 'http.docker.internal' || url.port !== '3128' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Docker Desktop upstream proxy differs from the reviewed endpoint');
    }
    return { scheme: 'http', host: url.hostname, port: 3128, credentialsPresent: false };
  };
  const http = parseEndpoint(httpProxy);
  const https = parseEndpoint(httpsProxy);
  if (JSON.stringify(http) !== JSON.stringify(https)) throw new Error('Docker HTTP and HTTPS proxies do not match');
  const cpuCount = Number(cpuText);
  const memoryBytes = Number(memoryText);
  if (!serverVersion || operatingSystem !== 'Docker Desktop' || !['aarch64', 'arm64'].includes(architecture) || !Number.isSafeInteger(cpuCount) || !Number.isSafeInteger(memoryBytes) || !noProxy) {
    throw new Error('Docker Desktop host does not meet the reviewed resource and architecture preflight');
  }
  if (cpuCount < 4 || memoryBytes < 6 * 1024 ** 3) throw new Error('Docker Desktop host is below the minimum CI resource budget');
  return {
    serverVersion,
    operatingSystem,
    architecture: architecture === 'aarch64' ? 'arm64' : architecture,
    cpuCount,
    memoryBytes,
    daemonRootless: false,
    upstreamProxy: http,
    noProxyConfigured: true,
  };
}

export function classifyDockerDiagnostic(value) {
  const text = String(value ?? '').toLowerCase();
  if (/no space left on device|enospc/.test(text)) return 'WORKSPACE_STORAGE_EXHAUSTED';
  if (/statfssync|filesystem.*not supported|operation not supported/.test(text)) return 'WORKSPACE_CAPACITY_PROBE_FAILED';
  if (/not a gzip|unexpected end of file|tar: .*cannot|tar: .*error|archive extraction/.test(text)) return 'SOURCE_ARCHIVE_EXTRACTION_FAILED';
  if (/source (path inventory|digest|snapshot).*mismatch/.test(text)) return 'SOURCE_SNAPSHOT_INTEGRITY_FAILED';
  if (/direct[- ]egress boundary failed/.test(text)) return 'DIRECT_EGRESS_BOUNDARY_FAILED';
  if (/container .* is not running|container is not running|is not running/.test(text)) return 'CONTAINER_NOT_RUNNING';
  if (/internal network has direct external connectivity/.test(text)) return 'DIRECT_EGRESS_ALLOWED';
  if (/internal network can reach docker host proxy/.test(text)) return 'HOST_PROXY_ACCESSIBLE';
  if (/internal network has an ipv4 default route/.test(text)) return 'IPV4_DEFAULT_ROUTE_PRESENT';
  if (/allowlisted package registry was unreachable/.test(text)) return 'ALLOWLISTED_PROXY_EGRESS_FAILED';
  if (/unlisted destination was not rejected/.test(text)) return 'UNLISTED_PROXY_DESTINATION_ACCEPTED';
  if (/could not resolve proxy/.test(text)) return 'PROXY_ALIAS_DNS_FAILURE';
  if (/could not resolve host|temporary failure in name resolution/.test(text)) return 'DNS_LOOKUP_FAILED';
  if (/failed to connect|connection refused/.test(text)) return 'PROXY_CONNECTION_FAILED';
  if (/read-only file system/.test(text)) return 'READ_ONLY_FILESYSTEM';
  if (/permission denied|operation not permitted/.test(text)) return 'PERMISSION_DENIED';
  if (/network .*not found|could not find network/.test(text)) return 'NETWORK_NOT_FOUND';
  if (/no such file or directory|not found/.test(text)) return 'RESOURCE_OR_PATH_NOT_FOUND';
  if (/already in use|name .* already exists/.test(text)) return 'NAME_CONFLICT';
  if (/failed to create task|failed to start shim|failed to start container/.test(text)) return 'RUNTIME_START_FAILURE';
  if (/deadline exceeded|timed? out|timeout/.test(text)) return 'TIMEOUT';
  if (/error response from daemon/.test(text)) return 'DOCKER_DAEMON_REJECTED';
  return 'UNCLASSIFIED_DOCKER_FAILURE';
}

export function lastProbeStage(value) {
  const stages = [...String(value ?? '').matchAll(/AGENT_CI_PROBE_STAGE=([a-z0-9-]+)/g)];
  return stages.at(-1)?.[1] ?? null;
}

export function verifySourceSnapshotMarker(output, manifest) {
  const value = String(output ?? '');
  const match = value.match(/SOURCE_SNAPSHOT_VERIFIED=([0-9a-f]{64});files=(\d+)/);
  const hashMatches = Boolean(match && match[1] === manifest?.sourceTreeSha256);
  const fileCount = match ? Number(match[2]) : null;
  const fileCountMatches = Number.isSafeInteger(manifest?.fileCount) && fileCount === manifest.fileCount;
  if (!match || !hashMatches || !fileCountMatches) {
    const markerState = !match ? 'missing' : `hashMatch=${hashMatches};fileCountMatch=${fileCountMatches}`;
    const error = new Error(`Guest source snapshot verification failed (${markerState};outputBytes=${Buffer.byteLength(value)})`);
    error.safeCode = 'SOURCE_SNAPSHOT_INTEGRITY_FAILED';
    throw error;
  }
  return { sourceTreeSha256: match[1], fileCount };
}

export function makeProxyLaunchArgs({ name, egressNetwork, run, imageId, source }) {
  if (!/^agent-ci-proxy-[0-9]{14}-[a-f0-9]{10}$/.test(name) || !/^agent-ci-egress-[0-9]{14}-[a-f0-9]{10}$/.test(egressNetwork) || !/^[0-9]{14}-[a-f0-9]{10}$/.test(run) || !/^sha256:[a-f0-9]{64}$/.test(imageId) || typeof source !== 'string' || source.length === 0) {
    throw new Error('Invalid disposable proxy launch identity or source');
  }
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  const sourceBase64 = Buffer.from(source).toString('base64');
  const bootstrap = [
    "const {createHash}=await import('node:crypto');",
    'const source=process.env.AGENT_CI_PROXY_SOURCE_B64;',
    "if(typeof source!=='string')process.exit(11);",
    "const actual=createHash('sha256').update(Buffer.from(source,'base64')).digest('hex');",
    `if(actual!==${JSON.stringify(sourceSha256)})process.exit(12);`,
    "process.stdout.write(JSON.stringify({event:'egress_proxy_source_verified',sha256:actual})+'\\n');",
    'delete process.env.AGENT_CI_PROXY_SOURCE_B64;',
    'const proxy=await import(`data:text/javascript;base64,${source}`);',
    'await proxy.main();',
  ].join('');
  return {
    sourceSha256,
    args: [
      'container', 'create', '--name', name,
      '--label', `codex.agent-ci.run=${run}`, '--label', 'codex.agent-ci.kind=egress-proxy',
      '--network', egressNetwork,
      '--memory', '128m', '--cpus', '0.5', '--pids-limit', '128', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16m',
      '--env', 'AGENT_CI_UPSTREAM_PROXY=http.docker.internal:3128', '--env', 'AGENT_CI_PROXY_PORT=3128',
      '--env', `AGENT_CI_PROXY_SOURCE_B64=${sourceBase64}`,
      '--user', '1001:1001', '--entrypoint', 'node', imageId, '--input-type=module', '-e', bootstrap,
    ],
  };
}

export function makeJobContainerArgs({ name, network, workspaceVolume, imageId, run, jobId, proxyEnv }) {
  if (!/^agent-ci-[a-z0-9-]+$/.test(name) || !/^agent-ci-net-[a-z0-9-]+$/.test(network) || !/^sha256:[a-f0-9]{64}$/.test(imageId)) {
    throw new Error('Invalid Agent CI container identity');
  }
  if (!/^[0-9]{14}-[a-f0-9]{10}$/.test(run) || !/^[a-z0-9-]+$/.test(jobId)) throw new Error('Invalid Agent CI run or job identity');
  if (workspaceVolume !== `agent-ci-workspace-${run}-${jobId}`) throw new Error('Invalid Agent CI workspace volume identity');
  const environment = [
    ['HOME', runnerHome],
    ['PLAYWRIGHT_BROWSERS_PATH', `${runnerHome}/.cache/ms-playwright`],
    ...Object.entries(proxyEnv),
  ];
  return [
    'container', 'create',
    '--name', name,
    '--label', `codex.agent-ci.run=${run}`,
    '--label', `codex.agent-ci.job=${jobId}`,
    '--network', network,
    '--user', '1001:1001',
    '--workdir', '/tmp',
    '--init',
    '--memory', '5g', '--cpus', '6', '--pids-limit', '2048', '--shm-size', '512m',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=512m,uid=1001,gid=1001,mode=1777',
    '--mount', `type=volume,source=${workspaceVolume},target=/home/pwuser`,
    ...environment.flatMap(([key, value]) => ['--env', `${key}=${value}`]),
    '--entrypoint', '/bin/bash', imageId, '--noprofile', '--norc', '-c', 'exec sleep infinity',
  ];
}

function proxyEnvironment() {
  const noProxy = 'localhost,127.0.0.1,::1,postgres,agent-ci-proxy';
  return {
    HTTP_PROXY: proxyAddress,
    HTTPS_PROXY: proxyAddress,
    http_proxy: proxyAddress,
    https_proxy: proxyAddress,
    npm_config_proxy: proxyAddress,
    npm_config_http_proxy: proxyAddress,
    npm_config_https_proxy: proxyAddress,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
    NODE_USE_ENV_PROXY: '1',
  };
}

function emptyDockerEnvironment(configDirectory) {
  return {
    PATH: '/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/usr/bin:/bin',
    HOME: configDirectory,
    DOCKER_CONFIG: configDirectory,
    DOCKER_HOST: dockerHost,
  };
}

function dockerProcess(args, { configDirectory, signal, input, timeoutMs = 30_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(dockerBinary, args, {
      env: emptyDockerEnvironment(configDirectory),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let overflow = false;
    let inputFailure = false;
    let closed = false;
    const terminate = () => {
      if (closed) return;
      child.kill('SIGTERM');
      const timer = setTimeout(() => { if (!closed) child.kill('SIGKILL'); }, 2_000);
      timer.unref();
    };
    const onAbort = () => terminate();
    if (signal?.aborted) terminate();
    else signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(terminate, timeoutMs);
    timeout.unref();
    child.stdout.on('data', (chunk) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.length > maxOutputBytes) { overflow = true; terminate(); }
    });
    child.stderr.on('data', (chunk) => {
      stderr = Buffer.concat([stderr, chunk]);
      if (stderr.length > 2 * 1024 * 1024) { overflow = true; terminate(); }
    });
    child.once('error', () => {
      closed = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Docker CLI could not be started'));
    });
    child.once('close', (code, exitSignal) => {
      closed = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      const output = stdout.toString('utf8');
      const diagnostic = stderr.toString('utf8');
      if (inputFailure) return reject(new Error('Docker source stream failed'));
      if (overflow) return reject(new Error('Docker command exceeded its output budget'));
      if (signal?.aborted) return reject(new Error('Docker command was cancelled'));
      if (code !== 0) {
        const error = new Error(`Docker ${args[0]} failed (${code ?? exitSignal ?? 'unknown'})`);
        error.stage = `docker ${args.slice(0, 2).join(' ')}`;
        error.safeCode = classifyDockerDiagnostic(`${output}\n${diagnostic}`);
        error.output = output;
        error.diagnostic = diagnostic.slice(-4000);
        return reject(error);
      }
      resolvePromise(output);
    });
    if (input && typeof input.pipe === 'function') {
      input.once('error', () => { inputFailure = true; terminate(); });
      input.pipe(child.stdin);
    } else if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function secureDirectory(path) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error('Agent CI private directory is unsafe');
}

async function writeJson(path, value) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

async function inspectDocker(configDirectory) {
  const template = '{{.ServerVersion}}|{{.OperatingSystem}}|{{.Architecture}}|{{.NCPU}}|{{.MemTotal}}|{{.HTTPProxy}}|{{.HTTPSProxy}}|{{.NoProxy}}';
  const raw = await dockerProcess(['info', '--format', template], { configDirectory, timeoutMs: 15_000 });
  const info = parseDockerInfo(raw);
  const imageMetadata = async (label, image) => {
    let value;
    try { value = await dockerProcess(['image', 'inspect', image, '--format', '{{.Id}}|{{.Os}}|{{.Architecture}}|{{json .RepoDigests}}'], { configDirectory, timeoutMs: 15_000 }); }
    catch { throw new Error(`Pinned ${label} image metadata is unavailable in Docker Desktop`); }
    const [id, os, architecture, repoDigests] = value.trim().split('|');
    if (!id || os !== 'linux' || architecture !== 'arm64') throw new Error('Pinned CI image is not Linux ARM64');
    return { id, os, architecture, repoDigests: JSON.parse(repoDigests) };
  };
  const jobImage = await imageMetadata('job', ciImage);
  const pgImage = await imageMetadata('PostgreSQL', postgresImage);
  if (jobImage.id !== ciImageId || pgImage.id !== postgresImageId) throw new Error('Cached CI image digests differ from the reviewed pins');
  return { info, jobImage, postgresImage: pgImage };
}

function checkPostgresService(job) {
  if (!job.postgres) return;
  const expected = { POSTGRES_USER: 'ci', POSTGRES_PASSWORD: 'ci', POSTGRES_DB: 'ci' };
  if (JSON.stringify(job.postgresEnv) !== JSON.stringify(expected)) throw new Error(`Unreviewed PostgreSQL service settings for ${job.id}`);
}

function securityArgs(run, network, name, workspaceVolume, jobId, imageId, proxyEnv) {
  return makeJobContainerArgs({ name, network, workspaceVolume, imageId, run, jobId, proxyEnv });
}

async function inspectContainerIsolation(configDirectory, name, expectedNetwork, expectedWorkspaceVolume) {
  const template = '{{.HostConfig.NetworkMode}}|{{json .HostConfig.CapDrop}}|{{.HostConfig.Privileged}}|{{json .HostConfig.SecurityOpt}}|{{.HostConfig.Memory}}|{{.HostConfig.NanoCpus}}|{{.HostConfig.PidsLimit}}|{{json .HostConfig.PortBindings}}|{{json .HostConfig.Binds}}|{{json .HostConfig.Tmpfs}}|{{.Config.User}}|{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.Mounts}}|{{.HostConfig.Init}}';
  const raw = await dockerProcess(['container', 'inspect', name, '--format', template], { configDirectory, timeoutMs: 10_000 });
  const [network, caps, privileged, security, memory, nanoCpus, pids, ports, binds, tmpfs, user, readOnly, mounts, init] = raw.trim().split('|');
  const securityOptions = JSON.parse(security);
  const capsValue = JSON.parse(caps);
  const portsValue = JSON.parse(ports);
  const bindsValue = JSON.parse(binds);
  const tmpfsValue = JSON.parse(tmpfs);
  const mountsValue = JSON.parse(mounts);
  const ok = network === expectedNetwork && capsValue.includes('ALL') && privileged === 'false' &&
    securityOptions.includes('no-new-privileges') && Number(memory) === 5 * 1024 ** 3 &&
    Number(nanoCpus) === 6_000_000_000 && Number(pids) === 2048 &&
    (portsValue === null || Object.keys(portsValue).length === 0) && (bindsValue === null || bindsValue.length === 0) &&
    Object.keys(tmpfsValue).sort().join(',') === '/tmp' && user === '1001:1001' && readOnly === 'true' &&
    Array.isArray(mountsValue) && mountsValue.length === 1 && mountsValue[0].Type === 'volume' && init === 'true' &&
    mountsValue[0].Source === expectedWorkspaceVolume && mountsValue[0].Target === '/home/pwuser';
  if (!ok) throw new Error('Disposable container isolation metadata failed verification');
  return { networkInternal: true, hostMountCount: 0, dockerSocketMounted: false, privileged: false, capabilitiesDropped: 'ALL', noNewPrivileges: true, readonlyRootFilesystem: true, initReaper: true, tmpfsBytes: 512 * 1024 ** 2, workspaceDockerVolume: true, dockerManagedVolumeCount: 1, memoryBytes: Number(memory), cpuCount: Number(nanoCpus) / 1_000_000_000, pidsLimit: Number(pids), userUid: 1001 };
}

async function inspectInternalNetwork(configDirectory, network) {
  const raw = await dockerProcess(['network', 'inspect', network, '--format', '{{.Internal}}|{{json .Labels}}'], { configDirectory, timeoutMs: 10_000 });
  const [internal, labels] = raw.trim().split('|');
  const labelValues = JSON.parse(labels);
  if (internal !== 'true' || labelValues['codex.agent-ci.kind'] !== 'job-network') throw new Error('Job network is not the expected internal-only network');
  return true;
}

async function createNetwork(configDirectory, name, run, internal) {
  const args = ['network', 'create', '--label', `codex.agent-ci.run=${run}`, '--label', `codex.agent-ci.kind=${internal ? 'job-network' : 'egress-network'}`];
  if (internal) args.push('--internal');
  args.push(name);
  await dockerProcess(args, { configDirectory, timeoutMs: 15_000 });
}

async function containerExists(configDirectory, name) {
  const value = await dockerProcess(['container', 'ls', '-a', '--filter', `name=${name}`, '--format', '{{.Names}}'], { configDirectory, timeoutMs: 10_000 });
  return value.split('\n').map((line) => line.trim()).includes(name);
}

async function workspaceVolumeExists(configDirectory, name) {
  const value = await dockerProcess(['volume', 'ls', '-q'], { configDirectory, timeoutMs: 10_000 });
  return value.split('\n').map((line) => line.trim()).includes(name);
}

async function createWorkspaceVolume(configDirectory, name, run, jobId) {
  if (!/^agent-ci-workspace-[0-9]{14}-[a-f0-9]{10}-[a-z0-9-]+$/.test(name)) throw new Error('Invalid Agent CI workspace volume name');
  if (await workspaceVolumeExists(configDirectory, name)) throw new Error('Agent CI workspace volume name already exists');
  await dockerProcess(['volume', 'create', '--label', `codex.agent-ci.run=${run}`, '--label', `codex.agent-ci.job=${jobId}`, '--label', 'codex.agent-ci.kind=workspace', name], { configDirectory, timeoutMs: 15_000 });
  const raw = await dockerProcess(['volume', 'inspect', name, '--format', '{{.Driver}}|{{json .Labels}}'], { configDirectory, timeoutMs: 10_000 });
  const [driver, labels] = raw.trim().split('|');
  const labelValues = JSON.parse(labels);
  if (driver !== 'local' || labelValues['codex.agent-ci.run'] !== run || labelValues['codex.agent-ci.job'] !== jobId || labelValues['codex.agent-ci.kind'] !== 'workspace') {
    throw new Error('Disposable workspace volume metadata failed verification');
  }
  return driver;
}

async function removeWorkspaceVolume(configDirectory, name, run) {
  if (!(await workspaceVolumeExists(configDirectory, name))) return true;
  let labels;
  try {
    const raw = await dockerProcess(['volume', 'inspect', name, '--format', '{{.Driver}}|{{json .Labels}}'], { configDirectory, timeoutMs: 10_000 });
    const [driver, labelText] = raw.trim().split('|');
    labels = JSON.parse(labelText);
    if (driver !== 'local' || labels?.['codex.agent-ci.run'] !== run || labels?.['codex.agent-ci.kind'] !== 'workspace') return false;
  } catch { return false; }
  await dockerProcess(['volume', 'rm', name], { configDirectory, timeoutMs: 15_000 }).catch(() => {});
  return !(await workspaceVolumeExists(configDirectory, name).catch(() => true));
}

async function removeContainer(configDirectory, name, run) {
  if (!(await containerExists(configDirectory, name))) return true;
  let labels;
  try { labels = JSON.parse(await dockerProcess(['container', 'inspect', name, '--format', '{{json .Config.Labels}}'], { configDirectory, timeoutMs: 10_000 })); }
  catch { return false; }
  if (labels?.['codex.agent-ci.run'] !== run) return false;
  try { await dockerProcess(['container', 'stop', '--timeout', '5', name], { configDirectory, timeoutMs: 10_000 }); }
  catch { /* exact container is force-removed below if graceful stop fails */ }
  try { await dockerProcess(['container', 'rm', '--force', name], { configDirectory, timeoutMs: 10_000 }); }
  catch { return !(await containerExists(configDirectory, name)); }
  return !(await containerExists(configDirectory, name));
}

async function networkExists(configDirectory, name) {
  const value = await dockerProcess(['network', 'ls', '--filter', `name=${name}`, '--format', '{{.Name}}'], { configDirectory, timeoutMs: 10_000 });
  return value.split('\n').map((line) => line.trim()).includes(name);
}

async function removeNetwork(configDirectory, name, run) {
  if (!(await networkExists(configDirectory, name))) return true;
  let labels;
  try { labels = JSON.parse(await dockerProcess(['network', 'inspect', name, '--format', '{{json .Labels}}'], { configDirectory, timeoutMs: 10_000 })); }
  catch { return false; }
  if (labels?.['codex.agent-ci.run'] !== run) return false;
  try { await dockerProcess(['network', 'rm', name], { configDirectory, timeoutMs: 10_000 }); }
  catch { /* checked below; the network may have been removed with a failed parent command */ }
  return !(await networkExists(configDirectory, name));
}

async function createProxy(configDirectory, run, egressNetwork, imageId, onStarted) {
  const name = `agent-ci-proxy-${run}`;
  const proxySource = join(root, 'tools/codex-ci/restricted-egress-proxy.mjs');
  const source = await readFile(proxySource, 'utf8');
  const launch = makeProxyLaunchArgs({ name, egressNetwork, run, imageId, source });
  await dockerProcess(launch.args, { configDirectory, timeoutMs: 15_000 });
  await dockerProcess(['container', 'start', name], { configDirectory, timeoutMs: 15_000 });
  onStarted();
  await waitForProxy(configDirectory, name);
  const logs = await dockerProcess(['container', 'logs', '--tail', '4', name], { configDirectory, timeoutMs: 5_000 });
  const events = logs.split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } });
  if (!events.some((event) => event?.event === 'egress_proxy_source_verified' && event.sha256 === launch.sourceSha256)) {
    throw new Error('Disposable proxy did not report the reviewed source hash');
  }
  return { name, sourceSha256: launch.sourceSha256 };
}

async function waitForProxy(configDirectory, name) {
  const code = 'fetch("http://127.0.0.1:3128/__health").then(async r=>{if(!r.ok)process.exit(2);const x=await r.json();if(x.ready!==true)process.exit(3);console.log("PROXY_HEALTH=PASS")}).catch(()=>process.exit(4))';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const result = await dockerProcess(['container', 'exec', name, 'node', '-e', code], { configDirectory, timeoutMs: 5_000 });
      if (result.includes('PROXY_HEALTH=PASS')) return;
    } catch { /* bounded startup poll */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('Restricted egress proxy failed its bounded startup health check');
}

export const PROBE_SCRIPT = String.raw`
const fs = require('node:fs');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
function canConnect(host, family) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: 443, family });
    let settled = false;
    const finish = (reachable) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(1500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
async function main() {
  const stage = (value) => process.stdout.write('AGENT_CI_PROBE_STAGE='+value+'\\n');
  stage('ipv4-route');
  const defaultRoute4 = fs.readFileSync('/proc/net/route', 'utf8').split('\n').slice(1).some((line) => line.trim().split(/\s+/)[1] === '00000000');
  if (defaultRoute4) throw new Error('internal network has an IPv4 default route');
  stage('direct-address-check');
  const [directIpv4, directIpv6] = await Promise.all([canConnect('1.1.1.1', 4), canConnect('2606:4700:4700::1111', 6)]);
  if (directIpv4 || directIpv6) throw new Error('internal network has direct external connectivity');
  stage('host-proxy-check');
  const hostProxyReachable = await new Promise((resolve) => {
    const socket = net.connect({ host: 'http.docker.internal', port: 3128, timeout: 1200 });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
  if (hostProxyReachable) throw new Error('internal network can reach Docker host proxy');
  stage('allowlisted-proxy-check');
  const allowed = spawnSync('curl', ['--silent', '--show-error', '--head', '--proxy', 'http://agent-ci-proxy:3128', '--noproxy', '', '--connect-timeout', '5', '--max-time', '20', '--output', '/dev/null', '--write-out', '%{http_code}', 'https://registry.npmjs.org/'], { encoding: 'utf8', timeout: 25000 });
  if (allowed.status !== 0 || !/^[23][0-9][0-9]$/.test(allowed.stdout.trim())) throw new Error('allowlisted package registry was unreachable');
  stage('allowlisted-font-check');
  const fontCss = spawnSync('curl', ['--silent', '--show-error', '--head', '--proxy', 'http://agent-ci-proxy:3128', '--noproxy', '', '--connect-timeout', '5', '--max-time', '20', '--output', '/dev/null', '--write-out', '%{http_code}', 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400&display=swap'], { encoding: 'utf8', timeout: 25000 });
  if (fontCss.status !== 0 || !/^[23][0-9][0-9]$/.test(fontCss.stdout.trim())) throw new Error('allowlisted Google Fonts CSS host was unreachable');
  const fontFileHost = spawnSync('curl', ['--silent', '--show-error', '--head', '--proxy', 'http://agent-ci-proxy:3128', '--noproxy', '', '--connect-timeout', '5', '--max-time', '20', '--output', '/dev/null', '--write-out', '%{http_code}', 'https://fonts.gstatic.com/'], { encoding: 'utf8', timeout: 25000 });
  if (fontFileHost.status !== 0 || !/^[234][0-9][0-9]$/.test(fontFileHost.stdout.trim())) throw new Error('allowlisted Google Fonts asset host was unreachable');
  stage('allowlisted-emoji-asset-check');
  const emojiAsset = spawnSync('curl', ['--silent', '--show-error', '--head', '--proxy', 'http://agent-ci-proxy:3128', '--noproxy', '', '--connect-timeout', '5', '--max-time', '20', '--output', '/dev/null', '--write-out', '%{http_code}', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a1.svg'], { encoding: 'utf8', timeout: 25000 });
  if (emojiAsset.status !== 0 || !/^2[0-9][0-9]$/.test(emojiAsset.stdout.trim())) throw new Error('allowlisted Twemoji SVG asset was unreachable');
  stage('denied-host-check');
  const blockedScript = [
    "const net=require('node:net');",
    "const socket=net.connect({host:'agent-ci-proxy',port:3128,timeout:3000});",
    "let response='';",
    "socket.once('connect',()=>socket.write('CONNECT example.com:443 HTTP/1.1\\r\\nHost: example.com:443\\r\\n\\r\\n'));",
    "socket.on('data',chunk=>{response+=chunk.toString('latin1');if(response.includes('\\r\\n\\r\\n')){console.log(response.split('\\r\\n',1)[0]);socket.destroy();}});",
    "socket.once('error',()=>process.exit(2));",
  ].join('');
  const blocked = spawnSync('node', ['-e', blockedScript], { encoding: 'utf8', timeout: 5000 });
  if (blocked.status !== 0 || !/^HTTP\/1\.1 403 Forbidden/.test(blocked.stdout.trim())) throw new Error('unlisted destination was not rejected before upstream access');
  console.log(JSON.stringify({directIpv4DefaultRoute: false, directIpv4TcpReachable: false, directIpv6TcpReachable: false, hostProxyReachable: false, allowedRegistry: true, allowedFontsCss: true, allowedFontAssetHost: true, allowedEmojiAsset: true, deniedUnlistedHost: true}));
}
main().catch((error) => { process.stderr.write(String(error.message)); process.exitCode = 1; });
`;

async function verifyNetworkBoundary(configDirectory, run, proxyName, imageId) {
  const network = `agent-ci-net-${run}-probe`;
  const container = `agent-ci-probe-${run}`;
  await createNetwork(configDirectory, network, run, true);
  try {
    await dockerProcess(['network', 'connect', '--alias', 'agent-ci-proxy', network, proxyName], { configDirectory, timeoutMs: 10_000 });
    await inspectInternalNetwork(configDirectory, network);
    let output;
    try { output = await dockerProcess([
      'container', 'run', '--name', container,
      '--label', `codex.agent-ci.run=${run}`, '--label', 'codex.agent-ci.kind=network-probe',
      '--network', network, '--user', '1001:1001', '--memory', '128m', '--cpus', '0.5', '--pids-limit', '128',
      '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16m',
      ...Object.entries(proxyEnvironment()).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
      '--entrypoint', 'node', imageId, '-e', PROBE_SCRIPT,
    ], { configDirectory, timeoutMs: 45_000 }); }
    catch (error) {
      const stage = lastProbeStage(error.output);
      if (stage) error.stage = `network probe ${stage}`;
      delete error.output;
      delete error.diagnostic;
      throw error;
    }
    const match = output.match(/\{"directIpv4DefaultRoute":false,"directIpv4TcpReachable":false,"directIpv6TcpReachable":false,"hostProxyReachable":false,"allowedRegistry":true,"allowedFontsCss":true,"allowedFontAssetHost":true,"allowedEmojiAsset":true,"deniedUnlistedHost":true\}/);
    if (!match) throw new Error('Restricted egress network probe did not confirm every boundary');
    return { status: 'PASS', container, network, directIpv4DefaultRoute: false, directIpv4TcpReachable: false, directIpv6TcpReachable: false, hostProxyReachable: false, allowedRegistry: true, allowedFontsCss: true, allowedFontAssetHost: true, allowedEmojiAsset: true, deniedUnlistedHost: true };
  } finally {
    await dockerProcess(['network', 'disconnect', '--force', network, proxyName], { configDirectory, timeoutMs: 10_000 }).catch(() => {});
  }
}

async function copyAndVerifySource(configDirectory, container, archivePath, manifestPath) {
  const atStage = async (stage, operation) => {
    try { return await operation(); }
    catch (error) { error.stage = stage; throw error; }
  };
  const archiveInfo = await atStage('inspect private source archive', () => lstat(archivePath));
  if (!archiveInfo.isFile() || archiveInfo.size > maxSourceArchiveBytes) throw new Error('Source archive exceeds the reviewed transfer budget');
  const manifest = JSON.parse(await atStage('read source manifest', () => readFile(manifestPath, 'utf8')));
  if (!Array.isArray(manifest.entries)) throw new Error('Source manifest entries are unavailable');
  const expandedSourceBytes = manifest.entries.reduce((sum, entry) => sum + (entry.type === 'file' ? Number(entry.size) : 0), 0);
  if (!Number.isSafeInteger(expandedSourceBytes) || expandedSourceBytes <= 0) throw new Error('Source manifest byte count is invalid');
  const capacity = await atStage('check workspace volume capacity', () => dockerProcess(['container', 'exec', '--user', '1001:1001', container, 'node', '-e', "const fs=require('node:fs');const s=fs.statfsSync('/home/pwuser');process.stdout.write(String(s.bavail*s.bsize)+'\\n')"], { configDirectory, timeoutMs: 10_000 }));
  const availableBytes = Number(capacity.trim());
  if (!Number.isSafeInteger(availableBytes) || availableBytes < expandedSourceBytes + workspaceReserveBytes) throw new Error('Disposable workspace volume has insufficient free space');
  const extraction = `mkdir -p ${shellQuote(workspace)} ${shellQuote(`${runnerHome}/work/.codex-local-ci`)} ${shellQuote(tempRoot)} && tar -xz -C ${shellQuote(workspace)}`;
  await atStage('extract source archive into disposable workspace', () => dockerProcess(['container', 'exec', '--interactive', '--user', '1001:1001', container, 'bash', '--noprofile', '--norc', '-c', extraction], { configDirectory, input: createReadStream(archivePath), timeoutMs: 300_000 }));
  const guestManifest = '/home/pwuser/agent-ci/manifest.json';
  await atStage('stream private source manifest', () => dockerProcess(['container', 'exec', '--interactive', '--user', '1001:1001', container, 'bash', '--noprofile', '--norc', '-c', `umask 077 && cat > ${shellQuote(guestManifest)}`], { configDirectory, input: createReadStream(manifestPath), timeoutMs: 30_000 }));
  const script = String.raw`
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const root=path.resolve(process.argv[2]);const expected=manifest.entries.filter(e=>e.type==='file'||e.type==='symlink').map(e=>e.path).sort();const actual=[];
function walk(dir,prefix=''){for(const name of fs.readdirSync(dir)){const rel=prefix?prefix+'/'+name:name;const abs=path.join(dir,name);const stat=fs.lstatSync(abs);if(stat.isDirectory())walk(abs,rel);else actual.push(rel)}}walk(root);actual.sort();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('source path inventory mismatch');
for(const e of manifest.entries){const target=path.resolve(root,e.path);if(!target.startsWith(root+path.sep))throw Error('unsafe manifest path');if(e.type==='deleted'){if(fs.existsSync(target))throw Error('deleted path exists');continue}const st=fs.lstatSync(target);const value=e.type==='symlink'?fs.readlinkSync(target):fs.readFileSync(target);const digest=crypto.createHash('sha256').update(value).digest('hex');if(digest!==e.sha256||((e.type==='symlink')!==st.isSymbolicLink()))throw Error('source digest mismatch')}
console.log('SOURCE_SNAPSHOT_VERIFIED='+manifest.sourceTreeSha256+';files='+manifest.fileCount);
`;
  const result = await atStage('verify extracted source snapshot', () => dockerProcess(['container', 'exec', '--user', '1001:1001', container, 'node', '-e', script, guestManifest, workspace], { configDirectory, timeoutMs: 60_000 }));
  return verifySourceSnapshotMarker(result, manifest);
}

function redactCiOutput(value, env) {
  const values = Object.entries(env)
    .filter(([key]) => /(TOKEN|PASSWORD|SECRET|PRIVATE|CREDENTIAL|KEY)/i.test(key) || /(?:DATABASE_URL|_DATABASE_URL)$/.test(key))
    .map(([, secret]) => secret)
    .concat(['0123456789abcdef0123456789abcdef', 'postgresql://ci:ci@postgres:5432/ci']);
  return redactLog(value, values)
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/g, '[REDACTED_DATABASE_URL]')
    .replaceAll(proxyAddress, '[REDACTED_CI_PROXY]');
}

async function writeStepLog(evidenceDir, jobId, index, output, env) {
  const relative = `logs/${jobId}/${String(index).padStart(2, '0')}.log`;
  const path = join(evidenceDir, relative);
  const contents = redactCiOutput(output, env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, contents, { mode: 0o600 });
  const testCount = extractTestCount(contents);
  return { relative, outputSha256: createHash('sha256').update(contents).digest('hex'), testCount };
}

function extractTestCount(output) {
  const patterns = [/# tests\s+(\d+)/, /^Tests:\s+(\d+)\s+(?:passed|total)/m, /Ran (\d+) tests?\b/, /(\d+) passing\b/];
  for (const pattern of patterns) {
    const match = pattern.exec(output);
    if (match) return Number(match[1]);
  }
  return null;
}

function heredocDelimiter(text, suffix) {
  let value;
  do { value = `__CODEX_AGENT_CI_${suffix}_${randomBytes(8).toString('hex')}__`; } while (text.split('\n').includes(value));
  return value;
}

function makeStepInput(rendered, index) {
  const commandPath = `${runnerHome}/work/.codex-local-ci/workflow-step.${rendered.commandExtension}`;
  const wrapperPath = `${runnerHome}/work/.codex-local-ci/workflow-wrapper.sh`;
  const stepDelimiter = heredocDelimiter(rendered.commandText, `STEP_${index}`);
  const wrapperDelimiter = heredocDelimiter(rendered.wrapper, `WRAPPER_${index}`);
  return [
    'set -euo pipefail',
    `cat > ${shellQuote(commandPath)} <<'${stepDelimiter}'`,
    rendered.commandText,
    stepDelimiter,
    `cat > ${shellQuote(wrapperPath)} <<'${wrapperDelimiter}'`,
    rendered.wrapper,
    wrapperDelimiter,
    `chmod 0600 ${shellQuote(commandPath)} ${shellQuote(wrapperPath)}`,
    `bash --noprofile --norc ${shellQuote(wrapperPath)}`,
    '',
  ].join('\n');
}

async function runStep(configDirectory, container, rendered, index, signal) {
  const output = await dockerProcess([
    'container', 'exec', '--interactive', '--user', '1001:1001', '--workdir', workspace,
    container, 'bash', '--noprofile', '--norc', '-s',
  ], { configDirectory, signal, input: makeStepInput(rendered, index), timeoutMs: 3_600_000 });
  const match = output.match(/(?:^|\n)__CODEX_STEP_RC__(\d+)\s*$/);
  if (!match) throw new Error('Workflow step process returned without an exit marker');
  return { exitCode: Number(match[1]), output: output.slice(0, match.index).replace(/\n$/, '') };
}

async function startPostgres(configDirectory, name, network, run, jobId) {
  await dockerProcess([
    'container', 'run', '--detach', '--name', name,
    '--label', `codex.agent-ci.run=${run}`, '--label', `codex.agent-ci.job=${jobId}`, '--label', 'codex.agent-ci.kind=postgres',
    '--network', network, '--network-alias', 'postgres',
    '--memory', '1g', '--cpus', '1', '--pids-limit', '256', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--shm-size', '128m', '--read-only',
    '--user', '999:999',
    '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=768m,uid=999,gid=999,mode=0700',
    '--tmpfs', '/var/run/postgresql:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700',
    '--env', 'POSTGRES_USER=ci', '--env', 'POSTGRES_PASSWORD=ci', '--env', 'POSTGRES_DB=ci',
    postgresImageId,
  ], { configDirectory, timeoutMs: 30_000 });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await dockerProcess(['container', 'exec', name, 'pg_isready', '-U', 'ci', '-d', 'ci'], { configDirectory, timeoutMs: 5_000 });
      return { name, status: 'READY', image: 'postgres:16', digest: postgresImageId };
    } catch { await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000)); }
  }
  throw new Error('Disposable PostgreSQL service did not become ready within 60 seconds');
}

export const JOB_EGRESS_CHECK = String.raw`
const fs = require('node:fs');
const net = require('node:net');
function canConnect(host, family, port = 443) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family });
    let settled = false;
    const finish = (reachable) => { if (settled) return; settled = true; socket.destroy(); resolve(reachable); };
    socket.setTimeout(1500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
async function main() {
  const ipv4Default = fs.readFileSync('/proc/net/route', 'utf8').split('\n').slice(1).some((line) => line.trim().split(/\s+/)[1] === '00000000');
  const [directIpv4, directIpv6, hostProxy] = await Promise.all([
    canConnect('1.1.1.1', 4),
    canConnect('2606:4700:4700::1111', 6),
    canConnect('http.docker.internal', undefined, 3128),
  ]);
  const result = { ipv4DefaultRoute: ipv4Default, directIpv4TcpReachable: directIpv4, directIpv6TcpReachable: directIpv6, hostProxyReachable: hostProxy };
  if (Object.values(result).some(Boolean)) {
    process.stdout.write('DIRECT_EGRESS_RESULT=' + JSON.stringify(result));
    process.exitCode = 2;
    return;
  }
  process.stdout.write('DIRECT_EGRESS_BLOCKED=PASS\n');
}
main().catch(() => { process.exitCode = 1; });
`;

async function verifyNoDirectEgress(configDirectory, container) {
  let output;
  try {
    output = await dockerProcess(['container', 'exec', '--user', '1001:1001', container, 'node', '-e', JOB_EGRESS_CHECK], { configDirectory, timeoutMs: 5_000 });
  } catch (error) {
    const match = String(error.output ?? '').match(/DIRECT_EGRESS_RESULT=(\{[^\r\n]+\})/);
    error.stage = 'verify job direct-egress boundary';
    error.safeCode = match ? 'DIRECT_EGRESS_BOUNDARY_FAILED' : error.safeCode ?? 'JOB_EGRESS_PROBE_FAILED';
    if (match) {
      try {
        const value = JSON.parse(match[1]);
        error.message = `Job direct-egress boundary failed: ${JSON.stringify({
          ipv4DefaultRoute: value.ipv4DefaultRoute === true,
          directIpv4TcpReachable: value.directIpv4TcpReachable === true,
          directIpv6TcpReachable: value.directIpv6TcpReachable === true,
          hostProxyReachable: value.hostProxyReachable === true,
        })}`;
      } catch { error.message = 'Job direct-egress boundary returned malformed sanitized results'; }
    }
    delete error.output;
    delete error.diagnostic;
    throw error;
  }
  if (!output.includes('DIRECT_EGRESS_BLOCKED=PASS')) throw new Error('Job container direct-egress boundary failed');
  return true;
}

async function cleanupJob(configDirectory, names, network, proxyName, run) {
  let complete = true;
  for (const name of names) if (name) complete = (await removeContainer(configDirectory, name, run).catch(() => false)) && complete;
  if (network && proxyName) {
    await dockerProcess(['network', 'disconnect', '--force', network, proxyName], { configDirectory, timeoutMs: 10_000 }).catch(() => {});
  }
  if (network) complete = (await removeNetwork(configDirectory, network, run).catch(() => false)) && complete;
  return complete;
}

async function runJob(job, context) {
  const { configDirectory, run, archivePath, manifestPath, evidenceDir, dependencies, signal, proxyName, jobImageId } = context;
  checkPostgresService(job);
  const network = `agent-ci-net-${run}-${job.id}`;
  const container = `agent-ci-job-${run}-${job.id}`;
  const workspaceVolume = `agent-ci-workspace-${run}-${job.id}`;
  let workspaceVolumeCreated = false;
  let pgName = null;
  let failure = null;
  let isolation = null;
  let setupStage = 'create job network';
  const result = {
    id: job.id, workflow: job.workflow, workflowSha256: job.workflowSha256,
    required: job.required, expectedStepNames: job.steps.map((step) => step.name),
    expectedStepCount: job.steps.length, status: 'BLOCKED', startedAt: new Date().toISOString(),
    containerCreated: false, containerDisposed: false, workspaceDockerVolume: true, workspaceVolumeDriver: 'NOT_CREATED', workspaceVolumeCreated: false, workspaceVolumeDisposed: true, postgresServiceCleanup: job.postgres ? 'NOT_RUN' : 'NOT_APPLICABLE',
    steps: [],
  };
  try {
    setupStage = 'inspect internal job network';
    await createNetwork(configDirectory, network, run, true);
    await inspectInternalNetwork(configDirectory, network);
    setupStage = 'connect restricted proxy to job network';
    await dockerProcess(['network', 'connect', '--alias', 'agent-ci-proxy', network, proxyName], { configDirectory, timeoutMs: 10_000 });
    setupStage = 'create disposable Docker-managed workspace volume';
    result.workspaceVolumeDriver = await createWorkspaceVolume(configDirectory, workspaceVolume, run, job.id);
    workspaceVolumeCreated = true;
    result.workspaceVolumeCreated = true;
    if (job.postgres) {
      setupStage = 'start disposable PostgreSQL';
      pgName = `agent-ci-pg-${run}-${job.id}`;
      const pg = await startPostgres(configDirectory, pgName, network, run, job.id);
      result.postgres = { status: pg.status, image: pg.image, digest: pg.digest, userUid: 999, serviceHostname: 'postgres', isolatedInternalNetwork: true };
    }
    setupStage = 'create read-only job container';
    const args = securityArgs(run, network, container, workspaceVolume, job.id, jobImageId, proxyEnvironment());
    await dockerProcess(args, { configDirectory, timeoutMs: 30_000 });
    result.containerCreated = true;
    setupStage = 'start job container';
    await dockerProcess(['container', 'start', container], { configDirectory, timeoutMs: 15_000 });
    setupStage = 'inspect job container isolation';
    isolation = await inspectContainerIsolation(configDirectory, container, network, workspaceVolume);
    setupStage = 'stream and verify source snapshot';
    await copyAndVerifySource(configDirectory, container, archivePath, manifestPath);
    setupStage = 'verify job direct-egress boundary';
    await verifyNoDirectEgress(configDirectory, container);
    result.isolation = isolation;
    result.networkPolicy = { internalOnly: true, restrictedProxyAlias: 'agent-ci-proxy', directEgressBlocked: true, allowlistedHosts: CI_EGRESS_HOSTS };
    const stepEnvironment = { ...proxyEnvironment(), ...(job.postgres ? { CODEX_AGENT_CI_POSTGRES: 'true' } : {}) };
    for (let index = 0; index < job.steps.length; index += 1) {
      if (signal.aborted) throw new Error('Agent CI execution cancelled');
      const step = job.steps[index];
      let rendered;
      try {
        rendered = renderWorkflowCommand(job, step, dependencies, '', {
          runnerHome,
          workspace,
          tempRoot,
          env: stepEnvironment,
          databaseServiceHost: job.postgres ? 'postgres' : undefined,
        });
      } catch (error) {
        failure = { status: 'BLOCKED', reason: error.message, stage: `workflow expression: ${step.name}` };
        break;
      }
      const stepResult = { name: step.name, startedAt: new Date().toISOString(), status: 'BLOCKED' };
      try {
        const execution = await runStep(configDirectory, container, rendered, index + 1, signal);
        const log = await writeStepLog(evidenceDir, job.id, index + 1, execution.output, rendered.env);
        stepResult.log = log.relative;
        stepResult.outputSha256 = log.outputSha256;
        stepResult.testCount = log.testCount;
        stepResult.exitCode = execution.exitCode;
        stepResult.status = execution.exitCode === 0 ? 'PASS' : 'FAIL';
        if (execution.exitCode !== 0) failure = { status: 'FAIL', reason: `Workflow command exited ${execution.exitCode}`, stage: step.name };
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
    else result.status = failure.status;
  } catch (error) {
    const safeReason = error.safeCode ? `${error.message} [${error.safeCode}]` : error.message;
    failure = failure ?? { status: 'BLOCKED', reason: safeReason, stage: error.stage ?? setupStage, safeCode: error.safeCode ?? 'UNCLASSIFIED' };
    delete error.output;
    delete error.diagnostic;
    result.status = failure.status;
  } finally {
    result.containerDisposed = await cleanupJob(configDirectory, [container, pgName], network, proxyName, run).catch(() => false);
    result.workspaceVolumeDisposed = workspaceVolumeCreated ? await removeWorkspaceVolume(configDirectory, workspaceVolume, run).catch(() => false) : true;
    if (result.workspaceVolumeCreated && !result.workspaceVolumeDisposed) {
      result.status = 'BLOCKED';
      failure = { status: 'BLOCKED', reason: 'Disposable workspace volume cleanup is unverified', stage: 'cleanup' };
    }
    if (!result.containerDisposed) {
      result.status = 'BLOCKED';
      failure = { status: 'BLOCKED', reason: 'Job containers or internal network cleanup is unverified', stage: 'cleanup' };
    }
    result.postgresContainerCreated = Boolean(pgName);
    result.postgresContainerDisposed = job.postgres ? !pgName || !(await containerExists(configDirectory, pgName).catch(() => true)) : null;
    result.postgresServiceCleanup = job.postgres ? (result.postgresContainerDisposed ? 'PASS' : 'BLOCKED') : 'NOT_APPLICABLE';
    if (job.postgres && result.postgresContainerDisposed !== true) {
      result.status = 'BLOCKED';
      failure = { status: 'BLOCKED', reason: 'Disposable PostgreSQL cleanup is unverified', stage: 'cleanup' };
    }
  }
  if (failure) result.failure = failure;
  result.finishedAt = new Date().toISOString();
  return result;
}

async function proxyLogCounts(configDirectory, name) {
  try {
    const text = await dockerProcess(['container', 'logs', '--tail', '4', name], { configDirectory, timeoutMs: 10_000 });
    const last = text.split('\n').filter(Boolean).at(-1);
    if (!last) return null;
    const value = JSON.parse(last);
    if (value.event !== 'egress_proxy_stopped') return null;
    return { allowed: Number(value.allowed), denied: Number(value.denied), upstreamFailure: Number(value.upstreamFailure), active: Number(value.active) };
  } catch { return null; }
}

async function writeChecksums(evidenceDir) {
  const files = [];
  async function walk(directory, relative = '') {
    for (const name of await readdir(directory)) {
      const rel = relative ? `${relative}/${name}` : name;
      if (rel === 'SHA256SUMS') continue;
      const path = join(directory, name);
      const stat = await lstat(path);
      if (stat.isDirectory()) await walk(path, rel);
      else if (stat.isFile()) files.push(rel);
      else throw new Error('Unsupported Agent CI evidence file type');
    }
  }
  await walk(evidenceDir);
  files.sort();
  const lines = [];
  for (const relative of files) {
    const content = await readFile(join(evidenceDir, relative));
    lines.push(`${createHash('sha256').update(content).digest('hex')}  ${relative}`);
  }
  await writeFile(join(evidenceDir, 'SHA256SUMS'), `${lines.join('\n')}\n`, { mode: 0o600 });
  return files.length;
}

async function removeRunResources(configDirectory, { proxyName, egressNetwork, probeNetworks = [], probeContainers = [], run }) {
  const cleanup = { probeContainersRemoved: true, probeNetworksRemoved: true, proxyRemoved: true, egressNetworkRemoved: true, orphanVolumesRemoved: true, proxyCounters: null };
  for (const name of probeContainers) cleanup.probeContainersRemoved = (await removeContainer(configDirectory, name, run).catch(() => false)) && cleanup.probeContainersRemoved;
  for (const name of probeNetworks) cleanup.probeNetworksRemoved = (await removeNetwork(configDirectory, name, run).catch(() => false)) && cleanup.probeNetworksRemoved;
  if (proxyName) {
    const exists = await containerExists(configDirectory, proxyName).catch(() => null);
    if (exists === null) cleanup.proxyRemoved = false;
    else if (exists) {
      try {
        const labels = JSON.parse(await dockerProcess(['container', 'inspect', proxyName, '--format', '{{json .Config.Labels}}'], { configDirectory, timeoutMs: 10_000 }));
        if (labels?.['codex.agent-ci.run'] !== run) cleanup.proxyRemoved = false;
        else {
          try { await dockerProcess(['container', 'stop', '--timeout', '5', proxyName], { configDirectory, timeoutMs: 10_000 }); } catch { /* exact owned container is force-removed below */ }
          cleanup.proxyCounters = await proxyLogCounts(configDirectory, proxyName);
          cleanup.proxyRemoved = await removeContainer(configDirectory, proxyName, run).catch(() => false);
        }
      } catch { cleanup.proxyRemoved = false; }
    }
  }
  if (egressNetwork) cleanup.egressNetworkRemoved = await removeNetwork(configDirectory, egressNetwork, run).catch(() => false);
  const remainingContainers = await dockerProcess(['container', 'ls', '-aq', '--filter', `label=codex.agent-ci.run=${run}`], { configDirectory, timeoutMs: 10_000 }).catch(() => 'UNKNOWN');
  cleanup.orphanContainersRemoved = remainingContainers === 'UNKNOWN' ? false : true;
  for (const id of remainingContainers.split('\n').map((value) => value.trim()).filter(Boolean)) {
    const name = await dockerProcess(['container', 'inspect', id, '--format', '{{.Name}}'], { configDirectory, timeoutMs: 5_000 }).then((value) => value.trim().replace(/^\//, '')).catch(() => '');
    if (!name || !/^agent-ci-[a-z0-9-]+$/.test(name) || !(await removeContainer(configDirectory, name, run).catch(() => false))) cleanup.orphanContainersRemoved = false;
  }
  const remainingNetworks = await dockerProcess(['network', 'ls', '-q', '--filter', `label=codex.agent-ci.run=${run}`], { configDirectory, timeoutMs: 10_000 }).catch(() => 'UNKNOWN');
  cleanup.orphanNetworksRemoved = remainingNetworks === 'UNKNOWN' ? false : true;
  for (const id of remainingNetworks.split('\n').map((value) => value.trim()).filter(Boolean)) {
    const name = await dockerProcess(['network', 'inspect', id, '--format', '{{.Name}}'], { configDirectory, timeoutMs: 5_000 }).then((value) => value.trim()).catch(() => '');
    if (!name || !/^agent-ci-[a-z0-9-]+$/.test(name) || !(await removeNetwork(configDirectory, name, run).catch(() => false))) cleanup.orphanNetworksRemoved = false;
  }
  const remainingVolumes = await dockerProcess(['volume', 'ls', '-q', '--filter', `label=codex.agent-ci.run=${run}`], { configDirectory, timeoutMs: 10_000 }).catch(() => 'UNKNOWN');
  cleanup.orphanVolumesRemoved = remainingVolumes === 'UNKNOWN' ? false : true;
  for (const name of remainingVolumes.split('\n').map((value) => value.trim()).filter(Boolean)) {
    if (!/^agent-ci-workspace-[0-9]{14}-[a-f0-9]{10}-[a-z0-9-]+$/.test(name) || !(await removeWorkspaceVolume(configDirectory, name, run).catch(() => false))) cleanup.orphanVolumesRemoved = false;
  }
  const leftovers = await dockerProcess(['container', 'ls', '-aq', '--filter', `label=codex.agent-ci.run=${run}`], { configDirectory, timeoutMs: 10_000 }).catch(() => 'UNKNOWN');
  cleanup.noRunContainersRemain = leftovers.trim() === '';
  const leftoverNetworks = await dockerProcess(['network', 'ls', '-q', '--filter', `label=codex.agent-ci.run=${run}`], { configDirectory, timeoutMs: 10_000 }).catch(() => 'UNKNOWN');
  cleanup.noRunNetworksRemain = leftoverNetworks.trim() === '';
  const leftoverVolumes = await dockerProcess(['volume', 'ls', '-q', '--filter', `label=codex.agent-ci.run=${run}`], { configDirectory, timeoutMs: 10_000 }).catch(() => 'UNKNOWN');
  cleanup.noRunVolumesRemain = leftoverVolumes.trim() === '';
  return cleanup;
}

async function runAgentCi(args) {
  const identity = await inspectSourceTree(root);
  const mainShaAtStart = readCurrentMainSha();
  const cleanWorktreeAtStart = isGitWorktreeClean();
  const baseContainsHead = isCommitAncestor(mainShaAtStart, identity.commitSha);
  const inventory = await inspectWorkflowInventory(root);
  const run = runId();
  const evidenceDir = args.evidenceDir ?? join(tmpdir(), `agent-ci-evidence-${run}`);
  await mkdir(evidenceDir, { mode: 0o700 });
  await secureDirectory(evidenceDir);
  const privateRoot = await mkdtemp(join(tmpdir(), `agent-ci-private-${run}-`));
  await chmod(privateRoot, 0o700);
  const configDirectory = join(privateRoot, 'docker-config');
  await mkdir(configDirectory, { mode: 0o700 });
  const archivePath = join(privateRoot, 'source-snapshot.tar.gz');
  const manifestPath = join(evidenceDir, 'source-manifest.json');
  try { await createSourceArchive(root, identity, archivePath, manifestPath); }
  catch (error) {
    await rm(privateRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  const report = {
    schemaVersion: 1,
    executor: 'codex-agent-docker',
    localOnly: true,
    githubActionsInvoked: false,
    runnerRegistered: false,
    runId: run,
    commitSha: identity.commitSha,
    baseSha: mainShaAtStart,
    baseContainsHead,
    cleanWorktreeAtStart,
    sourceTreeSha256: identity.sourceTreeSha256,
    sourceFileCount: identity.fileCount,
    sourceBytes: identity.entries.reduce((sum, entry) => sum + (entry.type === 'file' ? entry.size : 0), 0),
    sourceTreePolicy: sourcePolicy,
    workflowHashes: inventory.workflowHashes,
    startedAt: new Date().toISOString(),
    evidenceDir,
    inventoryErrors: inventory.errors,
    jobs: [],
  };
  let proxyName = null;
  let proxyStarted = false;
  let egressNetwork = null;
  let preflightNetwork = null;
  let preflightContainer = null;
  const globalController = new AbortController();
  const abort = () => globalController.abort();
  process.on('SIGINT', abort);
  process.on('SIGTERM', abort);
  let configDirectoryPassed = false;
  try {
    const docker = await inspectDocker(configDirectory);
    configDirectoryPassed = true;
    report.environment = {
      daemon: docker.info,
      jobImage: { reference: ciImage, digest: ciImageId, architecture: docker.jobImage.architecture },
      postgresImage: { reference: postgresImage, digest: postgresImageId, architecture: docker.postgresImage.architecture },
      networkPolicy: { jobNetwork: 'internal', proxy: 'exact-host CONNECT allowlist via Docker Desktop upstream', proxyImageDigest: ciImageId, proxySourceOnlyInDisposableContainer: true, derivedImageBuilt: false, hostMounts: 0, dockerSocketMounted: false },
      workspacePolicy: {
        storage: 'per-job Docker-managed local named volume',
        mountTarget: '/home/pwuser',
        hostBindMounts: 0,
        volumeNoCopy: false,
        minimumFreeSpaceBytes: identity.entries.reduce((sum, entry) => sum + (entry.type === 'file' ? entry.size : 0), 0) + workspaceReserveBytes,
      },
      proxyAllowlist: CI_EGRESS_HOSTS,
      resourceLimits: { jobMemoryBytes: 5 * 1024 ** 3, jobCpuCount: 6, jobPidsLimit: 2048, postgresMemoryBytes: 1024 ** 3, maxJobMinutes: 60 },
    };
    if (inventory.errors.length) throw new Error(`Workflow inventory failed: ${inventory.errors.join('; ')}`);
    egressNetwork = `agent-ci-egress-${run}`;
    await createNetwork(configDirectory, egressNetwork, run, false);
    proxyName = `agent-ci-proxy-${run}`;
    const proxy = await createProxy(configDirectory, run, egressNetwork, docker.jobImage.id, () => { proxyStarted = true; });
    report.environment.networkPolicy.proxyScriptSha256 = proxy.sourceSha256;
    preflightNetwork = `agent-ci-net-${run}-probe`;
    preflightContainer = `agent-ci-probe-${run}`;
    const networkPreflight = await verifyNetworkBoundary(configDirectory, run, proxyName, docker.jobImage.id);
    preflightNetwork = networkPreflight.network;
    report.networkPreflight = networkPreflight;
    const dependencies = {};
    let lifecycleBlocked = false;
    let runnerSetupBlocked = null;
    for (const job of inventory.jobs) {
      if (globalController.signal.aborted) {
        report.jobs.push({ id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'cancellation', reason: 'Agent CI run cancelled' } });
        continue;
      }
      if (job.externalProbe) {
        const skipped = { id: job.id, workflow: job.workflow, required: false, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'external diagnostic', reason: 'Advisory public TikTok probe is intentionally not run' } };
        report.jobs.push(skipped);
        dependencies[job.id] = skipped.status;
        continue;
      }
      if (lifecycleBlocked) {
        const blocked = { id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'container lifecycle', reason: 'Previous disposable resource cleanup was not verified' } };
        report.jobs.push(blocked);
        dependencies[job.id] = blocked.status;
        continue;
      }
      if (runnerSetupBlocked) {
        const blocked = { id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: 'runner setup fail-fast', reason: `Earlier job setup failed before workflow steps (${runnerSetupBlocked.safeCode ?? 'UNCLASSIFIED'})` } };
        report.jobs.push(blocked);
        dependencies[job.id] = blocked.status;
        continue;
      }
      report.inProgressJob = job.id;
      await writeJson(join(evidenceDir, 'result.json'), report);
      const jobController = new AbortController();
      const cancel = () => jobController.abort();
      globalController.signal.addEventListener('abort', cancel, { once: true });
      const timeoutMs = Math.min(job.timeoutMinutes * 60_000, 60 * 60_000);
      const timer = setTimeout(() => jobController.abort(), timeoutMs);
      timer.unref();
      const jobResult = await runJob(job, {
        configDirectory, run, archivePath, manifestPath, evidenceDir,
        dependencies, signal: jobController.signal, proxyName,
        jobImageId: docker.jobImage.id,
      });
      clearTimeout(timer);
      globalController.signal.removeEventListener('abort', cancel);
      delete report.inProgressJob;
      report.jobs.push(jobResult);
      dependencies[job.id] = jobResult.status;
      if (jobResult.containerCreated && !jobResult.containerDisposed) lifecycleBlocked = true;
      if (jobResult.status === 'BLOCKED' && jobResult.steps.length === 0) runnerSetupBlocked = jobResult.failure ?? { safeCode: 'UNCLASSIFIED' };
      await writeJson(join(evidenceDir, 'result.json'), report);
    }
    report.cleanup = await removeRunResources(configDirectory, { proxyName, egressNetwork, probeNetworks: preflightNetwork ? [preflightNetwork] : [], probeContainers: preflightContainer ? [preflightContainer] : [], run });
    proxyName = null;
    egressNetwork = null;
    report.cleanup.proxyShutdown = !proxyStarted ? 'NOT_STARTED' : report.cleanup.proxyCounters?.active === 0 ? 'CONFIRMED' : 'NOT_CONFIRMED';
    if (Object.values(report.cleanup).some((value) => value === false) || report.cleanup.noRunContainersRemain !== true || report.cleanup.noRunNetworksRemain !== true || report.cleanup.noRunVolumesRemain !== true) {
      report.cleanup.status = 'BLOCKED';
    } else {
      report.cleanup.status = report.cleanup.proxyShutdown === 'CONFIRMED' || report.cleanup.proxyShutdown === 'NOT_STARTED' ? 'PASS' : 'BLOCKED';
    }
  } catch (error) {
    const failureStage = error.stage ?? 'preflight or orchestration';
    const failureReason = error.safeCode ? `${error.message} [${error.safeCode}]` : error.message;
    report.runFailure = { status: 'BLOCKED', stage: failureStage, reason: failureReason };
    for (const job of inventory.jobs) {
      if (!report.jobs.some((value) => value.id === job.id)) report.jobs.push({ id: job.id, workflow: job.workflow, required: job.required, status: 'BLOCKED', failure: { status: 'BLOCKED', stage: failureStage, reason: failureReason } });
    }
    if (configDirectoryPassed) {
      report.cleanup = await removeRunResources(configDirectory, { proxyName, egressNetwork, probeNetworks: preflightNetwork ? [preflightNetwork] : [], probeContainers: preflightContainer ? [preflightContainer] : [], run }).catch(() => ({ status: 'BLOCKED' }));
      if (report.cleanup.status !== 'BLOCKED') {
        const resourcesRemoved = Object.entries(report.cleanup).filter(([key]) => key !== 'proxyCounters' && key !== 'status').every(([, value]) => value === true);
        const proxyStopped = !proxyStarted || report.cleanup.proxyCounters?.active === 0;
        report.cleanup.proxyShutdown = !proxyStarted ? 'NOT_STARTED' : proxyStopped ? 'CONFIRMED' : 'NOT_CONFIRMED';
        report.cleanup.status = resourcesRemoved && proxyStopped ? 'PASS' : 'BLOCKED';
      }
    } else report.cleanup = { status: 'NOT_RUN', reason: 'Docker preflight did not complete' };
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
    await rm(privateRoot, { recursive: true, force: true }).catch(() => {});
  }

  const finalIdentity = await inspectSourceTree(root);
  report.finishedAt = new Date().toISOString();
  report.currentSourceTreeSha256 = finalIdentity.sourceTreeSha256;
  report.sourceTreeMatchesAtFinish = finalIdentity.commitSha === identity.commitSha && finalIdentity.sourceTreeSha256 === identity.sourceTreeSha256;
  report.baseShaMatchesAtFinish = mainShaAtStart !== null && readCurrentMainSha() === mainShaAtStart;
  report.cleanWorktreeAtFinish = isGitWorktreeClean();
  report.requiredJobIds = expectedJobs.filter((job) => job.required).map((job) => job.id);
  report.advisoryJobIds = expectedJobs.filter((job) => !job.required).map((job) => job.id);
  report.localDecision = mergeDecision(report.jobs, report.requiredJobIds, { sourceTreeMatches: report.sourceTreeMatchesAtFinish });
  report.localDecision.githubRequiredChecksEquivalent = false;
  report.localDecision.githubRequiredChecksStatus = 'NOT_VERIFIED_OR_ENFORCED_BY_LOCAL_CI';
  report.localDecision.mergeReadiness = 'NOT_MERGEABLE_WITH_LOCAL_EVIDENCE_ALONE';
  report.mandatoryJobsPassed = report.jobs.filter((job) => job.required && job.status === 'PASS').length;
  report.mandatoryStepCount = report.jobs.filter((job) => job.required).reduce((sum, job) => sum + (job.steps?.length ?? 0), 0);
  report.evidenceVerification = { status: 'PENDING' };
  await writeJson(join(evidenceDir, 'result.json'), report);
  await writeChecksums(evidenceDir);
  const firstEvidence = await verifyEvidence(evidenceDir);
  report.evidenceVerification = firstEvidence;
  await writeJson(join(evidenceDir, 'result.json'), report);
  await writeChecksums(evidenceDir);
  const stableEvidence = await verifyEvidence(evidenceDir);
  let pushGateRecord = { status: 'BLOCKED', reason: 'full evidence verification did not pass' };
  if (stableEvidence.status === 'PASS') {
    try {
      pushGateRecord = await persistVerifiedRunRecord({ repo: root, evidenceDir, report, verification: stableEvidence });
    } catch {
      pushGateRecord = { status: 'BLOCKED', reason: 'private push-gate evidence record could not be written' };
    }
  }
  const final = {
    runId: run,
    commitSha: report.commitSha,
    sourceTreeSha256: report.sourceTreeSha256,
    evidenceDir,
    jobs: report.jobs.filter((job) => job.required).map(({ id, status, failure }) => ({ id, status, ...(failure ? { failure: failure.reason } : {}) })),
    mandatoryJobsPassed: report.mandatoryJobsPassed,
    mandatorySteps: report.mandatoryStepCount,
    cleanup: report.cleanup?.status ?? 'BLOCKED',
    evidenceVerification: stableEvidence.status,
    pushGateRecord: pushGateRecord.status,
  };
  process.stdout.write(`${JSON.stringify(final, null, 2)}\n`);
  return report.mandatoryJobsPassed === 8 && report.sourceTreeMatchesAtFinish && report.cleanup?.status === 'PASS' && stableEvidence.status === 'PASS' ? 0 : 1;
}

async function verifyEvidence(evidenceDir) {
  return new Promise((resolvePromise) => {
    const child = spawn('/usr/bin/python3', [join(root, 'tools/codex-ci/agent-evidence.py'), 'verify', '--evidence-dir', evidenceDir, '--repo', root], { stdio: ['ignore', 'pipe', 'ignore'] });
    const stdout = [];
    let closed = false;
    let timedOut = false;
    let forceTimer = null;
    let finalTimer = null;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      clearTimeout(finalTimer);
      resolvePromise(result);
    };
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.once('error', () => finish({ status: 'BLOCKED', reason: 'Agent CI evidence verifier could not be started' }));
    child.once('close', (code) => {
      if (timedOut) finish({ status: 'BLOCKED', reason: 'Agent CI evidence verifier exceeded 90 seconds' });
      else if (code === 0) finish({ status: 'PASS', summary: Buffer.concat(stdout).toString('utf8').trim() });
      else finish({ status: 'FAIL', reason: 'Agent CI evidence verifier rejected the run' });
    });
  const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => { if (!closed) child.kill('SIGKILL'); }, 2_000);
    forceTimer.unref();
      finalTimer = setTimeout(() => finish({ status: 'BLOCKED', reason: 'Agent CI evidence verifier exceeded its shutdown budget' }), 3_000);
    finalTimer.unref();
    }, 90_000);
    timer.unref();
  });
}

async function plan() {
  const [identity, inventory] = await Promise.all([inspectSourceTree(root), inspectWorkflowInventory(root)]);
  const required = inventory.jobs.filter((job) => job.required);
  process.stdout.write(`${JSON.stringify({
    mode: 'Codex-operated Docker CI; no GitHub Actions or runner registration',
    commitSha: identity.commitSha,
    sourceTreeSha256: identity.sourceTreeSha256,
    sourceFileCount: identity.fileCount,
    workflowHashes: inventory.workflowHashes,
    inventoryErrors: inventory.errors,
    mandatoryJobCount: required.length,
    mandatoryStepCount: required.reduce((sum, job) => sum + job.steps.length, 0),
    jobs: inventory.jobs.map((job) => ({ id: job.id, required: job.required, postgres: job.postgres, steps: job.steps.length, timeoutMinutes: job.timeoutMinutes })),
    jobImage: ciImage,
    postgresImage,
    allowlistedEgressHosts: CI_EGRESS_HOSTS,
    policyChangeRequiredBeforeReplacingExistingPushGate: true,
  }, null, 2)}\n`);
  return inventory.errors.length ? 1 : 0;
}

async function preflight() {
  const privateRoot = await mkdtemp(join(tmpdir(), 'agent-ci-preflight-'));
  await chmod(privateRoot, 0o700);
  const configDirectory = join(privateRoot, 'docker-config');
  await mkdir(configDirectory, { mode: 0o700 });
  try {
    const result = await inspectDocker(configDirectory);
    const inventory = await inspectWorkflowInventory(root);
    process.stdout.write(`${JSON.stringify({ status: inventory.errors.length ? 'BLOCKED' : 'PASS', docker: result.info, jobImage: result.jobImage, postgresImage: result.postgresImage, inventoryErrors: inventory.errors, mandatoryJobs: inventory.jobs.filter((job) => job.required).length, mandatorySteps: inventory.jobs.filter((job) => job.required).reduce((sum, job) => sum + job.steps.length, 0) }, null, 2)}\n`);
    return inventory.errors.length ? 1 : 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'BLOCKED', reason: error.message }, null, 2)}\n`);
    return 1;
  } finally { await rm(privateRoot, { recursive: true, force: true }); }
}

function usage() {
  process.stdout.write('Usage:\n  node tools/codex-ci/agent-ci.mjs plan\n  node tools/codex-ci/agent-ci.mjs preflight\n  node tools/codex-ci/agent-ci.mjs run [--evidence-dir=/absolute/private/path]\n');
}

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  const options = { evidenceDir: null };
  for (const arg of args) {
    if (arg.startsWith('--evidence-dir=')) options.evidenceDir = resolve(arg.slice('--evidence-dir='.length));
    else throw new Error('Unknown Agent CI argument');
  }
  if (command === 'plan') return plan();
  if (command === 'preflight') return preflight();
  if (command === 'run') return runAgentCi(options);
  usage();
  return command === 'help' ? 0 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${redactLog(error.message)}\n`);
    process.exitCode = 2;
  });
}
