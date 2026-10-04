# Independent nickname-derived Source Tag — manager-source-v1

Owner decision: this metadata is independent of sales/operational status. Conversation.onlineSource, its validation, clearing and existing sales UI retain their ONLINE-only contract. No backfill derives a Source Tag from onlineSource, Customer.displayName, MirrorChat.displayName or customer text.

## Data and provenance

- NicknameSourceState is one current metadata row per Conversation: tag, ruleVersion, sourceObservationId, lastObservedAt. Capturing evidence may advance lastObservedAt but never changes tag.
- NicknameSourceObservation preserves the explicit profile.nickname value/read status, exact Store/OA/chat identity, optional uniquely proven destination, observedAt, parsedTag, rule/version, snapshot classification, previousTag and resultingTag. Capture resultingTag equals previousTag because capture does not apply.
- NicknameSourceCapture is an OA checkpoint, including successful empty windows. It states BOUNDED_RECENT coverage; it never asserts full chat-history enumeration.
- NicknameSourceApplication is an append-only appliedAt/previous/resulting Tag/manifest receipt. Evidence and receipts are immutable at the PostgreSQL boundary. Current state's source reference points to the fresh authoritative observation used at apply; receipts retain the original frozen manifest observation.
- Old conversations without any nickname observation remain valid and have no invented Source Tag. Ordinary sales APIs cannot set this metadata. UI adds a separate read-only Source badge beside existing sales tags.

## Frozen parsing rules

The entire normalized nickname must match `<source> <MM/YY>`. Supported aliases are TikTok, Facebook, Instagram, IG, LINE, Website, Lemon8, compared case-insensitively; IG maps to Instagram. Month has exactly two digits 01–12; year has exactly two digits. Leading/trailing whitespace and internal Unicode whitespace runs normalize to one space. Control characters, unreadable/malformed/missing values, and values over 1000 characters are UNKNOWN. An explicitly readable null/empty nickname is NO_TAG_SIGNAL.

Each single signal emits `SOURCE_PERIOD_<canonical Tag>` with exact deterministic confidence. The grammar is frozen in its own versioned parser, independent of future changes to the legacy sales-nickname parser. Arbitrary platform-like words, custom Other values, invalid dates, unproven punctuation, Film/purchase nicknames and literal Online are not source signals.

AMBIGUOUS accepts only an entire explicit source list sharing a valid period or an entire sequence of complete source+period signals. Delimiters for source lists are spaces, commas, semicolons, plus, pipe and slash; complete repeated signals allow the same delimiters except slash. Multiple signals, including repeated identical signals, are held. No arbitrary text word search occurs.

Every observation has exactly one of TAG_MAPPED, TAG_NEEDS_UPDATE, NO_TAG_SIGNAL, AMBIGUOUS, IDENTITY_CONFLICT or UNKNOWN. Exact identity failure takes precedence over parsing classification. Dynamic audit reclassifies immutable evidence against current independent Tag state, so successful apply/rerun becomes TAG_MAPPED without rewriting the original evidence.

NO_TAG_SIGNAL, AMBIGUOUS, IDENTITY_CONFLICT and UNKNOWN never enter a write manifest and never clear or replace the last proven Tag. Only a later deterministic supported signal through the mapping path changes it.

## Identity and passive capture

Require exact lineOfficialAccountId + lineChatUserId, exactly one Conversation, and the same current active Store/OA. A chat ID under a different OA is a different identity. Same nickname/display name is never identity evidence. Initial implementation is DIRECT only; no Historical crosswalk or identity link is written or guessed.

Capture is a memory-only enqueue after the existing Manager recent read succeeds. It creates no Manager request, context, browser owner, profile lease or fleet sweep. Persistence runs only during Mirror cooldown; it rechecks cycle activity between bounded snapshots. A failed capture retries during the next cooldown, independently of Mirror health. An interrupted process resumes through subsequent natural reads; no checkpoint is claimed for data lost before persistence. A queue cap fails visibly without creating false coverage. Incremental profile occupancy is zero by construction; actual DB persistence time is separately observable.

Nickname differences between duplicated Manager page entries invalidate only nickname evidence. They do not change existing display-name/message duplicate health comparisons or introduce a Mirror partial/failure merely because staff changed a nickname.

## Read-only audit and immutable apply

Authenticated worker GET `/internal/line-chat/nickname-source/audit?since=<ISO instant>` returns aggregate counts only. It is database-enforced READ ONLY and rejects POST. The operator CLI `dist/line-chat/nickname-source.cli.js` supports audit, manifest, dry-run and apply; audit needs --since. Manifest needs --since and --file and creates a private file exclusively, never overwriting it. Raw evidence/manifests must stay outside Git.

Manifest creation requires 144 eligible and 144 passively scanned OAs plus unexplained=0. It selects only exact deterministic TAG_NEEDS_UPDATE rows. Each file preserves OA/chat/Store/destination, observation ID/time, nickname/hash, previous/expected Tag and rule/version. It has row/OA/Store counts and canonical row-set SHA-256; the CLI reports SHA-256 over actual file bytes. Dry-run/apply require matching --file and --sha256 and validate all frozen counts, uniqueness and parser evidence before DB consideration.

Apply is never automatically scheduled. Production quality/samples and canary gates must be established before invoking it. --offset and --limit select bounded rows within the frozen manifest; the hard limit is 25. Outside-manifest rows considered is zero. Health gates require the same 144 active eligible OAs, normal SUCCESS/RUNNING state and fresh successful scheduled evidence; scope/identity/Tag/health changes abort the batch.

Immediately before each row, a SERIALIZABLE transaction rechecks active Store/OA, unique destination, frozen evidence, current Tag and the latest authoritative nickname observation. The latest read must occur AFTER manifest freeze, remain within two hours, have the same exact nickname hash, rule and destination, and parse to the same Tag. Changed evidence is STALE_OBSERVATION and is skipped; absent fresh evidence is AWAITING_FRESH_OBSERVATION. Unexpected existing Tag, changed scope or identity aborts. Only Source state and its receipt are written. Every apply reads back before commit. Rerun returns ALREADY_CORRECT with zero additional writes.

## Rollout gates still required

Local synthetic fixtures cannot establish production fleet counts or quality. After normal GitHub CI/merge/Railway delivery, observe natural scheduled fleet cycles, wait for persisted passive coverage of all 144 OAs, audit, validate actual Manager evidence and exact destinations, freeze a canary/manifest, wait for fresh passive revalidation, dry-run/apply/read-back/rerun, then repeat bounded fleet batches. No forced Mirror cycle or aggressive continuous scan is permitted.

The initial passive recent-window coverage must be reported explicitly; it is not all Manager chats or Historical recollection. Supported Tags absent from production and unresolved identities remain explicit exceptions rather than fabricated samples or mappings. Continuous automatic Tag application remains unscheduled until initial acceptance and measured costs justify a cadence.
