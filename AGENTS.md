# OPPO LINE OA Monitor agent rules

## General behavior

- Inspect the relevant implementation before editing. Do not stop after writing code: run the affected application and verify behavior using actual logs and error output.
- If a test, lint, build, migration, server, or health check fails, diagnose it and continue the repair loop until every required check passes.
- Do not ask the user to copy terminal errors that can be inspected directly, and never report success while a required check is failing.
- Do not suppress warnings, disable lint rules, hide errors, or use `any` to conceal TypeScript problems.
- Preserve existing data unless deletion is explicitly requested. Never expose secrets, tokens, password hashes, OTPs, encryption keys, or credentials.
- Never commit `.env` files or credentials. Never push to GitHub without explicit user permission.

## Required verification loop

For every code change: inspect, implement, format/lint, test, build, start affected services, run health checks, functionally verify, review the diff, fix findings, and repeat until clean.

## Completion criteria

A task is complete only when TypeScript compilation, lint, relevant tests, and builds pass; affected routes respond correctly; no new browser-console or backend-startup errors remain; required migrations are applied; and the final report states actual results.

## Service rules

The local stack is PostgreSQL through Docker Compose, NestJS on port 3001, Next.js on port 3000, and optional ngrok forwarding to port 3001. Before starting a service, inspect its port, reuse a healthy project service, terminate only a stale process belonging to this repository, and never silently choose a fallback port.

## Webhook rules

For LINE webhook work, verify the canonical route registration and persisted key; preserve exact raw body bytes; locally test signed requests (valid 200, invalid 401, unknown key 404); and do not depend on manual LINE Console verification.

## Authentication rules

For authentication work, verify migrations, User and OTP tables, setup-status, login, cookies/sessions, unauthorized and role-restricted requests. Webhook routes remain public but signature-protected.

## Progress documentation

Maintain `AI_PROGRESS.md` with the current task, completed work, checks run/passed, blockers, and next action. Maintain `DECISIONS.md` for meaningful architectural choices and rationale. Never put raw logs or secrets in either file.

## Permanent Local CI policy

- Local CI is the default mandatory merge verification mechanism.
- Run all eight mandatory Local CI jobs and every recorded step in isolated disposable guests. Use PostgreSQL test databases, never Production.
- Record the tested base, final HEAD, source fingerprint, workflow hashes, per-step log hashes, and guest cleanup. Verify them with `tools/codex-ci/evidence.py` before presenting a pass.
- Any application, test, workflow, runner, evidence-verifier, or policy change requires a fresh complete Local CI run. Do not reclassify failed or unavailable GitHub-hosted checks as passed.
- The Local CI policy does not create GitHub Checks or bypass GitHub protections. Inspect and satisfy all rules enforced at merge time.
- Owner authorization is still required for each merge and each production release. Never auto-merge or deploy from a green Local CI result.
- Preserve the approved disposable runner's isolation, credential boundary, network allowlist, and cleanup behavior. If any boundary cannot be verified, stop instead of weakening it.

### Owner decisions D1–D4 (final)

- D1. GitHub Actions stay `workflow_dispatch`-only permanently. There is no hosted "final check". Agents never trigger a workflow, and an absent, pending or skipped GitHub check is never "green".
- D2. Railway configuration stays unchanged (`checkSuites=false`). The release gate is the owner's manual merge, made only on verified Local CI evidence. Agents do not touch Railway.
- D3. Merge-commit identity: a PR is mergeable only if its HEAD contains the current `origin/main` tip and its Local CI evidence was verified with base = that tip and head = PR HEAD, so the merge commit's tree equals the tested tree. If `main` advances, merge `origin/main` into the branch (merge commit) and rerun full Local CI.
- D4. Agents may push a branch and open a PR. Agents never merge, enable auto-merge, or deploy.

### Push gate

- No push without verified Local CI evidence for the exact HEAD being pushed: run `npm run ci:local` (all mandatory jobs plus `evidence.py verify`, base = current `origin/main`). `npm run ci:local:check` re-checks the recorded evidence without running tests.
- Install the hook once per clone with `npm run hooks:install`; `.githooks/pre-push` blocks pushes without that evidence. It never replaces an existing developer `core.hooksPath`.
- Never use `--no-verify` and never force-push. The local hook can be bypassed and is not server-side protection; bypassing it is a policy violation.

### Pre-merge checklist (owner)

1. The PR HEAD contains the current `origin/main` tip (up to date with `main`).
2. Local CI evidence for that exact HEAD is verified with `evidence.py` (base = current `origin/main`, all mandatory jobs and steps PASS, 0 skips, guests deleted, base stopped).
3. List the Railway services whose watch paths match the diff, and state whether the backend pre-deploy migration will run.
