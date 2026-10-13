export const resultStates = new Set(['PASS', 'FAIL', 'BLOCKED']);

export function mergeDecision(jobResults, requiredJobIds, { sourceTreeMatches = true } = {}) {
  const byId = new Map(jobResults.map((result) => [result.id, result]));
  const missing = requiredJobIds.filter((id) => !byId.has(id));
  const nonPassing = requiredJobIds.filter((id) => byId.get(id)?.status !== 'PASS');
  if (!sourceTreeMatches || missing.length || nonPassing.length) {
    return { localRequiredChecks: 'NOT_MERGEABLE', missing, nonPassing };
  }
  return { localRequiredChecks: 'PASS', missing: [], nonPassing: [] };
}

export function redactLog(value, extraValues = []) {
  let output = String(value);
  const literals = extraValues.filter((entry) => typeof entry === 'string' && entry.length >= 4);
  for (const literal of literals) output = output.split(literal).join('[REDACTED]');
  return output
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[REDACTED GITHUB TOKEN]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED JWT]')
    .replace(/\b(?:xox[baprs]-)[A-Za-z0-9-]{10,}\b/g, '[REDACTED TOKEN]');
}

export function workflowNeedsResult(localStatus) {
  if (localStatus === 'PASS') return 'success';
  if (localStatus === 'FAIL') return 'failure';
  return 'skipped';
}
