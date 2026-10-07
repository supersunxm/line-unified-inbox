# Three-language localization status — source coverage complete

- Worktree: `/private/tmp/line-three-language-coverage`
- Branch: `codex/three-language-coverage`
- Supported locales: Thai (`th`), English (`en`), Simplified Chinese (`zh`)
- Audit date: 2026-10-07

## Final classification

The initial audit found **1,003 direct Thai JSX candidate occurrences**. Of these, 520 had an exact translation-source match and 483 occurrences across 458 unique strings were initially unmatched. Contextual review classified every original candidate:

| Classification | Original candidates | Result |
|---|---:|---|
| `BUG` | 451 | 451 fixed with locale-backed copy |
| `NON_UI` | 19 | Reviewed and excluded from UI localization |
| `INTENTIONAL_UI` | 533 | Reviewed as canonical Thai source text, fixed business content, or other intentionally stable UI |
| Unclassified | 0 | None |

The current source sweep contains 908 Thai UI candidates and matches reviewed records one-for-one. It reports zero unclassified and zero unfixed bugs. `FINAL_THAI_CLASSIFICATION.json` also records 122 additional live-sweep occurrences outside the original queue and seven extra UI findings fixed during route and browser review.

The separate English/Chinese audit records 143 candidate occurrences, including overlapping findings that affect both locales: English has 139 locale occurrences and Chinese has 6. Three bug records were found and fixed (two English occurrences and two Chinese occurrences, with one fix shared across both locales); 56 findings are `NON_UI`, 84 are `INTENTIONAL_UI`, and none are unclassified. No English or Chinese bugs remain open. All findings and their reasons are in `FINAL_EN_ZH_CLASSIFICATION.json`.

## Feature coverage

| Feature | Source coverage | TH | EN | ZH | Desktop | Mobile | Runtime |
|---|---|---|---|---|---|---|---|
| Google Review KPI and Review15 | Complete locale resources and regression tests | PASS | PASS | PASS | PASS | PASS | PASS for public Review15; KPI `BLOCKED_AUTH` |
| Broadcast and mass messaging | Complete route and editor resources; parameter coverage tests | PASS | PASS | PASS | BLOCKED_AUTH | BLOCKED_AUTH | BLOCKED_AUTH |
| Main OA, HQ, registrations, store management | Route-scoped resources and classified source checks | PASS | PASS | PASS | BLOCKED_AUTH | BLOCKED_AUTH | BLOCKED_AUTH |
| Inbox, auto replies, greeting, rich messages and menus | Shared and feature dictionaries; editor and accessibility tests | PASS | PASS | PASS | BLOCKED_AUTH | BLOCKED_AUTH | BLOCKED_AUTH |
| Dashboard, purchase analytics, followers and operations | Route dictionaries, dynamic-copy and output tests | PASS | PASS | PASS | BLOCKED_AUTH | BLOCKED_AUTH | BLOCKED_AUTH |
| Coupons, friend-source links and downloads | Route resources and source tests | PASS | PASS | PASS | BLOCKED_AUTH for protected surfaces | BLOCKED_AUTH for protected surfaces | BLOCKED_AUTH for protected surfaces; public download pages PASS |
| Store 360 and V2 reports/responses | Complete locale resources; formatter, KPI-state and view tests | PASS | PASS | PASS | BLOCKED_AUTH | BLOCKED_AUTH | BLOCKED_AUTH |
| Public landing, store directory, profile and locator | Three-locale route resources and browser checks | PASS | PASS | PASS | PASS | PASS | PASS; API-backed store data unavailable in this worktree |
| TikTok public integration and connection states | Three-locale route resources and browser checks | PASS | PASS | PASS | PASS | PASS | PASS; external OAuth was not started |
| Login, registration, privacy and terms | Three-locale route copy and browser checks | PASS | PASS | PASS | PASS | PASS | PASS |
| Shared shell, language picker, loading/error and message controls | Shared locale resources and component/source tests | PASS | PASS | PASS | PASS on accessible pages | PASS on accessible pages | Protected content `BLOCKED_AUTH` |

## Route and browser QA

`ROUTE_COVERAGE.md` lists the 59 originally requested routes plus `/change-password`, added on the latest `origin/main`. All 60 paths were opened in a desktop route walk before the rebase. The 19 routes available without an authenticated workspace were then checked in all three locales at **1440px desktop** and **375×812 mobile**: 57 locale/route states per viewport. Every page rendered content; document and visible control bounds stayed within the viewport; locale state matched; no raw interpolation placeholders appeared. The mobile sweep found and fixed two store-locator leaks: Thai step labels and the API error sentence. Both now have regression coverage. Root/store search and Review15 input/count behavior were also checked across language changes. The new `/change-password` route will receive a safe unauthenticated redirect check after the rebase; the forced-reset form requires an authenticated server fixture.

Protected-route source coverage is complete, but protected feature interiors were not visually inspected. This isolated worktree has no running API on port 3001 and no repository-supported local QA account, seeded session, or authenticated browser state. Protected routes fail closed or redirect to login; they are correctly recorded as `BLOCKED_AUTH`, not runtime PASS. No credentials or authentication bypass were used. Store directory/profile and store-locator data therefore show their localized empty/error states.

The only browser console error observed was React minified hydration error 418 on `/friend-attribution` with no callback configuration. The route component is unchanged from base `de90d769`; its client initializer reads the URL while server rendering starts in `LOADING`, causing the existing mismatch. It does not originate from localization changes. Other routes produced no browser-console errors. The production QA server used port 3002 and was stopped after checks; the main checkout's port 3000 and port 3001 were left untouched.

## Regression checks

- Frontend tests: **947/947 PASS** (final rerun recorded before delivery).
- Localization coverage tests: **37/37 PASS**.
- Classified Thai AST audit: **PASS**, 908 current candidates; zero unclassified, zero unfixed.
- Build: **PASS**, all 53 pages generated. Existing dynamic-font HTTP 400 and `metadataBase` warnings remain; the build completes successfully.
- Full TypeScript baseline check: **50 errors / baseline 50**, no regression.
- Focused changed-file ESLint: baseline 53 errors / 75 warnings; worktree 51 errors / 73 warnings, with no new per-file/severity/rule groups. Full lint remains nonzero on existing debt: baseline 70 errors / 103 warnings; worktree 68 errors / 101 warnings, with no new per-file/severity/rule groups.
- `git diff --check`: **PASS**.
- No TypeScript suppression or lint-rule disable was added.

## Business logic safety

No KPI calculations, reply-status decisions, LINE messaging behavior, Live/Historical Mirror behavior, Google Review counting or validation, TikTok collection, authentication or permissions, backend APIs, or database schema were changed. V2 utilities only gained locale-aware presentation formatting; calculation and status rules remain intact. No migrations were added or run.

## Delivery

No commit, push, pull request, CI run, merge, or deployment has occurred yet. The work remains on `codex/three-language-coverage`; it must first be reconciled with the latest `origin/main`, then the complete checks must pass on the reconciled branch before the authorized PR/CI/merge sequence.

**SOURCE 3-LANGUAGE COVERAGE: PASS**

**PROTECTED ROUTE VISUAL QA: BLOCKED_AUTH**
