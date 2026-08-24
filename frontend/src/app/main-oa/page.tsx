"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiConversation } from "@/types/api";

export default function MainOaPage() {
  const [items, setItems] = useState<ApiConversation[]>([]);
  const [selected, setSelected] = useState<ApiConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  useEffect(() => { void api.mainOaConversations({ pageSize: 100 }).then(async (result) => { setItems(result.items); if (result.items[0]) setSelected(await api.mainOaConversation(result.items[0].id)); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load Main OA")); }, []);
  const choose = async (id: string) => { try { setSelected(await api.mainOaConversation(id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load conversation"); } };
  const send = async () => { if (!selected || !reply.trim()) return; try { await api.sendMainOaMessage(selected.id, reply.trim(), crypto.randomUUID()); setReply(""); setSelected(await api.mainOaConversation(selected.id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to send reply"); } };
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
    <header className="mx-auto mb-4 flex max-w-7xl items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Workspace</p><h1 className="text-2xl font-bold">Main OA</h1><p className="text-sm text-slate-500">Head office inbox — isolated from Branch Stores</p></div><a href="/chats" className="rounded-lg border bg-white px-3 py-2 text-sm">Switch to Branch Stores</a></header>
    {error && <div role="alert" className="mx-auto mb-3 max-w-7xl rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="mx-auto grid max-w-7xl overflow-hidden rounded-xl border bg-white shadow-sm md:grid-cols-[360px_1fr]">
      <section className="border-r"><div className="border-b p-4 font-semibold">Inbox <span className="text-slate-400">({items.length})</span></div>{items.map((item) => <button key={item.id} onClick={() => void choose(item.id)} className={`block w-full border-b p-4 text-left hover:bg-slate-50 ${selected?.id === item.id ? "bg-emerald-50" : ""}`}><div className="font-medium">{item.customer.displayName}</div><div className="truncate text-sm text-slate-500">{item.messages?.[0]?.originalText ?? "No message preview"}</div></button>)}</section>
      <section className="flex min-h-[70vh] flex-col">{selected ? <><div className="border-b p-4"><h2 className="font-semibold">{selected.customer.displayName}</h2><p className="text-xs text-slate-500">{selected.lineOfficialAccount.name}</p></div><div className="flex-1 space-y-3 overflow-auto p-5">{[...(selected.messages ?? [])].reverse().map((message) => <div key={message.id} className={`max-w-[75%] rounded-xl p-3 text-sm ${message.direction === "OUTBOUND" ? "ml-auto bg-emerald-600 text-white" : "bg-slate-100"}`}>{message.originalText}</div>)}</div><div className="flex gap-2 border-t p-4"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply as Main OA" className="flex-1 rounded-lg border px-3 py-2"/><button onClick={() => void send()} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">Send</button></div></> : <div className="m-auto text-slate-500">Select a Main OA conversation</div>}</section>
    </div>
  </main>;
}
