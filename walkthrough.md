# Walkthrough: Follower Insights Trend UX & Multi-Store Comparison

This update addresses all UX and multi-store comparison requirements for the **Follower Insights trend section** in the OPPO LINE OA Monitor application.

---

## 1. Summary of Changes

### A. Default Comparison Mode
- **Previous state**: Defaulted to `บัญชีที่เปรียบเทียบกันได้` (`"comparable"`).
- **New state**: Now defaults to `บัญชีทั้งหมดที่มีข้อมูล` (`"available"` / All accounts with available data).
- **Behavior**: Users immediately see aggregate data across all stores with available records upon loading the page. The user can explicitly switch to `บัญชีที่เปรียบเทียบกันได้` whenever they want to compare only accounts with 100% historical date coverage.

### B. Multi-Select Store Selector Combobox
- **Previous state**: Single-select dropdown that allowed choosing only one store.
- **New state**: Accessible, searchable multi-select combobox dropdown with checkboxes.
- **Features**:
  - **Dynamic Trigger Label**:
    - `0` stores selected -> `ทุกร้าน` (`t.allStores`)
    - `1` store selected -> Store Name (e.g. `CentralWorld`)
    - `2+` stores selected -> `CentralWorld +N` (e.g. `CentralWorld +3`)
  - **Quick Clear**: `×` button on the trigger button clears selection back to `ทุกร้าน`.
  - **Action Bar**: `[ เลือกทั้งหมด ]` (`t.selectAll`) and `[ ล้างการเลือก ]` (`t.clearSelection`).
  - **Store Search**: Live search input filtering store options by store name or LINE OA account name.
  - **Store Deduplication & Alphabetical Sorting**: Deduplicates records by `lineOaId` and sorts alphabetically by store name then account name.

### C. Multi-Store Multi-Series Trend Chart
- **One series per selected store**: When 2 or more stores are selected, the chart plots one separate SVG line series per store using a 12-color high-contrast palette (`STORE_PALETTE`), rather than collapsing them into a single sum.
- **Multi-Store Legend**: Displays color-coded badges for each selected store above the chart.
- **Multi-Store Hover Tooltip**: Hovering over any date column shows the exact value for each selected store on that date in a unified tooltip.
- **Single Store Table**: Retains the store daily changes table below the chart when exactly 1 store is selected.
- **Metric Switching**: Switching metrics (`followers`, `targetedReaches`, `blocks`) preserves all selected stores and updates all series simultaneously.

### D. Resilient Partial Data & Empty States
- **Partial Data Communication**: If some selected stores have data and others are missing data, the chart plots the stores with data and displays an informative badge:
  - In `"available"` mode: e.g. `3 จาก 5 ร้านมีข้อมูลในช่วงเวลานี้` (`t.storesWithDataCount(3, 5)`).
  - In `"comparable"` mode: e.g. `เปรียบเทียบได้ 3 จาก 5 ร้าน` (`t.comparableStoresCount(3, 5)`).
- **True Empty State**: The empty state message (`ไม่มีข้อมูลแผนภูมิในช่วงเวลาที่เลือก` / `ไม่มีข้อมูลสำหรับร้านนี้ในช่วงวันที่เลือก`) is shown strictly when 0 data points are available across all selected series.

### E. Trilingual Localization
- Added complete symmetric translations for all new keys across Thai (`th`), English (`en`), and Chinese (`zh`) in [follower-insights-translations.ts](file:///Users/chutisoa.nup/Projects/line-unified-inbox/frontend/src/app/follower-insights/follower-insights-translations.ts):
  - `selectAll`: `เลือกทั้งหมด` / `Select all` / `全选`
  - `clearSelection`: `ล้างการเลือก` / `Clear selection` / `清除选择`
  - `selectedStoresCount(count)`: `เลือก {count} ร้าน` / `Selected {count} stores` / `已选 {count} 家门店`
  - `storesWithDataCount(count, total)`: `{count} จาก {total} ร้านมีข้อมูลในช่วงเวลานี้` / `{count} of {total} stores have data in this period` / `{total} 家门店中有 {count} 家在此期间有数据`
  - `comparableStoresCount(count, total)`: `เปรียบเทียบได้ {count} จาก {total} ร้าน` / `Comparable: {count} of {total} stores` / `可对比: {total} 家中的 {count} 家门店`

---

## 2. Modified & Created Files

| File | Change Description |
| --- | --- |
| [follower-insights-translations.ts](file:///Users/chutisoa.nup/Projects/line-unified-inbox/frontend/src/app/follower-insights/follower-insights-translations.ts) | Added new translation keys and formatters for multi-store selection and partial coverage badges across `th`, `en`, and `zh`. |
| [trend-chart.tsx](file:///Users/chutisoa.nup/Projects/line-unified-inbox/frontend/src/app/follower-insights/trend-chart.tsx) | Multi-select `StoreMultiSelectCombobox`, multi-series SVG chart rendering, `STORE_PALETTE`, multi-store legend, and multi-store hover tooltip. |
| [follower-insights-view.tsx](file:///Users/chutisoa.nup/Projects/line-unified-inbox/frontend/src/app/follower-insights/follower-insights-view.tsx) | Updated comparisonMode default to `"available"`, multi-store selection state `selectedLineOaIds`, parallel time-series fetching into `storeSeriesMap`. |
| [follower-insights.test.mts](file:///Users/chutisoa.nup/Projects/line-unified-inbox/frontend/test/follower-insights.test.mts) | Added comprehensive test suite for Cases A through G, multi-store combobox, and translation symmetry. |
| [top-navigation.tsx](file:///Users/chutisoa.nup/Projects/line-unified-inbox/frontend/src/components/shell/top-navigation.tsx) | Integrated `/classification-insights` link in More navigation dropdown. |
| [AI_PROGRESS.md](file:///Users/chutisoa.nup/Projects/line-unified-inbox/AI_PROGRESS.md) | Documented task completion and verification status. |
| [DECISIONS.md](file:///Users/chutisoa.nup/Projects/line-unified-inbox/DECISIONS.md) | Documented architecture and design decisions for multi-store comparison. |

---

## 3. Verification Results

All required checks have passed:

| Check | Command | Result |
| --- | --- | --- |
| **Follower Insights Tests** | `node --test --experimental-strip-types test/follower-insights.test.mts` | **PASS (24 / 24 passed - 100%)** |
| **All Frontend Tests** | `npm test` in `frontend/` | **PASS (360 / 360 passed - 100%)** |
| **All Backend Tests** | `npm test` in `backend/` | **PASS (1,255 / 1,255 passed - 100%)** |
| **Frontend Production Build** | `npm run build` in `frontend/` | **PASS (Next.js Turbopack build with 0 errors)** |
| **Backend Production Build** | `npm run build` in `backend/` | **PASS (NestJS & Prisma build with 0 errors)** |

### User Verification Scenarios Verified

- **Case A (Default state)**: Default comparison mode is `"available"` (`บัญชีทั้งหมดที่มีข้อมูล`), rendering aggregate network trend with zero initial store selection.
- **Case B (Single store)**: Selecting 1 store displays that store's individual trend series and store daily changes breakdown table.
- **Case C (3 stores)**: Selecting 3 stores renders 3 distinct line series on the same chart with store palette colors, store legend badges, and multi-store hover tooltip.
- **Case D (Switch metric)**: Switching between `ผู้ติดตาม`, `ผู้รับข้อความที่เข้าถึงได้`, and `จำนวนบล็อก` updates all series values simultaneously while preserving store selections.
- **Case E (Comparable mode)**: Switching to `บัญชีที่เปรียบเทียบกันได้` applies historical coverage filtering to selected stores and updates the badge to e.g. `เปรียบเทียบได้ 3 จาก 5 ร้าน`.
- **Case F (Partial missing data)**: If 3 of 5 stores have data, the chart plots the 3 available stores and displays `3 จาก 5 ร้านมีข้อมูลในช่วงเวลานี้`.
- **Case G (True empty state)**: Only displays empty state message when 0 usable data points exist across all selected series.
