-- Additive PIN credential state. Existing employees remain password-compatible
-- and receive no PIN until they explicitly enroll.
ALTER TABLE "User"
  ADD COLUMN "pinHash" TEXT,
  ADD COLUMN "pinEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pinLockedUntil" TIMESTAMP(3),
  ADD COLUMN "pinUpdatedAt" TIMESTAMP(3);
