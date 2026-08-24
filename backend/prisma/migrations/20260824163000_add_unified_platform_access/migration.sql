ALTER TABLE "User"
ADD COLUMN "canAccessWeb" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "canAccessMobile" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "canAccessHq" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canAccessAllStores" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canManageAccounts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canReply" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET
  "canAccessWeb" = CASE WHEN "status" = 'DELETED' THEN false ELSE true END,
  "canAccessMobile" = CASE WHEN "status" = 'DELETED' THEN false ELSE true END,
  "canAccessHq" = CASE WHEN "role" = 'ADMIN' THEN true ELSE false END,
  "canAccessAllStores" = CASE WHEN "role" = 'ADMIN' THEN true ELSE false END,
  "canManageAccounts" = CASE WHEN "role" = 'ADMIN' THEN true ELSE false END,
  "canReply" = CASE
    WHEN "status" = 'DELETED' THEN false
    WHEN "role" = 'ADMIN' THEN true
    WHEN EXISTS (
      SELECT 1
      FROM "UserStoreMembership" m
      JOIN "Store" s ON s."id" = m."storeId"
      WHERE m."userId" = "User"."id"
        AND m."status" = 'ACTIVE'
        AND s."isActive" = true
        AND s."archivedAt" IS NULL
    ) THEN true
    ELSE false
  END;

ALTER TABLE "User"
ADD CONSTRAINT "User_manage_accounts_requires_hq_check"
CHECK (NOT "canManageAccounts" OR "canAccessHq");
