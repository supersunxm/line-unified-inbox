"use client";

import { AuthorizedSection } from "../../authorized-workspace";
import { RichMenuOverviewView } from "./rich-menu-overview-view";

export default function RichMenuOverviewPage() {
  return (
    <AuthorizedSection section="rich-menus">
      <RichMenuOverviewView />
    </AuthorizedSection>
  );
}
