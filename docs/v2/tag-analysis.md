# Customer-name tags: investigation and coverage

Date: 2026-10-07. Read-only investigation of code and schema. **No customer names, message
text or per-customer rows appear in this file, in the repo, or in tests. Every example below
is synthetic.**

## 1. Where the names are and which API exposes them

Store staff rename customers in LINE OA Manager to encode what the customer is
(e.g. a synthetic `Online Reno16 ติดฟิล์ม 09/26`). That renamed value is the Manager
**nickname**, not the customer's LINE profile name (`Customer.displayName`).

| Layer | Where | Exposed to the frontend? |
|---|---|---|
| Raw nickname | `NicknameSourceObservation.nickname` (+ `nicknameReadStatus`, `observedAt`, exact Store/OA/chat identity). Written by the passive capture that runs after an existing Manager recent-chat read (see `NICKNAME_SOURCE_TAG_CONTRACT.md`). Coverage is the bounded recent window, not full history. | **No.** No controller returns raw nicknames (by design; evidence stays immutable and out of Git). |
| Source tag (v2 rules) | `NicknameSourceState.tag` per conversation (`TikTok`, `Facebook`, `Instagram`, `LINE`, `Website`, `Lemon8`), grammar `<source> <MM/YY>`. | Yes: `/conversations` items carry `nicknameSourceState`. |
| Parsed tags (Parser v3) | `NicknameDerivedMetadataState` per observation: `source`, `customerType` (`ONLINE`), `productModelId` → product name, `paymentMethod` (`CASH`/`INSTALLMENT`), `financeProvider` (`SG_FINANCE`/`UFUND`), `service` (`FILM_INSTALLATION`), `periodYear`/`periodMonth` (MM/YY), `eventDate`. Kept in sync continuously from new observations; a no-signal observation clears it. | Yes: `/conversations` and `/conversations/:id` items carry `nicknameDerivedMetadata`. This is what `/chats` shows as chips (e.g. "ONLINE"). |
| Aggregates | Worker-internal `GET /internal/line-chat/nickname-source/audit` (source tags only, aggregate counts) and the operator CLIs `nickname-parser-v3-dry-run` / `nickname-derived-metadata-rollout` (dimension counts and combinations). | **No** user-facing endpoint. Internal routes and CLIs need production worker/database access. |

`GET /conversations?storeId=<id>&month=YYYY-MM` (the `/chats` list call) therefore returns the
parsed tags **per store and month**, one page of ≤ 100 chats at a time. It does not return
raw names.

## 2. Observed token patterns — BLOCKED

The brief asks for counts of the observed token patterns and formatting variants, and for
per-store coverage measured on real data. This session has **no access to production data**
(no database, no logged-in browser, and raw nicknames are deliberately not served by any API),
so no observed counts are reported here. Nothing in this section is estimated.

What is needed to fill it (read-only, aggregated, run by an operator with production access):

- `npm run line-chat:nickname-parser-v3:dry-run` (or `npm run line-chat:nickname-v3:readiness`) already
  prints dimension counts (`ONLINE`, `SOURCE`, `PRODUCT`, `CASH`, `INSTALLMENT`, `SG_FINANCE`,
  `UFUND`, `FILM`, `PERIOD`, `EVENT_DATE`), dimension combinations and date-token shapes
  (`auditNicknameDateTokens`: `MM/YY`, `M/YY`, `DD/MM/YY`, `MM-YY`, `MM.YY`, …, with
  disposition and year convention). Paste only those aggregate tables here.
- A residual-token histogram (tokens left after Parser v3 removes recognised markers),
  top-N by count, with tokens that look like names suppressed (e.g. only tokens seen ≥ 20
  times in ≥ 5 stores). This needs a small new read-only CLI; it is a backend change and
  needs approval.

## 3. Patterns the parser already recognises (from code)

Parser v3 (`backend/src/line-chat/nickname-parser-v3.contract.ts`, rule
`nickname-parser-v3.0.1`) normalises whitespace runs to one space and then reads:

| Kind | Tokens (whole word, case-insensitive for Latin) | Result |
|---|---|---|
| Source (sales channel) | `Online` | `customerType = ONLINE` |
| Source (platform), only in the exact `<source> <MM/YY>` form | `TikTok`, `Facebook`, `Instagram` / `IG`, `LINE`, `Website`, `Lemon8` | `source` |
| Service | `Film` | `service = FILM_INSTALLATION` |
| Payment | `เงินสด`, `สด` → CASH; `ผ่อน` → INSTALLMENT | `paymentMethod` |
| Finance provider | `SG`, `UFUND` | `financeProvider` |
| Purchase month | `M/YY` or `MM/YY` with month 01–12; year `26` or `69` (Buddhist 2569) → 2026; also `MM/YYYY` with a 4-digit Gregorian year or `2569` | `period` |
| Full date | `D/M/YY` … `DD/MM/YYYY` (same year rules) | `eventDate` |
| Product | the residual text after removing the tokens above, matched **exactly** against active Product Master models and catalog aliases marked safe (e.g. `reno16`, `reno 16`, `reno16 pro`, `รีโน16โปร`) | `product` |

Held for review (never applied): conflicting markers (two payment methods, two periods),
unsupported date separators (`09-26`, `09.26`), invalid dates, ambiguous product aliases, and
leftover free text next to a recognised marker.

Gaps against the owner's description of the naming convention:

- **Thai service words are not recognised**: `ฟิล์ม` / `ติดฟิล์ม` do not set the service; only
  the English `Film` does.
- **Years other than 2026 are rejected** for two-digit years (`25`, `27` → invalid). A
  purchase month in 2027 (`01/27`) will be held for review from January.
- **Product shorthands outside the catalog** (e.g. `FindX9` without a space, `X9`, `A6`)
  resolve only if the catalog has that exact safe alias.
- **Product + free text** (e.g. a product plus a store note) is held for review, so a name with
  any extra word loses all its tags.

> **Update 2026-10-07 (B3):** Parser v4 (`backend/src/v2-monthly/nickname-parser-v4.ts`) closes
> the gaps above: Thai ฟิล์ม variants, any 20YY year, extra words keep the tags, platforms
> anywhere. Decisions and the one deliberate difference from this proposal (two-digit years are
> always 20YY, per the owner) are in `decisions.md` → "Tag parser v4 (B3)".

## 4. Proposed grammar (implemented as Parser v4)

A name is a sequence of whitespace- or separator-delimited tokens (separators: space, `,`,
`;`, `+`, `|`, `-` between words). Tokens can appear in any order; unknown tokens are kept as
free text and **do not** cancel the recognised ones (change from v3, which holds the whole name).

```
name          := token (sep token)*
token         := source | product | service | payment | finance | purchase-month | date | free-text
source        := "Online" | "ออนไลน์" | platform
platform      := "TikTok" | "Facebook" | "FB" | "Instagram" | "IG" | "LINE" | "Website" | "Lemon8"
service       := "Film" | "ฟิล์ม" | "ติดฟิล์ม" | "ฟิล์มกระจก"
payment       := "เงินสด" | "สด" | "ผ่อน"
finance       := "SG" | "UFUND"
purchase-month:= MM "/" YY            ; MM = 01–12 (one digit allowed), YY = two-digit Gregorian
                                      ; year 25–30, or 68–73 read as Buddhist (2568–2573)
                                      ; the LAST purchase-month token in the name wins
date          := DD "/" MM "/" (YY | YYYY)
product       := longest exact match in the product dictionary (below), compact form
                 (case-folded, spaces removed) allowed only for aliases marked SAFE_COMPACT
```

Output per name: `source`, `products[]` (more than one allowed), `services[]`, `payment`,
`finance`, `purchaseMonth {year, month}`, `date`, `freeText`. A name "has a tag" when any field
other than `freeText` is set; "has a valid MM/YY" when `purchaseMonth` is set and is not in
the future relative to the observation time.

## 5. Product dictionary (seed)

Seeded from the existing catalog (`backend/src/classification/product-catalog.ts`); every
alias keeps its safety class there. Additions proposed for owner review are marked *.

| Canonical | Aliases (compact form shown) |
|---|---|
| OPPO Reno16 Pro 5G | reno16pro, reno16pro5g, รีโน16โปร, เรโน16โปร |
| OPPO Reno16 | reno16, reno165g, reno16f |
| OPPO Find X9 | findx9, find x9, x9* |
| OPPO A6 5G / OPPO A6 Pro 5G | a6, a65g*, a6pro |
| OPPO Pad 3 | pad3 |
| OPPO Enco Air4 | encoair4 |
| OPPO Watch X2 | watchx2 |
| Accessory families | case, charger, earbuds, band, router (family level only) |

`x9` and `a6` alone are short and collide easily; they need the owner's approval and a
same-store frequency check before being marked safe.

## 6. Coverage in v2

- **Store scorecard drawer**: computed client-side from the store's month of
  `/conversations?storeId=&month=` (the `/chats` list call): share of chats with ≥ 1 parsed tag,
  and with a valid MM/YY. It is a **lower bound** — a chat whose nickname was never read has
  no metadata and counts as untagged — and the drawer says so.
- **Store list column and network/partner coverage**: **hidden**. Computing it client-side would
  mean paging every chat of the month for every store (thousands of requests' worth of data).

> **Update 2026-10-07 (B4):** built as `GET /v2/tag-coverage?month=` on Parser v4 tags; v2 shows
> it in the store list, partner table and drawer, and says "ยังไม่ได้อ่านชื่อ" when no name was
> read. The two bullets above describe the earlier state.

### Backend endpoint (proposal as written before B4)

`GET /conversations/name-tag-coverage?month=YYYY-MM` → per store:
`{ storeId, chats, observed, tagged, withPurchaseMonth, bySource: {ONLINE, TikTok, …}, byService: {FILM_INSTALLATION}, byProductFamily: {…} }`
— counts only, same store scope and month bucketing (`latestMessageAt`) as
`bm-reply-status-summary`, `observed` = chats with any nickname observation (so "not read"
can be told apart from "no tag").


## 7. Purchase months lost under Parser v4.1 (8 Oct 2026)

Production re-derive (7 Oct): of 757 chats with a v4.0 purchase month, 502 are unchanged, 184 changed
(mostly "69" = BE 2569, 2069 → 2026) and 71 lost it because the year is outside both windows
(CE 2021–2027, BE 2564–2570); 74 date-like words were left as text.

**Status: breakdown by token shape NOT RUN.** It needs a read-only aggregate query on the production
database, which this cloud session cannot reach (no DB access; reading production credentials was not
done). Run it as an operator, copy only the table below (counts by shape and YY — no names, no rows):

```sql
-- Latest READ nickname per chat; counts of date-like tokens by shape and last-segment value only.
WITH latest AS (
  SELECT DISTINCT ON ("lineOfficialAccountId", "lineChatUserId") nickname
  FROM "NicknameSourceObservation" WHERE "nicknameReadStatus" = 'READ'
  ORDER BY "lineOfficialAccountId", "lineChatUserId", "observedAt" DESC, id DESC
), tokens AS (
  SELECT m[1] a, m[2] b, m[3] c
  FROM latest, regexp_matches(nickname, '(?<![[:alnum:]_/])([0-9]{1,4})/([0-9]{1,4})(?:/([0-9]{1,4}))?(?![[:alnum:]_/])', 'g') m
)
SELECT regexp_replace(regexp_replace(concat_ws('/', a, b, c), '[0-9]', 'N', 'g'), 'N+', 'N', 'g') AS punct,
       concat_ws('/', length(a), length(b), length(c)) AS digit_lengths,
       coalesce(c, b) AS yy, count(*) AS tokens
FROM tokens GROUP BY 1, 2, 3 ORDER BY tokens DESC;
```
