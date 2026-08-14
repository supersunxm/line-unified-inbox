export function getSafeTikTokErrorMessage(error: string | null, errorDescription: string | null): string {
  if (!error) return "An unknown error occurred during authorization.";

  const normalized = error.toLowerCase().trim();

  if (normalized === "access_denied") {
    return "Authorization was cancelled or declined by the account owner.";
  }
  if (normalized === "invalid_scope") {
    return "The requested authorization permissions are invalid or unsupported.";
  }
  if (normalized === "unauthorized_client") {
    return "The client application is not authorized to request an authorization code.";
  }
  if (normalized === "server_error") {
    return "The TikTok authorization service encountered a temporary server error. Please try again later.";
  }
  if (normalized === "temporarily_unavailable") {
    return "The TikTok authorization service is temporarily unavailable. Please try again later.";
  }

  // Safe fallback without reflecting untrusted or structured payloads directly
  if (errorDescription && errorDescription.length < 150 && !errorDescription.includes("<") && !errorDescription.includes("{")) {
    return `Authorization failed: ${errorDescription.trim()}`;
  }

  return "TikTok authorization could not be completed. Please return to the dashboard and try connecting again.";
}
