from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


def append_section(path: str, marker: str, section: str) -> None:
    content = read(path)
    if marker in content:
        return
    write(path, content.rstrip() + "\n\n" + section.strip() + "\n")


# ---------------------------------------------------------------------------
# Shared desktop focus-group definition.
# ---------------------------------------------------------------------------
write(
    "frontend/src/lib/focus-store-group.ts",
    '''export const FOCUS_STORE_GROUP_ID = "focus-seven-store-group";
export const FOCUS_STORE_GROUP_ROUTE_PARAM = "focusGroup";
export const FOCUS_STORE_GROUP_ROUTE_VALUE = "priority-seven";
export const FOCUS_STORE_GROUP_SIZE = 7;

export type FocusStoreGroupLanguage = "th" | "en" | "zh";

const COPY: Record<FocusStoreGroupLanguage, { label: string; subtitle: string }> = {
  th: {
    label: "กลุ่มโฟกัส 7 ร้าน",
    subtitle: "รวมแชท 7 ร้านที่ต้องโฟกัสเป็นพิเศษ",
  },
  en: {
    label: "Focus group · 7 stores",
    subtitle: "Combined chats from 7 priority stores",
  },
  zh: {
    label: "重点 7 家门店",
    subtitle: "汇总 7 家重点门店的聊天",
  },
};

export function getFocusStoreGroupCopy(language: FocusStoreGroupLanguage) {
  return COPY[language];
}
''',
)

write(
    "frontend/test/focus-store-group.test.mts",
    '''import assert from "node:assert/strict";
import test from "node:test";

import {
  FOCUS_STORE_GROUP_ID,
  FOCUS_STORE_GROUP_ROUTE_PARAM,
  FOCUS_STORE_GROUP_ROUTE_VALUE,
  FOCUS_STORE_GROUP_SIZE,
  getFocusStoreGroupCopy,
} from "../src/lib/focus-store-group.ts";

test("focus store group uses a virtual id and a desktop-only route marker", () => {
  assert.equal(FOCUS_STORE_GROUP_ID, "focus-seven-store-group");
  assert.equal(FOCUS_STORE_GROUP_ROUTE_PARAM, "focusGroup");
  assert.equal(FOCUS_STORE_GROUP_ROUTE_VALUE, "priority-seven");
  assert.equal(FOCUS_STORE_GROUP_SIZE, 7);
});

test("focus store group copy is available in all desktop languages", () => {
  assert.match(getFocusStoreGroupCopy("th").label, /7 ร้าน/);
  assert.match(getFocusStoreGroupCopy("en").label, /7 stores/);
  assert.match(getFocusStoreGroupCopy("zh").label, /7 家门店/);
});
''',
)

# ---------------------------------------------------------------------------
# Desktop context sidebar: a prominent, virtual focus-group card.
# ---------------------------------------------------------------------------
replace_once(
    "frontend/src/components/shell/context-sidebar.tsx",
    'import { formatWaitingDuration, getSlaRiskVariant, type StoreBmCountsItem } from "./store-priority-score.ts";\n',
    'import { formatWaitingDuration, getSlaRiskVariant, type StoreBmCountsItem } from "./store-priority-score.ts";\nimport { FOCUS_STORE_GROUP_ID } from "@/lib/focus-store-group";\n',
)

replace_once(
    "frontend/src/components/shell/context-sidebar.tsx",
    '  clearAllFilters: () => void;\n  stores: Array<{ id: string; storeId?: string | null; masterStoreId?: string | null; externalStoreId?: string | null; name: string; waiting: number; lineOaCount: number; code?: string; accountName?: string }>;\n',
    '  clearAllFilters: () => void;\n  focusGroupLabel: string;\n  focusGroupSubtitle: string;\n  stores: Array<{ id: string; storeId?: string | null; masterStoreId?: string | null; externalStoreId?: string | null; name: string; waiting: number; lineOaCount: number; code?: string; accountName?: string }>;\n',
)

replace_once(
    "frontend/src/components/shell/context-sidebar.tsx",
    '  clearAllFilters,\n  stores,\n',
    '  clearAllFilters,\n  focusGroupLabel,\n  focusGroupSubtitle,\n  stores,\n',
)

replace_once(
    "frontend/src/components/shell/context-sidebar.tsx",
    '  const totalOverviewCount = (overview.notReplied ?? 0) + (overview.notifiedBm ?? 0) + (overview.replied ?? 0);\n\n  return (\n',
    '''  const totalOverviewCount = (overview.notReplied ?? 0) + (overview.notifiedBm ?? 0) + (overview.replied ?? 0);
  const focusGroupCounts = storeBmCounts[FOCUS_STORE_GROUP_ID];
  const focusGroupTotalCount = focusGroupCounts
    ? focusGroupCounts.notReplied + focusGroupCounts.notifiedBm + focusGroupCounts.replied
    : 0;

  return (
''',
)

focus_card = '''          {focusGroupCounts && (
            <button
              type="button"
              data-focus-store-group
              onClick={() => {
                setSelectedStore(FOCUS_STORE_GROUP_ID);
                selectSidebarView("all");
              }}
              className={`mb-1.5 w-full rounded-[var(--app-radius-md)] border px-2.5 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 ${
                selectedStore === FOCUS_STORE_GROUP_ID
                  ? "border-purple-400/70 bg-purple-50 text-purple-950 shadow-sm dark:border-purple-500/50 dark:bg-purple-950/35 dark:text-purple-100"
                  : "border-purple-200/80 bg-purple-50/55 text-[var(--app-text-primary)] hover:border-purple-300 hover:bg-purple-50 dark:border-purple-900/70 dark:bg-purple-950/20 dark:hover:bg-purple-950/30"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-600 text-[12px] text-white shadow-sm">★</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold">{focusGroupLabel}</span>
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold leading-none text-white">NEW</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-medium text-purple-700/80 dark:text-purple-300/80">{focusGroupSubtitle}</span>
                </span>
                <span className="font-tabular shrink-0 rounded-full border border-purple-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-200">
                  {focusGroupTotalCount}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 pl-8 font-tabular">
                <span className="rounded-[var(--app-radius-xs)] bg-[var(--app-danger-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-danger)]" title="Not Replied">
                  {focusGroupCounts.notReplied}
                </span>
                <span className="rounded-[var(--app-radius-xs)] bg-[#f3e8ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#8e44ec] dark:bg-[#2b1c40] dark:text-[#d8b4fe]" title="Notified BM">
                  {focusGroupCounts.notifiedBm}
                </span>
                <span className="rounded-[var(--app-radius-xs)] bg-[var(--app-success-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-success)]" title="Replied">
                  {focusGroupCounts.replied}
                </span>
              </div>
            </button>
          )}

'''
replace_once(
    "frontend/src/components/shell/context-sidebar.tsx",
    '        <div className="space-y-0.5">\n          <button\n            type="button"\n            onClick={() => setSelectedStore("all")}\n',
    '        <div className="space-y-0.5">\n' + focus_card + '          <button\n            type="button"\n            onClick={() => setSelectedStore("all")}\n',
)

# ---------------------------------------------------------------------------
# Desktop workspace: preserve the virtual selection, render useful copy, and
# keep it out of the mobile route contract.
# ---------------------------------------------------------------------------
replace_once(
    "frontend/src/app/page.tsx",
    'import { ApiError, api } from "@/lib/api";\n',
    'import { ApiError, api } from "@/lib/api";\nimport { FOCUS_STORE_GROUP_ID, FOCUS_STORE_GROUP_ROUTE_PARAM, FOCUS_STORE_GROUP_ROUTE_VALUE, getFocusStoreGroupCopy } from "@/lib/focus-store-group";\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '  const chatsPaginationText = getChatsPaginationText(language);\n',
    '  const chatsPaginationText = getChatsPaginationText(language);\n  const focusStoreGroupCopy = getFocusStoreGroupCopy(language);\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '      const route = readChatRouteFilters(window.location.search);\n      setSelectedStore(route.store ?? "all");\n',
    '''      const route = readChatRouteFilters(window.location.search);
      const routeParams = new URLSearchParams(window.location.search);
      const focusGroupSelected = routeParams.get(FOCUS_STORE_GROUP_ROUTE_PARAM) === FOCUS_STORE_GROUP_ROUTE_VALUE;
      setSelectedStore(focusGroupSelected ? FOCUS_STORE_GROUP_ID : (route.store ?? "all"));
''',
)

replace_once(
    "frontend/src/app/page.tsx",
    '      store: selectedStore,\n      bmReplyStatus,\n',
    '      store: selectedStore === FOCUS_STORE_GROUP_ID ? "all" : selectedStore,\n      bmReplyStatus,\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '    window.history.replaceState(null, "", href);\n',
    '''    const routeUrl = new URL(href, window.location.origin);
    if (selectedStore === FOCUS_STORE_GROUP_ID) {
      routeUrl.searchParams.set(FOCUS_STORE_GROUP_ROUTE_PARAM, FOCUS_STORE_GROUP_ROUTE_VALUE);
    }
    window.history.replaceState(null, "", `${routeUrl.pathname}${routeUrl.search}${routeUrl.hash}`);
''',
)

replace_once(
    "frontend/src/app/page.tsx",
    '      if (selectedStore !== "all" && !storeOptions.includes(selectedStore)) {\n',
    '      if (selectedStore !== "all" && selectedStore !== FOCUS_STORE_GROUP_ID && !storeOptions.includes(selectedStore)) {\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '              clearAllFilters={clearAllFilters}\n              stores={stores}\n',
    '              clearAllFilters={clearAllFilters}\n              focusGroupLabel={focusStoreGroupCopy.label}\n              focusGroupSubtitle={focusStoreGroupCopy.subtitle}\n              stores={stores}\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '                        {conversationListTitle}\n',
    '                        {selectedStore === FOCUS_STORE_GROUP_ID ? `${focusStoreGroupCopy.label}${sidebarView === "all" ? "" : ` · ${conversationListTitle}`}` : conversationListTitle}\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '{sidebarView === "notReplied" && authUser?.role !== "VIEWER" && (chatTotalCount > 0 || conversations.length > 0) && (\n',
    '{sidebarView === "notReplied" && selectedStore !== FOCUS_STORE_GROUP_ID && authUser?.role !== "VIEWER" && (chatTotalCount > 0 || conversations.length > 0) && (\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '                          <option value="all">{text.allStores}</option>\n                          {storeOptions.map((storeId) => <option key={storeId} value={storeId}>{getStoreDisplayName(availableStores.find(({ id }) => id === storeId)?.name ?? storeId)}</option>)}\n',
    '                          <option value="all">{text.allStores}</option>\n                          <option value={FOCUS_STORE_GROUP_ID}>{focusStoreGroupCopy.label}</option>\n                          {storeOptions.map((storeId) => <option key={storeId} value={storeId}>{getStoreDisplayName(availableStores.find(({ id }) => id === storeId)?.name ?? storeId)}</option>)}\n',
)

replace_once(
    "frontend/src/app/page.tsx",
    '{text.storeFilter}: {getStoreDisplayName(availableStores.find(({ id }) => id === selectedStore)?.name ?? selectedStore)} ×',
    '{text.storeFilter}: {selectedStore === FOCUS_STORE_GROUP_ID ? focusStoreGroupCopy.label : getStoreDisplayName(availableStores.find(({ id }) => id === selectedStore)?.name ?? selectedStore)} ×',
)

# ---------------------------------------------------------------------------
# Backend virtual store scope. This is not persisted as a Store record.
# ---------------------------------------------------------------------------
write(
    "backend/src/focus-store-group.ts",
    '''export const FOCUS_STORE_GROUP_ID = "focus-seven-store-group";

export const FOCUS_STORE_CODES = [
  "28375",
  "25610",
  "27627",
  "25391",
  "24804",
  "27789",
  "3791",
] as const;

const FOCUS_STORE_CODE_SET = new Set<string>(FOCUS_STORE_CODES);
const FOCUS_STORE_NAME_TOKENS = [
  "robinson chonburi",
  "central world",
  "bangkapi",
  "central westgate",
  "ngamwongwan",
  "mkv suwannaphum",
  "central khonkaen",
] as const;

export type FocusStoreReference = {
  name: string;
  code?: string | null;
  storeMaster?: { externalStoreId?: string | null } | null;
};

function containsFocusCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return (value.match(/\\d+/g) ?? []).some((part) => FOCUS_STORE_CODE_SET.has(part));
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isFocusStoreReference(store: FocusStoreReference): boolean {
  if (containsFocusCode(store.code) || containsFocusCode(store.storeMaster?.externalStoreId) || containsFocusCode(store.name)) {
    return true;
  }

  const normalizedName = normalizeName(store.name);
  return FOCUS_STORE_NAME_TOKENS.some((token) => normalizedName.includes(token));
}
''',
)

write(
    "backend/src/focus-store-group.spec.ts",
    '''import assert from "node:assert/strict";
import test from "node:test";

import { FOCUS_STORE_CODES, FOCUS_STORE_GROUP_ID, isFocusStoreReference } from "./focus-store-group";

test("focus group keeps the requested seven store identifiers", () => {
  assert.equal(FOCUS_STORE_GROUP_ID, "focus-seven-store-group");
  assert.deepEqual([...FOCUS_STORE_CODES], ["28375", "25610", "27627", "25391", "24804", "27789", "3791"]);
});

test("focus store matching accepts Store code, Store Master id, and known names", () => {
  assert.equal(isFocusStoreReference({ name: "Robinson Chonburi", code: "28375" }), true);
  assert.equal(isFocusStoreReference({ name: "OBS Central World", storeMaster: { externalStoreId: "25610" } }), true);
  assert.equal(isFocusStoreReference({ name: "OBS MKV Suwannaphum" }), true);
  assert.equal(isFocusStoreReference({ name: "OBS Harbor Mall Laemchabang", code: "99999" }), false);
});
''',
)

replace_once(
    "backend/src/conversations.controller.ts",
    'import { StoreAccessService } from "./auth/store-access.service";\n',
    'import { StoreAccessService } from "./auth/store-access.service";\nimport { FOCUS_STORE_GROUP_ID } from "./focus-store-group";\n',
)

replace_once(
    "backend/src/conversations.controller.ts",
    '    if (query.storeId) await this.storeAccess.assertStoreAccess(req.user!, query.storeId);\n',
    '    if (query.storeId && query.storeId !== FOCUS_STORE_GROUP_ID) await this.storeAccess.assertStoreAccess(req.user!, query.storeId);\n',
)

replace_once(
    "backend/src/conversations.controller.ts",
    '      stores: summary.stores.map((s) => ({\n',
    '      stores: summary.stores.filter((s) => s.storeId !== FOCUS_STORE_GROUP_ID).map((s) => ({\n',
)

replace_once(
    "backend/src/conversations.service.ts",
    'import { ownerTrackingInboundFilter } from "./owner-tracking";\n',
    'import { ownerTrackingInboundFilter } from "./owner-tracking";\nimport { FOCUS_STORE_GROUP_ID, isFocusStoreReference } from "./focus-store-group";\n',
)

replace_once(
    "backend/src/conversations.service.ts",
    '  ) { }\n  private safe(item: IncludedConversation, latestManagerUrls: ReadonlyMap<string, string | null>) {\n',
    '''  ) { }

  private async resolveFocusStoreIds(accessibleStoreIds: string[] | null): Promise<string[]> {
    const candidates = await this.prisma.store.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        ...(accessibleStoreIds === null ? {} : { id: { in: accessibleStoreIds } }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        storeMaster: { select: { externalStoreId: true } },
      },
    });
    return candidates.filter(isFocusStoreReference).map(({ id }) => id);
  }

  private safe(item: IncludedConversation, latestManagerUrls: ReadonlyMap<string, string | null>) {
''',
)

replace_once(
    "backend/src/conversations.service.ts",
    '''  async list(query: ConversationQueryDto, accessibleStoreIds: string[] | null = null, accountType: "STORE" | "HEAD_OFFICE" = "STORE") {
    const search = query.search?.trim();
    const storeFilter = accessibleStoreIds === null
      ? query.storeId
      : { in: query.storeId ? [query.storeId] : accessibleStoreIds };
    const resetFilter = await this.operations.getOperationalConversationFilter();
''',
    '''  async list(query: ConversationQueryDto, accessibleStoreIds: string[] | null = null, accountType: "STORE" | "HEAD_OFFICE" = "STORE") {
    const search = query.search?.trim();
    const focusStoreIds = query.storeId === FOCUS_STORE_GROUP_ID
      ? await this.resolveFocusStoreIds(accessibleStoreIds)
      : null;
    const storeFilter = focusStoreIds !== null
      ? { in: focusStoreIds }
      : accessibleStoreIds === null
        ? query.storeId
        : { in: query.storeId ? [query.storeId] : accessibleStoreIds };
    const resetFilter = await this.operations.getOperationalConversationFilter();
''',
)

replace_once(
    "backend/src/conversations.service.ts",
    '''      select: {
        id: true,
        name: true,
        storeMaster: { select: { externalStoreId: true } },
      },
''',
    '''      select: {
        id: true,
        name: true,
        code: true,
        storeMaster: { select: { externalStoreId: true } },
      },
''',
)

replace_once(
    "backend/src/conversations.service.ts",
    '''    return {
      overview,
      stores: storesList,
    };
''',
    '''    const focusStores = stores.filter(isFocusStoreReference);
    if (focusStores.length > 0) {
      const focusCounts = focusStores.reduce(
        (result, store) => {
          const counts = storeMap.get(store.id);
          if (!counts) return result;
          result.notReplied += counts.notReplied;
          result.notifiedBm += counts.notifiedBm;
          result.replied += counts.replied;
          return result;
        },
        { notReplied: 0, notifiedBm: 0, replied: 0 },
      );
      const focusOldestWaitingMinutes = focusStores.reduce(
        (oldest, store) => Math.max(oldest, oldestMap.get(store.id) ?? 0),
        0,
      );
      storesList.unshift({
        id: FOCUS_STORE_GROUP_ID,
        storeId: FOCUS_STORE_GROUP_ID,
        masterStoreId: null,
        externalStoreId: null,
        storeName: "Focus group · 7 stores",
        notReplied: focusCounts.notReplied,
        notifiedBm: focusCounts.notifiedBm,
        replied: focusCounts.replied,
        oldestWaitingMinutes: focusCounts.notReplied > 0 ? focusOldestWaitingMinutes : 0,
      });
    }

    return {
      overview,
      stores: storesList,
    };
''',
)

# ---------------------------------------------------------------------------
# Repository handoff notes required by AGENTS.md.
# ---------------------------------------------------------------------------
append_section(
    "AI_PROGRESS.md",
    "Desktop focus chat group (7 stores)",
    '''## 2026-09-02 — Desktop focus chat group (7 stores)
- Added a prominent virtual focus group to the desktop chat sidebar for store IDs 28375, 25610, 27627, 25391, 24804, 27789, and 3791.
- Selecting the group combines conversations from the seven stores into the normal chat list while each conversation continues to show its source store.
- Added group-level Not Replied / BM Notified / Replied counts without creating a fake Store record.
- Kept the mobile UI unchanged. Desktop routing uses `focusGroup=priority-seven` instead of exposing the virtual store ID in the shared `store` query parameter.
- The group respects existing user store access; restricted users only receive focus stores they are authorized to access.
''',
)

append_section(
    "DECISIONS.md",
    "Virtual focus chat group, not a persisted Store",
    '''## 2026-09-02 — Virtual focus chat group, not a persisted Store
- Decision: model the seven-store focus view as a virtual conversation scope (`focus-seven-store-group`) rather than inserting a synthetic Store row into the database.
- Reason: the feature is an operational grouping, not a physical store. Keeping it virtual avoids contaminating Store Master, LINE OA management, analytics, and store membership data.
- The backend resolves the seven target stores from Store code / Store Master external ID with name fallbacks, then intersects the result with the caller's accessible-store scope.
- The desktop route stores the selection in a dedicated `focusGroup` query parameter so the existing mobile `store` route contract remains unchanged.
''',
)

print("Applied focus seven-store desktop chat group changes.")
