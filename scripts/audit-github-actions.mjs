#!/usr/bin/env node
// Read-only audit. Requires Node 22+ and a GitHub token with Actions: read.
// Usage: GITHUB_TOKEN=... node scripts/audit-github-actions.mjs [owner/repo] [YYYY-MM-DD] [YYYY-MM-DD]
// Dates are UTC, inclusive. No Actions workflow is triggered.
const repo = process.argv[2] || 'supersunxm/line-unified-inbox';
const start = process.argv[3] || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const end = process.argv[4] || new Date().toISOString().slice(0, 10);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) { console.error('Set GITHUB_TOKEN or GH_TOKEN (Actions: read).'); process.exit(2); }
if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
  console.error('Usage: node scripts/audit-github-actions.mjs owner/repo YYYY-MM-DD YYYY-MM-DD');
  process.exit(2);
}
async function api(path) {
  const response = await fetch('https://api.github.com' + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!response.ok) throw Error('GitHub API ' + response.status + ' for ' + path + ': ' + (await response.text()).slice(0, 240));
  return response.json();
}
async function pages(path, key) {
  const items = [];
  for (let page = 1; page <= 50; page++) {
    const join = path.includes('?') ? '&' : '?';
    const data = await api(path + join + 'per_page=100&page=' + page);
    const batch = key ? data[key] : data;
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw Error('Pagination limit reached; shorten the time window.');
}
const runs = await pages('/repos/' + repo + '/actions/runs?created=' + start + '..' + end, 'workflow_runs');
const totals = new Map();
let counted = 0, excluded = 0;
for (const run of runs) {
  // Avoid partial runs and double-counting older attempts where run_attempt > 1.
  if (run.status !== 'completed') { excluded++; continue; }
  const jobs = await pages('/repos/' + repo + '/actions/runs/' + run.id + '/jobs?filter=latest', 'jobs');
  const record = totals.get(run.name) || { runs: 0, jobs: 0, minutes: 0, failures: 0 };
  record.runs++;
  if (run.conclusion !== 'success') record.failures++;
  for (const job of jobs) {
    if (!job.started_at || !job.completed_at) { excluded++; continue; }
    const minutes = Math.max(0, (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 60000);
    if (!Number.isFinite(minutes)) { excluded++; continue; }
    record.minutes += minutes;
    record.jobs++;
    counted++;
  }
  totals.set(run.name, record);
}
console.log('GitHub Actions runtime audit: ' + repo + ' | ' + start + ' through ' + end + ' UTC');
console.log('Workflow | Runs | Jobs | Runner minutes (raw) | Non-success runs');
let sum = 0;
for (const [name, r] of [...totals].sort((a,b)=>b[1].minutes-a[1].minutes)) {
  sum += r.minutes;
  console.log([name, r.runs, r.jobs, r.minutes.toFixed(2), r.failures].join(' | '));
}
console.log('TOTAL RAW RUNNER MINUTES: ' + sum.toFixed(2) + ' (' + counted + ' jobs; ' + excluded + ' excluded/unfinished)');
console.log('Not a billing report: excludes rerun attempts, platform billing rounding, runner multipliers, and other repositories. Use GitHub Billing for billed usage.');
