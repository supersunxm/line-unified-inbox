-- v2 (B3): Parser v4 derived tags and re-derive runs. Two new tables only; no existing table changes.

-- CreateTable
CREATE TABLE "NicknameTagV4" (
    "conversationId" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sourceObservationId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "derivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT NOT NULL,
    "source" TEXT,
    "customerType" TEXT,
    "paymentMethod" TEXT,
    "financeProvider" TEXT,
    "services" TEXT[],
    "productModelIds" TEXT[],
    "periodYear" INTEGER,
    "periodMonth" INTEGER,
    "eventDate" DATE,
    "hasFreeText" BOOLEAN NOT NULL DEFAULT false,
    "conflicts" TEXT[],
    "ruleIds" TEXT[],

CONSTRAINT "NicknameTagV4_pkey" PRIMARY KEY ("conversationId","parserVersion")
);

-- CreateTable
CREATE TABLE "NicknameTagRederiveRun" (
    "id" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "cursor" TEXT,
    "watermark" TIMESTAMP(3),
    "batches" INTEGER NOT NULL DEFAULT 0,
    "counts" JSONB NOT NULL,

CONSTRAINT "NicknameTagRederiveRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NicknameTagV4_parserVersion_storeId_idx" ON "NicknameTagV4"("parserVersion", "storeId");

-- CreateIndex
CREATE INDEX "NicknameTagRederiveRun_parserVersion_startedAt_idx" ON "NicknameTagRederiveRun"("parserVersion", "startedAt");
