"use client";

import { AuthorizedSection } from "../authorized-workspace";
import { InternalPageShell } from "@/components/shell/internal-page-shell";
import { RichMessagesView } from "./rich-messages-view";

export default function RichMessagesPage() {
  return (
    <AuthorizedSection section="greeting-messages">
      <InternalPageShell section="greeting-messages">
        <RichMessagesView />
      </InternalPageShell>
    </AuthorizedSection>
  );
}
