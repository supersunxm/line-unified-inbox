import type { NextConfig } from "next";
import { API_BASE_URL } from "./src/lib/runtime-config.ts";

export function createFriendSourceLinkRewrite(apiBaseUrl: string) {
  return {
    source: "/f/:shortCode",
    destination: `${apiBaseUrl}/f/:shortCode`,
  };
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [createFriendSourceLinkRewrite(API_BASE_URL)];
  },
};

export default nextConfig;
