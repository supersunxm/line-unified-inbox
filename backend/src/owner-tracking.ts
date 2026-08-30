/**
 * Ownership became an operational workflow on 2026-08-30 in the business
 * timezone. Keep the boundary in UTC so comparisons are deterministic on
 * Railway and local development machines alike.
 */
export const OWNER_TRACKING_TIMEZONE = "Asia/Bangkok";
export const OWNER_TRACKING_STARTED_AT = new Date("2026-08-29T17:00:00.000Z");
export const OWNER_TRACKING_STARTED_AT_ISO = OWNER_TRACKING_STARTED_AT.toISOString();

export function ownerTrackingInboundFilter() {
  return {
    direction: "INBOUND" as const,
    createdAt: { gte: OWNER_TRACKING_STARTED_AT },
  };
}

export function isOwnerTrackingInbound(message: { direction: string; createdAt: Date }) {
  return message.direction === "INBOUND" && message.createdAt >= OWNER_TRACKING_STARTED_AT;
}
