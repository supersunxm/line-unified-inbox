-- Existing nullable identity fields are sufficient; enforce their OA scope at
-- the database boundary so legacy writers cannot race a safe bridge claim.
-- NULL chat IDs remain unrestricted. No backfill or existing row modification.
CREATE UNIQUE INDEX CONCURRENTLY "Conversation_oa_chat_identity_key"
ON "Conversation" ("lineOfficialAccountId", "lineChatUserId");
