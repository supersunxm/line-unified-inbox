import { BadRequestException } from "@nestjs/common";

export function normalizeThaiMobilePhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const normalized = compact.startsWith("+")
    ? `+${compact.slice(1).replace(/\D/g, "")}`
    : compact.replace(/\D/g, "").startsWith("0")
      ? `+66${compact.replace(/\D/g, "").slice(1)}`
      : `+${compact.replace(/\D/g, "")}`;
  if (!/^\+66\d{9}$/.test(normalized)) throw new BadRequestException("A valid Thai mobile phone number is required");
  return normalized;
}
