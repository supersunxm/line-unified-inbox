CREATE TYPE "LineAccountType" AS ENUM ('STORE', 'HEAD_OFFICE');

ALTER TABLE "LineOfficialAccount"
ADD COLUMN "accountType" "LineAccountType" NOT NULL DEFAULT 'STORE';

ALTER TABLE "LineOfficialAccount" ALTER COLUMN "storeId" DROP NOT NULL;
ALTER TABLE "Conversation" ALTER COLUMN "storeId" DROP NOT NULL;

ALTER TABLE "User"
ADD COLUMN "canAccessMainOa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canManageMainOa" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "LineOfficialAccount_accountType_isActive_archivedAt_idx"
ON "LineOfficialAccount"("accountType", "isActive", "archivedAt");

CREATE INDEX "Conversation_lineOfficialAccountId_customerId_idx"
ON "Conversation"("lineOfficialAccountId", "customerId");

ALTER TABLE "LineOfficialAccount"
ADD CONSTRAINT "LineOfficialAccount_account_type_store_check"
CHECK (
  ("accountType" = 'STORE' AND "storeId" IS NOT NULL) OR
  ("accountType" = 'HEAD_OFFICE' AND "storeId" IS NULL)
);

ALTER TABLE "User"
ADD CONSTRAINT "User_main_oa_manage_requires_access_check"
CHECK (NOT "canManageMainOa" OR "canAccessMainOa");
