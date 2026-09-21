-- Production observation on 2026-09-21 showed LINE OA Manager inbound chat
-- history rows use eventType = 'message', while staff replies use 'messageSent'.
-- Reclassify already mirrored shadow rows without changing canonical messages.
UPDATE "LineChatMirrorMessage"
SET "direction" = 'INBOUND'
WHERE "direction" = 'UNKNOWN'
  AND lower("eventType") = 'message';
