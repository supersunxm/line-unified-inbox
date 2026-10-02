"use client";

import { AuthorizedSection } from "../../authorized-workspace";
import { InternalPageShell } from "@/components/shell/internal-page-shell";
import { RichMenuOverviewView } from "./rich-menu-overview-view";

export default function RichMenuOverviewPage() {
  return (
    <AuthorizedSection section="rich-menus">
      <InternalPageShell section="rich-menus">
        <RichMenuOverviewView />
      </InternalPageShell>
    </AuthorizedSection>
  );
}
