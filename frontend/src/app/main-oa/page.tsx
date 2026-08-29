"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { api } from "@/lib/api";
import { authorizationFor, defaultRouteForUser, type AuthUser } from "@/lib/authorization";
import { createMainOaAccount, getMainOaAccounts, type MainOaAccount } from "@/lib/main-oa-api";
import type { ApiConversation } from "@/types/api";
import { getMessageSenderName } from "../message-sender";
import { lineStickerLabel, MessageSticker } from "../message-sticker";

type Language = "th" | "en" | "zh";

export default function MainOaPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<ApiConversation[]>([]);
  const [selected, setSelected] = useState<ApiConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [accounts, setAccounts] = useState<MainOaAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [setupName, setSetupName] = useState("OPPO Main OA");
  const [channelId, setChannelId] = useState("");
  const [channelSecret, setChannelSecret] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.mainOaConversations({ pageSize: 100 });
      setItems(result.items);
      if (result.items[0]) setSelected(await api.mainOaConversation(result.items[0].id));
      else setSelected(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to load Main OA");
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      setSetupError(null);
      setAccounts(await getMainOaAccounts());
    } catch (reason: unknown) {
      setSetupError(reason instanceof Error ? reason.message : "Unable to load Main OA connection status");
    } finally {
      setAccountsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.me().then((rawUser) => {
      if (cancelled) return;
      const user = rawUser as AuthUser;
      const authorization = authorizationFor(user);
      if (!authorization.workspaces.mainOa || !authorization.capabilities.accessMainOa) {
        router.replace(defaultRouteForUser(user));
        return;
      }
      setAuthUser(user);
      setAuthChecked(true);
      void load();
      void loadAccounts();
    }).catch(() => {
      if (cancelled) return;
      setAuthChecked(true);
      router.replace("/login");
    });
    return () => { cancelled = true; };
  }, [load, loadAccounts, router]);

  const choose = async (id: string) => {
    try {
      setError(null);
      setSelected(await api.mainOaConversation(id));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to load conversation");
    }
  };

  const send = async () => {
    if (!selected || !reply.trim()) return;
    try {
      setError(null);
      await api.sendMainOaMessage(selected.id, reply.trim(), crypto.randomUUID());
      setReply("");
      setSelected(await api.mainOaConversation(selected.id));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to send reply");
    }
  };

  const connectMainOa = async () => {
    if (!setupName.trim() || !channelId.trim() || !channelSecret.trim()) {
      setSetupError("Account name, Channel ID, and Channel Secret are required.");
      return;
    }
    setConnecting(true);
    setSetupError(null);
    try {
      const created = await createMainOaAccount({
        name: setupName.trim(),
        channelId: channelId.trim(),
        channelSecret: channelSecret.trim(),
      });
      setChannelSecret("");
      setAccounts([created]);
      setCopied(false);
      await load();
    } catch (reason: unknown) {
      setSetupError(reason instanceof Error ? reason.message : "Unable to connect Main OA");
    } finally {
      setConnecting(false);
    }
  };

  const copyWebhook = async (webhookUrl: string) => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { router.replace("/login"); }
  }, [router]);

  if (!authChecked || !authUser) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Main OA…</main>;
  }

  const authorization = authorizationFor(authUser);
  const mainAccount = accounts[0] ?? null;

  return (
    <AppShell
      currentSection="main-oa"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: "Main OA inbox", searchPlaceholder: "Search Main OA conversations" }}
      language={language}
      changeLanguage={setLanguage}
      searchText={searchText}
      setSearchText={setSearchText}
      logout={logout}
    >
      <main className="min-w-0 flex-1 bg-[var(--app-bg)] p-4 text-[var(--app-text-primary)] sm:p-6">
        <header className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-accent)]">Main OA workspace</p>
            <h1 className="text-2xl font-bold">Main OA</h1>
            <p className="text-sm text-[var(--app-text-secondary)]">Head office inbox — isolated from Store Operations</p>
          </div>
          {authorization.workspaces.store && <Link href="/chats" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium">Switch to Branch Stores</Link>}
        </header>

        {accountsLoaded && !mainAccount && authorization.capabilities.manageMainOa && (
          <section className="mx-auto mb-4 max-w-7xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-accent)]">Connect Messaging API</p>
              <h2 className="text-lg font-bold">Connect Main OA without an old Channel Access Token</h2>
              <p className="mt-1 max-w-3xl text-sm text-[var(--app-text-secondary)]">Enter the Channel ID and Channel Secret from LINE Official Account Manager. The backend verifies them with LINE, creates a short-lived stateless token, encrypts it, and rotates it automatically. The secret is never returned to this page.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">Account name<input value={setupName} onChange={(event) => setSetupName(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium">Channel ID<input value={channelId} onChange={(event) => setChannelId(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium">Channel Secret<input type="password" autoComplete="off" value={channelSecret} onChange={(event) => setChannelSecret(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal" /></label>
            </div>
            {setupError && <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{setupError}</div>}
            <button type="button" disabled={connecting} onClick={() => void connectMainOa()} className="mt-4 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{connecting ? "Verifying with LINE…" : "Verify & Connect Main OA"}</button>
          </section>
        )}

        {mainAccount && (
          <section className="mx-auto mb-4 max-w-7xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{mainAccount.name}</h2>
                  <span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--app-accent)]">Stateless token · Auto managed</span>
                  <span className="rounded-full border border-[var(--app-border)] px-2 py-1 text-xs">{mainAccount.connectionStatus}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--app-text-secondary)]">Channel ID: {mainAccount.channelId ?? "—"} {mainAccount.basicId ? `· Basic ID: ${mainAccount.basicId}` : ""}</p>
              </div>
            </div>
            {mainAccount.webhookUrl ? (
              <div className="mt-4 rounded-lg bg-[var(--app-surface-subtle)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">Next: replace the old Kaojao Webhook URL with this URL</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={mainAccount.webhookUrl} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm" />
                  <button type="button" onClick={() => void copyWebhook(mainAccount.webhookUrl!)} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium">{copied ? "Copied" : "Copy webhook URL"}</button>
                </div>
                <p className="mt-2 text-xs text-[var(--app-text-secondary)]">LINE Official Account Manager → Messaging API → Webhook URL → replace the Kaojao URL → Save. Then send one test message to the OA.</p>
              </div>
            ) : (
              <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">PUBLIC_WEBHOOK_BASE_URL is not configured on the backend. Do not cut over the LINE webhook yet.</div>
            )}
            {mainAccount.lastConnectionError && <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{mainAccount.lastConnectionError}</div>}
          </section>
        )}

        {setupError && mainAccount && <div role="alert" className="mx-auto mb-3 max-w-7xl rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{setupError}</div>}
        {error && <div role="alert" className="mx-auto mb-3 max-w-7xl rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{error}</div>}
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] md:grid-cols-[360px_1fr]">
          <section className="border-r border-[var(--app-border)]"><div className="border-b border-[var(--app-border)] p-4 font-semibold">Inbox <span className="text-[var(--app-text-tertiary)]">({items.length})</span></div>{items.map((item) => <button type="button" key={item.id} onClick={() => void choose(item.id)} className={`block w-full border-b border-[var(--app-border-subtle)] p-4 text-left hover:bg-[var(--app-surface-hover)] ${selected?.id === item.id ? "bg-[var(--app-accent-soft)]" : ""}`}><div className="font-medium">{item.customer.displayName}</div><div className="truncate text-sm text-[var(--app-text-secondary)]">{item.messages?.[0]?.messageType === "STICKER" ? lineStickerLabel(language) : item.messages?.[0]?.originalText ?? "No message preview"}</div></button>)}</section>
          <section className="flex min-h-[70vh] flex-col">{selected ? <><div className="border-b border-[var(--app-border)] p-4"><h2 className="font-semibold">{selected.customer.displayName}</h2><p className="text-xs text-[var(--app-text-secondary)]">{selected.lineOfficialAccount.name}</p></div><div className="flex-1 space-y-3 overflow-auto p-5">{[...(selected.messages ?? [])].reverse().map((message) => { const senderName = getMessageSenderName(message); return <div key={message.id} className={`max-w-[75%] rounded-xl p-3 text-sm ${message.direction === "OUTBOUND" ? "ml-auto bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface-subtle)]"}`}>{senderName && <div data-message-sender className="mb-1 text-xs font-semibold opacity-80">{senderName}</div>}{message.messageType === "STICKER" ? <MessageSticker sticker={message.sticker} language={language} /> : message.originalText}</div>; })}</div><div className="flex gap-2 border-t border-[var(--app-border)] p-4"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply as Main OA" className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"/><button type="button" onClick={() => void send()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 font-medium text-white">Send</button></div></> : <div className="m-auto p-6 text-[var(--app-text-secondary)]">{mainAccount ? "No Main OA conversations yet. After changing the LINE webhook, send a test message to this OA." : "Connect Main OA to start receiving conversations."}</div>}</section>
        </div>
      </main>
    </AppShell>
  );
}
