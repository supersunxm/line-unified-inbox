"use client";

import type { ReactNode } from "react";
import { AuthorizedSection } from "../authorized-workspace";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <AuthorizedSection section="home">{children}</AuthorizedSection>;
}
