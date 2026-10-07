# Review 15 Word Counting Rule V3

Canonical rule version: `THAI_REVIEW_WORDS_V3`

This is the current business contract for:
- public `/review15` and `/รีวิว15คำ`; and
- Google Review KPI word qualification.

Both consumers MUST use `frontend/src/lib/thai-word-counter.ts`. The Google Review checker must continue to re-export the canonical counter instead of maintaining a second tokenizer.

## Why V3 exists

V2 fixed known single-word drift such as `โปรโมชั่น`, but production audit found two additional failure classes:

1. Thai text glued directly to Latin product names could become one token, e.g. `ซื้อOPPOReno14Pro5Gวัน`.
2. Thai words typed with no spaces could be fragmented nonsensically by `Intl.Segmenter`, e.g. `แบตอึดกล้อง` becoming fragments such as `แบ / ตอึ / ดก / ล้อ / ง`.

V3 fixes those classes without replacing the entire Thai tokenizer.

## Counting pipeline

1. Remove known Google Maps UI noise.
2. Insert a boundary only where Thai characters touch ASCII letters or digits.
3. Protect approved lexical units. Protected units also act as boundary anchors inside Thai text with no spaces.
4. Segment remaining Thai text with `Intl.Segmenter("th", { granularity: "word" })`.
5. Split explicit OPPO product patterns deterministically.
6. Exclude punctuation/symbol-only tokens, emoji-only tokens, Google UI words, and pure numbers.
7. Apply the canonical compound dictionary.
8. Merge approved Thai compound prefixes.
9. Pass the word-count threshold when final token count is **15 or more**.

## Production-audit fixtures locked by V3

| Input | Expected final tokens | Count |
| --- | --- | ---: |
| `โปรโมชั่น` | `โปรโมชั่น` | 1 |
| `ใช้งาน` | `ใช้งาน` | 1 |
| `แบตอึดกล้อง` | `แบต / อึด / กล้อง` | 3 |
| `ซื้อOPPOReno14Pro5Gวันนี้` | `ซื้อ / OPPO / Reno14Pro / 5G / วันนี้` | 5 |
| `สมาร์ทโฟนเครื่องนี้ใช้งานง่ายแบตอึดกล้องสวยชาร์จเร็ว` | `สมาร์ทโฟน / เครื่อง / นี้ / ใช้งาน / ง่าย / แบต / อึด / กล้อง / สวย / ชาร์จ / เร็ว` | 11 |

The same already-spaced product text must return the same tokens as the glued version.

## Protected lexical units in V3

The initial V3 boundary anchors are:
- โปรโมชั่น
- สมาร์ทโฟน
- ประทับใจ
- ใช้งาน
- วันนี้
- แบต
- กล้อง

This list is intentionally conservative. A term may be added only when an audit case establishes the expected tokenization.

## Mixed-script product rule

V3 inserts Thai/ASCII script boundaries and then applies only explicit product parsing:

`OPPOReno14Pro5G` → `OPPO / Reno14Pro / 5G`

Do not generic-split arbitrary CamelCase strings. Model names may contain meaningful casing and digits.

## Google Review KPI parity

The public checker and Google Review tooling must produce identical `finalTokens` and `count` for identical review text.

Google Review KPI then applies its additional qualification conditions:

`qualified = !edited && hasCustomerPhoto && imageCaptureMonth === targetMonth && finalWordCount >= 15`

## Audit policy

Every counting-rule change must:
1. use an explicit rule version;
2. add an exact regression fixture from the disputed text;
3. assert the final token list, not only the total count;
4. retain the 14/15 boundary test;
5. retain the Google Review compatibility re-export test;
6. avoid storing review text merely for audit convenience.

If a browser or Node runtime tokenizes a disputed term differently, the business fixture wins.
