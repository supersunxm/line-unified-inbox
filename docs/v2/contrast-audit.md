# v2 dark-mode contrast audit

Date: 2026-10-07. Script: `frontend/scripts/contrast-audit.mjs` (`npm run audit:contrast`,
manual, not in CI).

## Method

- Real rendered pages: production build (`npm run build && npx next start -p 3000`), headless
  Chromium, viewport 1440×1000, app theme stored as dark.
- Every API call is answered by `frontend/scripts/v2-seed-api.mjs`: synthetic, deterministic
  stores and chats (summary, list and 24-hour rates generated from one chat set), so no backend
  and no customer data are involved.
- Every visible text node, select value and input placeholder: computed text colour (with
  ancestor opacity) against the nearest opaque background, compositing semi-transparent
  backgrounds up the ancestor chain. sr-only and `aria-hidden` text is skipped.
- Views: /v2, /v2?month=2026-09, /v2/stores, the scorecard drawer (normal and low-sample store),
  /v2/response (ตามวันนี้, ทั้งหมด, หน้าแชท). /v2/report is excluded: it is light-only.
- Threshold: 3:1 (`MIN_RATIO`, override with the env var). `THEME=light` audits light mode.

The auditor was checked against known failures: in light mode it reports the tertiary grey
(#a1a1a6) on white at 2.57:1 and the green delta (#34c759) on white at 2.22:1.

## Results, dark mode, 3:1

| Build | Views | Text nodes | Below 3:1 |
|---|---|---|---|
| Before: `origin/main` f60d9b3 (pre-monthly v2: วันนี้, สาขา health, การตอบแชท; the same script, drawer waits removed) | 8 | 2,400 | **0** |
| After: monthly v2 (ภาพรวมเดือน, สาขา scorecard + drawer, ตอนนี้) | 8 | 2,915 | **0** |

The suspected root cause — native `<button>` labels inheriting an unlayered global colour — was
already fixed on main before this program: `globals.css` puts `button { color: inherit }` in
`@layer base`, so `text-*` utilities win. The monthly views use real table semantics (the store
is a `<th scope="row">` with a button inside, not a clickable `<button>` row), so they do not
depend on that reset.

## Below 4.5:1 (informational, not a failure of the 3:1 bar)

All remaining gaps come from two global dark tokens used across the whole app:

| Token (dark) | Value | On | Ratio | Where in v2 |
|---|---|---|---|---|
| `--app-text-tertiary` | #64748b | `--app-surface` #14171d | 3.77:1 | sidebar captions, tab counts, chart weekday labels |
| `--app-text-tertiary` | #64748b | `--app-surface-subtle` #1a1e26 | 3.51:1 | table headers |
| `--app-accent` | #26805a | `--app-surface` #14171d | 3.69:1 | links ("รายงาน ↗"), active nav label |
| `--app-accent` | #26805a | `--app-accent-soft` #0f1f17 | 3.51:1 | active nav label |

Proposal (needs approval; changes every page): lighten dark `--app-text-tertiary` to about
#7c8aa0 and use a lighter accent for text on dark surfaces (e.g. a new `--app-accent-text`
≈ #3fa577) while keeping `--app-accent` for fills.

## Light mode (out of scope, reported)

Light mode has real failures under 3:1 in shared components: table headers and tab counts in
`--app-text-tertiary` #a1a1a6 (2.45–2.57:1), and the ตอนนี้ tab's green rate deltas in
`--app-success` #34c759 (2.2:1). The monthly views avoid `--app-success` for text (they use
`--app-accent`). Fixing the shared `TableHeader` and the token needs approval because it
affects every page.
