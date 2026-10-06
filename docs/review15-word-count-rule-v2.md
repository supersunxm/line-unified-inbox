# Review 15 Word Counting Rule V2

Canonical rule version: `THAI_REVIEW_WORDS_V2`

This document is the business contract for both:
- the public `/review15` / `/รีวิว15คำ` checker; and
- Google Review KPI qualification tooling.

Both consumers MUST use `frontend/src/lib/thai-word-counter.ts`. The Google Review checker compatibility module re-exports that implementation and must not maintain a second tokenizer.

## Counting pipeline

1. Clean Google Maps UI noise such as translation, like/share/reply, and equivalent Thai labels.
2. Protect business-approved lexical units before segmentation. A protected lexical unit always counts as exactly one word even if `Intl.Segmenter("th")` would split it.
3. Segment remaining text with `Intl.Segmenter("th", { granularity: "word" })`.
4. Exclude empty tokens, punctuation/symbol-only tokens, emoji-only tokens, Google UI words, and pure numbers.
5. Keep alphanumeric tokens that contain a letter. Example: `5G` counts; `14` does not.
6. Apply the existing compound dictionary.
7. Merge approved Thai compound prefixes: การ, ความ, น่า, ผู้, นัก, ชาว, ช่าง.
8. A review passes the word-count threshold when final token count is **15 or more**.

## Protected lexical units in V2

These are explicit business rules, not assumptions delegated to the browser tokenizer:

| Text | Count |
| --- | ---: |
| โปรโมชั่น | 1 |
| สมาร์ทโฟน | 1 |
| ประทับใจ | 1 |
| โปรโมชั่นพิเศษ | 2 (โปรโมชั่น + พิเศษ) |

New protected terms must be added only with an audit fixture that states the expected final tokens.

## Existing compound dictionary

The canonical counter also merges these exact token sequences:
- ท่อง + เที่ยว → ท่องเที่ยว
- ต่าง + ชาติ → ต่างชาติ
- โรง + พยาบาล → โรงพยาบาล
- เครื่อง + ใช้ → เครื่องใช้
- แม่ + บ้าน → แม่บ้าน

## Google Review KPI parity

The 15-word calculation is identical to the public checker. Google Review KPI qualification then applies additional conditions:

`qualified = !edited && hasCustomerPhoto && imageCaptureMonth === targetMonth && finalWordCount >= 15`

Word-count parity is non-negotiable: the same review text must produce the same `finalTokens` and `count` in the public checker and Google Review tooling.

## Audit policy

Every rule change must:
1. change or retain an explicit rule version;
2. add deterministic fixtures for disputed Thai words/phrases;
3. test the 14/15 boundary;
4. test the Google Review compatibility re-export;
5. avoid persisting review text merely for word-count auditing.

When an operator disputes a count, audit the exact final token list first. Do not fix a single screenshot by changing UI-only behavior.
