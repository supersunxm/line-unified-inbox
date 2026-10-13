-- Expand/contract retirement: stop granting the retired platform to new users.
-- Existing users, sessions, conversation history, message delivery and profiles
-- are intentionally unchanged. Retired tables remain available for archival.
ALTER TABLE "User" ALTER COLUMN "canAccessMobile" SET DEFAULT false;

-- Retain the complete release catalogue, but mark distribution inactive.
UPDATE "AppRelease" SET "isActive" = false WHERE "isActive" = true;
