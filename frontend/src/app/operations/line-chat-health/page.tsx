"use client";

import { AuthorizedSection } from "../../authorized-workspace";
import { LineChatHealthView } from "./line-chat-health-view";
import { LineChatNovncRecoveryAction } from "./line-chat-novnc-recovery-action";
import { LineChatPendingControlAction } from "./line-chat-pending-control-action";

export default function LineChatHealthPage() {
  return (
    <AuthorizedSection section="line-chat-health">
      <LineChatHealthView />
      <LineChatNovncRecoveryAction />
      <LineChatPendingControlAction />
    </AuthorizedSection>
  );
}
