import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

export const expectedJobs = [
  { id: 'backend', workflow: 'backend-ci.yml', required: true, postgres: true },
  { id: 'frontend', workflow: 'backend-ci.yml', required: true, postgres: false },
  { id: 'ci-gate', workflow: 'backend-ci.yml', required: true, postgres: false },
  { id: 'web-adaptive-auth', workflow: 'adaptive-auth-ci.yml', required: true, postgres: false },
  { id: 'auth-foundation', workflow: 'unified-auth-ci.yml', required: true, postgres: true },
  { id: 'web-registration', workflow: 'unified-auth-ci.yml', required: true, postgres: false },
  { id: 'enforce', workflow: 'artifact-retention-policy.yml', required: true, postgres: false },
  { id: 'validate', workflow: 'tiktok-public-profile-poc.yml', required: true, postgres: false },
  // This workflow job has continue-on-error: true in GitHub. It remains visible
  // in local results, but is advisory and is never silently treated as a pass.
  { id: 'live-probe', workflow: 'tiktok-public-profile-poc.yml', required: false, postgres: false, externalProbe: true },
];

const allowedActions = new Set([
  'actions/checkout@v4',
  'actions/setup-node@v4',
  'actions/upload-artifact@v4',
]);
const expectedWorkflowNames = [...new Set(expectedJobs.map(({ workflow }) => workflow))].sort();

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export async function inspectWorkflowInventory(rootPath) {
  const root = resolve(rootPath);
  const allJobs = [];
  const workflows = new Map();
  const errors = [];

  const workflowDirectory = join(root, '.github/workflows');
  const activeWorkflowNames = (await readdir(workflowDirectory))
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
  if (JSON.stringify(activeWorkflowNames) !== JSON.stringify(expectedWorkflowNames)) {
    errors.push(`Active workflow file inventory drift: expected ${expectedWorkflowNames.join(', ')}, found ${activeWorkflowNames.join(', ')}`);
  }

  for (const spec of expectedJobs) {
    if (!workflows.has(spec.workflow)) {
      const path = join(root, '.github/workflows', spec.workflow);
      const source = await readFile(path, 'utf8');
      let document;
      try {
        document = yaml.load(source, { schema: yaml.DEFAULT_SCHEMA });
      } catch {
        throw new Error(`Cannot parse active workflow safely: ${spec.workflow}`);
      }
      if (!document || Array.isArray(document) || typeof document !== 'object' ||
          !document.jobs || Array.isArray(document.jobs) || typeof document.jobs !== 'object') {
        throw new Error(`Workflow root and jobs must be mappings: ${spec.workflow}`);
      }
      const triggers = document.on;
      if (!triggers || Array.isArray(triggers) || typeof triggers !== 'object' ||
          JSON.stringify(Object.keys(triggers).sort()) !== JSON.stringify(['workflow_dispatch'])) {
        errors.push(`Manual-only workflow policy violated: ${spec.workflow}`);
      }
      if (JSON.stringify(document.permissions) !== JSON.stringify({ contents: 'read' })) {
        errors.push(`Workflow permissions must remain contents: read: ${spec.workflow}`);
      }
      workflows.set(spec.workflow, { sourceSha256: sha256(source), jobs: document.jobs, path });
    }
  }

  for (const [workflow, loaded] of workflows) {
    for (const [id, job] of Object.entries(loaded.jobs)) allJobs.push({ workflow, id, job });
  }
  const expected = expectedJobs.map((item) => `${item.workflow}:${item.id}`).sort();
  const actual = allJobs.map((item) => `${item.workflow}:${item.id}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`Active workflow job inventory drift: expected ${expected.join(', ')}, found ${actual.join(', ')}`);
  }

  const jobs = [];
  for (const spec of expectedJobs) {
    const loaded = workflows.get(spec.workflow);
    const job = loaded.jobs[spec.id];
    if (!job || typeof job !== 'object') {
      jobs.push({ ...spec, status: 'BLOCKED', reason: 'Expected workflow job is absent' });
      continue;
    }
    if (job['runs-on'] !== 'ubuntu-latest') errors.push(`${spec.workflow}:${spec.id} no longer has the reviewed ubuntu-latest target`);
    if (spec.externalProbe && job['continue-on-error'] !== true) errors.push('TikTok live-probe failure semantics changed');
    const steps = [];
    for (const step of job.steps ?? []) {
      if (step.uses) {
        if (!allowedActions.has(step.uses)) errors.push(`Unsupported action in ${spec.workflow}:${spec.id}: ${step.uses}`);
        if (step.uses === 'actions/upload-artifact@v4') {
          if (spec.id !== 'live-probe') errors.push(`Artifact upload is outside the reviewed optional diagnostic job: ${spec.workflow}:${spec.id}`);
          continue;
        }
      }
      if (step.run !== undefined) {
        if (typeof step.run !== 'string') errors.push(`Non-string run step in ${spec.workflow}:${spec.id}`);
        steps.push({
          name: String(step.name ?? `Run step ${steps.length + 1}`),
          run: step.run,
          shell: step.shell ?? 'bash',
          env: step.env ?? {},
        });
      }
    }
    if (steps.length === 0 && spec.id !== 'ci-gate') errors.push(`No executable run steps found for ${spec.id}`);
    const setupNodeSteps = (job.steps ?? []).filter((step) => step.uses === 'actions/setup-node@v4');
    const npmCacheWrites = setupNodeSteps.filter((step) => step.with?.cache === 'npm').length;
    jobs.push({
      ...spec,
      name: job.name ?? spec.id,
      workingDirectory: job.defaults?.run?.['working-directory'] ?? '.',
      timeoutMinutes: Number.isSafeInteger(job['timeout-minutes']) ? job['timeout-minutes'] : 60,
      postgresImage: spec.postgres ? job.services?.postgres?.image : null,
      postgresEnv: spec.postgres ? job.services?.postgres?.env : null,
      jobEnv: job.env ?? {},
      steps,
      npmCacheActionsNotUsed: npmCacheWrites,
      workflowSha256: loaded.sourceSha256,
      status: 'READY',
    });
  }

  return {
    jobs,
    errors,
    workflowHashes: Object.fromEntries([...workflows].map(([name, value]) => [name, value.sourceSha256])),
    expectedJobIds: expectedJobs.map(({ id }) => id),
  };
}
