# Fleet exact mapping duplicate-target behavior

Production discovery showed one OA exact-match target appears in both authenticated Manager sessions. The mapping applier must not fail the entire safe batch for this condition.

Expected behavior:
- If exactly one APPLY candidate targets an OA, it remains APPLY.
- If multiple APPLY candidates target the same OA, every candidate for that OA becomes SKIP_AMBIGUOUS_SESSION.
- No existing mapping is overwritten.
- Ambiguous duplicate targets are excluded from the transaction while all other safe exact mappings may proceed.
