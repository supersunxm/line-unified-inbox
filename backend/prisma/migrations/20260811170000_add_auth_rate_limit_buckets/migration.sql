CREATE TABLE "AuthRateLimitBucket" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthRateLimitBucket_key_windowStart_key" ON "AuthRateLimitBucket"("key", "windowStart");
CREATE INDEX "AuthRateLimitBucket_updatedAt_idx" ON "AuthRateLimitBucket"("updatedAt");
