# Review 15 Word Counting Rule V4

Canonical rule version: `THAI_REVIEW_WORDS_V4`

V4 is a narrow audit-driven extension of V3. It fixes three compound terms found in the second production audit screenshot without changing any other Google Review KPI condition.

## New locked compounds

| Input | Expected final tokens | Count |
| --- | --- | ---: |
| `คำแนะนำ` | `คำแนะนำ` | 1 |
| `ของแถม` | `ของแถม` | 1 |
| `ใช้บริการ` | `ใช้บริการ` | 1 |

Context fixtures:

- `พนักงานให้คำแนะนำดีมาก` → `พนักงาน / ให้ / คำแนะนำ / ดี / มาก`
- `ของแถมเยอะมาก` → `ของแถม / เยอะ / มาก`
- `กลับมาใช้บริการอีก` → `กลับ / มา / ใช้บริการ / อีก`

## Full production audit fixture

Input:

`วันนี้มาซื้อOPPOReno14Pro5Gโปรโมชั่นดีมากพนักงานให้คำแนะนำละเอียดใช้งานง่ายสมาร์ทโฟนเครื่องนี้กล้องสวยแบตอึดชาร์จเร็วของแถมเยอะราคาคุ้มบริการดีมากประทับใจและจะกลับมาใช้บริการอีก`

Expected count: **38 words**.

The exact token list is regression-tested in `frontend/test/review-15-checker.test.mts`.

## Contract

- `frontend/src/lib/thai-word-counter.ts` remains the single canonical word-count implementation.
- The public 15-word checker and Google Review KPI tooling must continue to use this same implementation.
- Future exceptions require an exact production/audit fixture and expected final tokens.
- V4 does not change image-month, customer-photo, edited-review, or any other Google Review qualification rule.
