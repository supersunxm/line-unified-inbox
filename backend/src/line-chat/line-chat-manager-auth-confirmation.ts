export type LineManagerAuthObservation = {
  authenticated: "YES" | "NO" | "UNKNOWN";
  status?: number;
  transport?: "SUCCEEDED" | "FAILED";
};

export type LineManagerAuthConfirmation = {
  outcome: "AUTHENTICATED" | "AUTH_EXPIRED" | "INCONCLUSIVE";
  attempts: number;
  observations: LineManagerAuthObservation[];
};

export const LINE_MANAGER_AUTH_CONFIRMATION_ATTEMPTS = 3;
const LINE_MANAGER_AUTH_CONFIRMATION_DELAYS_MS = [350, 750] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Treats a single ambiguous or transient /api/v1/me result as inconclusive,
 * not as proof that the persistent Manager session expired. A session is only
 * classified as expired after every bounded confirmation attempt returns a
 * definitive authenticated=NO result. Relay callers remain fail-closed for an
 * inconclusive result; they simply avoid telling the user to log in again.
 */
export async function confirmLineManagerAuthentication(
  probe: () => Promise<LineManagerAuthObservation>,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<LineManagerAuthConfirmation> {
  const observations: LineManagerAuthObservation[] = [];

  for (let attempt = 0; attempt < LINE_MANAGER_AUTH_CONFIRMATION_ATTEMPTS; attempt += 1) {
    let observation: LineManagerAuthObservation;
    try {
      observation = await probe();
    } catch {
      observation = { authenticated: "UNKNOWN", transport: "FAILED" };
    }
    observations.push({
      authenticated: observation.authenticated,
      status: observation.status,
      transport: observation.transport,
    });

    if (observation.authenticated === "YES") {
      return { outcome: "AUTHENTICATED", attempts: observations.length, observations };
    }

    if (attempt < LINE_MANAGER_AUTH_CONFIRMATION_ATTEMPTS - 1) {
      await wait(LINE_MANAGER_AUTH_CONFIRMATION_DELAYS_MS[attempt] ?? 750);
    }
  }

  const everyAttemptDefinitivelyUnauthenticated = observations.every(
    (observation) => observation.authenticated === "NO",
  );
  return {
    outcome: everyAttemptDefinitivelyUnauthenticated ? "AUTH_EXPIRED" : "INCONCLUSIVE",
    attempts: observations.length,
    observations,
  };
}
