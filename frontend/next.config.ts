import type { NextConfig } from "next";
import { API_BASE_URL } from "./src/lib/runtime-config.ts";

export function createFriendSourceLinkRewrite(apiBaseUrl: string) {
  return {
    source: "/f/:shortCode",
    destination: `${apiBaseUrl}/f/:shortCode`,
  };
}

export function createAuthRewrite(apiBaseUrl: string) {
  return {
    source: "/auth/:path*",
    destination: `${apiBaseUrl}/auth/:path*`,
  };
}

export function createBackendRewrite(apiBaseUrl: string) {
  return {
    source: "/api-backend/:path*",
    destination: `${apiBaseUrl}/:path*`,
  };
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      createFriendSourceLinkRewrite(API_BASE_URL),
      createAuthRewrite(API_BASE_URL),
      createBackendRewrite(API_BASE_URL),
    ];
  },
};

export default nextConfig;
