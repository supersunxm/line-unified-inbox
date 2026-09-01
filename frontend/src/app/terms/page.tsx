import type { Metadata } from "next";
import { TermsContent } from "./terms-content";

export const metadata: Metadata = {
  title: "Terms of Service | OPPO Retail TikTok Monitor",
  description: "Terms of Service for OPPO Retail TikTok Monitor. Available in Thai, English, and Chinese.",
};

export default function TermsOfServicePage() {
  return <TermsContent />;
}
