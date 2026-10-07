"use client";

import React, { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ApiConversation, ApiCustomerSalesInformation, UpdateCustomerSalesInfoInput } from "@/types/api";
import { getCustomerSalesTagEditorText } from "./customer-sales-tag-editor-i18n";

export interface CustomerSalesTagEditorProps {
  conversationId: string;
  salesInfo?: ApiCustomerSalesInformation | null;
  availableProductModels?: Array<{ id: string; name: string }>;
  disabled?: boolean;
  onSaved?: (updatedConversation: ApiConversation) => void;
  language?: "th" | "en" | "zh";
}

type SalesStatusOption = "ONLINE" | "INTERESTED" | "PURCHASED" | "FILM" | "";
type PaymentOption = "CASH" | "INSTALLMENT";

const filmBrandOptions = ["OPPO", "iPhone", "Samsung", "vivo", "Xiaomi", "HONOR", "realme", "Other"] as const;
const onlineSourceOptions = ["TikTok", "Facebook", "Instagram", "LINE", "Website", "Other"] as const;

export function CustomerSalesTagEditor({
  conversationId,
  salesInfo,
  availableProductModels = [],
  disabled = false,
  onSaved,
  language = "th",
}: CustomerSalesTagEditorProps) {
  const t = getCustomerSalesTagEditorText(language);
  const [prevKey, setPrevKey] = useState("");
  const [status, setStatus] = useState<SalesStatusOption>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentOption>("CASH");
  const [selectedProductModelId, setSelectedProductModelId] = useState<string>("");
  const [customModelName, setCustomModelName] = useState<string>("");
  const [filmBrand, setFilmBrand] = useState<string>("");
  const [onlineSource, setOnlineSource] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync state during render whenever conversationId or salesInfo changes
  const currentKey = `${conversationId}:${salesInfo?.status ?? ""}:${salesInfo?.filmBrand ?? ""}:${salesInfo?.onlineSource ?? ""}:${salesInfo?.paymentMethod ?? ""}:${salesInfo?.products?.[0]?.model?.id ?? ""}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setStatus(salesInfo?.status ?? "");
    setFilmBrand(salesInfo?.filmBrand?.trim() ?? "");
    setOnlineSource(salesInfo?.onlineSource?.trim() ?? "");
    setPaymentMethod(salesInfo?.paymentMethod === "INSTALLMENT" ? "INSTALLMENT" : "CASH");
    const firstProduct = salesInfo?.products?.[0];
    if (firstProduct) {
      setSelectedProductModelId(firstProduct.model?.id ?? "");
      setCustomModelName(firstProduct.customProductName ?? firstProduct.model?.name ?? "");
    } else {
      setSelectedProductModelId("");
      setCustomModelName("");
    }
    setFeedback(null);
  }

  const handleSave = async () => {
    if (!conversationId || !status || isSaving || disabled) return;

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: UpdateCustomerSalesInfoInput = {
        status,
      };

      if (status === "FILM") {
        const normalizedBrand = filmBrand.trim();
        if (!normalizedBrand) {
          setFeedback({
            type: "error",
            message: t.chooseBrandBeforeSave,
          });
          setIsSaving(false);
          return;
        }
        payload.filmBrand = normalizedBrand;
      }

      if (status === "ONLINE") {
        const normalizedSource = onlineSource.trim();
        if (!normalizedSource) {
          setFeedback({
            type: "error",
            message: t.chooseSourceBeforeSave,
          });
          setIsSaving(false);
          return;
        }
        payload.onlineSource = normalizedSource;
      }

      if (status === "PURCHASED") {
        payload.paymentMethod = paymentMethod;
        payload.purchaseChannel = ["STORE"];
        if (selectedProductModelId) {
          payload.products = [
            {
              productModelId: selectedProductModelId,
              customProductName: customModelName.trim() || undefined,
              quantity: 1,
              status: "PURCHASED",
            },
          ];
        }
      }

      const updated = await api.updateCustomerSalesInfo(conversationId, payload);
      setFeedback({
        type: "success",
        message:
          t.saveSuccess,
      });
      onSaved?.(updated);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t.saveFailed;
      setFeedback({ type: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      data-customer-sales-editor
      data-sales-tag-section
      className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3.5 shadow-[var(--app-shadow-card)]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">
          🏷️ {t.title}
        </h3>
        {salesInfo?.status && (
          <span
            data-sales-status-badge
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              salesInfo.status === "ONLINE"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                : salesInfo.status === "INTERESTED"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                  : salesInfo.status === "PURCHASED"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
            }`}
          >
            {salesInfo.status}
          </span>
        )}
      </div>

      {/* Status Buttons */}
      <div className="grid grid-cols-4 gap-1.5 mb-3" data-sales-status-options>
        {(
          [
            ["ONLINE", t.online, "bg-blue-600 hover:bg-blue-700 text-white"],
            ["INTERESTED", t.interested, "bg-amber-600 hover:bg-amber-700 text-white"],
            ["PURCHASED", t.purchased, "bg-emerald-600 hover:bg-emerald-700 text-white"],
            ["FILM", t.film, "bg-violet-600 hover:bg-violet-700 text-white"],
          ] as const
        ).map(([value, label, activeClasses]) => {
          const isSelected = status === value;
          return (
            <button
              key={value}
              type="button"
              data-sales-status-button={value}
              disabled={disabled || isSaving}
              onClick={() => {
                setStatus(value);
                if (value !== "FILM") setFilmBrand("");
                if (value !== "ONLINE") setOnlineSource("");
              }}
              className={`rounded-[var(--app-radius-sm)] py-1.5 px-2 text-xs font-semibold transition-all text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent)] disabled:opacity-50 disabled:cursor-not-allowed ${
                isSelected
                  ? activeClasses
                  : "border border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Purchased Details (Payment Method & Product) */}
      {status === "PURCHASED" && (
        <div data-purchased-fields className="mb-3 space-y-2.5 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">
              {t.paymentMethod}
            </label>
            <div className="flex gap-2" data-payment-method-options>
              {(
                [
                  ["CASH", t.cash],
                  ["INSTALLMENT", t.installment],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-[var(--app-radius-sm)] border px-2 py-1 text-xs font-medium cursor-pointer transition-colors ${
                    paymentMethod === val
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-600 font-semibold"
                      : "border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-subtle)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={val}
                    checked={paymentMethod === val}
                    disabled={disabled || isSaving}
                    onChange={() => setPaymentMethod(val)}
                    className="sr-only"
                    data-payment-method-radio={val}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Product Model Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">
              {t.purchasedModel}
            </label>
            {availableProductModels.length > 0 ? (
              <select
                data-product-model-select
                value={selectedProductModelId}
                disabled={disabled || isSaving}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedProductModelId(id);
                  const model = availableProductModels.find((m) => m.id === id);
                  if (model) setCustomModelName(model.name);
                }}
                className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50"
              >
                <option value="">{t.selectModel}</option>
                {availableProductModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                data-custom-product-input
                placeholder={t.customModelPlaceholder}
                value={customModelName}
                disabled={disabled || isSaving}
                onChange={(e) => setCustomModelName(e.target.value)}
                className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50"
              />
            )}
          </div>
        </div>
      )}

      {status === "ONLINE" && (
        <div data-online-source-fields className="mb-3 space-y-2.5 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
          <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">
            {t.onlineSource}
          </label>
          <select
            data-online-source-select
            value={onlineSourceOptions.includes(onlineSource as (typeof onlineSourceOptions)[number]) ? onlineSource : onlineSource ? "Other" : ""}
            disabled={disabled || isSaving}
            onChange={(e) => setOnlineSource(e.target.value === "Other" ? "" : e.target.value)}
            className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50"
          >
            <option value="">{t.selectSource}</option>
            {onlineSourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          {(!onlineSourceOptions.includes(onlineSource as (typeof onlineSourceOptions)[number]) || onlineSource === "") && (
            <input
              type="text"
              data-custom-online-source-input
              placeholder={t.otherSourcePlaceholder}
              value={onlineSource}
              disabled={disabled || isSaving}
              onChange={(e) => setOnlineSource(e.target.value)}
              className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50"
            />
          )}
        </div>
      )}

      {status === "FILM" && (
        <div data-film-fields className="mb-3 space-y-2.5 rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] p-2.5 border border-[var(--app-border-subtle)]">
          <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">
            {t.phoneBrand}
          </label>
          <select
            data-film-brand-select
            value={filmBrandOptions.includes(filmBrand as (typeof filmBrandOptions)[number]) ? filmBrand : filmBrand ? "Other" : ""}
            disabled={disabled || isSaving}
            onChange={(e) => setFilmBrand(e.target.value === "Other" ? "" : e.target.value)}
            className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50"
          >
            <option value="">{t.selectBrand}</option>
            {filmBrandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
          {(!filmBrandOptions.includes(filmBrand as (typeof filmBrandOptions)[number]) || filmBrand === "") && (
            <input
              type="text"
              data-custom-film-brand-input
              placeholder={t.otherBrandPlaceholder}
              value={filmBrand}
              disabled={disabled || isSaving}
              onChange={(e) => setFilmBrand(e.target.value)}
              className="w-full rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] outline-none focus:ring-1 focus:ring-[var(--app-accent)] disabled:opacity-50"
            />
          )}
        </div>
      )}

      {/* Save Button */}
      <button
        type="button"
        data-save-sales-tag-button
        disabled={!status || isSaving || disabled}
        onClick={() => void handleSave()}
        className="w-full rounded-[var(--app-radius-sm)] bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-white py-1.5 px-3 text-xs font-semibold shadow-[var(--app-shadow-card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {isSaving ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>{t.saving}</span>
          </>
        ) : (
          <span>{t.save}</span>
        )}
      </button>

      {/* Feedback Message */}
      {feedback && (
        <div
          role="alert"
          data-sales-tag-feedback={feedback.type}
          className={`mt-2 rounded-[var(--app-radius-sm)] p-2 text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </section>
  );
}
