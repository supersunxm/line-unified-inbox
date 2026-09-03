(() => {
  // src/dashboard_bridge.ts
  var lastSyncedSessionJson = "";
  function syncActiveKpiStore() {
    var _a, _b, _c, _d;
    try {
      const rawStore = localStorage.getItem("oppo_active_kpi_store");
      if (rawStore) {
        const data = JSON.parse(rawStore);
        if (data && data.storeId) {
          (_b = (_a = chrome.storage) == null ? void 0 : _a.local) == null ? void 0 : _b.set({ activeKpiStore: data });
        }
      }
      const rawBatch = localStorage.getItem("oppo_active_batch_audit");
      if (rawBatch && rawBatch !== lastSyncedSessionJson) {
        lastSyncedSessionJson = rawBatch;
        const batchData = JSON.parse(rawBatch);
        if (batchData && batchData.sessionId) {
          (_d = (_c = chrome.storage) == null ? void 0 : _c.local) == null ? void 0 : _d.set({ batchAuditSession: batchData });
        }
      }
    } catch {
    }
  }
  window.addEventListener("oppo_open_kpi_store", (e) => {
    var _a, _b;
    if (e.detail && e.detail.storeId) {
      (_b = (_a = chrome.storage) == null ? void 0 : _a.local) == null ? void 0 : _b.set({ activeKpiStore: e.detail });
    }
  });
  window.addEventListener("oppo_batch_audit_action", (e) => {
    var _a, _b;
    if (e.detail) {
      try {
        lastSyncedSessionJson = JSON.stringify(e.detail);
      } catch {
      }
      (_b = (_a = chrome.storage) == null ? void 0 : _a.local) == null ? void 0 : _b.set({ batchAuditSession: e.detail });
    }
  });
  syncActiveKpiStore();
  window.addEventListener("storage", (e) => {
    if (e.key === "oppo_active_kpi_store" || e.key === "oppo_active_batch_audit") {
      syncActiveKpiStore();
    }
  });
})();
