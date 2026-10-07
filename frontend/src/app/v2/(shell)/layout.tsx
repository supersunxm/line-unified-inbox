import type { ReactNode } from "react";
import { V2Layout } from "@/components/v2/v2-layout";

/** Every v2 page with the sidebar and top bar. /v2/report sits outside this group: it prints without chrome. */
export default function V2ShellLayout({ children }: { children: ReactNode }) {
  return <V2Layout>{children}</V2Layout>;
}
