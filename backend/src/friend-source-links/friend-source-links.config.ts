export function getFriendSourcePublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.FRIEND_SOURCE_PUBLIC_BASE_URL?.trim();
  if (!raw) {
    if (env.NODE_ENV === "production") {
      throw new Error("Missing required production environment variable: FRIEND_SOURCE_PUBLIC_BASE_URL");
    }
    return "http://localhost:3001";
  }
  if (env.NODE_ENV === "production" && !raw.startsWith("https://")) {
    throw new Error("FRIEND_SOURCE_PUBLIC_BASE_URL must be a valid HTTPS URL in production");
  }
  return raw.replace(/\/+$/, "");
}

export function getFriendSourceIpHashKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.FRIEND_SOURCE_IP_HASH_KEY?.trim();
  if (!key) {
    if (env.NODE_ENV === "production") {
      throw new Error("Missing required production environment variable: FRIEND_SOURCE_IP_HASH_KEY");
    }
    return null;
  }
  return key;
}
