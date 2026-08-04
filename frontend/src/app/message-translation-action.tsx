"use client";

import { useState } from "react";
import { api, TranslationFeedbackIssueCategory } from "@/lib/api";
import type { ApiConversation } from "@/types/api";
import { isMessageTranslationEligible } from "./message-translation";

type Message = ApiConversation["messages"][number];
type TranslationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; translatedText: string }
  | { status: "error" };
type FeedbackState = "idle" | "choosing-reason" | "submitting" | "submitted" | "error";

const incorrectReasons: Array<{ value: TranslationFeedbackIssueCategory; label: string }> = [
  { value: "meaning_issue", label: "Meaning issue" },
  { value: "terminology_issue", label: "Terminology issue" },
  { value: "other", label: "Other" },
];

export function MessageTranslationAction({
  message,
  userRole,
  onTranslated,
}: {
  message: Message;
  userRole: "ADMIN" | "VIEWER";
  onTranslated: (translatedText: string) => void;
}) {
  const [state, setState] = useState<TranslationState>({ status: "idle" });
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [incorrectReason, setIncorrectReason] = useState<TranslationFeedbackIssueCategory | null>(null);

  if (!isMessageTranslationEligible(message, userRole)) return null;

  async function translate() {
    if (state.status === "loading") return;
    setState({ status: "loading" });
    try {
      const result = await api.translateMessage(message.id, "en");
      setState({ status: "success", translatedText: result.translatedText });
      onTranslated(result.translatedText);
    } catch {
      setState({ status: "error" });
    }
  }

  async function submitFeedback(
    rating: "HELPFUL" | "INCORRECT",
    issueCategory?: TranslationFeedbackIssueCategory,
  ) {
    if (feedbackState === "submitting" || feedbackState === "submitted") return;
    setFeedbackState("submitting");
    try {
      await api.submitTranslationFeedback(message.id, {
        targetLanguage: "en",
        rating,
        ...(issueCategory ? { issueCategory } : {}),
      });
      setFeedbackState("submitted");
    } catch {
      setFeedbackState("error");
    }
  }

  return (
    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
      {state.status !== "success" && (
        <button
          type="button"
          disabled={state.status === "loading"}
          onClick={() => void translate()}
          className="rounded px-1 py-0.5 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:text-slate-500 dark:text-blue-300"
          aria-label="Translate message to English"
        >
          {state.status === "loading" ? "Translating..." : "Translate"}
        </button>
      )}
      <div aria-live="polite">
        {state.status === "success" && (
          <div>
            <div className="rounded-lg bg-blue-50 px-2.5 py-2 text-left dark:bg-blue-950/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                AI Translation · English
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
                {state.translatedText}
              </p>
            </div>
            {feedbackState === "submitted" ? (
              <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-300" role="status">Feedback recorded</p>
            ) : (
              <div className="mt-2 text-left" aria-label="Rate translation quality">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={feedbackState === "submitting"}
                    onClick={() => void submitFeedback("HELPFUL")}
                    className="rounded-full border border-green-300 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950/50"
                  >
                    Helpful 👍
                  </button>
                  <button
                    type="button"
                    disabled={feedbackState === "submitting"}
                    onClick={() => setFeedbackState("choosing-reason")}
                    className="rounded-full border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
                  >
                    Incorrect 👎
                  </button>
                </div>
                {(feedbackState === "choosing-reason" || (feedbackState === "error" && incorrectReason)) && (
                  <fieldset className="mt-2">
                    <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">What was incorrect?</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {incorrectReasons.map((reason) => (
                        <label key={reason.value} className="flex cursor-pointer items-center gap-1 text-xs">
                          <input
                            type="radio"
                            name={`translation-feedback-${message.id}`}
                            value={reason.value}
                            checked={incorrectReason === reason.value}
                            onChange={() => setIncorrectReason(reason.value)}
                          />
                          {reason.label}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!incorrectReason}
                      onClick={() => incorrectReason && void submitFeedback("INCORRECT", incorrectReason)}
                      className="mt-2 rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900"
                    >
                      Submit feedback
                    </button>
                  </fieldset>
                )}
                {feedbackState === "submitting" && <p className="mt-1 text-xs text-slate-500" role="status">Submitting feedback...</p>}
                {feedbackState === "error" && <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">Unable to submit feedback</p>}
              </div>
            )}
          </div>
        )}
        {state.status === "error" && (
          <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
            Translation unavailable
          </p>
        )}
      </div>
    </div>
  );
}
