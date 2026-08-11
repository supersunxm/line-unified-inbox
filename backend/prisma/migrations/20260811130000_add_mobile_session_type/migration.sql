-- Existing browser sessions remain WEB by default. No session tokens are modified.
CREATE TYPE "SessionType" AS ENUM ('WEB', 'MOBILE');

ALTER TABLE "Session"
  ADD COLUMN "sessionType" "SessionType" NOT NULL DEFAULT 'WEB';
