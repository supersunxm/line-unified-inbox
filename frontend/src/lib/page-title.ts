import type { Metadata } from "next";

export const INTERNAL_APP_NAME = "OPPO LINE OA Monitor";

// Internal pages opt out of the root "%s | OPPO Brand Shop" template, which
// belongs to the public store directory.
export function internalPageTitle(pageName: string): NonNullable<Metadata["title"]> {
  return { absolute: `${pageName} · ${INTERNAL_APP_NAME}` };
}
