import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("อัตราตอบกลับ 24 ชม.") };

export default function ReplyMessageLayout({ children }: { children: ReactNode }) {
  return children;
}
