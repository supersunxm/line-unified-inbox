"use client";

import type { ReactNode } from "react";
import { AuthorizedSection } from "../authorized-workspace";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthorizedSection section="dashboard">{children}</AuthorizedSection>;
}
