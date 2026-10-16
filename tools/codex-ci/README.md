# Agent-operated CI

See [policy and bootstrap](../../docs/AGENT_CI_POLICY.md) and [AGENTS.md](../../AGENTS.md). This migration is proposal-only until the owner approves its exact patch and enforcement transition. The original recovery worktree is unchanged.

The runner reuses all eight current-main jobs and required command coverage: 54 existing steps plus explicit Prisma generation, for 55. Three unmerged Live Mirror-specific steps and application changes are excluded from this CI-only migration. A prior 58-step dirty-source run is not final clean-commit evidence.

```sh
npm ci --prefix tools/codex-ci --ignore-scripts --no-audit --no-fund
npm run ci:agent:plan
# After explicit policy approval and establishment of the final clean commit:
npm run ci:agent
npm run ci:agent:check
```

The Docker Desktop ARM64 host, immutable images, proxy allowlist, no host binds or forwarded credentials, non-root jobs, disposable PostgreSQL, explicit denied direct egress and complete cleanup remain required. The evidence verifier derives all jobs, workflow hashes, ordered steps and totals from the repository's trusted inventory. Logs and evidence stay private and are unsigned.

`agent-pre-push-gate.mjs` enforces the committed exact remote and branch allowlist in `push-policy.json`; it accepts one matching checked-out branch update, requires exact clean-commit evidence and freshly fetched main, and rejects tags, deletions, multiple/non-fast-forward updates and stale/incomplete evidence. No wildcard, environment or CLI allowlist override is supported. Initially only the migration branch is allowed; future branch additions need explicit owner review. The local hook is not server-side protection.

`npm run hooks:install` refuses a different developer hook path. Do not install the proposed replacement before owner approval, bypass the old hook, use GitHub Actions, push, merge or deploy as part of preparation. Legacy Lima code is retained without repair or protection changes. Independent QA may be performed by ChatGPT or another owner-designated reviewer; no particular reviewer is mandatory.

Disposable fixture compatibility: the final incremental scope includes three existing backend integration/HTTP test guards. They accept Docker hostname `postgres` only with CODEX_AGENT_CI_POSTGRES=true, a PostgreSQL scheme, exact ci user/password, port 5432, database /ci, and no query or fragment. Existing loopback predicates and all test bodies remain intact. This corrects a confirmed hostname rejection without changing application behavior or test coverage. The reviewed scope is therefore 28 files; backend test paths now match backend/** Railway watchers. No deployment is authorized.
