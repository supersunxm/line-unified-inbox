# Agent-operated CI policy and migration

This is the proposed replacement for the mandatory Lima/VZ Local CI path. It becomes effective only after explicit owner approval of the exact reviewed patch and bootstrap action. The original clone's policy and hook remain authoritative until then. This document does not authorize publication, merge or deployment.

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

## Coverage and execution

The eight mandatory jobs are backend, frontend, ci-gate, web-adaptive-auth, auth-foundation, web-registration, enforce and validate. Current main has 54 required run steps; this migration preserves all 54 and adds explicit Prisma generation, for 55. The existing policy/isolation step now also runs the Agent verifier's adversarial tests. Three unmerged Live Mirror-specific steps from a separate 58-step development snapshot are outside this migration, along with their application changes. This is an explicit scope difference, not a pass or omission claim for those recovery tests. The baseline workflow-coverage file is unchanged.

Reuse the existing workflow inventory and evidence inventory bridge. The Agent renderer is extracted from the development adapter so the Lima supervisor remains unchanged. Existing Actions setup/cache/artifact steps are not executed, and no hosted runner is registered. Dormant manual workflows remain for command inventory; GitHub Actions are not used. No application runtime, dependency, schema or migration changes are included; three existing fixture guards add a strictly flagged disposable PostgreSQL alias, with adversarial tests, and the root package change exposes CI commands only.

The reviewed execution environment remains Docker Desktop on Apple Silicon with the runner's immutable Playwright and PostgreSQL image digests, restricted proxy and non-root jobs. It is not a generic Linux/cloud runner. Jobs receive no host bind mounts, host Docker socket, host credentials or Production configuration. The trusted host orchestrates Docker; container escape or host compromise is outside this isolation guarantee. The positive registry checks and all negative direct-egress assertions must pass. Cleanup uncertainty blocks evidence. No public live probe runs.

Use disposable non-production PostgreSQL only, never Production.

After approval, a clean committed candidate, refreshed main base and pinned parser installation are prerequisites:

```sh
npm ci --prefix tools/codex-ci --ignore-scripts --no-audit --no-fund
npm run ci:agent:plan
npm run ci:agent
npm run ci:agent:check
```

The runner uses a private temporary evidence directory, per-step sanitized logs, source manifest, workflow hashes, checksum sidecars and exact cleanup evidence. The gate reads its private per-commit record from the Git common directory and runs a fresh verifier. Never copy a successful record from another source or checkout, and never publish raw evidence. Test reports are unsigned; regenerating sidecars does not establish trust or owner approval.

`ci:local` and `ci:local:check` remain available as historical diagnostics only after migration; they cannot satisfy or automatically replace the Agent push gate. The existing Lima supervisor and legacy evidence verifier are retained, without VM repair or lock changes.

## Exact bootstrap, without an unapproved hook bypass

1. Owner reviews the exact patch SHA-256, file allowlist, main base, explicit branch allowlist, focused results and disclosure report. The owner explicitly authorizes activating that policy/hook replacement for the exact local draft commit in the isolated migration clone. Creating the draft commit is preparation, not policy activation. This is the one-time policy transition from the old mandatory Local CI gate; no old evidence is claimed equivalent. Preparation alone is not approval.
2. Before activation, verify the existing hook and hook-path state. Preserve any developer hook path. Apply only the reviewed patch in the isolated clone based on freshly fetched origin/main. Set upstream to the explicit feature branch only at separately authorized publication; never push to main. No policy/config environment overrides are allowed.
3. Verify the already prepared local draft commit contains exactly the reviewed file allowlist, its tree matches the approved tree, and the worktree is clean. The draft was created with a normal local commit and no hook bypass flags; no active original-clone policy was changed. Retain private review records outside Git. No push occurs. If the tree or main changes, re-review the changed scope.
4. Activate the approved replacement with `npm run hooks:install` in that isolated clone only. If another developer hook path exists, STOP for an approved chaining procedure; do not overwrite it. There is no period where an unapproved policy disables enforcement: the old rule remains in force until the owner's explicit transition decision, and the replacement itself still fails closed without evidence.
5. Refresh origin/main and require it to be an ancestor of the exact candidate commit. Run all eight jobs once for that clean commit; verify every current-inventory step, source/workflow/log hashes and cleanup. Run `npm run ci:agent:check`. The old dirty-tree 58-step result is development evidence only and cannot bootstrap this record.
6. Obtain independent review by ChatGPT or another owner-designated reviewer. Obtain a separate exact branch publication authorization after current Railway watch-path/environment and repository-protection checks. Keep the approved hook enabled and use a normal single-branch fast-forward push. No push is authorized by this document. No merge or deployment is included.
7. At merge, refresh main and re-verify; if main advanced, merge it and rerun the complete suite. The owner separately approves any merge and corresponding Production release. Never treat checkSuites=false or a green local run as deployment authorization.

Rollback before publication: leave the original clone untouched and abandon the draft clone. After approved activation, if Agent CI cannot verify, STOP with pushes blocked; returning to the legacy hook/policy requires an explicit owner decision and matching evidence, not an automatic fallback. A failed CI run, cleanup uncertainty or missing record never enables a push.

Disposable fixture compatibility: the final incremental scope includes three existing backend integration/HTTP test guards. They accept Docker hostname `postgres` only with CODEX_AGENT_CI_POSTGRES=true, a PostgreSQL scheme, exact ci user/password, port 5432, database /ci, and no query or fragment. Existing loopback predicates and all test bodies remain intact. This corrects a confirmed hostname rejection without changing application behavior or test coverage. The reviewed scope is therefore 28 files; backend test paths now match backend/** Railway watchers. No deployment is authorized.
