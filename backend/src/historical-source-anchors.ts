import { Prisma } from "@prisma/client";

/** Ephemeral read destination only; this never creates or rewrites a crosswalk. */
export function provenHistoricalSourceAnchorsSql(
  start: Date,
  scope: { storeId?: string; lineOfficialAccountId?: string } = {},
): Prisma.Sql {
  const historicalScope = [Prisma.sql`h."sentAt" >= ${start}`];
  const canonicalScope: Prisma.Sql[] = [];
  if (scope.storeId) {
    historicalScope.push(Prisma.sql`h."storeId" = ${scope.storeId}`);
    canonicalScope.push(Prisma.sql`c."storeId" = ${scope.storeId}`);
  }
  if (scope.lineOfficialAccountId) {
    historicalScope.push(Prisma.sql`h."lineOfficialAccountId" = ${scope.lineOfficialAccountId}`);
    canonicalScope.push(Prisma.sql`c."lineOfficialAccountId" = ${scope.lineOfficialAccountId}`);
  }
  return Prisma.sql`
    WITH canonical_sources AS MATERIALIZED (
      SELECT c."id" AS "conversationId", c."storeId", c."lineOfficialAccountId",
        m."direction", m."messageType", m."deliveryStatus", m."originalText", m."sentAt",
        regexp_replace(identity."sourceId", '^line-chat-manager:', '') AS "sourceId"
      FROM public."Message" m
      JOIN public."Conversation" c ON c."id" = m."conversationId"
      CROSS JOIN LATERAL (VALUES
        (m."externalMessageId"),
        (CASE WHEN jsonb_typeof(m."rawPayload"->'providerMessageId') = 'string'
          THEN m."rawPayload"->>'providerMessageId' END),
        (CASE WHEN jsonb_typeof(m."rawPayload"->'managerMessageId') = 'string'
          THEN m."rawPayload"->>'managerMessageId' END)
      ) identity("sourceId")
      WHERE identity."sourceId" IS NOT NULL AND btrim(identity."sourceId") <> ''
        ${canonicalScope.length ? Prisma.sql`AND ${Prisma.join(canonicalScope, " AND ")}` : Prisma.empty}
    ), candidates AS (
      SELECT h."storeId", h."lineOfficialAccountId", h."lineChatUserId",
        min(c."conversationId") AS "canonicalConversationId"
      FROM public."HistoricalTimelineMessage" h
      JOIN canonical_sources c
        ON c."storeId" = h."storeId" AND c."lineOfficialAccountId" = h."lineOfficialAccountId"
        AND c."sourceId" = regexp_replace(h."sourceEventId", '^line-chat-manager:', '')
      WHERE ${Prisma.join(historicalScope, " AND ")}
      GROUP BY h."storeId", h."lineOfficialAccountId", h."lineChatUserId"
      HAVING count(DISTINCT c."conversationId") = 1
        AND bool_and(coalesce(c."messageType" = 'TEXT' AND c."deliveryStatus" = 'DELIVERED'
          AND c."originalText" = h."text" AND c."direction" = h."direction"
          AND abs(extract(epoch FROM (c."sentAt" - h."sentAt"))) <= 1, false))
    )
    SELECT a.* FROM candidates a
    WHERE NOT EXISTS (
      SELECT 1 FROM public."Conversation" direct
      WHERE direct."storeId" = a."storeId" AND direct."lineOfficialAccountId" = a."lineOfficialAccountId"
        AND direct."lineChatUserId" = a."lineChatUserId" AND direct."id" <> a."canonicalConversationId"
    ) AND NOT EXISTS (
      SELECT 1 FROM public."HistoricalConversationCrosswalk" x
      WHERE x."storeId" = a."storeId" AND x."lineOfficialAccountId" = a."lineOfficialAccountId"
        AND x."historicalLineChatUserId" = a."lineChatUserId" AND x."classification" = 'LINK_SAFE'
        AND x."canonicalConversationId" IS NOT NULL AND x."canonicalConversationId" <> a."canonicalConversationId"
    )
  `;
}

export type HistoricalSourceAnchor = {
  storeId: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  canonicalConversationId: string;
};
