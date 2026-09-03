/**
 * Dashboard Bridge Content Script
 * Injected on lineoppo.click and localhost:3000 to safely bridge store context
 * and batch audit runner state from Dashboard into chrome.storage.local.
 */

let lastSyncedSessionJson = "";

function syncActiveKpiStore() {
  try {
    const rawStore = localStorage.getItem("oppo_active_kpi_store");
    if (rawStore) {
      const data = JSON.parse(rawStore);
      if (data && data.storeId) {
        chrome.storage?.local?.set({ activeKpiStore: data });
      }
    }

    const rawBatch = localStorage.getItem("oppo_active_batch_audit");
    if (rawBatch && rawBatch !== lastSyncedSessionJson) {
      lastSyncedSessionJson = rawBatch;
      const batchData = JSON.parse(rawBatch);
      if (batchData && batchData.sessionId) {
        chrome.storage?.local?.set({ batchAuditSession: batchData });
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

// Listen for custom event emitted when user clicks "Open Google Maps"
window.addEventListener("oppo_open_kpi_store", (e: any) => {
  if (e.detail && e.detail.storeId) {
    chrome.storage?.local?.set({ activeKpiStore: e.detail });
  }
});

// Listen for batch audit start/action events
window.addEventListener("oppo_batch_audit_action", (e: any) => {
  if (e.detail) {
    try {
      lastSyncedSessionJson = JSON.stringify(e.detail);
    } catch {}
    chrome.storage?.local?.set({ batchAuditSession: e.detail });
  }
});

// Sync on page load and storage changes
syncActiveKpiStore();
window.addEventListener("storage", (e) => {
  if (e.key === "oppo_active_kpi_store" || e.key === "oppo_active_batch_audit") {
    syncActiveKpiStore();
  }
});
