export function emailFromAddress(environment: NodeJS.ProcessEnv = process.env) {
  return environment.EMAIL_FROM_ADDRESS?.trim() || environment.EMAIL_FROM?.trim() || "";
}
