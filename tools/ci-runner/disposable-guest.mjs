// Host-only lifecycle, with no GitHub registration or hosted-runner fallback.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, lstat, rename } from 'node:fs/promises';
import { join } from 'node:path';

const base = 'oppo-ci';
const namePattern = /^oppo-job-[a-f0-9]{16}$/;
const overrides = [
  '.provision = []', '.probes = []', '.mounts = []', '.portForwards = [{"guestPortRange": [1,65535], "ignore": true}]', '.param = {"internal_netplanOptional": "true"}',
  '.ssh.overVsock = true', '.ssh.forwardAgent = false', '.ssh.forwardX11 = false', '.ssh.loadDotSSHPubKeys = false',
  '.propagateProxyEnv = false', '.message = "Disposable CI guest; no socket or port forwarding"',
];

export function limaDriver(executable = '/opt/homebrew/bin/limactl', { onFailure, home, limaHome } = {}) {
  return async (args, { signal } = {}) => new Promise((resolve, reject) => {
    const child = spawn(executable, ['--tty=false', ...args], {
      signal, stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        HOME: home ?? process.env.HOME,
        LIMA_HOME: limaHome ?? process.env.LIMA_HOME,
        PATH: '/opt/homebrew/bin:/usr/bin:/bin',
      },
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    let diagnostic = '';
    child.stderr.on('data', (chunk) => { diagnostic = (diagnostic + chunk).slice(-65536); });
    child.on('error', () => reject(new Error('Lima invocation failed')));
    child.on('close', async (code) => {
      if (code === 0) return resolve(output);
      try { if (onFailure) await onFailure({ operation: args[0], output, diagnostic }); }
      catch { return reject(new Error('Private diagnostic retention failed')); }
      reject(new Error(`Lima ${args[0]} failed`));
    });
  });
}

// All future runner/job execution must descend from this restricted user
// manager. A direct sudo/runuser launch would bypass its AF_VSOCK seccomp rule.
export async function runAsRunner(driver, name, command, { signal } = {}) {
  if (!namePattern.test(name) || !Array.isArray(command) || command.length === 0) {
    throw new Error('Invalid disposable command');
  }
  return driver(['shell', name, '--', 'sudo', 'runuser', '-u', 'oppo-ci-runner', '--',
    'env', 'HOME=/home/oppo-ci-runner', 'XDG_RUNTIME_DIR=/run/user/1001',
    'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1001/bus',
    'systemd-run', '--user', '--wait', '--collect', '--pipe', '--quiet',
    '--service-type=exec', '--', 'env',
    'PATH=/opt/ci/node/bin:/usr/local/bin:/usr/bin:/bin',
    'DOCKER_HOST=unix:///run/user/1001/docker.sock',
    'HTTP_PROXY=http://127.0.0.1:3128', 'HTTPS_PROXY=http://127.0.0.1:3128',
    'http_proxy=http://127.0.0.1:3128', 'https_proxy=http://127.0.0.1:3128',
    'NO_PROXY=localhost,127.0.0.1,::1', 'no_proxy=localhost,127.0.0.1,::1',
    'npm_config_proxy=http://127.0.0.1:3128', 'npm_config_https_proxy=http://127.0.0.1:3128',
    'NODE_USE_ENV_PROXY=1', 'CI=true', ...command], { signal });
}

async function instances(driver) {
  const raw = await driver(['list', '--json']);
  return raw.trim() ? raw.trim().split('\n').map((line) => JSON.parse(line)) : [];
}
async function destroy(driver, name) {
  if (!namePattern.test(name)) throw new Error('Refusing unmanaged guest deletion');
  if ((await instances(driver)).some((instance) => instance.name === name)) {
    await driver(['delete', '--force', name]);
  }
  if ((await instances(driver)).some((instance) => instance.name === name)) {
    throw new Error('Guest disposal unverified; scheduling blocked');
  }
  const limaHome = process.env.LIMA_HOME ?? join(process.env.HOME, '.lima');
  try { await lstat(join(limaHome, name)); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error('Guest filesystem disposal unknown; scheduling blocked');
  }
  throw new Error('Guest files remain; scheduling blocked');
}
async function secureState(stateDir) {
  await mkdir(stateDir, { mode: 0o700, recursive: true });
  const state = await lstat(stateDir);
  if (!state.isDirectory() || state.uid !== process.getuid() || (state.mode & 0o077)) {
    throw new Error('Unsafe host state directory');
  }
}

export async function recoverGuest({ stateDir, driver = limaDriver(), afterDestroy = async () => {} }) {
  await secureState(stateDir);
  let record;
  try { record = JSON.parse(await readFile(join(stateDir, 'lock', 'job.json'), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error('Recovery record unreadable; scheduling blocked');
  }
  if (!namePattern.test(record.name) || !Number.isSafeInteger(record.pid) || record.pid <= 0 ||
      (record.runnerId !== undefined && (!Number.isSafeInteger(record.runnerId) || record.runnerId <= 0)) ||
      (record.runnerName !== undefined && !/^oppo-ci-job-[a-f0-9]{16}$/.test(record.runnerName))) {
    throw new Error('Invalid recovery record; scheduling blocked');
  }
  try { process.kill(record.pid, 0); }
  catch (error) {
    if (error.code !== 'ESRCH') throw new Error('Supervisor liveness unknown');
    await destroy(driver, record.name);
    await afterDestroy(record);
    await rm(join(stateDir, 'lock'), { recursive: true });
    return;
  }
  throw new Error('Supervisor still alive; scheduling blocked');
}

export async function withDisposableGuest(action, {
  stateDir, driver = limaDriver(), signal, timeoutMs = 1800000, afterDestroy = async () => {},
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 3600000) {
    throw new Error('Invalid job deadline');
  }
  await secureState(stateDir);
  const lock = join(stateDir, 'lock');
  try { await mkdir(lock, { mode: 0o700 }); }
  catch { throw new Error('Supervisor locked; recover before scheduling'); }
  const name = `oppo-job-${randomBytes(8).toString('hex')}`;
  let record = { name, pid: process.pid };
  const recordPath = join(lock, 'job.json');
  await writeFile(recordPath, JSON.stringify(record), { mode: 0o600 });
  const updateRecord = async (update) => {
    if (!update || typeof update !== 'object' || Array.isArray(update) ||
        Object.keys(update).some((key) => !['runnerId', 'runnerName'].includes(key)) ||
        (update.runnerId !== undefined && (!Number.isSafeInteger(update.runnerId) || update.runnerId <= 0)) ||
        (update.runnerName !== undefined && !/^oppo-ci-job-[a-f0-9]{16}$/.test(update.runnerName))) {
      throw new Error('Invalid supervisor recovery metadata');
    }
    const current = JSON.parse(await readFile(recordPath, 'utf8'));
    if (current.name !== name || current.pid !== process.pid || current.runnerId !== record.runnerId ||
        current.runnerName !== record.runnerName) throw new Error('Supervisor recovery record changed');
    record = { ...current, ...update };
    const temporaryPath = join(lock, 'job.json.tmp');
    try {
      await writeFile(temporaryPath, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      await rename(temporaryPath, recordPath);
    } catch (error) {
      record = current;
      try { await rm(temporaryPath, { force: true }); } catch { /* the lock prevents unsafe scheduling */ }
      throw error;
    }
  };
  const deadline = AbortSignal.timeout(timeoutMs);
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let cancelHandler;
  try {
    const baseline = (await instances(driver)).find((instance) => instance.name === base);
    if (baseline?.status !== 'Stopped') throw new Error('Base must remain stopped and credential-free');
    await driver(['clone', base, name, '--mount-none', ...overrides.flatMap((value) => ['--set', value])], { signal: cancellation });
    await driver(['start', name], { signal: cancellation });
    await driver(['shell', name, '--', 'sudo', '/usr/local/sbin/ci-prepare-job'], { signal: cancellation });
    cancellation.throwIfAborted();
    const cancelled = new Promise((resolve, reject) => {
      cancelHandler = () => reject(new Error('Job cancelled or deadline exceeded'));
      cancellation.addEventListener('abort', cancelHandler, { once: true });
    });
    return await Promise.race([action({ name, signal: cancellation, driver, updateRecord }), cancelled]);
  } finally {
    // Cleanup deliberately has no cancelled signal. Host force-deletes the
    // entire guest, not just the workspace or ephemeral runner registration.
    if (cancelHandler) cancellation.removeEventListener('abort', cancelHandler);
    await destroy(driver, name);
    await afterDestroy(record);
    await rm(lock, { recursive: true });
  }
}
