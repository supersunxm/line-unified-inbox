/**
 * Project MUI A migration boundary.
 *
 * The pilot is frontend-only and must not alter Store Chats business behavior.
 * Keeping this contract in code makes the scope reviewable before MUI is wired.
 */

export const PROJECT_MUI_A = {
  name: "Project MUI A",
  pilotSurface: "Store Chats",
  runtimeEnabled: true,
  allowedAreas: [
    "frontend/src/mui",
    "frontend/src/components/ui",
    "frontend/src/components/shell",
    "frontend/src/app/layout.tsx",
    "frontend/src/app/globals.css",
    "frontend/package.json",
    "frontend/package-lock.json",
  ],
  protectedAreas: [
    "backend/src/line-chat",
    "AI_PROGRESS.md",
    "DECISIONS.md",
  ],
  behaviorThatMustRemainUnchanged: [
    "LINE Manager mirror behavior",
    "historical backfill behavior",
    "realtime message subscription",
    "conversation query and pagination",
    "BM reply status transitions",
    "assignment logic",
    "message send behavior",
    "LINE OA manager deep-link behavior",
  ],
} as const;
