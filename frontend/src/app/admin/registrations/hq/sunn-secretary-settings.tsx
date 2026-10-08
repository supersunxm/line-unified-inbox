"use client";
import { useEffect, useRef, useState } from "react";
import type { AppLanguage } from "../../../language-utils";
import { secretarySettingsText } from "./sunn-secretary-settings-i18n";

export type SecretaryStatus = {
  channelIdConfigured: boolean; channelSecretConfigured: boolean; accessTokenConfigured: boolean; botUserIdConfigured: boolean;
  webhookEnabled: boolean; webhookUrl: string; validationState: "NOT_CONFIGURED" | "NOT_VALIDATED" | "VALIDATED" | "FAILED"; lastValidatedAt: string | null;
};
const fields = ["channelId", "channelSecret", "accessToken", "botUserId"] as const;
type Field = typeof fields[number];
const empty = (): Record<Field, string> => ({ channelId: "", channelSecret: "", accessToken: "", botUserId: "" });

// Never display raw backend errors; they might contain integration diagnostics.
export function settingsError(status: number, language: AppLanguage): string {
  const t = secretarySettingsText[language];
  return status === 401 ? t.unauthorized : status === 403 ? t.forbidden : status === 400 ? t.invalid : status === 429 ? t.rateLimited : t.error;
}
async function settingsRequest(path: string, language: AppLanguage, method = "GET", values?: Record<string, string>, signal?: AbortSignal): Promise<SecretaryStatus> {
  const response = await fetch(`/api-backend/sunn-secretary/owner/${path}`, {
    method, credentials: "include", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", "X-Sunn-Secretary-Settings": "1" },
    ...(values ? { body: JSON.stringify(values) } : {}),
  });
  if (!response.ok) throw new Error(settingsError(response.status, language));
  return response.json() as Promise<SecretaryStatus>;
}

export function SunnSecretarySettings({ language, onClose }: { language: AppLanguage; onClose: () => void }) {
  const t = secretarySettingsText[language];
  const [status, setStatus] = useState<SecretaryStatus | null>(null);
  const [values, setValues] = useState(empty);
  const [visible, setVisible] = useState<Record<Field, boolean>>({ channelId: false, channelSecret: false, accessToken: false, botUserId: false });
  const [busy, setBusy] = useState<"loading" | "saving" | "testing" | null>("loading");
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void settingsRequest("status", language, "GET", undefined, abort.signal).then(result => { if (!abort.signal.aborted) setStatus(result); }).catch((cause: unknown) => {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : t.error);
    }).finally(() => { if (!abort.signal.aborted) setBusy(null); });
    return () => abort.abort();
  }, [language, reload, t.error]);

  const act = async (action: "saving" | "testing") => {
    if (lock.current || busy || !status) return;
    lock.current = true; setBusy(action); setError(null); setNotice(null);
    try {
      const result = await settingsRequest(action === "saving" ? "credentials" : "test-connection", language, action === "saving" ? "PATCH" : "POST", action === "saving" ? values : {});
      setStatus(result);
      if (action === "saving") { setValues(empty()); setVisible({ channelId: false, channelSecret: false, accessToken: false, botUserId: false }); setNotice(t.saved); }
      else setNotice(result.validationState === "VALIDATED" ? t.validated : t.failed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { lock.current = false; setBusy(null); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="secretary-settings-title">
    <div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><h2 id="secretary-settings-title" className="text-lg font-bold">{t.title}</h2><button type="button" disabled={busy === "saving" || busy === "testing"} onClick={onClose} className="rounded-lg border border-[var(--app-border)] px-3 py-2">{t.close}</button></div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{status ? status.webhookEnabled ? t.enabled : t.disabled : t.unknown}</p>
      {busy === "loading" && <p role="status">{t.loading}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <form onSubmit={event => { event.preventDefault(); void act("saving"); }} className="space-y-3" autoComplete="off">
        {fields.map(field => {
          const key = ({ channelId: "channelIdConfigured", channelSecret: "channelSecretConfigured", accessToken: "accessTokenConfigured", botUserId: "botUserIdConfigured" } as const)[field];
          const secret = field === "channelSecret" || field === "accessToken";
          return <div key={field} className="space-y-1"><div className="flex justify-between gap-3"><label htmlFor={`secretary-${field}`} className="text-sm font-medium">{t[field]}</label><span className="text-xs">{status ? status[key] ? t.configured : t.missing : t.unknown}</span></div>
            <div className="flex gap-2"><input id={`secretary-${field}`} name={field} type={secret && !visible[field] ? "password" : "text"} autoComplete="off" spellCheck={false} maxLength={field === "accessToken" ? 4096 : field === "botUserId" ? 33 : field === "channelSecret" ? 32 : 20} value={values[field]} onChange={event => setValues(current => ({ ...current, [field]: event.target.value }))} disabled={busy !== null || !status} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm" />
              {secret && <button type="button" aria-label={`${visible[field] ? t.hide : t.show} ${t[field]}`} aria-pressed={visible[field]} disabled={busy !== null || !status} onClick={() => setVisible(current => ({ ...current, [field]: !current[field] }))} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm">{visible[field] ? t.hide : t.show}</button>}</div>
          </div>;
        })}
        <p className="text-xs text-[var(--app-text-secondary)]">{t.preserve}</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy !== null || !status || !fields.some(field => values[field].trim())} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm text-white disabled:opacity-50">{busy === "saving" ? t.saving : t.save}</button><button type="button" onClick={() => void act("testing")} disabled={busy !== null || !status?.accessTokenConfigured || !status.botUserIdConfigured || fields.some(field => values[field].trim())} className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm disabled:opacity-50">{busy === "testing" ? t.testing : t.test}</button><button type="button" onClick={() => { setBusy("loading"); setError(null); setStatus(null); setReload(current => current + 1); }} disabled={busy !== null} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm">{t.refresh}</button></div>
      </form>
      <p className="text-sm">{status ? status.validationState === "VALIDATED" ? t.validated : status.validationState === "FAILED" ? t.failed : t.notValidated : t.unknown}</p>
      {status?.lastValidatedAt && <p className="text-xs">{t.verifiedAt}: {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language === "th" ? "th-TH" : "en-US", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(status.lastValidatedAt))}</p>}
      <p className="text-xs text-[var(--app-text-secondary)]">{t.limited}</p>
      <p className="text-sm font-semibold">{t.webhook}</p><code className="block break-all rounded-lg border border-[var(--app-border)] p-3 text-xs">https://lineoppo.click/sunn-secretary/webhook</code>
    </div>
  </div>;
}
