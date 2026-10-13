# Codex-operated local CI

This existing runner executes the nine current workflow jobs as local checks: eight mandatory and one advisory. It does not use the GitHub Actions service, register a GitHub runner, read GitHub credentials, or establish GitHub Required Checks.

## Commands

From the trusted Apple Silicon host, in this worktree:

```sh
node tools/codex-ci/local-ci.mjs plan
node tools/codex-ci/local-ci.mjs run
node tools/codex-ci/local-ci.mjs run --job=backend
node tools/codex-ci/local-ci.mjs run --jobs=backend,frontend,ci-gate
```

Install the pinned workflow parser on the trusted host before calling `plan` or `run`:

```sh
npm ci --prefix tools/codex-ci --ignore-scripts --no-audit --no-fund
```

Each selected job gets a fresh clone of the stopped `oppo-ci` Lima base. A complete run uses one guest per job, with a 60-minute local cap per job. `SIGINT`/`SIGTERM`, deadline expiry, startup failure, and cleanup uncertainty are fail-closed; the supervisor deletes the complete guest and keeps its recovery lock if disposal cannot be proved. The next invocation recovers only the exact recorded orphan after confirming its supervisor process is gone.

The command emits `result.json`, a source manifest, a source archive, and mode-0600 redacted per-step logs under a mode-0700 evidence directory. By default that directory is created under the host temporary directory. Use `--evidence-dir=/absolute/path` to select a private evidence location. Keep the directory private and preserve it with the review record if its results matter.

The source identity records the full commit SHA plus SHA-256 over current tracked, staged, modified, and non-ignored untracked source files. It excludes `.git`, dependency/build/cache output, generated evidence, `AI_PROGRESS.md`, and `DECISIONS.md`. Credential-like tracked files prevent snapshot creation; ignored credentials are not archived. The archive is created once and reused across the run. A final digest comparison catches changes to validation inputs during execution.

## Job map and local adaptations

The inventory is checked against every active `.yml`/`.yaml` file before execution. Unknown workflows, job IDs, actions, expressions, or run shells block the run. The existing workflow `run:` scripts remain the commands being executed.

| Job | Local treatment |
|---|---|
| `backend` | All 30 `run:` steps; fresh rootless PostgreSQL 16 service on guest loopback. |
| `frontend` | All 6 `run:` steps. |
| `ci-gate` | Existing gate script, with dependency outcomes projected from local backend/frontend results. |
| `web-adaptive-auth` | All 3 `run:` steps. |
| `auth-foundation` | All 6 `run:` steps; fresh rootless PostgreSQL 16 service on guest loopback. |
| `web-registration` | Both `run:` steps. |
| `enforce` | Existing Python artifact-retention policy, fail-closed workflow inventory check, and policy/runner/evidence regression suites. |
| `validate` | All 4 `run:` steps, including the parser test, lint, and backend build. |
| `live-probe` | Advisory because the GitHub job declares `continue-on-error: true`. It is `BLOCKED` by default without contacting TikTok. `--allow-public-tiktok-probe --username=NON_PRODUCTION_PUBLIC_NAME` requires an explicit non-production test handle; the known workflow default `o_centralworld` is rejected. No credentials are supplied. Chromium is downloaded as the unprivileged job user, and the guest must already contain the reviewed browser system packages. The workflow's artifact upload is omitted; the disposable guest is destroyed instead. |

`actions/checkout` is represented by the immutable host-created source snapshot. `actions/setup-node` is represented by the base's Node 22 toolchain. Its seven npm cache writes are not used: `npm ci` cache is inside guest RAM and every guest is discarded. Artifact upload is never performed. The local backend and auth service containers are rootless and confined to their guest; their mapped port is guest loopback only. No host directory, host Docker socket, GitHub token, App key, production secret, or deployment integration is forwarded.

The runner uses exact workflow commands but does not emulate GitHub's hosted Ubuntu image, Actions expression engine, checkout metadata, artifact service, cache service, event context, or hosted-runner status reporting. It omits `.git` from job snapshots. Those are known parity limits. Node, npm, kernel, Docker, and PostgreSQL image identity are recorded where available; mutable workflow image tags and package registries mean byte-for-byte execution reproducibility is not guaranteed.

The `enforce` step installs only the locked `js-yaml` workflow parser inside its disposable guest, then runs Node policy/lifecycle tests and Python evidence-verifier tests. The `tools/codex-ci/workflow-coverage.json` file hashes the original 53 mandatory workflow commands; repository-policy tests require every one to remain and require the extra enforcement step. The artifact-retention rule remains a maximum of three days, with the existing TikTok diagnostic limited to one day. The retention job checks out its inputs and fails closed if no workflow files are present.

## Result policy

Every job is `PASS`, `FAIL`, or `BLOCKED`. Unselected jobs, absent jobs, unsupported workflow drift, environment/setup errors, and incomplete disposal are `BLOCKED`. All eight non-advisory jobs must pass for `localRequiredChecks: PASS`; otherwise the result is `NOT_MERGEABLE`. The optional public TikTok diagnostic remains visible but does not change the mandatory set.

Even if all local required jobs pass, the report always says `NOT_MERGEABLE_WITH_LOCAL_EVIDENCE_ALONE`. The result is unsigned, is not posted to GitHub, and is not equivalent to a GitHub-enforced Required Check or branch-protection decision. It cannot establish repository policy or authorize a merge.

## Evidence verification and handoff

After a complete run, verify its source and outcome against the published commit, then create a portable bundle:

```sh
python3 tools/codex-ci/evidence.py verify --evidence-dir=/private/tmp/local-ci-run --repo=/path/to/line-unified-inbox --base=BASE_SHA --head=HEAD_SHA
python3 tools/codex-ci/evidence.py bundle --evidence-dir=/private/tmp/local-ci-run --repo=/path/to/line-unified-inbox --base=BASE_SHA --head=HEAD_SHA --output=/private/tmp/local-ci-evidence.tar.gz
```

The verifier checks the exact eight-job inventory, every workflow step name/status/exit code, per-step output hashes, canonical source fingerprint, workflow hashes, published Git blob bytes and modes, base ancestry, clean checkout, disposable PostgreSQL identity, and guest/base cleanup. The portable archive contains the result, manifest, per-step logs, verifier, checksums and instructions; it omits the full source snapshot and host diagnostics. The original evidence directory is never rewritten. Logs are scanned for credential-like material before packaging. The evidence is unsigned: its hashes prove consistency after transfer but do not establish signed runner provenance or create GitHub Checks.

For an independent handoff, transfer the `.tar.gz` and `.sha256` sidecar together, then run:

```sh
shasum -a 256 -c local-ci-evidence.tar.gz.sha256
mkdir local-ci-evidence
tar -xzf local-ci-evidence.tar.gz -C local-ci-evidence
cd local-ci-evidence/local-ci-evidence
npm ci --prefix /path/to/line-unified-inbox/tools/codex-ci --ignore-scripts --no-audit --no-fund
python3 evidence.py verify --evidence-dir=. --repo=/path/to/line-unified-inbox --base=BASE_SHA --head=HEAD_SHA
```

## Host limits

This is a Mac-specific supervisor for the previously validated ARM64 Lima base. The base must exist, be stopped, and be readable by Lima. The supervisor and host remain trusted. Real Keychain ACL assurance and the supervisor's host access remain unresolved security risks; this system never accesses real credentials. Do not run against production credentials or add host mounts. No GitHub Actions job is triggered by these commands.
