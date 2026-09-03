/**
 * Monthly Batch Audit Runner for Google Review KPI.
 *
 * Coordinates automated sequential store auditing directly in the active Google Maps tab.
 * - Adheres strictly to the single-store detection engine as source of truth.
 * - Controlled scrolling with lazy-load and boundary detection.
 * - Submits ONLY aggregate numbers (zero reviewer PII/text/media).
 * - Moves sequentially to next store via window navigation.
 */

import { GoogleMapsDomAdapter } from "../core/googleMapsDomAdapter.ts";
import {
  QualificationEngine,
  determineAuditCoverageStatus,
  type AuditCoverageStatus,
  type EvaluatedReview,
  type KpiScanResult,
} from "../core/qualificationEngine.ts";

export type BatchRunnerState =
  | "IDLE"
  | "LOADING_STORE"
  | "WAITING_FOR_MAPS"
  | "OPENING_REVIEWS"
  | "SETTING_NEWEST"
  | "SCANNING"
  | "SCROLLING"
  | "WAITING_FOR_LAZY_LOAD"
  | "AUDIT_COMPLETE"
  | "SUBMITTING_RESULT"
  | "MOVING_TO_NEXT_STORE"
  | "PAUSED"
  | "NEEDS_ATTENTION"
  | "COMPLETED";

export type BatchAuditSessionInfo = {
  sessionId: string;
  targetMonth: string;
  backendUrl?: string;
  /** Short-lived Bearer token issued by the dashboard for cross-origin auth. */
  runnerToken?: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "CANCELLED" | "COMPLETED";
  currentStore?: {
    storeId: string;
    storeName: string;
    storeCode?: string | null;
    googleMapsUrl: string;
    region?: string | null;
  } | null;
};

export class BatchAuditRunner {
  private state: BatchRunnerState = "IDLE";
  private sessionInfo: BatchAuditSessionInfo | null = null;
  private attemptCount: number = 0;
  private maxAttempts: number = 2;
  private isRunning: boolean = false;
  private statusListeners: Array<(state: BatchRunnerState, details?: any) => void> = [];

  constructor() {}

  public onStatusChange(listener: (state: BatchRunnerState, details?: any) => void) {
    this.statusListeners.push(listener);
  }

  private notify(state: BatchRunnerState, details?: any) {
    this.state = state;
    for (const l of this.statusListeners) {
      try {
        l(state, details);
      } catch (err) {
        console.error("[BatchAuditRunner] Listener error:", err);
      }
    }
  }

  public getState(): BatchRunnerState {
    return this.state;
  }

  public async initFromStorage(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage?.local?.get(["batchAuditSession", "batchRunnerState"], (result) => {
        if (result?.batchAuditSession) {
          this.sessionInfo = result.batchAuditSession;
          if (this.sessionInfo && this.sessionInfo.status === "RUNNING") {
            resolve(true);
            return;
          }
        }

        // URL hash fallback if storage hasn't synced yet
        if (typeof window !== "undefined" && window.location) {
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
          const hashParams = new URLSearchParams(hash);
          const hashToken = hashParams.get("oppoToken");
          const hashSessionId = hashParams.get("oppoSessionId");
          if (hashToken && hashSessionId) {
            resolve(true);
            return;
          }
        }

        resolve(false);
      });
    });
  }

  public setSession(session: BatchAuditSessionInfo) {
    this.sessionInfo = session;
  }

  public stop() {
    this.isRunning = false;
    this.notify("PAUSED", { reason: "USER_STOPPED" });
  }

  /**
   * Main entry point to run audit on the currently loaded Google Maps place page.
   */
  public async runForCurrentStore(storeInfo: {
    storeId: string;
    storeName: string;
    targetMonth: string;
    backendUrl: string;
  }): Promise<void> {
    if (this.isRunning) {
      console.warn("[BatchAuditRunner] Already running");
      return;
    }

    this.isRunning = true;
    this.attemptCount++;

    try {
      // 1. Check for CAPTCHA / bot challenge
      if (GoogleMapsDomAdapter.detectGoogleChallenge()) {
        await this.handleNeedsAttention(
          storeInfo.storeId,
          "GOOGLE_CHALLENGE_DETECTED",
          "Google Maps displayed a CAPTCHA or unusual traffic challenge",
          storeInfo.backendUrl,
        );
        return;
      }

      this.notify("WAITING_FOR_MAPS", { storeName: storeInfo.storeName });
      await this.sleep(1200);

      // 2. Open Reviews Pane if not yet open
      this.notify("OPENING_REVIEWS");
      let reviewsOpen = GoogleMapsDomAdapter.isReviewsPaneOpen();
      if (!reviewsOpen) {
        GoogleMapsDomAdapter.openReviewsPane();
        await this.sleep(1500);
        reviewsOpen = GoogleMapsDomAdapter.isReviewsPaneOpen();
      }

      if (!reviewsOpen) {
        if (this.attemptCount < this.maxAttempts) {
          await this.sleep(1000);
          return this.runForCurrentStore(storeInfo);
        }
        await this.handleNeedsAttention(
          storeInfo.storeId,
          "REVIEWS_PANE_NOT_FOUND",
          "Could not locate or open Google Maps reviews tab",
          storeInfo.backendUrl,
        );
        return;
      }

      // 3. Ensure Newest Sorting
      this.notify("SETTING_NEWEST");
      const sortRes = await GoogleMapsDomAdapter.ensureNewestSorting();
      if (!sortRes.success) {
        console.warn("[BatchAuditRunner] Could not confirm newest sorting:", sortRes.reason);
      }
      await this.sleep(800);

      // 4. Progressive Scanning & Controlled Scrolling
      this.notify("SCANNING");
      const auditResult = await this.scrollAndScanReviews(storeInfo.targetMonth);

      if (!auditResult) {
        await this.handleNeedsAttention(
          storeInfo.storeId,
          "SCAN_FAILED",
          "Failed to collect reviews from page",
          storeInfo.backendUrl,
        );
        return;
      }

      // 5. Submit Aggregate Result to Backend
      this.notify("SUBMITTING_RESULT", auditResult);
      await this.submitAuditResult(storeInfo.storeId, auditResult, storeInfo.backendUrl);

      // 6. Transition to Next Store
      this.notify("MOVING_TO_NEXT_STORE");
      await this.navigateToNextStore(storeInfo.backendUrl);
    } catch (err: any) {
      console.error("[BatchAuditRunner] Error during run:", err);
      await this.handleNeedsAttention(
        storeInfo.storeId,
        "UNEXPECTED_ERROR",
        err?.message || "Unexpected runner error",
        storeInfo.backendUrl,
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Controlled scrolling loop: scrolls down until coverage is complete or end of reviews.
   */
  private async scrollAndScanReviews(targetMonth: string): Promise<{
    reviewsChecked: number;
    reviewsWithPhoto: number;
    reviewsOver15ThaiWords: number;
    qualifiedReviews: number;
    coverageStatus: AuditCoverageStatus;
    oldestReviewDateText?: string;
  } | null> {
    const scrollContainer = GoogleMapsDomAdapter.getReviewScrollContainer();
    let noNewReviewsCount = 0;
    let prevCardCount = 0;
    const maxScrolls = 40; // Hard safety boundary

    for (let scrollIdx = 0; scrollIdx < maxScrolls; scrollIdx++) {
      if (!this.isRunning) return null;

      // Extract and evaluate currently loaded reviews using single-store detection engine
      const rawReviews = GoogleMapsDomAdapter.extractReviews();
      const scanResult = QualificationEngine.calculateScanSummary(
        rawReviews,
        targetMonth,
        new Date(),
        false,
      );

      // Condition A: Older than target reached -> Finished! Stop scrolling!
      if (scanResult.auditCoverageStatus === "OLDER_THAN_TARGET_REACHED") {
        this.notify("AUDIT_COMPLETE", { coverageStatus: scanResult.auditCoverageStatus, reviews: scanResult.reviewsChecked });
        const oldest = scanResult.reviews[scanResult.reviews.length - 1];
        return {
          reviewsChecked: scanResult.reviewsChecked,
          reviewsWithPhoto: scanResult.reviewsWithPhoto,
          reviewsOver15ThaiWords: scanResult.reviewsOver15ThaiWords,
          qualifiedReviews: scanResult.qualifiedReviews,
          coverageStatus: scanResult.auditCoverageStatus,
          oldestReviewDateText: oldest?.rawDateText || undefined,
        };
      }

      // If cards did not increase across consecutive scroll attempts
      if (rawReviews.length === prevCardCount) {
        noNewReviewsCount++;
        if (noNewReviewsCount >= 5) {
          // Reached physical end of available reviews (Condition B)
          const finalResult = QualificationEngine.calculateScanSummary(
            rawReviews,
            targetMonth,
            new Date(),
            true, // isAtScrollBottom = true
          );
          const oldest = finalResult.reviews[finalResult.reviews.length - 1];

          return {
            reviewsChecked: finalResult.reviewsChecked,
            reviewsWithPhoto: finalResult.reviewsWithPhoto,
            reviewsOver15ThaiWords: finalResult.reviewsOver15ThaiWords,
            qualifiedReviews: finalResult.qualifiedReviews,
            coverageStatus: finalResult.auditCoverageStatus,
            oldestReviewDateText: oldest?.rawDateText || undefined,
          };
        }
      } else {
        noNewReviewsCount = 0;
        prevCardCount = rawReviews.length;
      }

      // Controlled scroll down
      this.notify("SCROLLING", { cardCount: rawReviews.length, scrollStep: scrollIdx + 1 });
      if (scrollContainer) {
        scrollContainer.scrollBy({ top: 900, behavior: "smooth" });
      } else {
        window.scrollBy({ top: 800, behavior: "smooth" });
      }

      // Wait for lazy load
      this.notify("WAITING_FOR_LAZY_LOAD");
      await this.sleep(1400);
    }

    // Safety fallback if reached maxScrolls
    const finalRaw = GoogleMapsDomAdapter.extractReviews();
    const fallbackResult = QualificationEngine.calculateScanSummary(
      finalRaw,
      targetMonth,
      new Date(),
      true,
    );
    const oldestFallback = fallbackResult.reviews[fallbackResult.reviews.length - 1];

    return {
      reviewsChecked: fallbackResult.reviewsChecked,
      reviewsWithPhoto: fallbackResult.reviewsWithPhoto,
      reviewsOver15ThaiWords: fallbackResult.reviewsOver15ThaiWords,
      qualifiedReviews: fallbackResult.qualifiedReviews,
      coverageStatus: fallbackResult.auditCoverageStatus,
      oldestReviewDateText: oldestFallback?.rawDateText || undefined,
    };
  }

  /**
   * Submits aggregate numbers to backend.
   */
  private async submitAuditResult(
    storeId: string,
    result: {
      reviewsChecked: number;
      reviewsWithPhoto: number;
      reviewsOver15ThaiWords: number;
      qualifiedReviews: number;
      coverageStatus: AuditCoverageStatus;
      oldestReviewDateText?: string;
    },
    backendUrl: string,
  ): Promise<void> {
    if (!this.sessionInfo?.sessionId) {
      throw new Error("No active session ID");
    }

    const payload = {
      reviewsChecked: result.reviewsChecked,
      reviewsWithPhoto: result.reviewsWithPhoto,
      reviewsOver15ThaiWords: result.reviewsOver15ThaiWords,
      qualifiedReviews: result.qualifiedReviews,
      targetQualifiedReviews: 10,
      auditCoverageStatus:
        result.coverageStatus === "OLDER_THAN_TARGET_REACHED"
          ? "OLDER_THAN_TARGET_REACHED"
          : "END_OF_AVAILABLE_REVIEWS",
      oldestReviewDateText: result.oldestReviewDateText || null,
      notes: "Auto-verified via Extension Batch Audit Runner",
    };

    const url = `${backendUrl}/google-review-kpi/audit-session/${this.sessionInfo.sessionId}/stores/${storeId}/complete`;
    const headers = this.buildAuthHeaders({ "Content-Type": "application/json" });
    console.debug("[BatchAuditRunner] fetch", { method: "POST", url, hasToken: !!this.sessionInfo.runnerToken });
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to submit audit result: ${res.status} ${errText}`);
    }
  }

  /**
   * Flags store as NEEDS_ATTENTION on backend and pauses runner.
   */
  private async handleNeedsAttention(
    storeId: string,
    errorCode: string,
    errorMessage: string,
    backendUrl: string,
  ): Promise<void> {
    this.notify("NEEDS_ATTENTION", { errorCode, errorMessage });
    this.isRunning = false;

    if (this.sessionInfo?.sessionId) {
      try {
        const url = `${backendUrl}/google-review-kpi/audit-session/${this.sessionInfo.sessionId}/stores/${storeId}/flag-attention`;
        const headers = this.buildAuthHeaders({ "Content-Type": "application/json" });
        console.debug("[BatchAuditRunner] fetch", { method: "POST", url, hasToken: !!this.sessionInfo.runnerToken });
        await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ errorCode, errorMessage }),
        });
      } catch (err) {
        console.error("[BatchAuditRunner] Failed to flag needs attention on backend:", err);
      }
    }
  }

  /**
   * Fetches the next pending store from backend and navigates to its Google Maps URL.
   */
  private async navigateToNextStore(backendUrl: string): Promise<void> {
    if (!this.sessionInfo?.sessionId) return;

    const url = `${backendUrl}/google-review-kpi/audit-session/${this.sessionInfo.sessionId}/next-store`;
    const headers = this.buildAuthHeaders();
    console.debug("[BatchAuditRunner] fetch", { method: "GET", url, hasToken: !!this.sessionInfo.runnerToken });
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`Failed to fetch next store: ${res.status}`);
    }

    const data = await res.json();
    if (!data || !data.store) {
      // No more stores in queue -> Batch Complete!
      this.notify("COMPLETED");
      chrome.storage?.local?.remove(["batchAuditSession"]);
      alert("🎉 Monthly Google Review KPI Batch Audit completed for all stores!");
      return;
    }

    const nextStore = data.store;
    if (!nextStore.googleMapsUrl) {
      console.warn("[BatchAuditRunner] Next store lacks googleMapsUrl, moving past it");
      return this.navigateToNextStore(backendUrl);
    }

    // Update transient storage
    const updatedSession = {
      ...this.sessionInfo,
      currentStore: {
        storeId: nextStore.storeId,
        storeName: nextStore.storeName,
        storeCode: nextStore.storeCode,
        googleMapsUrl: nextStore.googleMapsUrl,
        region: nextStore.region,
      },
    };
    chrome.storage?.local?.set({ batchAuditSession: updatedSession });

    // Navigate to next store with query & hash params preserved
    let navUrl = nextStore.googleMapsUrl;
    try {
      const parsed = new URL(navUrl);
      parsed.searchParams.set("oppoStoreId", nextStore.storeId);
      if (nextStore.storeCode) {
        parsed.searchParams.set("oppoCode", nextStore.storeCode);
        parsed.searchParams.set("oppoExtId", nextStore.storeCode);
      }
      parsed.searchParams.set("oppoName", nextStore.storeName);
      if (this.sessionInfo?.targetMonth) {
        parsed.searchParams.set("oppoMonth", this.sessionInfo.targetMonth);
      }
      if (this.sessionInfo?.runnerToken || this.sessionInfo?.sessionId) {
        const hashParams = new URLSearchParams();
        if (this.sessionInfo.runnerToken) hashParams.set("oppoToken", this.sessionInfo.runnerToken);
        if (this.sessionInfo.sessionId) hashParams.set("oppoSessionId", this.sessionInfo.sessionId);
        parsed.hash = hashParams.toString();
      }
      navUrl = parsed.toString();
    } catch {
      // Keep original url if parsing failed
    }

    await this.sleep(1000);
    window.location.href = navUrl;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Builds fetch headers including the Authorization Bearer token when a
   * runner token is available. Never logs the token value itself.
   * Fails closed by throwing an Error if no token is present, preventing
   * silent 401 unauthenticated requests from breaking runner flows.
   */
  private buildAuthHeaders(base: Record<string, string> = {}): Record<string, string> {
    let token = this.sessionInfo?.runnerToken;
    if (!token && typeof window !== "undefined" && window.location) {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const hashToken = hashParams.get("oppoToken");
      if (hashToken) {
        token = hashToken;
        if (this.sessionInfo) {
          this.sessionInfo.runnerToken = hashToken;
        }
      }
    }

    if (token) {
      return { ...base, Authorization: `Bearer ${token}` };
    }

    console.error("[BatchAuditRunner] Runner token missing — refusing unauthenticated request");
    throw new Error("Runner authentication token is missing. Please resume the session from the dashboard to acquire a fresh token.");
  }
}
