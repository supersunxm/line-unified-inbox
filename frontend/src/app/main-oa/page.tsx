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
import { LanguageControl, pickLanguageText, useAppLanguage } from "../language";

const mainOaTranslations = {
  th: {
    appDescription: "กล่องข้อความ Main OA",
    searchPlaceholder: "ค้นหาบทสนทนา Main OA",
    loadFailed: "ไม่สามารถโหลด Main OA ได้",
    loadConnectionFailed: "ไม่สามารถโหลดสถานะการเชื่อมต่อ Main OA ได้",
    conversationLoadFailed: "ไม่สามารถโหลดบทสนทนาได้",
    sendFailed: "ส่งข้อความตอบกลับไม่สำเร็จ",
    required: "จำเป็นต้องกรอกชื่อบัญชี, Channel ID และ Channel Secret",
    connectFailed: "เชื่อมต่อ Main OA ไม่สำเร็จ",
    opening: "กำลังเปิด Main OA…",
    workspace: "Main OA Workspace",
    title: "Main OA",
    subtitle: "กล่องข้อความสำนักงานใหญ่ — แยกจาก Store Operations",
    switchStores: "สลับไปยังร้านสาขา",
    connectApi: "เชื่อมต่อ Messaging API",
    connectTitle: "เชื่อมต่อ Main OA โดยไม่ต้องใช้ Channel Access Token เดิม",
    connectDescription: "กรอก Channel ID และ Channel Secret จาก LINE Official Account Manager ระบบ backend จะตรวจสอบกับ LINE, สร้าง stateless token แบบอายุสั้น, เข้ารหัส และหมุน token ให้อัตโนมัติ โดยจะไม่ส่ง secret กลับมาที่หน้านี้",
    accountName: "ชื่อบัญชี",
    channelId: "Channel ID",
    channelSecret: "Channel Secret",
    verifying: "กำลังตรวจสอบกับ LINE…",
    verifyConnect: "ตรวจสอบและเชื่อมต่อ Main OA",
    tokenManaged: "Stateless token · จัดการอัตโนมัติ",
    nextWebhook: "ขั้นตอนถัดไป: เปลี่ยน Webhook URL เดิมของ Kaojao เป็น URL นี้",
    copied: "คัดลอกแล้ว",
    copyWebhook: "คัดลอก Webhook URL",
    webhookInstruction: "LINE Official Account Manager → Messaging API → Webhook URL → เปลี่ยน URL ของ Kaojao → Save จากนั้นส่งข้อความทดสอบ 1 ข้อความเข้าบัญชี OA",
    webhookMissing: "ยังไม่ได้ตั้งค่า PUBLIC_WEBHOOK_BASE_URL ที่ backend กรุณาอย่าเพิ่งสลับ LINE webhook",
    inbox: "กล่องข้อความ",
    noPreview: "ไม่มีตัวอย่างข้อความ",
    replyPlaceholder: "ตอบกลับในนาม Main OA",
    send: "ส่ง",
    noConversationConnected: "ยังไม่มีบทสนทนา Main OA หลังเปลี่ยน LINE webhook แล้วให้ส่งข้อความทดสอบเข้าบัญชี OA นี้",
    connectToStart: "เชื่อมต่อ Main OA เพื่อเริ่มรับบทสนทนา",
  },
  en: {
    appDescription: "Main OA inbox",
    searchPlaceholder: "Search Main OA conversations",
    loadFailed: "Unable to load Main OA",
    loadConnectionFailed: "Unable to load Main OA connection status",
    conversationLoadFailed: "Unable to load conversation",
    sendFailed: "Unable to send reply",
    required: "Account name, Channel ID, and Channel Secret are required.",
    connectFailed: "Unable to connect Main OA",
    opening: "Opening Main OA…",
    workspace: "Main OA workspace",
    title: "Main OA",
    subtitle: "Head office inbox — isolated from Store Operations",
    switchStores: "Switch to Branch Stores",
    connectApi: "Connect Messaging API",
    connectTitle: "Connect Main OA without an old Channel Access Token",
    connectDescription: "Enter the Channel ID and Channel Secret from LINE Official Account Manager. The backend verifies them with LINE, creates a short-lived stateless token, encrypts it, and rotates it automatically. The secret is never returned to this page.",
    accountName: "Account name",
    channelId: "Channel ID",
    channelSecret: "Channel Secret",
    verifying: "Verifying with LINE…",
    verifyConnect: "Verify & Connect Main OA",
    tokenManaged: "Stateless token · Auto managed",
    nextWebhook: "Next: replace the old Kaojao Webhook URL with this URL",
    copied: "Copied",
    copyWebhook: "Copy webhook URL",
    webhookInstruction: "LINE Official Account Manager → Messaging API → Webhook URL → replace the Kaojao URL → Save. Then send one test message to the OA.",
    webhookMissing: "PUBLIC_WEBHOOK_BASE_URL is not configured on the backend. Do not cut over the LINE webhook yet.",
    inbox: "Inbox",
    noPreview: "No message preview",
    replyPlaceholder: "Reply as Main OA",
    send: "Send",
    noConversationConnected: "No Main OA conversations yet. After changing the LINE webhook, send a test message to this OA.",
    connectToStart: "Connect Main OA to start receiving conversations.",
  },
  zh: {
    appDescription: "Main OA 收件箱",
    searchPlaceholder: "搜索 Main OA 对话",
    loadFailed: "无法加载 Main OA",
    loadConnectionFailed: "无法加载 Main OA 连接状态",
    conversationLoadFailed: "无法加载对话",
    sendFailed: "回复发送失败",
    required: "必须填写账户名称、Channel ID 和 Channel Secret。",
    connectFailed: "无法连接 Main OA",
    opening: "正在打开 Main OA…",
    workspace: "Main OA 工作区",
    title: "Main OA",
    subtitle: "总部门店收件箱 — 与 Store Operations 数据隔离",
    switchStores: "切换到分店",
    connectApi: "连接 Messaging API",
    connectTitle: "无需旧 Channel Access Token 即可连接 Main OA",
    connectDescription: "请输入 LINE Official Account Manager 中的 Channel ID 和 Channel Secret。后端会向 LINE 验证信息、创建短期 stateless token、加密保存并自动轮换。Secret 不会返回到此页面。",
    accountName: "账户名称",
    channelId: "Channel ID",
    channelSecret: "Channel Secret",
    verifying: "正在通过 LINE 验证…",
    verifyConnect: "验证并连接 Main OA",
    tokenManaged: "Stateless token · 自动管理",
    nextWebhook: "下一步：将旧的 Kaojao Webhook URL 替换为此 URL",
    copied: "已复制",
    copyWebhook: "复制 Webhook URL",
    webhookInstruction: "LINE Official Account Manager → Messaging API → Webhook URL → 替换 Kaojao URL → 保存，然后向 OA 发送一条测试消息。",
    webhookMissing: "后端尚未配置 PUBLIC_WEBHOOK_BASE_URL，请暂时不要切换 LINE webhook。",
    inbox: "收件箱",
    noPreview: "无消息预览",
    replyPlaceholder: "以 Main OA 身份回复",
    send: "发送",
    noConversationConnected: "目前还没有 Main OA 对话。切换 LINE webhook 后，请向此 OA 发送一条测试消息。",
    connectToStart: "连接 Main OA 后即可开始接收对话。",
  },
};

export default function MainOaPage() {
  const router = useRouter();
  const { language, setLanguage } = useAppLanguage();
  const t = pickLanguageText(language, mainOaTranslations);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
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
      setError(reason instanceof Error ? reason.message : t.loadFailed);
    }
  }, [t.loadFailed]);

  const loadAccounts = useCallback(async () => {
    try {
      setSetupError(null);
      setAccounts(await getMainOaAccounts());
    } catch (reason: unknown) {
      setSetupError(reason instanceof Error ? reason.message : t.loadConnectionFailed);
    } finally {
      setAccountsLoaded(true);
    }
  }, [t.loadConnectionFailed]);

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
      setError(reason instanceof Error ? reason.message : t.conversationLoadFailed);
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
      setError(reason instanceof Error ? reason.message : t.sendFailed);
    }
  };

  const connectMainOa = async () => {
    if (!setupName.trim() || !channelId.trim() || !channelSecret.trim()) {
      setSetupError(t.required);
      return;
    }
    setConnecting(true);
    setSetupError(null);
    try {
      const created = await createMainOaAccount({ name: setupName.trim(), channelId: channelId.trim(), channelSecret: channelSecret.trim() });
      setChannelSecret("");
      setAccounts([created]);
      setCopied(false);
      await load();
    } catch (reason: unknown) {
      setSetupError(reason instanceof Error ? reason.message : t.connectFailed);
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
    return <main className="relative flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]"><LanguageControl className="absolute right-4 top-4" />{t.opening}</main>;
  }

  const authorization = authorizationFor(authUser);
  const mainAccount = accounts[0] ?? null;

  return (
    <AppShell currentSection="main-oa" authUser={authUser} text={{ appName: "OPPO LINE OA Monitor", appDescription: t.appDescription, searchPlaceholder: t.searchPlaceholder }} language={language} changeLanguage={setLanguage} searchText={searchText} setSearchText={setSearchText} logout={logout}>
      <main className="min-w-0 flex-1 bg-[var(--app-bg)] p-4 text-[var(--app-text-primary)] sm:p-6">
        <header className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-accent)]">{t.workspace}</p><h1 className="text-2xl font-bold">{t.title}</h1><p className="text-sm text-[var(--app-text-secondary)]">{t.subtitle}</p></div>
          {authorization.workspaces.store && <Link href="/chats" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium">{t.switchStores}</Link>}
        </header>

        {accountsLoaded && !mainAccount && authorization.capabilities.manageMainOa && (
          <section className="mx-auto mb-4 max-w-7xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-sm)]">
            <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-accent)]">{t.connectApi}</p><h2 className="text-lg font-bold">{t.connectTitle}</h2><p className="mt-1 max-w-3xl text-sm text-[var(--app-text-secondary)]">{t.connectDescription}</p></div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">{t.accountName}<input value={setupName} onChange={(event) => setSetupName(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium">{t.channelId}<input value={channelId} onChange={(event) => setChannelId(event.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium">{t.channelSecret}<input type="password" autoComplete="off" value={channelSecret} onChange={(event) => setChannelSecret(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 font-normal" /></label>
            </div>
            {setupError && <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{setupError}</div>}
            <button type="button" disabled={connecting} onClick={() => void connectMainOa()} className="mt-4 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{connecting ? t.verifying : t.verifyConnect}</button>
          </section>
        )}

        {mainAccount && (
          <section className="mx-auto mb-4 max-w-7xl rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[var(--app-shadow-sm)]">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{mainAccount.name}</h2><span className="rounded-full bg-[var(--app-accent-soft)] px-2 py-1 text-xs font-semibold text-[var(--app-accent)]">{t.tokenManaged}</span><span className="rounded-full border border-[var(--app-border)] px-2 py-1 text-xs">{mainAccount.connectionStatus}</span></div><p className="mt-1 text-xs text-[var(--app-text-secondary)]">Channel ID: {mainAccount.channelId ?? "—"} {mainAccount.basicId ? `· Basic ID: ${mainAccount.basicId}` : ""}</p></div></div>
            {mainAccount.webhookUrl ? <div className="mt-4 rounded-lg bg-[var(--app-surface-subtle)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">{t.nextWebhook}</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input readOnly value={mainAccount.webhookUrl} className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm" /><button type="button" onClick={() => void copyWebhook(mainAccount.webhookUrl!)} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium">{copied ? t.copied : t.copyWebhook}</button></div><p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t.webhookInstruction}</p></div> : <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{t.webhookMissing}</div>}
            {mainAccount.lastConnectionError && <div role="alert" className="mt-3 rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{mainAccount.lastConnectionError}</div>}
          </section>
        )}

        {setupError && mainAccount && <div role="alert" className="mx-auto mb-3 max-w-7xl rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{setupError}</div>}
        {error && <div role="alert" className="mx-auto mb-3 max-w-7xl rounded-lg bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">{error}</div>}
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[var(--app-shadow-sm)] md:grid-cols-[360px_1fr]">
          <section className="border-r border-[var(--app-border)]"><div className="border-b border-[var(--app-border)] p-4 font-semibold">{t.inbox} <span className="text-[var(--app-text-tertiary)]">({items.length})</span></div>{items.map((item) => <button type="button" key={item.id} onClick={() => void choose(item.id)} className={`block w-full border-b border-[var(--app-border-subtle)] p-4 text-left hover:bg-[var(--app-surface-hover)] ${selected?.id === item.id ? "bg-[var(--app-accent-soft)]" : ""}`}><div className="font-medium">{item.customer.displayName}</div><div className="truncate text-sm text-[var(--app-text-secondary)]">{item.messages?.[0]?.messageType === "STICKER" ? lineStickerLabel(language) : item.messages?.[0]?.originalText ?? t.noPreview}</div></button>)}</section>
          <section className="flex min-h-[70vh] flex-col">{selected ? <><div className="border-b border-[var(--app-border)] p-4"><h2 className="font-semibold">{selected.customer.displayName}</h2><p className="text-xs text-[var(--app-text-secondary)]">{selected.lineOfficialAccount.name}</p></div><div className="flex-1 space-y-3 overflow-auto p-5">{[...(selected.messages ?? [])].reverse().map((message) => { const senderName = getMessageSenderName(message); return <div key={message.id} className={`max-w-[75%] rounded-xl p-3 text-sm ${message.direction === "OUTBOUND" ? "ml-auto bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface-subtle)]"}`}>{senderName && <div data-message-sender className="mb-1 text-xs font-semibold opacity-80">{senderName}</div>}{message.messageType === "STICKER" ? <MessageSticker sticker={message.sticker} language={language} /> : message.originalText}</div>; })}</div><div className="flex gap-2 border-t border-[var(--app-border)] p-4"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder={t.replyPlaceholder} className="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"/><button type="button" onClick={() => void send()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 font-medium text-white">{t.send}</button></div></> : <div className="m-auto p-6 text-[var(--app-text-secondary)]">{mainAccount ? t.noConversationConnected : t.connectToStart}</div>}</section>
        </div>
      </main>
    </AppShell>
  );
}
