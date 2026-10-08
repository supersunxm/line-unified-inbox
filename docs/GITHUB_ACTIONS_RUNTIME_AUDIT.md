# GitHub Actions runtime audit (Phase 3)

Run locally with Node 22+, using a fine-grained GitHub token with **Actions: read** access to the private repository:

```bash
GITHUB_TOKEN=<token> node scripts/audit-github-actions.mjs supersunxm/line-unified-inbox 2026-10-01 2026-10-08
```

Do not commit or share the token. The script only reads GitHub Actions run/job metadata and does not trigger CI. Output groups completed workflow runs by name, totals raw job elapsed minutes, and counts unsuccessful runs. Use a narrow date range for manageable API calls.

**Limits:** This is **not GitHub billed minutes**. Job elapsed time is not the same as billing (rounding, runner type/multipliers, canceled attempts, older reruns, other repos). Verify against GitHub Settings > Billing and licensing > Usage. In particular, the earlier notification covered account-level usage, not necessarily this repository alone.

Baseline: PR #537 added cancellation to Adaptive Auth and Unified Auth (Application CI already had it). PR #539 removed redundant frontend full-suite test/build in Adaptive Auth and backend/frontend builds in Unified Auth. Required checks and Application CI's full tests/builds remain.

For a comparison, collect multiple representative PR windows before and after #539, separate overlapping releases and reruns, and report both per-workflow raw job runtime and account-level billed usage. Do not claim an exact savings percentage from a single run or from source inspection.
