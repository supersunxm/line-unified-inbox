"use client";

import { notFound } from "next/navigation";
import { ChatMessageSearchPanel } from "@/components/chats/message-search/chat-message-search-panel";
import { createSyntheticChatMessageSearchAdapter } from "@/components/chats/message-search/message-search-adapter";
import { createHttpChatMessageSearchAdapter } from "@/components/chats/message-search/message-search-http-adapter";
import {
  isChatMessageSearchUiEnabled,
  resolveMessageSearchDataMode,
  selectMessageSearchAdapterKind,
} from "@/components/chats/message-search/message-search-config";
import { messageSearchCopy } from "@/components/chats/message-search/message-search-copy";
import { AuthorizedSection } from "../../authorized-workspace";
import { useAppLanguage } from "../../language";

// Adapters are created at module load. Neither performs a request until the panel calls it.
const SYNTHETIC_ADAPTER = createSyntheticChatMessageSearchAdapter();
const BACKEND_ADAPTER = createHttpChatMessageSearchAdapter();

/**
 * Global message search route (WP3). Disabled by default: when the frontend flag is off the route
 * returns 404 and renders no search functionality. Synthetic mode renders sample data only and makes
 * no requests, so it skips the auth check, which calls the production /auth/me endpoint. Backend mode
 * keeps the existing authorization wrapper; the server enforces store scope.
 */
export default function ChatMessageSearchPage() {
  const { language } = useAppLanguage();
  const copy = messageSearchCopy(language);
  const hostname = typeof window === "undefined" ? undefined : window.location.hostname;
  const kind = selectMessageSearchAdapterKind({
    enabled: isChatMessageSearchUiEnabled(process.env.NEXT_PUBLIC_CHAT_MESSAGE_SEARCH_UI),
    mode: resolveMessageSearchDataMode(process.env.NEXT_PUBLIC_CHAT_MESSAGE_SEARCH_DATA),
    appEnv: process.env.NEXT_PUBLIC_APP_ENV,
    nodeEnv: process.env.NODE_ENV,
    hostname,
  });
  if (kind === null) notFound();

  if (kind === "synthetic") {
    return <ChatMessageSearchPanel adapter={SYNTHETIC_ADAPTER} language={language} notice={copy.syntheticNotice} />;
  }
  return (
    <AuthorizedSection section="chats">
      <ChatMessageSearchPanel adapter={BACKEND_ADAPTER} language={language} />
    </AuthorizedSection>
  );
}
