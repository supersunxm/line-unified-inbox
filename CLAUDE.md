# CLAUDE.md — line-unified-inbox

Persistent working agreement for Claude Code in this repository.
`AGENTS.md` also applies. Where the two conflict during the current UI phase,
this file takes precedence.

## Project context

`line-unified-inbox` is an existing production system: a Next.js frontend and a
NestJS backend with PostgreSQL via Prisma, deployed on Railway. It centralizes
multiple LINE Official Accounts into a unified inbox.

Frontend stack (verified by audit):

- Next.js 16.2, React 19
- Tailwind CSS v4 (`@import "tailwindcss"`, `@theme inline`)
- Design tokens are CSS custom properties in `frontend/src/app/globals.css`
  (`--app-bg`, `--app-surface*`, `--app-border*`, `--app-text-*`, `--app-accent*`,
  `--app-success/warning/danger/info/...`, `--app-radius-*`, `--app-shadow-*`).
  Light values on `:root`, dark values on `html[data-theme="dark"]`.
- Shared UI kit in `@/components/ui`; app shell in `@/components/shell`.
- **There is no MUI.** Do not introduce MUI or any other UI library.

Preserve the current architecture and working behavior unless explicitly
instructed otherwise. Assume every change can reach real production data.

## Current phase: frontend UI/UX only

Work only on frontend UI/UX improvements. Do not expand into backend, database,
production infrastructure, or LINE integration work without explicit approval.

## Before making any changes

1. Check the current branch and `git status`.
2. Read the files directly related to the task, plus `package.json`, relevant
   shared components, `globals.css` tokens, and the API client/types it uses.
3. Identify existing components and patterns to reuse.
4. Report briefly: how the target currently works, which files will change,
   and the risks.

Do not open by rewriting a page or creating duplicate components.

## Allowed scope

React / Next.js frontend components, layout, spacing, typography, responsive
behavior, loading/empty/error states, visual consistency, accessibility,
behavior-preserving frontend refactoring (including extracting components out
of `frontend/src/app/page.tsx`), shared UI components where clearly appropriate,
and frontend-only bugs.

## Restricted scope

Do not modify any of the following without explicit approval:

- NestJS backend behavior or API contracts
- Prisma schema, migrations, PostgreSQL data
- authentication architecture
- LINE Messaging API, webhooks, LINE Manager sessions, Chat Mirror
- Historical Mirror / historical backfill / historical timeline
- Playwright / Chromium worker behavior
- reply-status semantics and `<24h reply` KPI logic
- Railway configuration and production environment variables

If a UI problem appears to need one of these, isolate the frontend part, explain
the dependency, show exactly what change would be required, and wait.

## Store Chats guardrails (from audit)

- **Reply state is two-state in the UI** (`NOT_REPLIED` / `REPLIED`). Keep using
  `effectiveSummaryCounts` and `getEffectiveReplyState` from `reply-state.ts`.
  Filters send `replyState=`, not `bmReplyStatus=`. Never surface `NOTIFIED_BM`.
- **Some controls are hidden by CSS, not removed** (`ChatsUiOverrides` hides
  `[data-product-intent-card]`, `[data-conversation-action-menu]`,
  `[data-mobile-mark-replied]`). Preserve these `data-*` attributes exactly, or
  remove the underlying control deliberately with approval. Renaming them makes
  hidden controls — including a `NOTIFIED_BM` writer — reappear.
- The detail-header reply-status `<select>` is intentionally `disabled`.
- **Mobile is a separate implementation** (`components/chats/mobile-chats-app.tsx`).
  `MobileChatFiltersBridge` portals into its list-view `<header>`; do not change
  that header's structure without checking the bridge and the hiding CSS.
- **Mobile Thai strings are translated by phrase-matching**
  (`mobile-route-i18n.ts`). Changing a Thai string requires updating that file.
- Optimistic reply → `REPLIED` behavior must stay.
- Pane widths are persisted by `use-resizable-panes`; changing grid columns
  affects saved user layouts.
- **Several tests regex-match source code** (`chat-detail-hierarchy`,
  `bm-reply-status-presentation`, `mobile-chat-mark-replied`,
  `store-chats-media-parity`, `conversations-pagination`,
  `route-tree-integration`, `design-system-foundation`). When markup changes
  intentionally, update the test in the same commit and explain why. Never
  delete or loosen a test just to make it pass.

## UI implementation rules

- Preserve existing functionality; make the smallest coherent change.
- Reuse `@/components/ui` and `--app-*` tokens. Prefer tokens over hardcoded
  Tailwind palette colors (e.g. `bg-emerald-100`, `text-red-600`).
- Avoid unnecessary abstractions and dependencies.
- Do not change API assumptions to simplify the UI.
- Do not remove controls or information unless explicitly requested.
- Treat provided screenshots or references as the visual requirement, but do
  not remove something just because it is absent from a reference crop.

## Git workflow

- Never work directly on `main`.
- One task per branch, e.g. `claude/ui-<short-task-name>`, branched from the
  current base.
- Confirm the working tree is clean before editing; do not overwrite unrelated
  changes.
- Keep commits focused. Do not force-push unless instructed.
- **Merging to `main` deploys to production** (Railway deploys on merge). Merge
  only as the Merging rule below allows; otherwise stop at the pull request.
- **Open every PR with base `main`.** After creating it, run
  `gh pr view --json baseRefName` and confirm it says `main`. Do not stack PRs
  on each other: branch each task from the latest `origin/main`, and if a task
  depends on an unmerged PR, wait for that PR to merge into `main` first.
- **Merging:** once every CI check on a PR into main is green, merge it
  automatically with a merge commit (`gh pr merge --merge`, or `--auto` when
  available). Never bypass, override with admin rights, or disable a check.
  Stop and report instead of merging if CI fails for reasons outside the task,
  if a conflict touches unrelated files, or if branch protection blocks the
  merge.

## Validation

GitHub Actions is available. **CI must be green before merge.** Do not bypass a
failing check: no merging over a red check, and no disabling, skipping, or
loosening a check to get it green. Fix the cause. Local validation still runs
first: run the commands below before you push, so CI confirms rather than
discovers. A passing local build or CI run does not by itself prove production
safety.

Run from `frontend/`:

- `npm run lint` — Baseline: 72 errors / 101 warnings on ee61a4f5.
- `npm run test`
- `npm run build` — note: next.config.ts sets typescript.ignoreBuildErrors, so
  the build does NOT type-check.
- `npx tsc --noEmit` — run manually as the type check (no repo script exists).
  Baseline: 50 pre-existing errors on ee61a4f5. Report a regression only if the
  count rises or a changed file has new errors.

Baselines drift as other work merges. Always measure the baseline yourself on
the branch point before editing; treat the numbers above as a rough reference,
not as the comparison target.

**Do not run** root `npm run verify`, `dev:up`, `dev:restart`, `deploy:check`,
or other root scripts. They touch backend Prisma, start the full dev stack,
send webhook smoke tests, and auto-install dependencies.

For UI work also verify: no console/runtime errors, desktop and mobile layouts,
loading/empty/error states, and that displayed data has not changed.

## Production safety

Do not, unless explicitly instructed: delete data, run destructive scripts or
migrations, change environment variables, alter Railway configuration, deploy,
or modify production LINE accounts.

## When uncertain

Inspect existing code rather than guessing. Reuse existing helpers, components,
hooks, and services. Do not build a parallel implementation without first
confirming none exists.

## Completion report

1. What changed
2. Files modified
3. Key implementation decisions
4. Validation commands actually run
5. Result of each
6. What could not be validated locally, and the CI result (`gh pr checks`) once the PR exists
7. Remaining risks
8. Branch name
9. Commit SHA, if committed
10. PR link, if created

Label each claim **VERIFIED**, **NOT VERIFIED**, or **BLOCKED**. Do not claim a
test passed unless you ran it. Do not claim production safety unless verified.
