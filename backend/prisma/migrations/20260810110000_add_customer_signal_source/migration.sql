-- CustomerSignal.source is present in the Prisma schema but was omitted from
-- the original CustomerSignal migration. Preserve existing rows by applying
-- the schema default while adding the non-null column.
CREATE TYPE "CustomerSignalSource" AS ENUM ('NAME_CHANGE', 'MESSAGE_ANALYSIS', 'BM_NOTE', 'AI_ANALYSIS');

ALTER TABLE "CustomerSignal"
ADD COLUMN "source" "CustomerSignalSource" NOT NULL DEFAULT 'NAME_CHANGE';
