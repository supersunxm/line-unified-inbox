"use client";

import { AuthorizedSection } from "../../authorized-workspace";
import { LineChatHealthView } from "./line-chat-health-view";
import { LineChatNovncRecoveryAction } from "./line-chat-novnc-recovery-action";
import { LineChatPendingControlAction } from "./line-chat-pending-control-action";
import { LineChatHealthRuntime } from "./line-chat-health-runtime";

export default function LineChatHealthPage() {
  return (
    <AuthorizedSection section="line-chat-health">
      <LineChatHealthRuntime>
        <LineChatHealthView />
        <LineChatNovncRecoveryAction sessionKey="account-1" />
        <LineChatNovncRecoveryAction sessionKey="profile-b" />
        <LineChatPendingControlAction />
      </LineChatHealthRuntime>
    </AuthorizedSection>
  );
}
