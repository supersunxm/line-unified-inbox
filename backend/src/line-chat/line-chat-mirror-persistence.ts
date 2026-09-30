import { randomUUID } from "node:crypto";
import { LineChatMirrorDirection, Prisma } from "@prisma/client";

export interface LineChatMirrorPersistEvent {
  managerMessageId: string;
  eventType: string;
  direction: LineChatMirrorDirection;
  messageType: string | null;
  text: string | null;
  fileName: string | null;
  bizId: string | null;
  ownerName: string | null;
  sentAt: Date;
}

export async function persistLineChatMirrorHistoryBatch(
  executeRaw: (query: Prisma.Sql) => Promise<number>,
  input: {
    lineOfficialAccountId: string;
    lineChatUserId: string;
    events: readonly LineChatMirrorPersistEvent[];
  },
): Promise<number> {
  const uniqueEvents = [...new Map(input.events
    .filter((event) => Number.isFinite(event.sentAt.getTime()))
    .map((event) => [event.managerMessageId, event])).values()];

  for (let offset = 0; offset < uniqueEvents.length; offset += 100) {
    const chunk = uniqueEvents.slice(offset, offset + 100);
    const values = chunk.map((event) => Prisma.sql`(
      ${randomUUID()}, ${input.lineOfficialAccountId}, ${input.lineChatUserId},
      ${event.managerMessageId}, ${event.eventType}, ${event.direction}::"LineChatMirrorDirection",
      ${event.messageType}, ${event.text}, ${event.fileName}, ${event.bizId}, ${event.ownerName},
      ${event.sentAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )`);
    await executeRaw(Prisma.sql`
      INSERT INTO "LineChatMirrorMessage" AS existing (
        "id", "lineOfficialAccountId", "lineChatUserId", "managerMessageId", "eventType",
        "direction", "messageType", "text", "fileName", "bizId", "ownerName", "sentAt",
        "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt"
      ) VALUES ${Prisma.join(values)}
      ON CONFLICT ("lineOfficialAccountId", "managerMessageId") DO UPDATE SET
        "lineChatUserId" = EXCLUDED."lineChatUserId",
        "eventType" = EXCLUDED."eventType",
        "direction" = EXCLUDED."direction",
        "messageType" = EXCLUDED."messageType",
        "text" = EXCLUDED."text",
        "fileName" = EXCLUDED."fileName",
        "bizId" = EXCLUDED."bizId",
        "ownerName" = EXCLUDED."ownerName",
        "sentAt" = EXCLUDED."sentAt",
        "lastSeenAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CASE
          WHEN ROW(
            existing."lineChatUserId", existing."eventType", existing."direction",
            existing."messageType", existing."text", existing."fileName", existing."bizId",
            existing."ownerName", existing."sentAt"
          ) IS DISTINCT FROM ROW(
            EXCLUDED."lineChatUserId", EXCLUDED."eventType", EXCLUDED."direction",
            EXCLUDED."messageType", EXCLUDED."text", EXCLUDED."fileName", EXCLUDED."bizId",
            EXCLUDED."ownerName", EXCLUDED."sentAt"
          ) THEN CURRENT_TIMESTAMP
          ELSE existing."updatedAt"
        END
    `);
  }
  return uniqueEvents.length;
}
