import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy | OPPO Retail TikTok Monitor",
  description: "Privacy Policy for OPPO Retail TikTok Monitor. Available in Thai, English, and Chinese.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyContent />;
}
