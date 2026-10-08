// Home's data-health line: which parts of the system are down (GET /operations/status). Pure.

export type SystemStatusLike = { backendApi: string; database: string; lineWebhookEnabled: boolean };
export type SystemProblem = "backend" | "database" | "webhook";

const healthyText = (value: string | undefined) => Boolean(value && /\b(ok|healthy|up|connected)\b/i.test(value));

/** The parts of the system that are down, or [] when everything is up (Home then shows "ระบบปกติ"). */
export function systemProblems(status: SystemStatusLike): SystemProblem[] {
  return [
    ...(healthyText(status.backendApi) ? [] : ["backend" as const]),
    ...(healthyText(status.database) ? [] : ["database" as const]),
    ...(status.lineWebhookEnabled ? [] : ["webhook" as const]),
  ];
}
