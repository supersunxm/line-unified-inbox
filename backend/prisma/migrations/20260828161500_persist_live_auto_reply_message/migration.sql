-- Persist successful LIVE inbound-text auto replies into the canonical conversation.
-- This keeps the web/mobile inbox consistent with what the customer actually received on LINE.

CREATE OR REPLACE FUNCTION persist_live_auto_reply_message()
RETURNS TRIGGER AS $$
DECLARE
  v_rule "AutoResponseRule"%ROWTYPE;
  v_store_id TEXT;
  v_store_code TEXT;
  v_external_store_id TEXT;
  v_sent_at TIMESTAMP(3);
BEGIN
  -- Only act on the first transition to a successful LIVE send.
  IF NEW."outcome" IS DISTINCT FROM 'SENT'::"AutoResponseExecutionOutcome"
     OR NEW."mode" IS DISTINCT FROM 'LIVE'::"AutoResponsePilotMode"
     OR NEW."conversationId" IS NULL
     OR NEW."ruleId" IS NULL
     OR (OLD."outcome" = 'SENT'::"AutoResponseExecutionOutcome" AND OLD."status" = 'SUCCESS'::"AutoResponseExecutionStatus") THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_rule
  FROM "AutoResponseRule"
  WHERE "id" = NEW."ruleId";

  IF NOT FOUND
     OR v_rule."triggerType" <> 'INBOUND_TEXT'::"AutoResponseTriggerType"
     OR v_rule."contentType" <> 'TEXT'::"AutoResponseContentType"
     OR v_rule."textTemplate" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c."storeId", s."code", sm."externalStoreId"
    INTO v_store_id, v_store_code, v_external_store_id
  FROM "Conversation" c
  LEFT JOIN "Store" s ON s."id" = c."storeId"
  LEFT JOIN "StoreMaster" sm ON sm."id" = s."storeMasterId"
  WHERE c."id" = NEW."conversationId";

  -- Keep this repair scoped to the approved Robinson Chonburi pilot only.
  IF v_store_id IS NULL
     OR v_store_code IS DISTINCT FROM '28375'
     OR v_external_store_id IS DISTINCT FROM '28375' THEN
    RETURN NEW;
  END IF;

  v_sent_at := NOW();

  INSERT INTO "Message" (
    "id",
    "conversationId",
    "externalMessageId",
    "direction",
    "messageType",
    "originalText",
    "rawPayload",
    "senderUserId",
    "senderDisplayName",
    "sentAt",
    "createdAt"
  ) VALUES (
    'auto-reply:' || NEW."id",
    NEW."conversationId",
    NULL,
    'OUTBOUND'::"MessageDirection",
    'TEXT'::"MessageType",
    v_rule."textTemplate",
    jsonb_build_object(
      'source', 'AUTO_RESPONSE',
      'autoResponseExecutionId', NEW."id",
      'autoResponseRuleId', NEW."ruleId",
      'intent', NEW."intent",
      'mode', NEW."mode"
    ),
    NULL,
    'Auto Reply Bot',
    v_sent_at,
    v_sent_at
  )
  ON CONFLICT ("id") DO NOTHING;

  UPDATE "Conversation"
  SET
    "bmReplyStatus" = 'REPLIED'::"BmReplyStatus",
    "latestMessageAt" = GREATEST("latestMessageAt", v_sent_at),
    "updatedAt" = v_sent_at
  WHERE "id" = NEW."conversationId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AutoResponseExecution_persist_live_auto_reply" ON "AutoResponseExecution";

CREATE TRIGGER "AutoResponseExecution_persist_live_auto_reply"
AFTER UPDATE OF "status", "outcome" ON "AutoResponseExecution"
FOR EACH ROW
WHEN (NEW."status" = 'SUCCESS'::"AutoResponseExecutionStatus" AND NEW."outcome" = 'SENT'::"AutoResponseExecutionOutcome")
EXECUTE FUNCTION persist_live_auto_reply_message();
