import { GoogleMapsDomAdapter } from "./core/googleMapsDomAdapter.ts";
import {
  QualificationEngine,
  determineAuditCoverageStatus,
  type KpiScanResult,
  type EvaluatedReview,
  type AuditCoverageStatus,
} from "./core/qualificationEngine.ts";
import { BatchAuditRunner, type BatchAuditSessionInfo } from "./batch/batchAuditRunner.ts";

function getCurrentMonthString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(monthStr: string): string {
  try {
    const [y, m] = monthStr.split("-");
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  } catch {
    return monthStr;
  }
}

class ReviewCheckerOverlay {
  private container: HTMLDivElement | null = null;
  private selectedMonth: string = getCurrentMonthString();
  private storeId: string = "";
  private externalStoreId: string = "";
  private storeCode: string = "";
  private storeName: string = "";
  private isStoreLocked: boolean = false;
  private lastResult: KpiScanResult | null = null;
  private isCollapsed: boolean = false;
  private showDebugMode: boolean = true;
  private backendUrl: string = "https://lineoppo.click";
  private allEvaluatedReviews: EvaluatedReview[] = [];
  private seenFingerprints = new Set<string>();
  private lastScanNewCount: number | null = null;
  private batchRunner = new BatchAuditRunner();
  private batchSession: BatchAuditSessionInfo | null = null;
  private isBatchMode: boolean = false;

  async init() {
    this.detectStoreContextFromUrl();
    await this.detectStoreContextFromStorage();

    // Check if a batch audit session is active
    const isBatchActive = await this.batchRunner.initFromStorage();
    if (isBatchActive) {
      await this.initBatchMode();
    } else {
      this.render();
    }
  }

  private async initBatchMode() {
    chrome.storage?.local?.get(["batchAuditSession"], (res) => {
      this.batchSession = res?.batchAuditSession || null;

      // Check URL hash fallback for runnerToken or sessionId if missing in storage
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const hashToken = hashParams.get("oppoToken");
      const hashSessionId = hashParams.get("oppoSessionId");

      if (this.batchSession) {
        if (hashToken && !this.batchSession.runnerToken) {
          this.batchSession.runnerToken = hashToken;
          chrome.storage?.local?.set({ batchAuditSession: this.batchSession });
        }
        if (hashSessionId && !this.batchSession.sessionId) {
          this.batchSession.sessionId = hashSessionId;
          chrome.storage?.local?.set({ batchAuditSession: this.batchSession });
        }
      } else if (hashToken && hashSessionId) {
        // Bootstrap session from URL hash if storage was empty
        this.batchSession = {
          sessionId: hashSessionId,
          targetMonth: this.selectedMonth,
          runnerToken: hashToken,
          status: "RUNNING",
          currentStore: {
            storeId: this.storeId,
            storeName: this.storeName,
            storeCode: this.storeCode,
            googleMapsUrl: window.location.href,
          },
        };
        chrome.storage?.local?.set({ batchAuditSession: this.batchSession });
      }

      if (!this.batchSession || this.batchSession.status !== "RUNNING") {
        return;
      }

      // Explicitly inject the current batchSession with runnerToken into batchRunner
      this.batchRunner.setSession(this.batchSession);

      this.isBatchMode = true;
      this.renderBatchRunnerBar();
      this.startBatchStoreRun();
    });
  }

  private renderBatchRunnerBar() {
    let bar = document.getElementById("oppo-batch-runner-bar") as HTMLDivElement | null;
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "oppo-batch-runner-bar";
      bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999999;
        background: linear-gradient(135deg, #064e3b, #047857);
        color: #fff;
        padding: 10px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      `;
      document.body.appendChild(bar);
    }

    const currentStore = this.batchSession?.currentStore;
    const storeTitle = currentStore?.storeName || this.storeName || "Current Store";
    const storeCodeText = currentStore?.storeCode ? ` (${currentStore.storeCode})` : "";
    const targetMonth = this.batchSession?.targetMonth || this.selectedMonth;

    bar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #34d399;"></span>
        <div>
          <strong style="font-size: 14px;">🤖 Monthly Batch Audit Runner (${targetMonth})</strong>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
            Target: <strong>${storeTitle}${storeCodeText}</strong>
          </div>
        </div>
      </div>
      <div id="oppo-batch-status-text" style="background: rgba(0,0,0,0.25); padding: 5px 12px; border-radius: 6px; font-weight: 500;">
        Initializing runner...
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="oppo-batch-pause-btn" style="background: #f59e0b; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">
          Pause
        </button>
        <button id="oppo-batch-skip-btn" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
          Skip Store
        </button>
      </div>
    `;

    document.getElementById("oppo-batch-pause-btn")?.addEventListener("click", () => {
      this.batchRunner.stop();
      chrome.storage?.local?.set({
        batchAuditSession: { ...this.batchSession, status: "PAUSED" },
      });
      const statusText = document.getElementById("oppo-batch-status-text");
      if (statusText) statusText.textContent = "⏸ Paused by operator";
    });

    document.getElementById("oppo-batch-skip-btn")?.addEventListener("click", async () => {
      if (confirm("Skip this store and move to next in queue?")) {
        const storeId = this.batchSession?.currentStore?.storeId || this.storeId;
        if (storeId && this.batchSession?.sessionId) {
          await fetch(`${this.backendUrl}/google-review-kpi/audit-session/${this.batchSession.sessionId}/stores/${storeId}/skip`, {
            method: "POST",
          });
          window.location.reload();
        }
      }
    });

    // Listen to status changes from runner
    this.batchRunner.onStatusChange((state, details) => {
      const statusText = document.getElementById("oppo-batch-status-text");
      if (!statusText) return;

      switch (state) {
        case "WAITING_FOR_MAPS":
          statusText.textContent = "⏳ Waiting for Google Maps to load...";
          break;
        case "OPENING_REVIEWS":
          statusText.textContent = "📂 Opening reviews pane...";
          break;
        case "SETTING_NEWEST":
          statusText.textContent = "🔄 Setting sorting to Newest...";
          break;
        case "SCANNING":
          statusText.textContent = "🔍 Scanning reviews...";
          break;
        case "SCROLLING":
          statusText.textContent = `📜 Scrolling reviews (${details?.cardCount || 0} loaded)...`;
          break;
        case "WAITING_FOR_LAZY_LOAD":
          statusText.textContent = "⏳ Loading more reviews...";
          break;
        case "AUDIT_COMPLETE":
          statusText.textContent = `✅ Audit complete! Evaluated ${details?.reviews || 0} reviews (${details?.coverageStatus})`;
          break;
        case "SUBMITTING_RESULT":
          statusText.textContent = "💾 Submitting KPI results to Dashboard...";
          break;
        case "MOVING_TO_NEXT_STORE":
          statusText.textContent = "🚀 Transitioning to next store...";
          break;
        case "NEEDS_ATTENTION":
          statusText.textContent = `⚠ Attention needed: ${details?.errorMessage || details?.errorCode}`;
          statusText.style.background = "#dc2626";
          break;
        case "PAUSED":
          statusText.textContent = "⏸ Paused";
          break;
        case "COMPLETED":
          statusText.textContent = "🎉 Batch Audit Completed!";
          break;
        default:
          statusText.textContent = state;
      }
    });
  }

  private async startBatchStoreRun() {
    const storeId = this.batchSession?.currentStore?.storeId || this.storeId;
    const storeName = this.batchSession?.currentStore?.storeName || this.storeName || "Store";
    const targetMonth = this.batchSession?.targetMonth || this.selectedMonth;

    if (!storeId) {
      console.warn("[ReviewCheckerOverlay] No storeId for batch audit");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.batchRunner.runForCurrentStore({
      storeId,
      storeName,
      targetMonth,
      backendUrl: this.backendUrl,
    });
  }

  private detectStoreContextFromUrl() {
    // 1. Search params
    const searchParams = new URLSearchParams(window.location.search);
    // 2. Hash params (e.g. #oppoStoreId=... or #storeId=...)
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);

    const q = (key: string) => searchParams.get(key) || hashParams.get(key);

    const storeId = q("oppoStoreId") || q("storeId");
    if (storeId) {
      this.storeId = storeId.trim();
      this.isStoreLocked = true;
    }

    const extId = q("oppoExtId") || q("externalStoreId");
    if (extId) this.externalStoreId = extId.trim();

    const code = q("oppoCode") || q("code");
    if (code) this.storeCode = code.trim();

    const name = q("oppoName") || q("storeName");
    if (name) this.storeName = decodeURIComponent(name).trim();

    const month = q("oppoMonth") || q("kpiMonth");
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      this.selectedMonth = month;
    }
  }

  private async detectStoreContextFromStorage() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get("activeKpiStore");
        if (stored?.activeKpiStore) {
          const data = stored.activeKpiStore;
          if (data.storeId && !this.storeId) {
            this.storeId = data.storeId;
            this.isStoreLocked = true;
          }
          if (data.externalStoreId && !this.externalStoreId) this.externalStoreId = data.externalStoreId;
          if (data.code && !this.storeCode) this.storeCode = data.code;
          if (data.name && !this.storeName) this.storeName = data.name;
          if (data.month && /^\d{4}-\d{2}$/.test(data.month)) this.selectedMonth = data.month;
        }
      } catch {
        // Fall back to URL parameters
      }
    }
  }

  private render() {
    if (this.container) {
      this.container.remove();
    }

    const detectedStoreName = this.storeName || GoogleMapsDomAdapter.getStoreName() || "Google Maps Store";
    const reviews = this.allEvaluatedReviews;
    const hasReachedOlder = this.lastResult?.hasReachedOlderReviews ?? false;

    this.container = document.createElement("div");
    this.container.id = "oppo-review-kpi-overlay";
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: ${this.isCollapsed ? "auto" : "360px"};
      max-height: 85vh;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      color: #0f172a;
      overflow-y: auto;
      transition: all 0.2s ease-in-out;
    `;

    if (this.isCollapsed) {
      this.container.innerHTML = `
        <button id="oppo-kpi-expand-btn" style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #059669;
          color: #ffffff;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        ">
          <span>⭐ OPPO Review KPI</span>
        </button>
      `;
      document.body.appendChild(this.container);
      document.getElementById("oppo-kpi-expand-btn")?.addEventListener("click", () => {
        this.isCollapsed = false;
        this.render();
      });
      return;
    }

    this.container.innerHTML = `
      <div style="background: #059669; color: #ffffff; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-top-left-radius: 15px; border-top-right-radius: 15px;">
        <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          <span>⭐</span>
          <span>Google Review KPI Checker</span>
        </div>
        <button id="oppo-kpi-collapse-btn" style="background: none; border: none; color: #ffffff; cursor: pointer; font-size: 16px; opacity: 0.85;">✕</button>
      </div>

      <div style="padding: 14px 16px; font-size: 12px; display: flex; flex-direction: column; gap: 12px;">

        <!-- Store Identification Header -->
        ${
          this.isStoreLocked
            ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-weight: 700; color: #166534; font-size: 11px;">🔒 Linked Store:</span>
              <span style="background: #dcfce7; color: #15803d; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">DASHBOARD VERIFIED</span>
            </div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${detectedStoreName}
            </div>
            <div style="font-family: monospace; font-size: 10px; color: #475569; margin-top: 2px;">
              Store ID: ${this.storeId.slice(0, 18)}... ${this.storeCode ? `(${this.storeCode})` : ""}
            </div>
          </div>
        `
            : `
          <div>
            <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">Store Name:</div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${detectedStoreName}</div>
          </div>

          <div>
            <label style="display: block; font-size: 10px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Store ID / Code *:</label>
            <input id="oppo-kpi-store-id" type="text" value="${this.storeId}" placeholder="e.g. 25610 or UUID" style="
              width: 100%;
              padding: 6px 8px;
              font-size: 12px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              box-sizing: border-box;
            " />
          </div>
        `
        }

        <div>
          <label style="display: block; font-size: 10px; font-weight: 600; color: #64748b; margin-bottom: 4px;">Target Audit Month:</label>
          <input id="oppo-kpi-month" type="month" value="${this.selectedMonth}" style="
            width: 100%;
            padding: 6px 8px;
            font-size: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            box-sizing: border-box;
          " />
        </div>

        <div style="display: flex; gap: 6px;">
          <button id="oppo-kpi-scan-btn" style="
            flex: 2;
            padding: 8px 12px;
            background: #059669;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            🔍 Scan Loaded Reviews
          </button>
          <button id="oppo-kpi-reset-btn" style="
            flex: 1;
            padding: 8px 10px;
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            🔄 Reset
          </button>
        </div>

        <!-- Incremental Scan Notification Banner -->
        ${
          this.lastScanNewCount !== null
            ? `
          <div style="
            background: ${this.lastScanNewCount > 0 ? "#ecfdf5" : "#f8fafc"};
            color: ${this.lastScanNewCount > 0 ? "#047857" : "#64748b"};
            border: 1px solid ${this.lastScanNewCount > 0 ? "#a7f3d0" : "#e2e8f0"};
            border-radius: 6px;
            padding: 5px 8px;
            font-size: 11px;
            font-weight: 700;
            text-align: center;
          ">
            ${this.lastScanNewCount > 0 ? `✨ +${this.lastScanNewCount} new reviews detected` : "ℹ️ +0 new reviews (all visible reviews already added)"}
          </div>
        `
            : ""
        }

        <!-- Metric Cards -->
        <div id="oppo-kpi-results" style="
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        ">
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Unique reviews detected:</span>
            <span style="font-weight: 700; font-family: monospace;">${this.lastResult?.reviewsChecked ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">With customer photo:</span>
            <span style="font-weight: 700; font-family: monospace;">${this.lastResult?.reviewsWithPhoto ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">15+ Thai words:</span>
            <span style="font-weight: 700; font-family: monospace;">${this.lastResult?.reviewsOver15ThaiWords ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Edited reviews (unverifiable):</span>
            <span style="font-weight: 700; font-family: monospace; color: #d97706;">${this.lastResult?.editedReviewCount ?? 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Unknown date reviews:</span>
            <span style="font-weight: 700; font-family: monospace; color: #d97706;">${this.lastResult?.unknownDateCount ?? 0}</span>
          </div>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; font-size: 12px; color: #059669; font-weight: 800;">
            <span>Qualified Reviews:</span>
            <span style="font-size: 14px; font-family: monospace;">${this.lastResult?.qualifiedReviews ?? 0}</span>
          </div>
        </div>

        <!-- Scroll Boundary Guidance -->
        ${(() => {
          const status = this.lastResult?.auditCoverageStatus ?? "IN_PROGRESS";
          if (status === "OLDER_THAN_TARGET_REACHED") {
            return `
              <div style="
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 8px;
                padding: 8px 10px;
                font-size: 11px;
                line-height: 1.3;
                display: flex;
                align-items: flex-start;
                gap: 6px;
              ">
                <span>🏁</span>
                <span style="color: #166534; font-weight: 600;">
                  Reached reviews older than ${formatMonthLabel(this.selectedMonth)}.<br/>
                  Audit coverage complete.
                </span>
              </div>
            `;
          }
          if (status === "END_OF_AVAILABLE_REVIEWS") {
            return `
              <div style="
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 8px;
                padding: 8px 10px;
                font-size: 11px;
                line-height: 1.3;
                display: flex;
                align-items: flex-start;
                gap: 6px;
              ">
                <span>✅</span>
                <span style="color: #166534; font-weight: 600;">
                  Reached the end of available Google Maps reviews.<br/>
                  ${formatMonthLabel(this.selectedMonth)} audit complete.
                </span>
              </div>
            `;
          }
          return `
            <div style="
              background: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 8px;
              padding: 8px 10px;
              font-size: 11px;
              line-height: 1.3;
              display: flex;
              align-items: flex-start;
              gap: 6px;
            ">
              <span>📜</span>
              <span style="color: #92400e; font-weight: 600;">
                Scroll down the reviews pane to load older reviews.
              </span>
            </div>
          `;
        })()}

        <div style="display: flex; gap: 6px;">
          <button id="oppo-kpi-copy-btn" style="
            flex: 1;
            padding: 7px 10px;
            background: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            📋 Copy JSON
          </button>
          <button id="oppo-kpi-send-btn" style="
            flex: 1;
            padding: 7px 10px;
            background: #0284c7;
            color: #ffffff;
            border: none;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">
            🚀 Send Result
          </button>
        </div>

        <div id="oppo-kpi-status-msg" style="font-size: 10px; text-align: center; color: #64748b; min-height: 14px;"></div>

        <!-- Live Validation Debug View -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 11px; color: #334155;">🐞 Live Validation Debug View</span>
            <button id="oppo-kpi-debug-toggle" style="background: none; border: none; font-size: 10px; color: #0284c7; cursor: pointer; text-decoration: underline;">
              ${this.showDebugMode ? "Hide Debug" : "Show Debug"}
            </button>
          </div>

          ${
            this.showDebugMode
              ? `
            <div id="oppo-kpi-debug-list" style="
              max-height: 260px;
              overflow-y: auto;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px;
              display: flex;
              flex-direction: column;
              gap: 8px;
              font-family: monospace;
              font-size: 10px;
            ">
              ${
                reviews.length === 0
                  ? `<div style="color: #94a3b8; text-align: center; padding: 12px;">No reviews scanned yet. Scroll down and click "Scan Loaded Reviews".</div>`
                  : reviews
                      .map(
                        (r, i) => `
                <div style="
                  background: #ffffff;
                  border: 1px solid ${r.isQualified ? "#86efac" : "#e2e8f0"};
                  border-left: 3px solid ${r.isQualified ? "#16a34a" : r.isEdited ? "#d97706" : "#94a3b8"};
                  border-radius: 6px;
                  padding: 8px 10px;
                  line-height: 1.4;
                ">
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Review #${i + 1}</div>
                  ${r.fullReviewText ? `<div style="margin-bottom: 3px; color: #334155; word-break: break-word;"><strong>Full review text:</strong> "${r.fullReviewText}"</div>` : ""}
                  ${r.rawTokens && r.rawTokens.length > 0 ? `<div style="color: #64748b; font-size: 9px; margin-bottom: 2px; word-break: break-word;"><strong>Raw tokens (${r.rawTokens.length}):</strong> [${r.rawTokens.join(", ")}]</div>` : ""}
                  ${r.finalTokens && r.finalTokens.length > 0 ? `<div style="color: #0284c7; font-size: 9px; margin-bottom: 3px; word-break: break-word;"><strong>Final counted tokens (${r.finalTokens.length}):</strong> [${r.finalTokens.join(", ")}]</div>` : ""}
                  <div><strong>Final word count:</strong> ${r.thaiWordCount}</div>
                  <div><strong>15+ words:</strong> ${r.isAtLeast15Words ? "Yes ✅" : "No ❌"}</div>
                  <div><strong>Photo evidence:</strong> ${r.photoEvidence ?? "NONE"}</div>
                  <div><strong>Has customer photo:</strong> ${r.hasPhoto ? "Yes ✅" : "No ❌"}</div>
                  <div><strong>Date:</strong> ${r.month ?? "ORIGINAL_DATE_UNKNOWN"} ${r.isDateInMonth ? "✅" : "❌"}</div>
                  ${
                    r.isEdited
                      ? `<div style="color: #d97706; font-weight: 700; font-size: 9px; margin: 1px 0;">
                          ⚠️ EDITED REVIEW — Original creation date unknown. Excluded from monthly KPI.
                         </div>`
                      : ""
                  }
                  <div style="font-weight: 700; color: ${r.isQualified ? "#16a34a" : "#dc2626"}; margin-top: 3px;">
                    Qualified: ${r.isQualified ? "Yes ✅" : "No ❌"}
                  </div>
                </div>
              `
                      )
                      .join("")
              }
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.attachEventListeners();
  }

  private attachEventListeners() {
    document.getElementById("oppo-kpi-collapse-btn")?.addEventListener("click", () => {
      this.isCollapsed = true;
      this.render();
    });

    document.getElementById("oppo-kpi-debug-toggle")?.addEventListener("click", () => {
      this.showDebugMode = !this.showDebugMode;
      this.render();
    });

    if (!this.isStoreLocked) {
      const storeInput = document.getElementById("oppo-kpi-store-id") as HTMLInputElement;
      storeInput?.addEventListener("input", (e) => {
        this.storeId = (e.target as HTMLInputElement).value;
      });
    }

    const monthInput = document.getElementById("oppo-kpi-month") as HTMLInputElement;
    monthInput?.addEventListener("change", (e) => {
      this.selectedMonth = (e.target as HTMLInputElement).value;
      this.recalculateCurrentReviews();
    });

    document.getElementById("oppo-kpi-scan-btn")?.addEventListener("click", () => {
      this.performScan();
    });

    document.getElementById("oppo-kpi-reset-btn")?.addEventListener("click", () => {
      this.resetScan();
    });

    document.getElementById("oppo-kpi-copy-btn")?.addEventListener("click", () => {
      this.copyJson();
    });

    document.getElementById("oppo-kpi-send-btn")?.addEventListener("click", () => {
      this.sendResult();
    });
  }

  private resetScan() {
    this.allEvaluatedReviews = [];
    this.seenFingerprints.clear();
    this.lastResult = null;
    this.lastScanNewCount = null;
    this.render();
    this.showStatus("Cleared scanned reviews.", "#64748b");
  }

  private recalculateCurrentReviews() {
    // Re-evaluate previously seen reviews against new target month without creating duplicates
    const targetMonth = this.selectedMonth;
    let withPhoto = 0;
    let over15 = 0;
    let qualified = 0;
    let unknownDate = 0;
    let editedCount = 0;

    for (const r of this.allEvaluatedReviews) {
      r.isDateInMonth = Boolean(r.month && r.month === targetMonth);
      r.isQualified = r.isDateInMonth && r.hasPhoto && r.isOver15Words;
      if (r.hasPhoto) withPhoto++;
      if (r.isOver15Words) over15++;
      if (r.isQualified) qualified++;
      if (r.month === null) unknownDate++;
      if (r.isEdited) editedCount++;
    }

    const isAtScrollBottom = GoogleMapsDomAdapter.isReviewScrollAtBottom();
    const auditCoverageStatus = determineAuditCoverageStatus({
      targetMonth,
      reviews: this.allEvaluatedReviews,
      isAtScrollBottom,
    });
    const hasReachedOlder = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";

    this.lastResult = {
      targetMonth,
      reviewsChecked: this.allEvaluatedReviews.length,
      reviewsWithPhoto: withPhoto,
      reviewsOver15ThaiWords: over15,
      qualifiedReviews: qualified,
      unknownDateCount: unknownDate,
      editedReviewCount: editedCount,
      hasReachedOlderReviews: hasReachedOlder,
      isAtScrollBottom,
      auditCoverageStatus,
      reviews: this.allEvaluatedReviews,
    };

    this.render();
  }

  private performScan() {
    const cards = GoogleMapsDomAdapter.getReviewCardElements();
    const rawReviews = cards.map((c) => GoogleMapsDomAdapter.extractReviewData(c));

    const ref = new Date();
    let newlyAdded = 0;

    for (let i = 0; i < rawReviews.length; i++) {
      const raw = rawReviews[i];
      const evaluated = QualificationEngine.evaluateReview(raw, this.selectedMonth, i, ref);

      // Strict Deduplication: Add only if never seen before
      if (!this.seenFingerprints.has(evaluated.fingerprint)) {
        this.seenFingerprints.add(evaluated.fingerprint);
        this.allEvaluatedReviews.push(evaluated);
        newlyAdded++;
      }
    }

    this.lastScanNewCount = newlyAdded;

    let withPhoto = 0;
    let over15 = 0;
    let qualified = 0;
    let unknownDate = 0;
    let editedCount = 0;

    for (const r of this.allEvaluatedReviews) {
      if (r.hasPhoto) withPhoto++;
      if (r.isOver15Words) over15++;
      if (r.isQualified) qualified++;
      if (r.month === null) unknownDate++;
      if (r.isEdited) editedCount++;
    }

    const isAtScrollBottom = GoogleMapsDomAdapter.isReviewScrollAtBottom();
    const auditCoverageStatus = determineAuditCoverageStatus({
      targetMonth: this.selectedMonth,
      reviews: this.allEvaluatedReviews,
      isAtScrollBottom,
    });
    const hasReachedOlder = auditCoverageStatus === "OLDER_THAN_TARGET_REACHED";

    this.lastResult = {
      targetMonth: this.selectedMonth,
      reviewsChecked: this.allEvaluatedReviews.length,
      reviewsWithPhoto: withPhoto,
      reviewsOver15ThaiWords: over15,
      qualifiedReviews: qualified,
      unknownDateCount: unknownDate,
      editedReviewCount: editedCount,
      hasReachedOlderReviews: hasReachedOlder,
      isAtScrollBottom,
      auditCoverageStatus,
      reviews: this.allEvaluatedReviews,
    };

    this.render();
    this.showStatus(
      `Scan complete: ${this.allEvaluatedReviews.length} total reviews (+${newlyAdded} new). Qualified: ${qualified}`,
      "#059669"
    );
  }

  private copyJson() {
    if (!this.lastResult) {
      this.performScan();
    }
    const payload = {
      storeId: this.storeId || "STORE_ID_REQUIRED",
      month: this.selectedMonth,
      reviewsChecked: this.lastResult?.reviewsChecked ?? 0,
      reviewsWithPhoto: this.lastResult?.reviewsWithPhoto ?? 0,
      reviewsOver15ThaiWords: this.lastResult?.reviewsOver15ThaiWords ?? 0,
      qualifiedReviews: this.lastResult?.qualifiedReviews ?? 0,
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      this.showStatus("Copied result JSON to clipboard! Ready to paste into Dashboard.", "#0284c7");
    }).catch(() => {
      this.showStatus("Failed to copy to clipboard", "#e11d48");
    });
  }

  private async sendResult() {
    if (!this.storeId.trim()) {
      this.showStatus("Please enter Store ID before sending", "#e11d48");
      return;
    }

    if (!this.lastResult) {
      this.performScan();
    }

    const payload = {
      storeId: this.storeId.trim(),
      month: this.selectedMonth,
      reviewsChecked: this.lastResult?.reviewsChecked ?? 0,
      reviewsWithPhoto: this.lastResult?.reviewsWithPhoto ?? 0,
      reviewsOver15ThaiWords: this.lastResult?.reviewsOver15ThaiWords ?? 0,
      qualifiedReviews: this.lastResult?.qualifiedReviews ?? 0,
    };

    this.showStatus("Submitting to lineoppo.click...", "#0284c7");

    try {
      const resp = await fetch(`${this.backendUrl}/google-review-kpi/check-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        this.showStatus("Result saved successfully to Dashboard!", "#059669");
      } else {
        const data = await resp.json().catch(() => ({}));
        this.showStatus(data.message || `Server responded with ${resp.status}`, "#e11d48");
      }
    } catch {
      this.showStatus("Backend connection failed. Use 'Copy JSON' instead.", "#e11d48");
    }
  }

  private showStatus(msg: string, color: string) {
    const el = document.getElementById("oppo-kpi-status-msg");
    if (el) {
      el.textContent = msg;
      el.style.color = color;
    }
  }
}

// Auto-initialize when running as content script on Google Maps
if (typeof window !== "undefined" && window.location.href.includes("google")) {
  if (!(window as any).__OPPO_KPI_OVERLAY_INITIALIZED__) {
    (window as any).__OPPO_KPI_OVERLAY_INITIALIZED__ = true;
    const overlay = new ReviewCheckerOverlay();
    setTimeout(() => overlay.init(), 1000);
  }
}
