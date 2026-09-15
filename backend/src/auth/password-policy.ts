import { BadRequestException } from "@nestjs/common";

export const PASSWORD_POLICY_MESSAGE = "Password must be at least 8 characters and include at least one letter and one number";
export const PASSWORD_POLICY_PATTERN = /^(?=.{8,}$)(?=.*\p{L})(?=.*[0-9]).*$/u;
export const PASSWORD_POLICY_REQUIREMENTS = [
  "At least 8 characters",
  "At least one letter",
  "At least one number (0-9)",
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
