import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { classifyDockerDiagnostic, JOB_EGRESS_CHECK, lastProbeStage, makeJobContainerArgs, makeProxyLaunchArgs, parseDockerInfo, PROBE_SCRIPT, verifySourceSnapshotMarker } from './agent-ci.mjs';

const run = '20261016000000-0123456789';
const imageId = `sha256:${'a'.repeat(64)}`;

test('Docker preflight accepts only the reviewed Desktop ARM64 host and upstream proxy', () => {
  const valid = parseDockerInfo('29.8.1|Docker Desktop|arm64|10|8319504384|http://http.docker.internal:3128|http://http.docker.internal:3128|localhost,127.0.0.1');
  assert.equal(valid.architecture, 'arm64');
  assert.equal(valid.upstreamProxy.credentialsPresent, false);
  for (const invalid of [
    '29.8.1|Linux|arm64|10|8319504384|http://http.docker.internal:3128|http://http.docker.internal:3128|localhost',
    '29.8.1|Docker Desktop|x86_64|10|8319504384|http://http.docker.internal:3128|http://http.docker.internal:3128|localhost',
    '29.8.1|Docker Desktop|arm64|2|8319504384|http://http.docker.internal:3128|http://http.docker.internal:3128|localhost',
    '29.8.1|Docker Desktop|arm64|10|8319504384|http://user:secret@http.docker.internal:3128|http://http.docker.internal:3128|localhost',
  ]) assert.throws(() => parseDockerInfo(invalid));
});

test('Docker errors expose only a bounded diagnostic class', () => {
  assert.equal(classifyDockerDiagnostic('tar: Cannot write: No space left on device'), 'WORKSPACE_STORAGE_EXHAUSTED');
  assert.equal(classifyDockerDiagnostic('tar: error reading archive'), 'SOURCE_ARCHIVE_EXTRACTION_FAILED');
  assert.equal(classifyDockerDiagnostic('statfsSync is not a function'), 'WORKSPACE_CAPACITY_PROBE_FAILED');
  assert.equal(classifyDockerDiagnostic('source digest mismatch'), 'SOURCE_SNAPSHOT_INTEGRITY_FAILED');
  assert.equal(classifyDockerDiagnostic('direct egress boundary failed'), 'DIRECT_EGRESS_BOUNDARY_FAILED');
  assert.equal(classifyDockerDiagnostic('read-only file system'), 'READ_ONLY_FILESYSTEM');
  assert.equal(classifyDockerDiagnostic('operation not permitted'), 'PERMISSION_DENIED');
  assert.equal(classifyDockerDiagnostic('network agent-ci-net-abc not found'), 'NETWORK_NOT_FOUND');
  assert.equal(classifyDockerDiagnostic('Could not resolve proxy: agent-ci-proxy'), 'PROXY_ALIAS_DNS_FAILURE');
  assert.equal(classifyDockerDiagnostic('allowlisted package registry was unreachable'), 'ALLOWLISTED_PROXY_EGRESS_FAILED');
  assert.equal(classifyDockerDiagnostic('daemon rejected an unknown failure'), 'UNCLASSIFIED_DOCKER_FAILURE');
  assert.equal(classifyDockerDiagnostic('raw diagnostic with sensitive field'), 'UNCLASSIFIED_DOCKER_FAILURE');
});

test('network probe telemetry retains only the last allowlisted phase name', () => {
  assert.equal(lastProbeStage('AGENT_CI_PROBE_STAGE=ipv4-route\nAGENT_CI_PROBE_STAGE=host-proxy-check'), 'host-proxy-check');
  assert.equal(lastProbeStage('private diagnostic text'), null);
});

test('guest source snapshot marker must exactly match the host digest and file count', () => {
  const manifest = { sourceTreeSha256: 'a'.repeat(64), fileCount: 2122 };
  assert.deepEqual(verifySourceSnapshotMarker(`SOURCE_SNAPSHOT_VERIFIED=${manifest.sourceTreeSha256};files=2122\n`, manifest), {
    sourceTreeSha256: manifest.sourceTreeSha256,
    fileCount: manifest.fileCount,
  });
  assert.throws(() => verifySourceSnapshotMarker(`SOURCE_SNAPSHOT_VERIFIED=${'b'.repeat(64)};files=2122`, manifest), /hashMatch=false/);
  assert.throws(() => verifySourceSnapshotMarker(`SOURCE_SNAPSHOT_VERIFIED=${manifest.sourceTreeSha256};files=2121`, manifest), /fileCountMatch=false/);
  assert.throws(() => verifySourceSnapshotMarker(''), /missing.*outputBytes=0/);
});

test('job egress check uses a bounded async wrapper and emits sanitized boundary flags', () => {
  const parsed = spawnSync(process.execPath, ['--check', '-'], { input: JOB_EGRESS_CHECK, encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
  assert.match(JOB_EGRESS_CHECK, /async function main\(\)/);
  assert.match(JOB_EGRESS_CHECK, /DIRECT_EGRESS_RESULT=/);
  assert.match(JOB_EGRESS_CHECK, /directIpv4TcpReachable/);
  assert.match(JOB_EGRESS_CHECK, /directIpv6TcpReachable/);
  assert.match(JOB_EGRESS_CHECK, /hostProxyReachable/);
});

test('proxy source is hash-checked in a disposable read-only container without host mounts', () => {
  const launch = makeProxyLaunchArgs({
    name: `agent-ci-proxy-${run}`,
    egressNetwork: `agent-ci-egress-${run}`,
    run,
    imageId,
    source: 'export function main() { process.exit(0); }',
  });
  const args = launch.args;
  const bootstrap = args.at(-1);
  const checked = spawnSync(process.execPath, ['--input-type=module', '--check', '-'], { input: bootstrap, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(bootstrap, /createHash/);
  assert.match(bootstrap, /data:text\/javascript;base64/);
  assert.ok(args.includes('--read-only'));
  assert.equal(args.includes('--volume'), false);
  assert.equal(args.some((arg) => arg.includes('docker.sock')), false);
  assert.equal(args.some((arg) => arg === 'cp'), false);
  assert.match(launch.sourceSha256, /^[a-f0-9]{64}$/);
});

test('job container uses a per-job Docker volume without host binds, socket, ports, or elevated privilege', () => {
  const args = makeJobContainerArgs({
    name: `agent-ci-job-${run}-backend`,
    network: `agent-ci-net-${run}-backend`,
    workspaceVolume: `agent-ci-workspace-${run}-backend`,
    imageId,
    run,
    jobId: 'backend',
    proxyEnv: { HTTPS_PROXY: 'http://agent-ci-proxy:3128' },
  });
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('--init'));
  assert.ok(args.includes('--cap-drop'));
  assert.ok(args.includes('ALL'));
  assert.ok(args.includes('no-new-privileges'));
  assert.ok(args.includes('1001:1001'));
  assert.equal(args.includes('-v'), false);
  assert.equal(args.includes('--volume'), false);
  assert.ok(args.includes('--mount'));
  assert.ok(args.includes(`type=volume,source=agent-ci-workspace-${run}-backend,target=/home/pwuser`));
  assert.equal(args.some((arg) => arg.includes('docker.sock')), false);
  assert.equal(args.some((arg) => arg === '--publish' || arg === '-p'), false);
  assert.throws(() => makeJobContainerArgs({ name: `agent-ci-job-${run}-backend`, network: `agent-ci-net-${run}-backend`, workspaceVolume: 'unrelated-volume', imageId, run, jobId: 'backend', proxyEnv: {} }));
  assert.throws(() => makeJobContainerArgs({ name: `agent-ci-job-${run}-backend`, network: `agent-ci-net-${run}-backend`, workspaceVolume: `agent-ci-workspace-${run}-backend`, imageId, run: 'bad', jobId: 'backend', proxyEnv: {} }));
});

test('network preflight script is valid Node.js and includes allow/deny and direct-route checks', () => {
  const parsed = spawnSync(process.execPath, ['--check', '-'], { input: PROBE_SCRIPT, encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr);
  const section = PROBE_SCRIPT.slice(PROBE_SCRIPT.indexOf('const blockedScript = ['), PROBE_SCRIPT.indexOf("].join('');") + "].join('');".length);
  const blockedScript = new Function(`${section}; return blockedScript;`)();
  const nestedParsed = spawnSync(process.execPath, ['--check', '-'], { input: blockedScript, encoding: 'utf8' });
  assert.equal(nestedParsed.status, 0, nestedParsed.stderr);
  assert.match(blockedScript, /CONNECT example\.com:443 HTTP\/1\.1\\r\\n/);
  assert.match(PROBE_SCRIPT, /https:\/\/registry\.npmjs\.org/);
  assert.match(PROBE_SCRIPT, /https:\/\/fonts\.googleapis\.com/);
  assert.match(PROBE_SCRIPT, /https:\/\/fonts\.gstatic\.com/);
  assert.match(PROBE_SCRIPT, /https:\/\/cdn\.jsdelivr\.net\/gh\/twitter\/twemoji@14\.0\.2\/assets\/svg\/26a1\.svg/);
  assert.match(PROBE_SCRIPT, /stage\('allowlisted-font-check'\)/);
  assert.match(PROBE_SCRIPT, /stage\('allowlisted-emoji-asset-check'\)/);
  assert.match(PROBE_SCRIPT, /CONNECT example\.com:443/);
  assert.match(PROBE_SCRIPT, /internal network has an IPv4 default route/);
  assert.match(PROBE_SCRIPT, /directIpv4TcpReachable/);
  assert.match(PROBE_SCRIPT, /directIpv6TcpReachable/);
  assert.match(PROBE_SCRIPT, /const hostProxyReachable = await new Promise/);
  assert.doesNotMatch(PROBE_SCRIPT, /const canConnect\s*=/);
  assert.match(PROBE_SCRIPT, /stage\('allowlisted-proxy-check'\)/);
  assert.doesNotMatch(PROBE_SCRIPT, /LINE|Railway|localhost:5432/);
});
