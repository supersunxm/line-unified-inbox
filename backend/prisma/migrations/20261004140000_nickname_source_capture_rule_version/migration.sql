-- Existing immutable checkpoints were captured by the first deployed v1 collector.
-- Preserve their provenance; new collectors explicitly provide their rule version.
ALTER TABLE "NicknameSourceCapture"
ADD COLUMN "ruleVersion" TEXT NOT NULL DEFAULT 'manager-source-v1';
