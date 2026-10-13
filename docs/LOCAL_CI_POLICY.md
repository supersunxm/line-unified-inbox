# Local CI policy

## Decision and merge gate

Local CI is the default mandatory merge verification mechanism for this repository. This policy adopts the owner's direction to use the existing isolated Codex Local CI runner after this policy change is reviewed and merged. No per-PR Local CI exception is then needed. Owner authorization is still required for each merge and each production release; a passing local run never merges or deploys a change automatically.

A PR is eligible for owner review only after its final base, head and source fingerprint are recorded; every mandatory Local CI job and step passes; evidence checksums and source identity are verified; relevant security regressions pass; TypeScript and lint results show no new baseline regression; deployment effects are documented; mergeability is confirmed; and all repository rules actually enforced at merge time are satisfied. The policy does not create GitHub Checks or bypass GitHub branch protection. If a GitHub rule requires a hosted check, satisfy that requirement through the normal authorized process or stop. Do not infer permission from an empty ruleset query or from `mergeable=true`.

Previously failed GitHub-hosted checks remain failed. Report a billing or runner-allocation failure as that failure; never relabel it as a Local CI pass. Local CI does not publish statuses to GitHub, create Required Checks, or prove that a branch-protection rule is absent. Any repository policy decision is separate from the technical Local CI result.

## Mandatory workflow coverage

All five workflows retain `workflow_dispatch` and have no automatic event triggers. The existing eight required jobs and their 53 original `run:` commands remain. The artifact-retention job now checks out the workflow files, fails if that inventory is empty, and runs the repository-policy, runner-isolation, and evidence-integrity regression tests as one additional mandatory step. The current required set is eight jobs and 54 executable steps.

| Required job | Existing coverage |
| --- | --- |
| `backend` | Backend lint, TypeScript/build and regression suites, including disposable PostgreSQL 16 integration. |
| `frontend` | Frontend lint, tests and production build. |
| `ci-gate` | Existing backend/frontend result gate. |
| `web-adaptive-auth` | Adaptive-authentication web regression. |
| `auth-foundation` | Authentication foundation and disposable PostgreSQL 16 coverage. |
| `web-registration` | Web registration regression. |
| `enforce` | Artifact retention, workflow/job coverage parity, Local CI policy, runner isolation, and evidence integrity. |
| `validate` | Existing TikTok public-profile parser, lint and backend-build validation. |

`live-probe` remains advisory and opt-in. It is not required for the eight-job pass. Do not contact a production profile. The test inventory pins the original 53 required command hashes; a deliberate command change requires updating that reviewed inventory and its tests in the same change.

## Run and verify

The supervisor is the existing `tools/codex-ci/local-ci.mjs` and the existing disposable-guest lifecycle in `tools/ci-runner/disposable-guest.mjs`. Do not create a second runner or a hosted self-hosted runner. The supervisor and lifecycle were brought into the repository from the already-proven local runner; the only portability adjustment is deriving the checkout root from the script location. The workflow inventory uses the pinned `js-yaml` dependency in `tools/codex-ci/package-lock.json` because Ruby is absent from the approved guest. Install it from the lockfile before using the host CLI:

```sh
npm ci --prefix tools/codex-ci --ignore-scripts --no-audit --no-fund
node tools/codex-ci/local-ci.mjs plan
node tools/codex-ci/local-ci.mjs run --jobs=backend,frontend,ci-gate,web-adaptive-auth,auth-foundation,web-registration,enforce,validate --evidence-dir=/private/tmp/local-ci-run
python3 tools/codex-ci/evidence.py verify --evidence-dir=/private/tmp/local-ci-run --repo=/path/to/line-unified-inbox --base=BASE_SHA --head=HEAD_SHA
python3 tools/codex-ci/evidence.py bundle --evidence-dir=/private/tmp/local-ci-run --repo=/path/to/line-unified-inbox --base=BASE_SHA --head=HEAD_SHA --output=/private/tmp/local-ci-evidence.tar.gz
```

All eight required jobs must be selected and pass. A missing, failed, blocked or skipped required job/step fails the run. Do not use old evidence after a tested source or workflow change. Run a fresh complete validation after changes to application code, tests, workflows, runner code, policy or evidence verification. `AI_PROGRESS.md` and `DECISIONS.md` are operational records excluded by the existing fingerprint; a progress-only commit may retain evidence only when the tested source fingerprint and all included Git blobs still match, the final published HEAD is recorded, and a clean checkout is independently checked. No other exclusion permits reusing a run.

The evidence verifier extends the repository's prior Local CI bundle verifier: it obtains expected job and step identities from the active workflow inventory and also checks published Git blobs and modes, base ancestry, and a clean checkout. This keeps one reusable runner and one repository-owned verification path instead of duplicating a runner or relying on a detached one-off verifier. The portable bundle contains the sanitized result, source manifest, all mandatory step logs, verification script and checksums. It omits the full source snapshot and host diagnostics. Keep the raw run intact. Transfer the archive and `.sha256` sidecar together, verify the sidecar, extract it, install the pinned parser in the checked-out repository, then run the included `evidence.py verify` command with a repository checkout at the recorded HEAD. Hashes detect content changes; this evidence is unsigned and does not prove the runner host or execution logs were cryptographically attested.

## Isolation and trust limits

The supported runner is the previously validated Apple Silicon host and its stopped, credential-free `oppo-ci` Lima base. Each required job receives a fresh guest, fresh source snapshot, guest-local rootless Docker and disposable PostgreSQL where required. The job runs as the restricted guest user with the existing proxy allowlist and resource limits. The host does not forward repository credentials, GitHub tokens, SSH agent, Keychain items, deployment credentials, production secrets, host paths or Docker sockets. Every guest must be deleted and the base confirmed stopped after the run. A missing base, cleanup uncertainty, failed network preflight, or missing dependency blocks the run; do not widen the proxy, install security-sensitive host packages, or relax guest isolation to make a job pass.

Local execution uses Node 22, npm, the configured guest image and registries. It does not reproduce GitHub's hosted Ubuntu image, Actions service, event context, expression engine, cache, artifact service or hosted-runner status. Package registries and workflow image tags are mutable. The host supervisor and configured Lima base remain trusted dependencies. No new paid CI infrastructure is introduced. PostgreSQL tests use disposable guest databases and never Production.

## Manual GitHub execution and production effects

Automatic pull-request execution is removed from the five audited workflows; their manual `workflow_dispatch` entry points remain available for an owner-authorized run. This means ordinary PR updates create no GitHub Actions checks from these workflows. Manual runs may incur hosted runner cost and require explicit owner authorization; do not launch them as part of Local CI.

The policy change is limited to the five workflow files, `AGENTS.md`, this policy, `tools/codex-ci/`, and the already-proven disposable runner source. It changes no backend, frontend, worker, Prisma, application package manifest, production data or Railway configuration. Branch publication does not change `main`. On merge, these files have no match in the currently reviewed Railway service watch paths, so they are not expected to build or deploy a Railway service. Recheck current Railway watch paths and actual GitHub rules before any separately authorized merge; if they changed or the effect is uncertain, stop and report it.

This policy is not release authorization. Confirm the effective branch rules at the time of each merge, use the repository's approved merge method, and require explicit owner authorization for that PR. Never bypass an enforced rule or treat local evidence as a GitHub Required Check.
