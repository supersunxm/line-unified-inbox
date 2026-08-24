"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";
import { api } from "@/lib/api";
import type { ApiConversation } from "@/types/api";

type Language = "th" | "en" | "zh";
type AuthUser = Awaited<ReturnType<typeof api.me>>;

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

  useEffect(() => {
    let cancelled = false;
    void api.me().then((user) => {
      if (cancelled) return;
      if (!user.permissions?.canAccessMainOa) {
        router.replace("/home");
        return;
      }
      setAuthUser(user);
      setAuthChecked(true);
      void load();
    }).catch(() => {
      if (cancelled) return;
      setAuthChecked(true);
      router.replace("/login");
    });
    return () => { cancelled = true; };
  }, [load, router]);

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

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { router.replace("/login"); }
  }, [router]);

  if (!authChecked || !authUser) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">Opening Main OA…</main>;
  }

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
          <Link href="/chats" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium">Switch to Branch Stores</Link>
        </header>
        {error && <div role="alert" className="mx-auto mb-3 max-w-7xl rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{error}</div>}
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] md:grid-cols-[360px_1fr]">
          <section className="border-r border-[var(--app-border)]"><div className="border-b border-[var(--app-border)] p-4 font-semibold">Inbox <span className="text-[var(--app-text-tertiary)]">({items.length})</span></div>{items.map((item) => <button type="button" key={item.id} onClick={() => void choose(item.id)} className={`block w-full border-b border-[var(--app-border-subtle)] p-4 text-left hover:bg-[var(--app-surface-hover)] ${selected?.id === item.id ? "bg-[var(--app-accent-soft)]" : ""}`}><div className="font-medium">{item.customer.displayName}</div><div className="truncate text-sm text-[var(--app-text-secondary)]">{item.messages?.[0]?.originalText ?? "No message preview"}</div></button>)}</section>
          <section className="flex min-h-[70vh] flex-col">{selected ? <><div className="border-b border-[var(--app-border)] p-4"><h2 className="font-semibold">{selected.customer.displayName}</h2><p className="text-xs text-[var(--app-text-secondary)]">{selected.lineOfficialAccount.name}</p></div><div className="flex-1 space-y-3 overflow-auto p-5">{[...(selected.messages ?? [])].reverse().map((message) => <div key={message.id} className={`max-w-[75%] rounded-xl p-3 text-sm ${message.direction === "OUTBOUND" ? "ml-auto bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface-subtle)]"}`}>{message.originalText}</div>)}</div><div className="flex gap-2 border-t border-[var(--app-border)] p-4"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply as Main OA" className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"/><button type="button" onClick={() => void send()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 font-medium text-white">Send</button></div></> : <div className="m-auto p-6 text-[var(--app-text-secondary)]">No Main OA conversations yet.</div>}</section>
        </div>
      </main>
    </AppShell>
  );
}
