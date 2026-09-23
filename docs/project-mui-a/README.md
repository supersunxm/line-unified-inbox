# Project MUI A

Project MUI A modernizes the frontend visual system with Material UI while
preserving the existing Store Chats behavior and keeping Big Project A isolated.

## Pilot target

The first pilot surface is **Store Chats**.

The desired outcome is a moderate visual refresh rather than a full Material
Design redesign: keep the current information architecture, operational density,
OPPO accent color, and chat behavior while improving spacing, controls, states,
cards, filters, menus, dialogs, and consistency.

## Isolation boundary

Project MUI A is frontend-only during the pilot.

Do not modify:

- `backend/src/line-chat/**`
- Mirror Chat / LINE Manager capture logic
- historical backfill logic
- realtime message semantics
- assignment or reply-state transitions
- `AI_PROGRESS.md`
- `DECISIONS.md`

The two shared progress files are intentionally excluded from this branch so
Big Project A can continue without merge churn.

## Existing stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Existing semantic CSS variables in `frontend/src/app/globals.css`
- Existing shared primitives in `frontend/src/components/ui/**`

The MUI theme should consume the existing semantic tokens instead of introducing
a second independent color system.

## Planned MUI integration

Verified package line for the implementation phase:

- `@mui/material`
- `@mui/material-nextjs`
- `@emotion/react`
- `@emotion/styled`
- `@emotion/cache`

For Next.js App Router, use `AppRouterCacheProvider` from the MUI Next.js
integration and enable the MUI CSS layer so Tailwind 4 and existing app styles
remain predictable.

No MUI dependency is added in the isolation commit. The dependency + provider
change is a separate checkpoint so its lockfile, build, SSR behavior, and visual
impact can be verified independently.

## Migration sequence

1. Isolation guard and token contract.
2. Dependency + Next.js/Emotion provider foundation.
3. Shared primitives: Button, IconButton, Input, Select, Badge, Card.
4. Store Chats visual pilot with zero business-logic changes.
5. Regression verification: filters, pagination, realtime, status, LINE OA link,
   reply composer, desktop widths, light/dark modes.
6. Only after the pilot is accepted, expand to other frontend surfaces.

## Merge gate

Do not merge Project MUI A into `main` while a Big Project A change is being
validated against the same base. Before merge, refresh from current `main`,
review the changed-file boundary, and rerun frontend build/tests.
