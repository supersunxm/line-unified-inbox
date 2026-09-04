"use strict";
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
  function handlePersistRequest(requestId, data) {
    if (data && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        lastSyncedSessionJson = JSON.stringify(data);
      } catch {
      }
      chrome.storage.local.set({ batchAuditSession: data }, () => {
        var _a, _b;
        const error = (_b = (_a = chrome.runtime) == null ? void 0 : _a.lastError) == null ? void 0 : _b.message;
        if (error) {
          console.error("[DashboardBridge] chrome.storage.local write failed:", error);
        } else {
          console.debug("[DashboardBridge] Session persisted to chrome.storage.local:", {
            sessionId: data.sessionId,
            runnerTokenPresent: !!data.runnerToken,
            status: data.status
          });
        }
        const ackPayload = {
          type: "OPPO_PERSIST_BATCH_SESSION_ACK",
          requestId,
          success: !error,
          error: error || null,
          sessionId: data.sessionId,
          runnerTokenPresent: !!data.runnerToken,
          timestamp: Date.now()
        };
        try {
          window.postMessage(ackPayload, "*");
        } catch {
        }
        try {
          window.dispatchEvent(
            new CustomEvent("OPPO_PERSIST_BATCH_SESSION_ACK", {
              detail: ackPayload
            })
          );
        } catch {
        }
      });
    } else if (data) {
      const ackPayload = {
        type: "OPPO_PERSIST_BATCH_SESSION_ACK",
        requestId,
        success: false,
        error: "chrome.storage.local unavailable",
        sessionId: data.sessionId,
        runnerTokenPresent: !!data.runnerToken,
        timestamp: Date.now()
      };
      try {
        window.postMessage(ackPayload, "*");
      } catch {
      }
      try {
        window.dispatchEvent(
          new CustomEvent("OPPO_PERSIST_BATCH_SESSION_ACK", {
            detail: ackPayload
          })
        );
      } catch {
      }
    }
  }
  window.addEventListener("message", (event) => {
    if (!event || !event.data) return;
    if (event.data.type === "OPPO_PERSIST_BATCH_SESSION_REQUEST") {
      handlePersistRequest(event.data.requestId, event.data.data);
    }
  });
  window.addEventListener("OPPO_PERSIST_BATCH_SESSION_REQUEST", (e) => {
    const detail = e.detail;
    if ((detail == null ? void 0 : detail.requestId) && (detail == null ? void 0 : detail.data)) {
      handlePersistRequest(detail.requestId, detail.data);
    }
  });
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
  try {
    window.__OPPO_KPI_BRIDGE_READY__ = true;
    window.postMessage({ type: "OPPO_BRIDGE_INITIALIZED", ready: true }, "*");
    window.dispatchEvent(new CustomEvent("OPPO_BRIDGE_INITIALIZED", { detail: { ready: true } }));
  } catch {
  }
})();
