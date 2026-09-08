# Store ID canonical export audit

Store ID is the canonical business identifier for every store-facing export and download.

Rules:

1. Resolve Store ID from Store Master `externalStoreId` first.
2. Never replace an existing Store ID by matching store name, LINE account name, LINE ID, or internal database UUID.
3. If canonical Store ID is missing or ambiguous where one is required, fail safely and surface the issue; do not guess.
4. Downstream exports must carry the same canonical Store ID used by Store Master sync.
5. Export regression tests should cover LINE OA CSV, Follower Insights, Google Review weekly export, TikTok/report exports, and shared export helpers.

This audit document intentionally treats internal UUIDs only as implementation identifiers, never as Store ID substitutes.
