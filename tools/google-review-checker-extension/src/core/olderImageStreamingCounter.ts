export type PhotoRelationToTarget =
  | "NEWER"
  | "TARGET"
  | "OLDER"
  | "UNKNOWN_OR_MIXED"
  | "EDITED_NEUTRAL";

export type PhotoTraceEntry = {
  reviewSequence: number;
  photoIndex: number;
  dateText?: string;
  imageCaptureMonth: string | null;
  relationToTarget: PhotoRelationToTarget;
  olderImageCountBefore: number;
  olderImageCountAfter: number;
  stopTriggered: boolean;
};

export type StopEvidenceImage = {
  evidenceIndex: number;
  reviewSequence: number;
  photoIndex: number;
  dateText?: string;
  imageCaptureMonth: string;
  reviewId?: string;
};

export class OlderImageStreamingCounter {
  public olderImageCount: number = 0;
  public totalPhotosInspected: number = 0;
  public stopTriggered: boolean = false;
  public readonly stopThreshold: number = 5;
  public readonly targetMonth: string;
  public readonly stopEvidenceImages: StopEvidenceImage[] = [];
  public readonly photoTrace: PhotoTraceEntry[] = [];
  public stopTriggerDetail: {
    reviewSequence: number;
    photoIndex: number;
    imageCaptureMonth: string;
    olderImageCount: number;
  } | null = null;

  constructor(targetMonth: string, stopThreshold: number = 5) {
    this.targetMonth = targetMonth;
    this.stopThreshold = stopThreshold;
    this.olderImageCount = 0;
  }

  /**
   * Evaluates an individual customer photo sequentially in real time.
   * Cumulative counter: NEVER resets on TARGET, NEWER, EDITED, or UNKNOWN photos.
   * Halts immediately upon olderImageCount >= stopThreshold.
   */
  public processPhoto(params: {
    reviewSequence: number;
    photoIndex: number;
    dateText?: string;
    isEdited?: boolean;
    imageCaptureMonth?: string | null;
    reviewId?: string;
  }): {
    isStop: boolean;
    relation: PhotoRelationToTarget;
    olderImageCountBefore: number;
    olderImageCountAfter: number;
  } {
    // If store-level stop is already triggered, refuse any further processing
    if (this.stopTriggered) {
      return {
        isStop: true,
        relation: "OLDER",
        olderImageCountBefore: this.olderImageCount,
        olderImageCountAfter: this.olderImageCount,
      };
    }

    const { reviewSequence, photoIndex, dateText, isEdited, imageCaptureMonth, reviewId } = params;
    const olderImageCountBefore = this.olderImageCount;

    // RULE: Edited review photos are neutral
    if (isEdited) {
      return {
        isStop: false,
        relation: "EDITED_NEUTRAL",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
      };
    }

    this.totalPhotosInspected++;

    // RULE: Unknown or mixed photo metadata is neutral
    if (!imageCaptureMonth || imageCaptureMonth === "IMAGE_MONTH_UNKNOWN" || imageCaptureMonth === "MIXED_IMAGE_MONTH") {
      const entry: PhotoTraceEntry = {
        reviewSequence,
        photoIndex,
        dateText,
        imageCaptureMonth: null,
        relationToTarget: "UNKNOWN_OR_MIXED",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
        stopTriggered: false,
      };
      this.photoTrace.push(entry);
      return {
        isStop: false,
        relation: "UNKNOWN_OR_MIXED",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
      };
    }

    // RULE: Newer than target (e.g. Sep 2026 for Aug 2026 audit) -> Neutral, does NOT reset
    if (imageCaptureMonth > this.targetMonth) {
      const entry: PhotoTraceEntry = {
        reviewSequence,
        photoIndex,
        dateText,
        imageCaptureMonth,
        relationToTarget: "NEWER",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
        stopTriggered: false,
      };
      this.photoTrace.push(entry);
      return {
        isStop: false,
        relation: "NEWER",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
      };
    }

    // RULE: Target month image (e.g. Aug 2026) -> Neutral, does NOT reset cumulative olderImageCount
    if (imageCaptureMonth === this.targetMonth) {
      const entry: PhotoTraceEntry = {
        reviewSequence,
        photoIndex,
        dateText,
        imageCaptureMonth,
        relationToTarget: "TARGET",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
        stopTriggered: false,
      };
      this.photoTrace.push(entry);
      return {
        isStop: false,
        relation: "TARGET",
        olderImageCountBefore,
        olderImageCountAfter: this.olderImageCount,
      };
    }

    // RULE: Older than target month (e.g. Jul 2026, Jun 2026, Jan 2026) -> Increment counter
    if (imageCaptureMonth < this.targetMonth) {
      this.olderImageCount++;
      const olderImageCountAfter = this.olderImageCount;
      const isStop = olderImageCountAfter >= this.stopThreshold;

      const entry: PhotoTraceEntry = {
        reviewSequence,
        photoIndex,
        dateText,
        imageCaptureMonth,
        relationToTarget: "OLDER",
        olderImageCountBefore,
        olderImageCountAfter,
        stopTriggered: isStop,
      };
      this.photoTrace.push(entry);

      this.stopEvidenceImages.push({
        evidenceIndex: olderImageCountAfter,
        reviewSequence,
        photoIndex,
        dateText,
        imageCaptureMonth,
        reviewId,
      });

      if (isStop) {
        this.stopTriggered = true;
        this.stopTriggerDetail = {
          reviewSequence,
          photoIndex,
          imageCaptureMonth,
          olderImageCount: olderImageCountAfter,
        };
      }

      return {
        isStop,
        relation: "OLDER",
        olderImageCountBefore,
        olderImageCountAfter,
      };
    }

    return {
      isStop: false,
      relation: "UNKNOWN_OR_MIXED",
      olderImageCountBefore,
      olderImageCountAfter: this.olderImageCount,
    };
  }
}
