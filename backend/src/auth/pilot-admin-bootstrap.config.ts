export const PILOT_ADMIN_INTERNAL_EMAIL = "pilot-admin@internal.invalid";

const commonPasswords = new Set([
  "admin123",
  "password",
  "password123",
  "12345678",
]);

export type PilotAdminBootstrapConfig = {
  username: string;
  password: string;
  displayName: string;
};

export function normalizePilotAdminUsername(value: string) {
  return value.trim().toLowerCase();
}

export function readPilotAdminBootstrapConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PilotAdminBootstrapConfig | null {
  if (
    environment.NODE_ENV !== "production" ||
    environment.PILOT_MODE !== "true" ||
    environment.PILOT_ADMIN_BOOTSTRAP_ENABLED !== "true"
  ) {
    return null;
  }

  const username = normalizePilotAdminUsername(
    environment.PILOT_ADMIN_USERNAME ?? "",
  );
  const password = environment.PILOT_ADMIN_PASSWORD ?? "";
  const displayName =
    environment.PILOT_ADMIN_DISPLAY_NAME?.trim() || "Pilot Admin";

  if (!username) {
    throw new Error(
      "PILOT_ADMIN_USERNAME is required when pilot admin bootstrap is enabled",
    );
  }
  if (!password.trim()) {
    throw new Error(
      "PILOT_ADMIN_PASSWORD is required when pilot admin bootstrap is enabled",
    );
  }
  if (commonPasswords.has(password.trim().toLowerCase())) {
    throw new Error("PILOT_ADMIN_PASSWORD is a common password and is not allowed");
  }
  if (password.length < 12) {
    throw new Error("PILOT_ADMIN_PASSWORD must contain at least 12 characters");
  }

  return { username, password, displayName };
}
