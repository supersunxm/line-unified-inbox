import { BadRequestException } from "@nestjs/common";

export const PASSWORD_POLICY_MESSAGE = "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a special character";
export const PASSWORD_POLICY_PATTERN = /^(?=.{12,}$)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9\s]).*$/;
export const PASSWORD_POLICY_REQUIREMENTS = [
  "At least 12 characters",
  "At least one uppercase letter (A-Z)",
  "At least one lowercase letter (a-z)",
  "At least one number (0-9)",
  "At least one special character",
] as const;

export function isPasswordPolicyCompliant(password: string): boolean {
  return typeof password === "string" && PASSWORD_POLICY_PATTERN.test(password);
}

export function assertPasswordPolicy(password: string): void {
  if (isPasswordPolicyCompliant(password)) return;
  throw new BadRequestException({
    code: "PASSWORD_POLICY_VIOLATION",
    message: PASSWORD_POLICY_MESSAGE,
    requirements: PASSWORD_POLICY_REQUIREMENTS,
  });
}
