"use client";

import { AuthorizedSection } from "../authorized-workspace";
import { RichMessagesView } from "./rich-messages-view";

export default function RichMessagesPage() {
  return (
    <AuthorizedSection section="greeting-messages">
      <RichMessagesView />
    </AuthorizedSection>
  );
}
