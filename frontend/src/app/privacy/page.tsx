import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: {
    absolute: "Privacy Policy | OPPO Brand Shop",
  },
  description: "Privacy Policy for OPPO Retail TikTok Monitor. Available in Thai, English, and Chinese.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyContent />;
}
