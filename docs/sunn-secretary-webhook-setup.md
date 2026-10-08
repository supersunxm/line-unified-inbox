# Sunn Secretary dedicated LINE webhook — Phase 3 security increment

This PR includes **only pure security primitives**; it does not expose a webhook route or send LINE messages. Default production behavior remains unchanged.

## Setup checklist for the existing เลขาซันน์ LINE OA

1. Enable Messaging API for its dedicated channel.
2. Keep the dedicated Channel Secret and Channel Access Token in Railway **sealed variables** (not GitHub, chat or CI outputs).
3. Verify bot basic user ID (U + 32 hex), owner LINE user ID, and consenting pilot LINE group ID with an authenticated setup flow. No IDs should be guessed from nicknames.
4. On the eventual dedicated endpoint, require exact raw-body LINE HMAC signature verification before parsing JSON; validate destination and event schema; reject malformed events.
5. Require a real LINE mention entity addressed to the configured bot plus group ID and sender user ID allowlists.
6. Reject missing webhookEventId. Use **persistent** event deduplication (database uniqueness, not in-memory) before executing any query or LINE reply; separate retries, errors, telemetry and response timeouts.
7. Existing monthly summary is `ConversationsService.getBmReplyStatusSummary(explicitAuthorizedStoreIds, month)`. Never allow a null/global scope. Compare numbers with the authorized Dashboard month.
8. Keep the eventual live handler feature-flagged OFF until its secure config, privacy notice, production deploy and single-group parity test have passed.
9. Reply token is short-lived and can be used once; support LINE reply failures safely and do not retry blindly with a reused reply token.
10. Do not enable automation to access private personal LINE chat history. This official bot handles invited groups only.

## Follow-up after security review

Wire the primitives into an isolated controller/module, server-side metrics adapter and persistent dedupe. Keep current store LINE webhook and all mirror workers untouched. Add integration tests with forged signature, unauthorized group/sender, duplicate event, disabled flag, AI hallucination prevention and LINE API error conditions.
