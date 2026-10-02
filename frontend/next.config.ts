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

export function createGoogleReviewApiRewrite(apiBaseUrl: string) {
  return [
    {
      source: "/google-review-kpi/check-result",
      destination: `${apiBaseUrl}/google-review-kpi/check-result`,
    },
    {
      source: "/google-review-kpi/audit-session/:path*",
      destination: `${apiBaseUrl}/google-review-kpi/audit-session/:path*`,
    },
  ];
}

export function createReview15Rewrites() {
  return [
    {
      source: "/%E0%B8%A3%E0%B8%B5%E0%B8%A7%E0%B8%B4%E0%B8%A715%E0%B8%84%E0%B8%B3",
      destination: "/review15",
    },
    {
      source: "/%E0%B8%A3%E0%B8%B5%E0%B8%A7%E0%B8%B4%E0%B8%A715",
      destination: "/review15",
    },
  ];
}

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/downloads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      createFriendSourceLinkRewrite(API_BASE_URL),
      createAuthRewrite(API_BASE_URL),
      createBackendRewrite(API_BASE_URL),
      ...createGoogleReviewApiRewrite(API_BASE_URL),
      ...createReview15Rewrites(),
    ];
  },
};

export default nextConfig;
