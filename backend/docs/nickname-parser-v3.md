# Nickname Parser v3

`nickname-parser-v3.0.0` is a pure, deterministic interpretation contract. It does not update a Conversation, `NicknameSourceState`, LINE OA Manager, or any other production metadata.

## Independent dimensions

| Nickname signal | Parsed dimension | Parsed value |
|---|---|---|
| `Online` | `customerType` | `ONLINE` |
| `SG` | `financeProvider` | `SG_FINANCE` |
| `UFUND` / `Ufund` | `financeProvider` | `UFUND` |
| standalone `สด` / `เงินสด` | `paymentMethod` | `CASH` |
| standalone `ผ่อน` | `paymentMethod` | `INSTALLMENT` |
| `Film` | `service` | `FILM_INSTALLATION` |
| existing manager-source-v2 whole-nickname form | `source` | Existing v2 Source tag |

These dimensions do not reuse or reinterpret `Conversation.onlineSource`. Parsing `Online` is only a nickname-derived `customerType` candidate; it never changes sales status. V3 calls the frozen v2 parser and carries its result without changing v2 rules.

ASCII markers are case-insensitive, but must be separate tokens. Letters, digits, hyphens, and underscores join a token; for example, `design`, `OnlineShop`, and `online-shop` do not yield a marker. Thai terms also require token boundaries. Repeated identical signals collapse to one value. Conflicting providers, payment methods, or periods require review.

## Numeric dates

Only slash-separated numeric shapes are parseable:

- `M/YY` or `MM/YY` yields a month/year period.
- `D/M/YY`, `DD/MM/YY`, mixed one- and two-digit day/month fields, or the corresponding four-digit-year form yields a full date in day/month/year order.
- `26` and `69` normalize to 2026; `2569` also normalizes to 2026 in full dates. Valid four-digit Gregorian years are retained.
- Other two-digit years, two-field four-digit years, invalid calendar dates, and non-slash separators are review cases. No pivot year or date-order inference is used.

The analysis helper reports date-like shapes without widening parser acceptance.

## Product resolution

The read-only runner supplies active Product Master entities, exact canonical names, active CATALOG aliases whose existing catalog safety is `SAFE_EXACT` or `SAFE_COMPACT`, and approved aliases from the static catalog. Active MANUAL aliases remain review-only under the existing safety policy. Matching is exact after the existing product normalization, or compact only where an alias explicitly has `SAFE_COMPACT` safety. No substring, family inference, message text, or fuzzy match is used. A cross-product collision or unresolved residual is held for review.

## Dry-run operation

Run `npm run line-chat:nickname-parser-v3:dry-run` with the normal database environment. It runs inside a PostgreSQL `READ ONLY` transaction, selects the latest readable nickname per exact OA/chat-ID pair from `NicknameSourceObservation`, compares v2 `parsedTag` evidence, and emits aggregates without raw nickname text, customer/chat IDs, or messages. Product Master labels may appear in the aggregate product breakdown. It does not access Manager or browser sessions. A v3 read-only result is not authorization to apply metadata; destination identity validation, an independent v3 state/history model, freshness checks, and a separately authorized write workflow remain prerequisites.
