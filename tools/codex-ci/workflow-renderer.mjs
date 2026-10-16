import { workflowNeedsResult } from './policy.mjs';
const runnerHome = '/home/oppo-ci-runner';
const workspace = `${runnerHome}/work/repository`;
function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function workflowEnvValue(value, { availableEnv, dependencies, username }) {
  if (typeof value !== 'string') return String(value);
  let output = value.replace(/\$\{\{\s*env\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_whole, key) => {
    if (!(key in availableEnv)) throw new Error(`Unresolved workflow environment reference: ${key}`);
    return availableEnv[key];
  });
  output = output.replace(/\$\{\{\s*needs\.([A-Za-z0-9_-]+)\.result\s*\}\}/g, (_whole, key) => {
    if (!(key in dependencies)) throw new Error(`Unresolved job dependency result: ${key}`);
    return workflowNeedsResult(dependencies[key]);
  });
  if (output.includes('${{ inputs.username ||')) output = username;
  if (output.includes('${{')) throw new Error('Unsupported GitHub Actions expression in workflow environment');
  return output;
}

function resolvedStepEnv(job, step, dependencyStatuses, username, settings = {}) {
  const merged = { ...job.jobEnv };
  for (const [key, raw] of Object.entries(job.jobEnv)) {
    merged[key] = workflowEnvValue(raw, { availableEnv: merged, dependencies: dependencyStatuses, username });
  }
  for (const [key, raw] of Object.entries(step.env)) {
    merged[key] = workflowEnvValue(raw, { availableEnv: merged, dependencies: dependencyStatuses, username });
  }
  merged.CI = 'true';
  merged.GITHUB_ACTIONS = 'true';
  merged.GITHUB_WORKSPACE = settings.workspace ?? workspace;
  const tempRoot = settings.tempRoot ?? '/tmp/codex-local-ci';
  merged.GITHUB_OUTPUT = `${tempRoot}/github-output`;
  merged.GITHUB_STEP_SUMMARY = `${tempRoot}/step-summary`;
  merged.GITHUB_JOB = job.id;
  merged.RUNNER_TEMP = tempRoot;
  merged.NPM_CONFIG_CACHE = `${tempRoot}/npm-cache`;
  if (job.externalProbe) merged.PLAYWRIGHT_BROWSERS_PATH = `${settings.runnerHome ?? runnerHome}/.cache/ms-playwright`;
  return merged;
}

export function renderWorkflowCommand(job, step, dependencyStatuses = {}, username = '', settings = {}) {
  const selectedRunnerHome = settings.runnerHome ?? runnerHome;
  const selectedWorkspace = settings.workspace ?? workspace;
  let commandText = step.run;
  const syntheticChromiumStep = job.id === 'backend' && step.name === 'Install Chromium for synthetic Manager interception';
  const advisoryChromiumStep = job.id === 'live-probe' && step.name === 'Install Chromium';
  const webAdaptiveAuthTypeScriptStep = job.id === 'web-adaptive-auth' && step.name === 'Adaptive authorization regression tests';
  if (webAdaptiveAuthTypeScriptStep) {
    if (commandText !== 'node --test test/authorization.test.mts') {
      throw new Error('Node TypeScript test command changed; pinned-image compatibility adapter needs review');
    }
    commandText = 'node --experimental-strip-types --test test/authorization.test.mts';
  }
  const frontendBuildStep = job.id === 'frontend' && step.name === 'Build';
  if (frontendBuildStep && commandText !== 'npm run build') {
    throw new Error('Frontend build command changed; restricted Google Fonts proxy adapter needs review');
  }
  if (syntheticChromiumStep || advisoryChromiumStep) {
    if (commandText !== 'npx playwright install --with-deps chromium') {
      throw new Error('Browser installation command changed; non-sudo adapter needs review');
    }
    commandText = 'npx playwright install chromium';
  }
  const env = resolvedStepEnv(job, step, dependencyStatuses, username, settings);
  for (const [key, value] of Object.entries(settings.env ?? {})) env[key] = String(value);
  if (frontendBuildStep) {
    const preloadPath = `${selectedWorkspace}/tools/codex-ci/google-font-fetch-proxy.cjs`;
    env.CODEX_AGENT_CI_BUILD_ASSET_PROXY = '1';
    env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require=${preloadPath}`].filter(Boolean).join(' ');
  }
  if (settings.databaseServiceHost) {
    for (const [key, value] of Object.entries(env)) {
      if (key !== 'DATABASE_URL' && !/_DATABASE_URL$/.test(key)) continue;
      let parsed;
      try { parsed = new URL(value); }
      catch { throw new Error(`Unsupported database service URL in ${key}`); }
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.hostname !== 'localhost' || parsed.port !== '5432') {
        throw new Error(`Unreviewed database service endpoint in ${key}`);
      }
      parsed.hostname = settings.databaseServiceHost;
      env[key] = parsed.toString();
    }
  }
  const workingDirectory = job.workingDirectory === '.' ? selectedWorkspace : `${selectedWorkspace}/${job.workingDirectory}`;
  const envLines = Object.entries(env).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error('Invalid workflow environment variable name');
    return `export ${key}=${shellQuote(value)}`;
  });
  const commandPath = step.shell === 'python'
    ? `${selectedRunnerHome}/work/.codex-local-ci/workflow-step.py`
    : `${selectedRunnerHome}/work/.codex-local-ci/workflow-step.sh`;
  let invocation;
  if (step.shell === 'python') invocation = `python3 ${shellQuote(commandPath)}`;
  else if (step.shell === 'bash') invocation = `bash --noprofile --norc -eo pipefail ${shellQuote(commandPath)}`;
  else throw new Error(`Unsupported workflow shell: ${step.shell}`);
  invocation += ' 2>&1';
  const wrapper = [
    'set -u',
    `mkdir -p ${shellQuote(settings.tempRoot ?? '/tmp/codex-local-ci')}`,
    `: > ${shellQuote(env.GITHUB_OUTPUT)}`,
    `: > ${shellQuote(env.GITHUB_STEP_SUMMARY)}`,
    `cd ${shellQuote(workingDirectory)}`,
    ...envLines,
    'set +e',
    invocation,
    'code=$?',
    'printf "\\n__CODEX_STEP_RC__%s\\n" "$code"',
    'exit 0',
  ].join('\n');
  return { wrapper, commandText, commandExtension: step.shell === 'python' ? 'py' : 'sh', env };
}
