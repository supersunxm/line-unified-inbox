import type { Metadata } from "next";
import { TermsContent } from "./terms-content";

export const metadata: Metadata = {
  title: {
    absolute: "Terms of Service | OPPO Brand Shop",
  },
  description: "Terms of Service for OPPO Retail TikTok Monitor. Available in Thai, English, and Chinese.",
};

export default function TermsOfServicePage() {
  return <TermsContent />;
}
