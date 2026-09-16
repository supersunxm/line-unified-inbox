"use client";

import { AuthorizedSection } from "../../authorized-workspace";
import { GreetingManagementView } from "../greeting-management-view";

export default function GreetingManagementPage() {
  return (
    <AuthorizedSection section="greeting-messages">
      <GreetingManagementView />
    </AuthorizedSection>
  );
}
