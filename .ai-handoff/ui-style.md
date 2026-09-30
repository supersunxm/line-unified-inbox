# UI Style Spec & Site Audit — line-unified-inbox

Place this file at `.ai-handoff/ui-style.md`. It is the visual requirement for all
UI work. `CLAUDE.md` guardrails still apply.

Source: live review of https://lineoppo.click on 2026-09-30, all 22 sections,
desktop (1440px) and mobile (400px). Read-only review; nothing was changed.

---

## Part 1 — Target style

### Direction

Clean, calm operations tool. Thai-first labels. Fewer colors, fewer borders,
clear hierarchy. One visual language across every page.

### Typography

- Primary font: **IBM Plex Sans Thai** (load with `next/font/google`,
  weights 400 / 500 / 600 / 700, subsets `thai` + `latin`).
- Fallback stack: `"IBM Plex Sans Thai", -apple-system, "Segoe UI", sans-serif`.
- Replace the current `Inter` stack everywhere. Do not use monospace for names,
  store names, or times — only for IDs, codes, and URLs.
- Proposed scale:
  - Page title 24px / 600
  - Section title 16px / 600
  - Body 14px / 400
  - Secondary / meta 12px / 400
  - KPI number 28px / 600, tabular figures

### Color

- Brand accent: **#1f6b4a** (replaces current `--app-accent: #00a651`).
- Proposed derived tokens (verify contrast before shipping):
  - `--app-accent-hover`: #17563b
  - `--app-accent-soft`: #e8f1ec
  - `--app-accent-contrast`: #ffffff
- Keep **status colors separate from the accent**. "Healthy / connected /
  replied" uses `--app-success`, not the brand accent, so a status dot never
  looks like a button.
- Remove hardcoded Tailwind palette colors (`bg-emerald-*`, `bg-purple-*`,
  `text-red-600`, etc.) in favor of `--app-*` tokens.
- Colored left borders on KPI cards: remove. Icon tint colors: at most accent +
  neutral, plus status colors only where they carry meaning.
- No emoji in UI chrome (KPI cards, headings).

### Language

- `html lang="th"`.
- Thai is the primary label language. Do not mix Thai and English inside one
  phrase (e.g. `Waiting 29วัน 2ชม.` → `รอ 29 วัน 2 ชม.`).
- Product / proper names stay as-is (LINE OA, Store 360, TikTok, KPI).
- See Open Decision 1 about the TH/EN/中文 toggle.

### Components

- **Page header** (every page): eyebrow optional, page title, one-line
  description, actions on the right. The top-bar title must match the page.
- **Browser tab title**: `<Page name> · OPPO LINE OA Monitor` on every internal
  page. The public `/stores` page keeps its own title.
- **KPI card**: one shared component. Label (12px, secondary), value (28px),
  sub-text (12px), optional status dot with a text meaning available on hover
  or in the sub-text. Empty value shows `—` at normal size plus a short reason,
  never a large "No data available".
- **Period control**: one per page, in the page header. Not repeated inside
  cards.
- **Cards**: one radius (`--app-radius-lg`), one border (`--app-border-subtle`),
  one shadow (`--app-shadow-card`).
- **Row actions**: max two visible actions per row; the rest in an overflow
  menu. Destructive actions (Remove, Delete, Disable) only inside the overflow
  menu, separated, with confirmation.
- **Floating elements** (toasts, floating buttons, mode toggles) must never
  cover page-header actions or table content.

### Navigation

- Sidebar: show text labels next to icons when expanded (default expanded on
  ≥1280px), with group headings, e.g.:
  - ภาพรวม — Main, Dashboard, Message Traffic, 24H Response Rate
  - แชท — Store Chats, Main OA
  - สาขา — Store 360, Store Management, Store Directory, Google Review KPI
  - ลูกค้า — Follower Insights, Purchase Intelligence, Friend Source Links
  - การตลาด — Mass Message, Rich Menu, Auto-response, Greeting, Coupons
  - ระบบ — Download Center, BM Approval, LINE Chat Health, TikTok
  (Grouping is a proposal; confirm before implementing.)
- Every internal page renders inside the shared app shell (sidebar + top bar).

### Internal wording

Remove developer/phase text from production UI: e.g. "Phase 2B · Durable
Multi-Store Bulk Publishing", "NEXT: REPLACE THE OLD KAOJAO WEBHOOK URL…".
Raw codes like `NEED_BOT_MAPPING` / `MISSING_LINE_CHAT_SESSION` get
human-readable Thai labels (code may stay as a tooltip).

---

## Part 2 — Audit findings

### Global

1. Four different visual languages exist:
   - main shell pages (Home, Store Chats, Message Traffic) — grey/white, flat;
   - Store 360 — large rounded cards, multicolor icons;
   - pages outside the shell — `/replymessage` (24H Response Rate) and
     `/tiktok` (dark hero header) have no sidebar;
   - Friend Source Links — emoji KPI cards, colored borders.
2. Font is Inter, accent is #00a651, `lang="en"`.
3. Every internal page's browser tab title is
   "OPPO Brand Shop · ค้นหาสาขา & ช่องทางติดต่อ" (the public store directory title).
4. Top-bar title wrong on some pages: Download Center shows "Follower
   Insights"; Message Traffic shows "Dashboard".
5. Sidebar: ~22 icon-only items, no labels or groups — hard to scan.
6. Language toggle exists only on some pages (Purchase Intelligence, BM
   Approval, mobile Store Chats).

### Per page

| Page | Findings |
|---|---|
| Home `/home` | "Needs attention" repeats the Unreplied KPI. Status dots have no stated meaning (grey dot on Total stores). "24h response rate 0%" (today) conflicts visually with 44.3% on the 24H page (7D) — same label, different period. Mobile header: two small icon buttons stacked under the title. |
| Dashboard | Period control appears twice (page header and inside the peer-comparison card). English page title, Thai card content. Dense tables with small secondary text. |
| 24H Response Rate `/replymessage` | Outside the app shell; own "back to dashboard" button. Otherwise clear. |
| Store Chats | Store names and times in monospace. Store list truncates names heavily. Mixed-language wait labels. Sidebar overview shows "BM notified" (see Open Decision 2). |
| Follower Insights | Large empty area above the title. "Warning: Warning:" duplicated. Total followers 0 while Home shows 211,327 (partial-data case needs a clearer empty state). Floating download button overlaps content. |
| Store 360 | Different card style. "No data available" rendered at KPI-number size. Header layout (date range + user avatar) differs from other pages. |
| Message Traffic | Clean. Two KPI cards have colored left borders (green, blue) for no stated reason. |
| Main OA | Setup instruction text left in UI. Webhook URL shown in full on screen (see security note). Chat detail lacks timestamps and differs from Store Chats. |
| Download Center | Wrong top-bar title. Otherwise good structure. |
| Coupons | Fine; follow shared form styles. |
| Store Management | Each row shows ~10 action buttons including a red "Remove LINE OA" beside routine actions — high misclick risk, visually heavy. |
| Google Review KPI | Dense; many status colors (purple, orange, green). |
| Purchase Intelligence | Clean; has its own language toggle. |
| Friend Source Links | Emoji in KPI cards; colored borders; uppercase bold section headers unlike other pages. |
| Mass Message | Audience options include "Notified BM" (Open Decision 2). Floating draft toast overlaps the page corner. |
| Rich Menu | Internal "Phase 2B …" badge. Tooltip overlaps header button. |
| Auto-response | Good. Follow shared card style. |
| Greeting Messages | Floating "Preview / Builder" toggle overlaps header action buttons. |
| BM Approval | Fine; language toggle overlaps top-right area. |
| LINE Chat Health | Raw status codes as labels. |
| TikTok | Outside the app shell; dark hero header — different design language. |

### Security note (not UI scope — report only)

The Main OA page displays the full webhook URL, whose path looks like it
contains a secret token. Consider masking it with a copy button. Do not change
backend behavior; raise with the owner.

---

## Part 3 — Rollout order (one PR each)

1. **Foundation**: font, accent tokens, `lang="th"`, document titles, top-bar
   titles. Token-level; touches every page consistently. Check the
   source-regex tests (`design-system-foundation`, etc.).
2. **Sidebar**: labels + groups.
3. **Shared KPI card + page header**, then apply to Home and Message Traffic.
4. **Bring `/replymessage` and `/tiktok` into the app shell.**
5. **Store Chats** visual pass (extract components from `page.tsx` first, per
   `CLAUDE.md` guardrails).
6. **Store 360**.
7. **Store Management** row actions → overflow menu.
8. Remaining pages: wording cleanup, overlaps, emoji removal.

Each PR: before/after screenshots at 1440px and 400px, frontend lint / test /
build, completion report per `CLAUDE.md`.

---

## Open decisions (owner to confirm)

1. **Language**: Thai-only UI, or keep the TH / EN / 中文 toggle and make it
   global?
2. **BM notified**: production still shows a third "BM notified" state in Store
   Chats (desktop + mobile) and Mass Message audiences, while code audit
   described the UI as two-state. Keep, hide, or remove? (Reply-status
   semantics are restricted scope — UI-only change needs explicit approval.)
3. **Sidebar grouping** above — accept or adjust.
