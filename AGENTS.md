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

## Permanent Agent-operated CI policy

- Agent-operated CI is the mandatory push and merge verification mechanism after the owner explicitly approves this amendment and its matching hook migration. Until approval, the existing Local CI policy and hook remain in force; a draft does not activate itself.
- Run all eight mandatory jobs and every required step derived independently from the current trusted workflow inventory with `npm run ci:agent`. Use the reviewed Docker Desktop ARM64 environment, immutable pinned images, restricted package egress, disposable isolated PostgreSQL, and no forwarded host credentials, host binds, Docker socket, Production access or deployment capability in jobs.
- Require exact workflow hashes, ordered step names and per-job/aggregate counts, zero required skips, positive allowlist network checks, explicitly false direct IPv4 route/TCP, direct IPv6 TCP and host-proxy checks, complete sanitized log checksums, unchanged source, and confirmed container/network/volume cleanup. Missing, failed, ambiguous or unverifiable evidence is BLOCKED.
- Evidence must identify the exact clean committed HEAD and source fingerprint, with base equal to a freshly fetched `origin/main` ancestor. If main advances, integrate it with a merge commit and rerun all eight jobs. Old dirty-tree development evidence is never a push record.
- Agent CI does not create GitHub Checks or bypass repository protections. Evidence and checksum sidecars are unsigned and depend on the trusted workstation; hashes prove consistency, not cryptographic host attestation.
- Owner authorization is still required for each merge and each production release. A green result never authorizes publication, merge, deployment, original Volume access, Manager authentication or production data operations.
- Diagnose a failure, make a narrow fix, run focused adversarial regressions, then rerun the full suite for the exact final changed source. Never skip failures, reduce required coverage silently, or alter isolation to obtain PASS.
- Independent QA may be performed by ChatGPT or another owner-designated reviewer. No particular reviewer is mandatory. QA does not change technical test results or authorize publication or release.
- Keep CI evidence local and private. Do not include credentials, authenticated profiles, customer data, original Railway Volume content or Production logs. The advisory public probe remains BLOCKED without separate approval and a non-production target.

### Owner decisions D1–D4

- D1. GitHub Actions are not used for project CI. Existing dormant workflows stay `workflow_dispatch`-only with read-only permissions as a command inventory; agents never dispatch them or register hosted runners.
- D2. Railway configuration stays unchanged (`checkSuites=false` is historical evidence, not a freshly verified setting). Agents do not change Railway as part of CI. Publication and merge effects require a separate current watch-path and environment review.
- D3. Merge-commit identity: the PR HEAD must contain the current `origin/main` tip, and full verified evidence must identify that exact base and PR HEAD. If main advances, merge it and rerun the complete suite. A passing local result is not a GitHub Required Check or proof of mergeability.
- D4. Agents may prepare branches locally. Explicit owner permission is required for publication. Agents never merge, enable auto-merge or deploy under CI authority.

### Push gate

- No push without verified Agent CI evidence for the exact HEAD. After explicit migration approval, `.githooks/pre-push` invokes `agent-pre-push-gate.mjs hook` with Git's remote name, URL and update input; `npm run ci:agent:check` re-verifies evidence without running tests.
- `tools/codex-ci/push-policy.json` is the committed, owner-reviewed policy: exact canonical origin URL, main base and an explicit allowlist of feature-branch refs. Initially only `refs/heads/codex/agent-ci-policy-migration-20261016` is allowed. Future work requires a reviewed allowlist amendment; environment variables, local Git configuration, CLI overrides, wildcard patterns and the obsolete Live Mirror prefix cannot widen it.
- Permit exactly one matching local/remote branch update, equal to clean checked-out HEAD. Reject protected branches, tags, deletions, multiple updates, non-fast-forward/unverifiable changes, changed targets, missing evidence, stale main, tampering, skipped steps, or uncertain cleanup. Fetch current main at check time; fail closed if unavailable. A check-time fetch cannot freeze the remote after the check; the owner must recheck base and evidence at merge.
- `npm run hooks:install` sets `.githooks` only when unset or already selected; it refuses a different developer hook path. Keep the old hook effective until the owner approves the exact migration diff and its bootstrap procedure in `docs/AGENT_CI_POLICY.md`.
- Never use `--no-verify` and never force-push. A local hook is not server-side protection and cannot prevent a workstation owner from tampering with the local verifier or unsigned evidence.

### Pre-merge checklist (owner)

1. Current origin/main is contained in the exact clean PR HEAD; evidence records both identities and the matching source fingerprint.
2. All eight jobs and every trusted workflow step pass, zero required skips, denied direct egress, complete log checksums and confirmed resource cleanup; current repository protections are independently satisfied.
3. Review the public file manifest and privacy report, list Railway services whose watch paths match the diff, and state whether the backend pre-deploy migration could run. Unknown effective deployment rules block publication/merge authorization until resolved.
