-- Additive nullable enum-backed source tag; existing conversations remain unchanged.
CREATE TYPE "ConversationSourceChannel" AS ENUM ('STORE', 'ONLINE');

ALTER TABLE "Conversation"
ADD COLUMN "sourceChannel" "ConversationSourceChannel";
