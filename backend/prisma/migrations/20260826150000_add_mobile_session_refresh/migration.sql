ALTER TABLE "Session"
ADD COLUMN "refreshTokenHash" TEXT,
ADD COLUMN "refreshExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
