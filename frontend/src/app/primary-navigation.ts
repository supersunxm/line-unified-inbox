export type PrimarySection = "dashboard" | "stores";

export function primaryNavigationState(section: PrimarySection) {
  return {
    dashboardActive: section === "dashboard",
    storesActive: section === "stores",
    showStoreManagementAction: section === "stores",
  };
}
