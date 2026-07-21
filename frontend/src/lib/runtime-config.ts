const LOCAL_API_BASE_URL = "http://127.0.0.1:3001";

export function resolveApiBaseUrl(configuredUrl: string | undefined, appEnvironment: string | undefined) {
  const value = configuredUrl?.trim();

  if (!value) {
    if (appEnvironment === "production") {
      throw new Error("NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_APP_ENV=production");
    }
    return LOCAL_API_BASE_URL;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL");
  }

  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an origin without credentials, path, query, or fragment");
  }
  if (appEnvironment === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must use HTTPS in production");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must use HTTP or HTTPS");
  }

  return url.origin;
}

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NEXT_PUBLIC_APP_ENV,
);
