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

function handlePersistRequest(requestId: string, data: any) {
  if (data && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      lastSyncedSessionJson = JSON.stringify(data);
    } catch {}

    chrome.storage.local.set({ batchAuditSession: data }, () => {
      const error = chrome.runtime?.lastError?.message;
      if (error) {
        console.error("[DashboardBridge] chrome.storage.local write failed:", error);
      } else {
        console.debug("[DashboardBridge] Session persisted to chrome.storage.local:", {
          sessionId: data.sessionId,
          runnerTokenPresent: !!data.runnerToken,
          status: data.status,
        });
      }

      const ackPayload = {
        type: "OPPO_PERSIST_BATCH_SESSION_ACK",
        requestId,
        success: !error,
        error: error || null,
        sessionId: data.sessionId,
        runnerTokenPresent: !!data.runnerToken,
        timestamp: Date.now(),
      };

      // Post message across isolated worlds
      try {
        window.postMessage(ackPayload, "*");
      } catch {}

      // Also fire custom event on DOM
      try {
        window.dispatchEvent(
          new CustomEvent("OPPO_PERSIST_BATCH_SESSION_ACK", {
            detail: ackPayload,
          }),
        );
      } catch {}
    });
  } else if (data) {
    const ackPayload = {
      type: "OPPO_PERSIST_BATCH_SESSION_ACK",
      requestId,
      success: false,
      error: "chrome.storage.local unavailable",
      sessionId: data.sessionId,
      runnerTokenPresent: !!data.runnerToken,
      timestamp: Date.now(),
    };
    try {
      window.postMessage(ackPayload, "*");
    } catch {}
    try {
      window.dispatchEvent(
        new CustomEvent("OPPO_PERSIST_BATCH_SESSION_ACK", {
          detail: ackPayload,
        }),
      );
    } catch {}
  }
}

// 1. Listen for standard window.postMessage from Dashboard
window.addEventListener("message", (event) => {
  if (!event || !event.data) return;
  if (event.data.type === "OPPO_PERSIST_BATCH_SESSION_REQUEST") {
    handlePersistRequest(event.data.requestId, event.data.data);
  }
});

// 2. Listen for custom event on window
window.addEventListener("OPPO_PERSIST_BATCH_SESSION_REQUEST", (e: any) => {
  const detail = e.detail;
  if (detail?.requestId && detail?.data) {
    handlePersistRequest(detail.requestId, detail.data);
  }
});

// 3. Listen for single store open event
window.addEventListener("oppo_open_kpi_store", (e: any) => {
  if (e.detail && e.detail.storeId) {
    chrome.storage?.local?.set({ activeKpiStore: e.detail });
  }
});

// 4. Listen for legacy batch audit start/action events
window.addEventListener("oppo_batch_audit_action", (e: any) => {
  if (e.detail) {
    try {
      lastSyncedSessionJson = JSON.stringify(e.detail);
    } catch {}
    chrome.storage?.local?.set({ batchAuditSession: e.detail });
  }
});

// 5. Sync on page load and storage changes
syncActiveKpiStore();
window.addEventListener("storage", (e) => {
  if (e.key === "oppo_active_kpi_store" || e.key === "oppo_active_batch_audit") {
    syncActiveKpiStore();
  }
});

// Announce bridge readiness to Dashboard
try {
  (window as any).__OPPO_KPI_BRIDGE_READY__ = true;
  window.postMessage({ type: "OPPO_BRIDGE_INITIALIZED", ready: true }, "*");
  window.dispatchEvent(new CustomEvent("OPPO_BRIDGE_INITIALIZED", { detail: { ready: true } }));
} catch {}
